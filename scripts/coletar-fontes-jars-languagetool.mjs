import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.argv[2] ?? resolve(repository, ".superpowers/fontes-jars"));
await mkdir(output);
const inventory = JSON.parse(
  await readFile(resolve(repository, "docs/quality/languagetool-20261027-jars.json"), "utf8"),
);
const selected = inventory.jars.filter((jar) =>
  /GNU Lesser|GNU General|LGPL|GPL|CDDL/i.test(
    JSON.stringify([jar.declaredLicenses, jar.manifestLicense, jar.resolvedLicense]),
  ),
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const records = [];
const visited = new Set();
const runtime = resolve(
  repository,
  "apps/desktop/src-tauri/resources/runtime/languagetool/languagetool",
);
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) return null;
  assert(response.ok, `HTTP ${response.status}: ${url}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    assert(length <= 32 * 1024 * 1024, "Download excede 32 MiB");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
for (const jar of selected) {
  assert(/^(?:libs\/)?[\w.-]+\.jar$/.test(jar.file), "Caminho JAR inesperado");
  assert.equal(sha256(await readFile(resolve(runtime, jar.file))), jar.sha256, jar.file);
  const coordinates = jar.coordinates.length
    ? jar.coordinates
    : (jar.mavenVerification ?? [])
        .filter((verification) => verification.identicalBytes)
        .map((verification) => verification.candidate);
  assert(coordinates.length > 0, `Coordenadas não resolvidas: ${jar.file}`);
  for (const coordinate of coordinates) {
    const { groupId, artifactId, version } = coordinate;
    for (const part of [groupId, artifactId, version]) assert(/^[\w.+-]+$/.test(part));
    const id = `${groupId}:${artifactId}:${version}`;
    if (visited.has(id)) continue;
    visited.add(id);
    if (version.includes("SNAPSHOT")) {
      records.push({ id, installedJar: jar.file, status: "SNAPSHOT_SOURCE_COMMIT_REQUIRED" });
      continue;
    }
    const prefix = `https://repo.maven.apache.org/maven2/${groupId.replaceAll(".", "/")}/${artifactId}/${version}/${artifactId}-${version}`;
    const sourceUrl = `${prefix}-sources.jar`;
    const source = await download(sourceUrl);
    if (source === null) {
      records.push({ id, installedJar: jar.file, sourceUrl, status: "SOURCE_404" });
      continue;
    }
    assert.equal(source.readUInt32LE(0), 0x04034b50, "Fontes não são um ZIP/JAR");
    const checksum = await download(`${sourceUrl}.sha1`);
    assert(checksum, "Checksum Maven ausente");
    const expectedSha1 = checksum.toString("utf8").trim().split(/\s/)[0];
    assert.match(expectedSha1, /^[a-f\d]{40}$/i);
    assert.equal(createHash("sha1").update(source).digest("hex"), expectedSha1.toLowerCase());
    const publishedBinary = await download(`${prefix}.jar`);
    assert(publishedBinary, "Binário publicado ausente");
    const filename = `${groupId}-${artifactId}-${version}-sources.jar`;
    await writeFile(resolve(output, filename), source, { flag: "wx" });
    records.push({
      id,
      installedJar: jar.file,
      sourceUrl,
      filename,
      bytes: source.length,
      sha256: sha256(source),
      mavenSha1Verified: true,
      publishedBinarySha256: sha256(publishedBinary),
      installedJarSha256: jar.sha256,
      binaryMatchesInstalledJar: sha256(publishedBinary) === jar.sha256,
      status: "SOURCE_ARCHIVE_COLLECTED",
    });
  }
}
const report = {
  snapshotSha256: inventory.sourceZipSha256,
  scope:
    "Coordenadas dos JARs com GPL/LGPL/CDDL declaradas em POM/manifesto ou na resolução de licença do inventário, incluindo coordenadas embutidas desses JARs. Não cobre todos os recursos ou componentes do runtime.",
  limitation:
    "Checksums do mesmo repositório conferem o download, não assinatura independente. Fonte publicada da mesma versão não prova reconstrução do binário nem satisfação integral das obrigações de redistribuição.",
  selectedJars: selected.length,
  installedJarsVerified: selected.length,
  records,
};
await writeFile(resolve(output, "relatorio.json"), `${JSON.stringify(report, null, 2)}\n`, {
  flag: "wx",
});
console.log(
  JSON.stringify({
    selectedJars: selected.length,
    coordinates: records.length,
    collected: records.filter((record) => record.status === "SOURCE_ARCHIVE_COLLECTED").length,
    missing: records.filter((record) => record.status === "SOURCE_404").length,
  }),
);
