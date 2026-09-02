import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const expected = process.env.NEXOHUB_RELEASE_VERSION ?? "0.1.0-alpha.1";
const pythonVersion = expected
  .replace(/-alpha\.(\d+)$/, "a$1")
  .replace(/-beta\.(\d+)$/, "b$1")
  .replace(/-rc\.(\d+)$/, "rc$1");
const versionMatch = expected.match(/^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/);
if (!versionMatch) throw new Error(`Versão de release inválida: ${expected}`);
const [, major, minor, patch, channel, sequence] = versionMatch;
const channelBase = { alpha: 1000, beta: 2000, rc: 3000 };
const wixBuild = channel ? channelBase[channel] + Number(sequence) : 4000;
if (wixBuild > 65_535)
  throw new Error(`Sequência de pré-release excede o limite do MSI: ${expected}`);
const expectedWixVersion = `${major}.${minor}.${patch}.${wixBuild}`;

const manifests = [
  "package.json",
  "apps/client/package.json",
  "apps/desktop/package.json",
  "packages/contracts/package.json",
  "packages/domain/package.json",
  "packages/tool-registry/package.json",
  "packages/tool-sdk/package.json",
  "apps/desktop/src-tauri/tauri.conf.json",
];
for (const path of manifests) {
  const actual = readJson(path).version;
  if (actual !== expected) throw new Error(`${path}: versão ${actual}, esperada ${expected}`);
}
const tauri = readJson("apps/desktop/src-tauri/tauri.conf.json");
if (tauri.bundle?.windows?.wix?.version !== expectedWixVersion) {
  throw new Error(
    `tauri.conf.json: versão MSI ${tauri.bundle?.windows?.wix?.version}, esperada ${expectedWixVersion}`,
  );
}

const cargo = readFileSync(resolve(root, "Cargo.lock"), "utf8");
for (const crate of ["nexohub-core", "nexohub-desktop"]) {
  if (!cargo.includes(`name = "${crate}"\nversion = "${expected}"`)) {
    throw new Error(`Cargo.lock não contém ${crate} ${expected}`);
  }
}
const pyproject = readFileSync(resolve(root, "engines/python/pyproject.toml"), "utf8");
if (!pyproject.includes(`version = "${pythonVersion}"`)) {
  throw new Error(`pyproject.toml não corresponde a ${expected}`);
}
for (const path of ["pnpm-lock.yaml", "Cargo.lock", "engines/python/uv.lock"]) {
  readFileSync(resolve(root, path));
}

const sidecars = readJson("runtime/languagetool-community.json");
for (const component of [sidecars.snapshot, sidecars.java]) {
  for (const field of ["tool", "version", "source", "checksum", "license"]) {
    if (!component[field]) throw new Error(`Manifesto de sidecar sem ${field}`);
  }
  if (!/^https:\/\//.test(component.source) || !/^sha256:[0-9a-f]{64}$/.test(component.checksum)) {
    throw new Error(`Fonte ou checksum inválido para ${component.tool}`);
  }
}
console.log(`Release ${expected}: versões, lockfiles e manifesto verificados.`);
