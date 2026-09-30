import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const newVersion = process.argv[2];

if (!newVersion || !/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(newVersion)) {
  console.error("Uso: node scripts/bump-version.mjs <versao> (ex: 0.1.0, 0.2.0-beta.1)");
  process.exit(1);
}

const pythonVersion = newVersion
  .replace(/-alpha\.(\d+)$/, "a$1")
  .replace(/-beta\.(\d+)$/, "b$1")
  .replace(/-rc\.(\d+)$/, "rc$1");

console.log(`Atualizando NexoHub para versão: ${newVersion} (Python: ${pythonVersion})...`);

// 1. Atualizar manifests Node.js
const jsonFiles = [
  "package.json",
  "apps/client/package.json",
  "apps/desktop/package.json",
  "packages/contracts/package.json",
  "packages/domain/package.json",
  "packages/tool-registry/package.json",
  "packages/tool-sdk/package.json",
  "apps/desktop/src-tauri/tauri.conf.json",
];

for (const relPath of jsonFiles) {
  const fullPath = resolve(root, relPath);
  const data = JSON.parse(readFileSync(fullPath, "utf8"));
  data.version = newVersion;
  writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`  ✓ ${relPath}`);
}

// 2. Atualizar Cargo.toml
const cargoTomlFiles = ["crates/nexohub-core/Cargo.toml", "apps/desktop/src-tauri/Cargo.toml"];

for (const relPath of cargoTomlFiles) {
  const fullPath = resolve(root, relPath);
  let content = readFileSync(fullPath, "utf8");
  content = content.replace(/version\s*=\s*"[^"]+"/, `version = "${newVersion}"`);
  writeFileSync(fullPath, content, "utf8");
  console.log(`  ✓ ${relPath}`);
}

// 3. Atualizar engines/python/pyproject.toml
const pyprojectPath = resolve(root, "engines/python/pyproject.toml");
let pyContent = readFileSync(pyprojectPath, "utf8");
pyContent = pyContent.replace(/version\s*=\s*"[^"]+"/, `version = "${pythonVersion}"`);
writeFileSync(pyprojectPath, pyContent, "utf8");
console.log(`  ✓ engines/python/pyproject.toml`);

// 4. Atualizar scripts/verificar-release.mjs default
const verifyPath = resolve(root, "scripts/verificar-release.mjs");
let verifyContent = readFileSync(verifyPath, "utf8");
verifyContent = verifyContent.replace(
  /NEXOHUB_RELEASE_VERSION \?\? "[^"]+"/,
  `NEXOHUB_RELEASE_VERSION ?? "${newVersion}"`,
);
writeFileSync(verifyPath, verifyContent, "utf8");
console.log(`  ✓ scripts/verificar-release.mjs`);

// 5. Atualizar Cargo.lock
console.log("Atualizando Cargo.lock...");
execSync("cargo check", { cwd: root, stdio: "inherit" });

// 6. Atualizar engines/python/uv.lock
console.log("Atualizando engines/python/uv.lock...");
try {
  execSync("uv lock --project engines/python", { cwd: root, stdio: "inherit" });
} catch {
  // Se uv não estiver no PATH global, tenta pelo executável do ambiente
  const uvVenv = resolve(root, "engines/python/.venv/Scripts/uv.exe");
  execSync(`"${uvVenv}" lock --project engines/python`, { cwd: root, stdio: "inherit" });
}

// 7. Atualizar README.md
const readmePath = resolve(root, "README.md");
let readmeContent = readFileSync(readmePath, "utf8");
readmeContent = readmeContent.replace(
  /> \*\*Estado\*\*: `[^`]+`/,
  `> **Estado**: \`${newVersion}\``,
);
writeFileSync(readmePath, readmeContent, "utf8");
console.log(`  ✓ README.md`);

// 8. Regenerar THIRD_PARTY_LICENSES.md
console.log("Regenerando inventário de licenças...");
execSync("pnpm licenses:generate", { cwd: root, stdio: "inherit" });

// 9. Verificar sincronização
console.log("Validando release...");
execSync("pnpm release:verify", { cwd: root, stdio: "inherit" });

console.log(`\nVersão ${newVersion} configurada com sucesso em todos os componentes!`);
