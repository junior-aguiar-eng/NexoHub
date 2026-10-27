import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(
  process.argv[2] ??
    resolve(repository, "apps/desktop/src-tauri/resources/runtime/languagetool/languagetool"),
);
const inventory = JSON.parse(
  await readFile(
    resolve(process.argv[3] ?? resolve(repository, "docs/quality/languagetool-20261027-jars.json")),
    "utf8",
  ),
);
const manifest = JSON.parse(
  await readFile(resolve(repository, "runtime/languagetool-community.json"), "utf8"),
);
assert.equal(`sha256:${inventory.sourceZipSha256}`, manifest.snapshot.checksum);
assert.equal(inventory.count, inventory.jars.length);
const expected = new Set();
for (const item of inventory.jars) {
  const path = resolve(root, item.file);
  const confined = relative(root, path);
  assert(
    !isAbsolute(confined) &&
      confined !== ".." &&
      !confined.startsWith("..\\") &&
      !confined.startsWith("../"),
  );
  assert(!expected.has(item.file), `JAR duplicado: ${item.file}`);
  expected.add(item.file);
  const bytes = await readFile(path);
  assert.equal(bytes.length, item.bytes, item.file);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.file);
}
async function listJars(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), "Link simbólico não é aceito no runtime verificado.");
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await listJars(path)));
    else if (entry.name.endsWith(".jar")) result.push(relative(root, path).replaceAll("\\", "/"));
  }
  return result;
}
assert.deepEqual(
  new Set(await listJars(root)),
  expected,
  "Conjunto de JARs diverge do inventário.",
);
console.log(
  `${expected.size} JARs conferidos por tamanho, SHA-256 e cobertura exata. Licenças/fontes exigem avaliação separada.`,
);
