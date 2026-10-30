import { CloudIdentityError } from "./cloud-identity";
export interface DesktopBinding {
  state: string;
  challenge: string;
  publicKey: string;
  port: number;
  method: "google" | "emailLink";
}
export interface SessionEnvelope {
  wrappedKey: string;
  nonce: string;
  ciphertext: string;
}
const fail = (): never => {
  throw new CloudIdentityError("AUTH_INVALID_CALLBACK");
};
export function parseDesktopBinding(url: string): DesktopBinding {
  const parsed = new URL(url);
  const p = parsed.searchParams;
  const get = (name: string) => {
    const values = p.getAll(name);
    if (values.length !== 1) return fail();
    return values[0];
  };
  const state = get("state"),
    challenge = get("challenge"),
    publicKey = get("publicKey"),
    port = get("port"),
    method = get("method");
  if (
    !/^[a-f0-9]{64}$/.test(state) ||
    !/^[a-f0-9]{64}$/.test(challenge) ||
    !/^[a-f0-9]{500,1024}$/.test(publicKey) ||
    publicKey.length % 2 !== 0 ||
    !/^\d{4,5}$/.test(port) ||
    Number(port) < 1024 ||
    Number(port) > 65535 ||
    (method !== "google" && method !== "emailLink")
  )
    return fail();
  return { state, challenge, publicKey, port: Number(port), method };
}
const hex = (buffer: ArrayBuffer | Uint8Array) =>
  Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
export async function sealDesktopSession(
  binding: DesktopBinding,
  session: { idToken: string; refreshToken: string },
): Promise<SessionEnvelope> {
  const bytes = Uint8Array.from(binding.publicKey.match(/../g) ?? [], (v) =>
    Number.parseInt(v, 16),
  );
  const publicKey = await crypto.subtle.importKey(
    "spki",
    bytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(session));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: new TextEncoder().encode(`${binding.state}:${binding.challenge}`),
      },
      key,
      plain,
    );
    const wrapped = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      await crypto.subtle.exportKey("raw", key),
    );
    return { wrappedKey: hex(wrapped), nonce: hex(nonce), ciphertext: hex(ciphertext) };
  } finally {
    plain.fill(0);
  }
}
