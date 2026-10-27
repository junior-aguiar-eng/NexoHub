import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(
  process.argv[2] ?? resolve(repository, ".superpowers/reproducao-pos-bretao"),
);
await mkdir(output);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sources = [
  {
    file: "apertium-br-fr.br.dix",
    url: "https://raw.githubusercontent.com/apertium/apertium-br-fr/99007c6bfff287d6a4b1b104f06a151c1cc9d4f4/apertium-br-fr.br.dix",
    sha256: "8949b3db060e1d26a1815d139911bfcc8bb2399d849bc1a2e7f11c36a6932b61",
  },
  {
    file: "create-lexicon-original.pl",
    url: "https://raw.githubusercontent.com/languagetool-org/languagetool/5a0fa50578f4010fc037a25750ff7ae0d8b76a63/languagetool-language-modules/br/src/main/resources/org/languagetool/resource/br/create-lexicon.pl",
    sha256: "309223cd731caabbf969426bd3db97950c80cea57df0fd1be0095daaa6418c7f",
  },
  {
    file: "lttoolbox-2015.tar.gz",
    url: "https://api.github.com/repos/apertium/lttoolbox/tarball/2bda5a443206b614c540d4005ea32562e51a388e",
    sha256: "da45206316343da2098beacb17ffe3113c0d13e0123102432326fb5b7faaccf4",
  },
];
for (const source of sources) {
  const response = await fetch(source.url, { signal: AbortSignal.timeout(30_000) });
  assert(response.ok, `HTTP ${response.status}: ${source.file}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes), source.sha256, source.file);
  await writeFile(resolve(output, source.file), bytes, { flag: "wx" });
  source.bytes = bytes.length;
}
const original = await readFile(resolve(output, "create-lexicon-original.pl"), "utf8");
const compilation = /^`java -jar morfologik-stemming-nodict-1\.4\.0\.jar [^\r\n]+;\r?$/gm;
assert.equal([...original.matchAll(compilation)].length, 2);
await writeFile(
  resolve(output, "create-lexicon.pl"),
  original.replace(compilation, "# Compilação desativada na cópia de análise: comparar o TSV."),
  { flag: "wx" },
);
await writeFile(
  resolve(output, "Dockerfile"),
  await readFile(resolve(repository, "scripts/languagetool-pos/Dockerfile.breton")),
  { flag: "wx" },
);
await writeFile(resolve(output, ".dockerignore"), "*\n!Dockerfile\n!lttoolbox-2015.tar.gz\n", {
  flag: "wx",
});
const docker = process.platform === "win32" ? "docker.exe" : "docker";
const image = "nexohub-qc0-pos-breton:analysis";
execFileSync(docker, ["build", "--tag", image, output], {
  windowsHide: true,
  timeout: 300_000,
  stdio: "inherit",
});
execFileSync(
  docker,
  [
    "run",
    "--pull",
    "never",
    "--rm",
    "--network",
    "none",
    "--env",
    "LC_ALL=C.UTF-8",
    "--env",
    "LANG=C.UTF-8",
    "--memory",
    "2g",
    "--cpus",
    "2",
    "--read-only",
    "--tmpfs",
    "/tmp",
    "--mount",
    `type=bind,source=${output},target=/work`,
    image,
    "sh",
    "-c",
    "perl create-lexicon.pl > generation.log 2>&1 && cp /toolchain.tsv toolchain.tsv",
  ],
  { windowsHide: true, timeout: 120_000, stdio: "inherit" },
);
execFileSync(
  process.execPath,
  [resolve(repository, "scripts/verificar-inventario-languagetool.mjs")],
  {
    windowsHide: true,
    timeout: 30_000,
    stdio: "inherit",
  },
);
const runtime = resolve(repository, "apps/desktop/src-tauri/resources/runtime/languagetool");
const java = resolve(runtime, "java/bin/java.exe");
const manifest = JSON.parse(
  await readFile(resolve(repository, "runtime/languagetool-community.json"), "utf8"),
);
assert.equal(`sha256:${hash(await readFile(java))}`, manifest.java.componentChecksum);
const binary = resolve(runtime, "languagetool/org/languagetool/resource/br/breton.dict");
const binarySha256 = hash(await readFile(binary));
assert.equal(binarySha256, "eb5ef06be9f3967b3ca068f8347cd0880548082c78776fe5d526705291bbd952");
const decoded = resolve(output, "breton-decompiled.tsv");
execFileSync(
  java,
  [
    "-Xmx512m",
    "-cp",
    resolve(runtime, "languagetool/libs/*"),
    "morfologik.tools.Launcher",
    "dict_decompile",
    "-i",
    binary,
    "-o",
    decoded,
  ],
  {
    windowsHide: true,
    timeout: 30_000,
    stdio: "inherit",
  },
);
const tuples = (text, separator, reorder) =>
  text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const fields = line.split(separator);
      assert.equal(fields.length, 3, "Entrada sem os três campos esperados");
      return JSON.stringify(reorder ? [fields[1], fields[0], fields[2]] : fields);
    });
const generatedFile = resolve(output, "apertium-br-fr.br.dix-LT.txt");
const generated = tuples(await readFile(generatedFile, "utf8"), "\t", true);
const expected = new Set(tuples(await readFile(decoded, "utf8"), "+", false));
const actual = new Set(generated);
const missing = [...expected].filter((entry) => !actual.has(entry));
const added = [...actual].filter((entry) => !expected.has(entry));
assert.equal(actual.size, 278023);
assert.equal(expected.size, 278023);
assert.equal(missing.length, 0, "Faltam entradas do binário");
assert.equal(added.length, 0, "Há entradas extras");
const report = {
  sources,
  binarySha256,
  generatedRows: generated.length,
  generatedDistinct: actual.size,
  binaryDistinct: expected.size,
  missing: missing.length,
  added: added.length,
  generatedSha256: hash(await readFile(generatedFile)),
  toolchainSha256: hash(await readFile(resolve(output, "toolchain.tsv"))),
  locale: "C.UTF-8",
  scope:
    "Correspondência exata dos conjuntos de triplas lema, forma e POS. Somente CRLF é tratado como terminador de linha; sem normalização de caixa, acentos ou pontuação. Duplicatas do gerador são deduplicadas, como no FSA.",
  limitation:
    "Não recompila o FSA com Morfologik 1.4 nem certifica reprodução bit a bit ou suficiência jurídica. Só duas chamadas finais de compilação foram desativadas na cópia do gerador; fontes e runtime originais preservados.",
};
await writeFile(resolve(output, "relatorio.json"), `${JSON.stringify(report, null, 2)}\n`, {
  flag: "wx",
});
console.log("278.023 triplas POS do bretão reproduzidas; zero ausências e zero adições.");
