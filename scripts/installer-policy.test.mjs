import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { assertInstallerPolicy } from "./installer-policy.mjs";
import { prepareInstaller } from "./preparar-instalador.mjs";

const root = resolve(import.meta.dirname, "..");

test("instalador não incorpora o diretório de runtimes por wildcard", async () => {
  const source = await readFile(new URL("../installer/nexohub.iss", import.meta.url), "utf8");
  const files = source.split("[Files]")[1].split("[Icons]")[0];
  assert.doesNotMatch(files, /Source:\s*"[^"\r\n]*runtime\\\*"/i);
  assertInstallerPolicy(source);
  assert.throws(
    () => assertInstallerPolicy(source.replace("runtime\\README.md", "runtime\\*")),
    /Payload não autorizado/,
  );
  assert.throws(
    () =>
      assertInstallerPolicy(
        source.replace("[Icons]", 'Source: "..\\target\\release\\nexohub-desktop.exe";\n[Icons]'),
      ),
    /duplicada/,
  );
});

test("prepareInstaller copia THIRD_PARTY_LICENSES.md, runtime/README.md e scripts de setup", async () => {
  const targetLicenses = resolve(root, "target/release/THIRD_PARTY_LICENSES.md");
  const targetRuntimeReadme = resolve(root, "target/release/runtime/README.md");
  await rm(targetLicenses, { force: true });
  await rm(targetRuntimeReadme, { force: true });

  await prepareInstaller(root);

  assert.equal(existsSync(targetLicenses), true);
  assert.equal(existsSync(targetRuntimeReadme), true);
  assert.equal(existsSync(resolve(root, "target/release/installer/messages.iss")), true);
  assert.equal(
    existsSync(resolve(root, "target/release/runtime/setup/install-languagetool.ps1")),
    true,
  );
  assert.equal(
    existsSync(resolve(root, "target/release/runtime/setup/languagetool-community.json")),
    true,
  );
  assert.equal(
    existsSync(resolve(root, "target/release/runtime/setup/languagetool-jars.json")),
    true,
  );
  assert.equal(
    existsSync(resolve(root, "target/release/runtime/setup/languagetool-java-files.json")),
    true,
  );
  assert.equal(
    await readFile(targetLicenses, "utf8"),
    await readFile(resolve(root, "THIRD_PARTY_LICENSES.md"), "utf8"),
  );
  assert.equal(
    await readFile(targetRuntimeReadme, "utf8"),
    await readFile(resolve(root, "apps/desktop/src-tauri/resources/runtime/README.md"), "utf8"),
  );
});
