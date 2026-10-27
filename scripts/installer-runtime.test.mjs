import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";

const repository = resolve(import.meta.dirname, "..");
const { zipSync } = createRequire(new URL("../apps/client/package.json", import.meta.url))(
  "fflate",
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("setup verifica staging, repete sem download e preserva conflitos", {
  skip: process.platform !== "win32",
}, async () => {
  const root = resolve(repository, `.superpowers/installer-runtime-test-${Date.now()}`);
  const archives = resolve(root, "archives");
  await mkdir(archives, { recursive: true });
  const cli = Buffer.from("jar-fixture");
  const library = Buffer.from("lib-fixture");
  const java = Buffer.from("exe-fixture-nao-executavel");
  const jvm = Buffer.from("jvm-fixture");
  const snapshot = zipSync({
    "LT-fixture/languagetool-commandline.jar": cli,
    "LT-fixture/libs/test.jar": library,
    "LT-fixture/COPYING.txt": Buffer.from("license-fixture"),
    "LT-fixture/third-party-licenses/README.txt": Buffer.from("notice-fixture"),
  });
  const jre = zipSync({
    "JRE-fixture/bin/java.exe": java,
    "JRE-fixture/bin/server/jvm.dll": jvm,
    "JRE-fixture/legal/java.base/LICENSE": Buffer.from("license-fixture"),
    "JRE-fixture/legal/java.base/ASSEMBLY_EXCEPTION": Buffer.from("exception-fixture"),
  });
  await writeFile(resolve(archives, "snapshot.zip"), snapshot);
  await writeFile(resolve(archives, "java.zip"), jre);
  const manifest = {
    snapshot: {
      source: "https://example.invalid/snapshot.zip",
      archive: "archives/snapshot.zip",
      checksum: `sha256:${sha(snapshot)}`,
      size: snapshot.length,
      jar: "languagetool/languagetool-commandline.jar",
      componentChecksum: `sha256:${sha(cli)}`,
      licenseFile: "languagetool/COPYING.txt",
      thirdPartyLicenses: "languagetool/third-party-licenses/README.txt",
    },
    java: {
      source: "https://example.invalid/java.zip",
      archive: "archives/java.zip",
      checksum: `sha256:${sha(jre)}`,
      size: jre.length,
      executable: "java/bin/java.exe",
      componentChecksum: `sha256:${sha(java)}`,
      licenseFile: "java/legal/java.base/LICENSE",
      assemblyException: "java/legal/java.base/ASSEMBLY_EXCEPTION",
    },
  };
  const inventory = {
    sourceZipSha256: sha(snapshot),
    count: 2,
    jars: [
      { file: "languagetool-commandline.jar", bytes: cli.length, sha256: sha(cli) },
      { file: "libs/test.jar", bytes: library.length, sha256: sha(library) },
    ],
  };
  const manifestPath = resolve(root, "manifest.json");
  const inventoryPath = resolve(root, "jars.json");
  const javaInventoryPath = resolve(root, "java-files.json");
  await writeFile(
    javaInventoryPath,
    JSON.stringify({
      sourceZipSha256: sha(jre),
      count: 1,
      files: [{ file: "bin/server/jvm.dll", bytes: jvm.length, sha256: sha(jvm) }],
    }),
  );
  await writeFile(manifestPath, `\ufeff${JSON.stringify(manifest)}`);
  await writeFile(inventoryPath, `\ufeff${JSON.stringify(inventory)}`);
  const run = (target, archiveDirectory = archives) =>
    spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        resolve(repository, "scripts/install-languagetool.ps1"),
        "-InstallRoot",
        target,
        "-ManifestPath",
        manifestPath,
        "-InventoryPath",
        inventoryPath,
        "-JavaInventoryPath",
        javaInventoryPath,
        "-ArchiveDirectory",
        archiveDirectory,
      ],
      { windowsHide: true, timeout: 30_000, encoding: "utf8" },
    );
  const target = resolve(root, "installed");
  const installed = run(target);
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  assert.equal(sha(await readFile(resolve(target, manifest.snapshot.jar))), sha(cli));
  const repeated = run(target, resolve(root, "archives-inexistentes"));
  assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr);
  await unlink(resolve(target, "java/bin/server/jvm.dll"));
  const missingJvm = run(target);
  assert.notEqual(missingJvm.status, 0);
  assert.match(missingJvm.stderr, /LT_INSTALL_CONFLICT/);
  await writeFile(resolve(target, "java/bin/server/jvm.dll"), jvm);
  await writeFile(resolve(archives, "snapshot.zip"), Buffer.from("corrompido"));
  const incomplete = resolve(root, "incomplete");
  const failed = run(incomplete);
  assert.notEqual(failed.status, 0);
  await assert.rejects(access(incomplete));
  const changedJar = resolve(target, manifest.snapshot.jar);
  await writeFile(changedJar, Buffer.from("alteracao-preservada"));
  const conflict = run(target);
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /LT_INSTALL_CONFLICT/);
  assert.equal(await readFile(changedJar, "utf8"), "alteracao-preservada");
});
