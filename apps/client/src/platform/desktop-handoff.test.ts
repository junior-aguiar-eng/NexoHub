import { webcrypto } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { parseDesktopBinding, sealDesktopSession } from "./desktop-handoff";

afterEach(() => vi.unstubAllGlobals());
it("recusa callbacks com porta, estado, desafio ou parâmetros duplicados inválidos", () => {
  const input = new URL("https://nexojuris.ia.br/hub/cloud/login");
  input.search = new URLSearchParams({
    state: "a".repeat(64),
    challenge: "b".repeat(64),
    publicKey: "c".repeat(588),
    port: "12345",
    method: "google",
  }).toString();
  expect(parseDesktopBinding(input.href).port).toBe(12345);
  for (const [field, value] of [
    ["port", "0"],
    ["state", "bad"],
    ["method", "password"],
  ]) {
    const altered = new URL(input);
    altered.searchParams.set(field, value);
    expect(() => parseDesktopBinding(altered.href)).toThrow();
  }
  input.searchParams.append("port", "12345");
  expect(() => parseDesktopBinding(input.href)).toThrow();
});
it("WebCrypto cifra tokens com RSA-OAEP e AES-GCM ligados ao estado/desafio", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const pair = await webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  const publicKey = Buffer.from(await webcrypto.subtle.exportKey("spki", pair.publicKey)).toString(
    "hex",
  );
  const binding = {
    state: "a".repeat(64),
    challenge: "b".repeat(64),
    publicKey,
    port: 12345,
    method: "google" as const,
  };
  const session = { idToken: "synthetic-id-token", refreshToken: "synthetic-refresh-token" };
  const sealed = await sealDesktopSession(binding, session);
  expect(JSON.stringify(sealed)).not.toContain("synthetic");
  const raw = await webcrypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    pair.privateKey,
    Buffer.from(sealed.wrappedKey, "hex"),
  );
  const key = await webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  const algorithm = {
    name: "AES-GCM",
    iv: Buffer.from(sealed.nonce, "hex"),
    additionalData: new TextEncoder().encode(`${binding.state}:${binding.challenge}`),
  };
  const plain = await webcrypto.subtle.decrypt(
    algorithm,
    key,
    Buffer.from(sealed.ciphertext, "hex"),
  );
  expect(JSON.parse(new TextDecoder().decode(plain))).toEqual(session);
  await expect(
    webcrypto.subtle.decrypt(
      { ...algorithm, additionalData: new TextEncoder().encode("other-instance") },
      key,
      Buffer.from(sealed.ciphertext, "hex"),
    ),
  ).rejects.toThrow();
});
