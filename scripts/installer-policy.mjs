import assert from "node:assert/strict";

export const installerSources = [
  "../target/release/nexohub-desktop.exe",
  "../target/release/THIRD_PARTY_LICENSES.md",
  "../target/release/runtime/README.md",
  "../target/release/runtime/setup/install-languagetool.ps1",
  "../target/release/runtime/setup/languagetool-community.json",
  "../target/release/runtime/setup/languagetool-jars.json",
  "../target/release/runtime/setup/languagetool-java-files.json",
  "../target/release/runtime/MicrosoftEdgeWebview2Setup.exe",
];

export function assertInstallerPolicy(source) {
  const section = source.split("[Files]")[1]?.split(/^\[/m)[0];
  assert(section, "Seção Files ausente");
  const allowed = new Set(installerSources.map((path) => path.toLowerCase()));
  const found = new Set();
  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) continue;
    const match = /^Source:\s*"([^"]+)";/i.exec(line);
    assert(match, "Entrada Files desconhecida; revisão explícita necessária");
    const path = match[1].replaceAll("\\", "/").toLowerCase();
    assert(allowed.has(path), `Payload não autorizado pelo ADR-019: ${match[1]}`);
    assert(!found.has(path), "Entrada Files duplicada");
    found.add(path);
  }
  assert.equal(found.size, allowed.size, "Lista de arquivos incompleta");
}
