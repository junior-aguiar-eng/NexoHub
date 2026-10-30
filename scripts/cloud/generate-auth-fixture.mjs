import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Chave efêmera gerada apenas para assinar fixtures públicas. Nunca é salva.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = { ...publicKey.export({ format: "jwk" }), kid: "synthetic-test", alg: "RS256" };
const now = 2_000_000_000;
const base = {
  sub: "participant-1",
  email: "person@example.invalid",
  email_verified: true,
  aud: "demo-nexohub-hybrid",
  iss: "https://securetoken.google.com/demo-nexohub-hybrid",
  exp: now + 3600,
  iat: now - 10,
  auth_time: now - 20,
  firebase: { sign_in_provider: "google.com" },
};
const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (changes = {}, headerChanges = {}) => {
  const input = `${encoded({ alg: "RS256", kid: key.kid, typ: "JWT", ...headerChanges })}.${encoded({ ...base, ...changes })}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
};
const output = {
  note: "Fixtures sintéticas públicas; chave privada descartada. Não são credenciais Google.",
  now,
  jwks: { keys: [key] },
  tokens: {
    google: token(),
    otherUid: token({ sub: "participant-2" }),
    otherEmail: token({ email: "alternate@example.invalid" }),
    monthGuard: token({
      exp: 2_001_222_000 + 3600,
      iat: 2_001_222_000 - 900,
      auth_time: 2_001_222_000 - 900,
    }),
    nextMonth: token({ exp: 2_001_222_000 + 3600, iat: 2_001_222_000, auth_time: 2_001_222_000 }),
    futureNotBefore: token({ nbf: now + 1 }),
    emailLink: token({ firebase: { sign_in_provider: "password" } }),
    expired: token({ exp: now }),
    futureIssue: token({ iat: now + 1 }),
    futureAuth: token({ auth_time: now + 1 }),
    wrongAudience: token({ aud: "other-project" }),
    wrongIssuer: token({ iss: "https://example.invalid" }),
    emptyUid: token({ sub: "" }),
    unverified: token({ email_verified: false }),
    anonymous: token({ firebase: { sign_in_provider: "anonymous" } }),
    unknownKey: token({}, { kid: "other-key" }),
    wrongAlgorithm: token({}, { alg: "HS256" }),
  },
};
const dir = resolve("crates/nexohub-server/tests/fixtures");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "firebase-synthetic.json"), `${JSON.stringify(output, null, 2)}\n`);
