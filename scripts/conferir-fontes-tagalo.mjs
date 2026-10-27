import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.argv[2] ?? resolve(repository, ".superpowers/fontes-tagalo"));
// A coleta recusa reutilizar diretórios; não remove ou sobrescreve evidências anteriores.
await mkdir(output);
const parent = "fe4d80b2b76d864081576a9799e7cae30b6c7143";
const conversion = "fe8a600cfeaf4be745186758a3beb60f94ad4130";
const resource =
  "languagetool-language-modules/tl/src/main/resources/org/languagetool/resource/tl/hunspell/";
const artifacts = [
  {
    file: "tl_PH.aff",
    revision: parent,
    bytes: 822,
    sha256: "c6a8719a2be9d12394f9e884b2ebd1c5aea246e4775882727a4be042c41fb4bd",
  },
  {
    file: "tl_PH.dic",
    revision: parent,
    bytes: 138158,
    sha256: "e4db50a3288e1f7766c5ab7e90e6b0e862226ad0fd9e622b6a2083a626311732",
  },
  {
    file: "tl_PH.dict",
    revision: conversion,
    bytes: 51457,
    sha256: "209f819adf1e1d5605108197310aadd4bdde08c156c2b820d14debd4ae38ce4e",
  },
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const artifact of artifacts) {
  artifact.url = `https://raw.githubusercontent.com/languagetool-org/languagetool/${artifact.revision}/${resource}${artifact.file}`;
  const response = await fetch(artifact.url, { signal: AbortSignal.timeout(30_000) });
  assert(response.ok, `Download recusado: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, artifact.bytes, artifact.file);
  assert.equal(sha256(bytes), artifact.sha256, artifact.file);
  await writeFile(resolve(output, artifact.file), bytes, { flag: "wx" });
}
const runtime = resolve(repository, "apps/desktop/src-tauri/resources/runtime/languagetool");
const languageTool = resolve(runtime, "languagetool");
const dictionary = resolve(languageTool, "org/languagetool/resource/tl/hunspell/tl_PH.dict");
assert.equal(sha256(await readFile(dictionary)), artifacts[2].sha256);
const manifest = JSON.parse(
  await readFile(resolve(repository, "runtime/languagetool-community.json"), "utf8"),
);
const java = resolve(runtime, "java/bin/java.exe");
assert.equal(`sha256:${sha256(await readFile(java))}`, manifest.java.componentChecksum);
const sequences = resolve(output, "sequencias.bin");
execFileSync(
  java,
  [
    "-Xmx256m",
    "-cp",
    resolve(languageTool, "libs/*"),
    "morfologik.tools.Launcher",
    "fsa_decompile",
    "-i",
    dictionary,
    "-o",
    sequences,
  ],
  { windowsHide: true, timeout: 30_000, stdio: "pipe" },
);
const sourceLines = (await readFile(resolve(output, "tl_PH.dic")))
  .toString("latin1")
  .trimEnd()
  .split(/\r?\n/);
const declaredWords = Number(sourceLines.shift());
assert.equal(sourceLines.length, declaredWords);
const legacy = new Set(sourceLines);
const decoded = new Set(
  (await readFile(sequences, "utf8"))
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const separator = line.lastIndexOf("+");
      assert(separator > 0 && line.length - separator <= 2, "Formato de frequência inesperado");
      return line.slice(0, separator);
    }),
);
const missing = [...legacy].filter((word) => !decoded.has(word)).sort();
const added = [...decoded].filter((word) => !legacy.has(word)).sort();
assert.equal(legacy.size, 14298);
assert.equal(decoded.size, 13357);
assert.equal(missing.length, 951);
assert.equal(added.length, 10);
const report = {
  conversionCommit: conversion,
  sourceParent: parent,
  artifacts,
  binaryUnchangedInInstalledSnapshot: true,
  comparison: {
    encodingSource: "ISO-8859-1",
    encodingBinary: "UTF-8; palavra antes do separador +; frequências não reconstruídas",
    declaredWords,
    sourceWords: legacy.size,
    binaryWords: decoded.size,
    missingCount: missing.length,
    addedCount: added.length,
    missing,
    added,
  },
  limitation:
    "Recupera entradas históricas, mas não prova receita completa, dados de frequência ou fontes correspondentes integrais. Exportar o binário não substitui sua forma preferida para modificação.",
};
await writeFile(resolve(output, "relatorio.json"), `${JSON.stringify(report, null, 2)}\n`, {
  flag: "wx",
});
console.log(
  "3 arquivos fixados; binário histórico idêntico ao instalado; léxico difere em 951 ausências e 10 adições. Frequências/receita permanecem pendentes.",
);
