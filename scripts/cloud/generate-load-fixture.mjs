import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Identidades sintéticas para o ensaio de carga do piloto (300 vagas + 1 excedente).
// Chave efêmera gerada só para assinar estas fixtures públicas; nunca é salva.
// Não são credenciais Google nem contas reais.
const total = 301;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = { ...publicKey.export({ format: "jwk" }), kid: "synthetic-load", alg: "RS256" };
const now = 2_000_000_000;
const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (n, at = now) => {
  const id = String(n).padStart(3, "0");
  const claims = {
    sub: `load-${id}`,
    email: `load-${id}@example.invalid`,
    email_verified: true,
    aud: "demo-nexohub-hybrid",
    iss: "https://securetoken.google.com/demo-nexohub-hybrid",
    exp: at + 3600,
    iat: at - 10,
    auth_time: at - 20,
    firebase: { sign_in_provider: "google.com" },
  };
  const input = `${encoded({ alg: "RS256", kid: key.kid, typ: "JWT" })}.${encoded(claims)}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
};
// Fim da competência de maio de 2033 (America/Los_Angeles, PDT = UTC-7): 1º/jun 00:00 local.
const monthEnd = Date.UTC(2033, 5, 1, 7, 0, 0) / 1000;
const output = {
  note: "Fixtures sintéticas públicas de carga; chave privada descartada. Não são credenciais Google.",
  now,
  jwks: { keys: [key] },
  tokens: Array.from({ length: total }, (_, i) => token(i + 1)),
  // Tokens do participante 1 emitidos em outros instantes, para a virada de mês.
  rollover: {
    monthEnd,
    guardAt: monthEnd - 900,
    guard: token(1, monthEnd - 900),
    nextAt: now + 35 * 86_400,
    next: token(1, now + 35 * 86_400),
  },
};
const dir = resolve("crates/nexohub-server/tests/fixtures");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "firebase-load.json"), `${JSON.stringify(output)}\n`);
