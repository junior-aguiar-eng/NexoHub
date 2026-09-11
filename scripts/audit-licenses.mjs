import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checkOnly = process.argv.includes("--check");
const run = (command, args) => {
  const pnpmCli = command === "pnpm" ? process.env.npm_execpath : undefined;
  if (command === "pnpm" && !pnpmCli) {
    throw new Error("Execute este auditor por `pnpm licenses:generate` ou `pnpm licenses:check`.");
  }
  const executable = pnpmCli ? process.execPath : command;
  const commandArgs = pnpmCli ? [pnpmCli, ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || result.error?.message || `${command} falhou`);
  return JSON.parse(result.stdout);
};

const rows = [];
const pnpm = run("pnpm", ["licenses", "list", "--json", "--prod"]);
for (const [license, packages] of Object.entries(pnpm)) {
  for (const item of packages) {
    for (const version of item.versions) rows.push(["JavaScript", item.name, version, license]);
  }
}

const cargo = run("cargo", ["metadata", "--locked", "--format-version", "1"]);
for (const item of cargo.packages) {
  rows.push(["Rust", item.name, item.version, item.license ?? "UNKNOWN"]);
}

const python = run("uv", [
  "run",
  "--locked",
  "--project",
  "engines/python",
  "python",
  resolve(root, "scripts/python-license-inventory.py"),
]);
for (const item of python) rows.push(["Python", item.name, item.version, item.license]);

const sidecars = JSON.parse(
  readFileSync(resolve(root, "runtime/languagetool-community.json"), "utf8"),
);
for (const item of [sidecars.snapshot, sidecars.java]) {
  rows.push(["Sidecar", item.tool, item.version, item.license]);
}

const normalized = [...new Map(rows.map((row) => [row.join("\u0000"), row])).values()].sort(
  (a, b) => a.join("\u0000").localeCompare(b.join("\u0000"), "en"),
);
const unknown = normalized.filter((row) => !row[3] || /unknown|proprietary/i.test(row[3]));
if (unknown.length) {
  throw new Error(
    `Licenças não identificadas:\n${unknown.map((row) => row.join(" | ")).join("\n")}`,
  );
}
const approvedCopyleft = new Set([
  "Sidecar\u0000Eclipse Temurin JRE\u0000GPL-2.0-only WITH Classpath-exception-2.0",
  "Sidecar\u0000LanguageTool Community\u0000LGPL-2.1-or-later",
]);
const disallowed = normalized.filter(([ecosystem, name, _version, license]) => {
  if (/AGPL/i.test(license)) return true;
  if (!/[LA]?GPL/i.test(license)) return false;
  if (approvedCopyleft.has(`${ecosystem}\u0000${name}\u0000${license}`)) return false;
  return !license.split(/\s+OR\s+/i).some((alternative) => !/[LA]?GPL/i.test(alternative));
});
if (disallowed.length) {
  throw new Error(
    `Licenças copyleft sem decisão explícita:\n${disallowed.map((row) => row.join(" | ")).join("\n")}`,
  );
}

const lines = [
  "# Licenças de terceiros",
  "",
  "Inventário gerado por `pnpm licenses:generate` a partir dos lockfiles e do ambiente Python sincronizado. Inclui dependências de runtime, build e teste, além dos sidecars empacotáveis.",
  "",
  "| Ecossistema | Componente | Versão | Licença declarada |",
  "| --- | --- | --- | --- |",
  ...normalized.map(
    (row) => `| ${row.map((value) => String(value).replaceAll("|", "\\|")).join(" | ")} |`,
  ),
  "",
  "## Sidecars",
  "",
  ...[sidecars.snapshot, sidecars.java].flatMap((item) => [
    `- **${item.tool} ${item.version}** — ${item.license}`,
    `  Fonte: ${item.source}`,
    `  Integridade: \`${item.checksum}\``,
  ]),
  "",
  "Os textos completos e avisos exigidos dos sidecars são preservados dentro do bundle. O manifesto versionado é `runtime/languagetool-community.json`.",
  "",
];
const content = lines.join("\n");
const output = resolve(root, "THIRD_PARTY_LICENSES.md");
if (checkOnly) {
  console.log("Inventário de licenças auditado e aprovado.");
} else {
  writeFileSync(output, content, "utf8");
  console.log(`Inventário gerado com ${normalized.length} componentes.`);
}
