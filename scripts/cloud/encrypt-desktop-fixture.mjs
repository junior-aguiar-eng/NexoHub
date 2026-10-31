import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;
const d = JSON.parse(process.argv[2]);
const key = await subtle.importKey(
  "spki",
  Buffer.from(d.publicKey, "hex"),
  { name: "RSA-OAEP", hash: "SHA-256" },
  false,
  ["encrypt"],
);
const aes = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
const nonce = webcrypto.getRandomValues(new Uint8Array(12));
const ciphertext = await subtle.encrypt(
  {
    name: "AES-GCM",
    iv: nonce,
    additionalData: new TextEncoder().encode(`${d.state}:${d.challenge}`),
  },
  aes,
  new TextEncoder().encode(
    JSON.stringify({ idToken: "synthetic-id-token", refreshToken: "synthetic-refresh-token" }),
  ),
);
const wrapped = await subtle.encrypt({ name: "RSA-OAEP" }, key, await subtle.exportKey("raw", aes));
console.log(
  JSON.stringify({
    wrappedKey: Buffer.from(wrapped).toString("hex"),
    nonce: Buffer.from(nonce).toString("hex"),
    ciphertext: Buffer.from(ciphertext).toString("hex"),
  }),
);
