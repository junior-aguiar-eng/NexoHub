import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ptBR } from "../apps/client/src/i18n/pt-BR.ts";

export async function prepareInstaller(root) {
  const setup = resolve(root, "target/release/runtime/setup");
  const installer = resolve(root, "target/release/installer");
  await mkdir(setup, { recursive: true });
  await mkdir(installer, { recursive: true });
  const manifest = JSON.parse(
    await readFile(resolve(root, "runtime/languagetool-community.json"), "utf8"),
  );
  const date = /-(\d{8})$/.exec(manifest.snapshot.version)?.[1];
  assert(date, "Snapshot sem data fixada");
  const inventoryPath = resolve(root, `docs/quality/languagetool-${date}-jars.json`);
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  assert.equal(`sha256:${inventory.sourceZipSha256}`, manifest.snapshot.checksum);
  const script = await readFile(resolve(root, "scripts/install-languagetool.ps1"), "utf8");
  await writeFile(
    resolve(setup, "install-languagetool.ps1"),
    `\ufeff${script.replace(/^\ufeff/, "")}`,
    "utf8",
  );
  await copyFile(
    resolve(root, "runtime/languagetool-community.json"),
    resolve(setup, "languagetool-community.json"),
  );
  await copyFile(inventoryPath, resolve(setup, "languagetool-jars.json"));
  const javaInventoryPath = resolve(root, "docs/quality/languagetool-java-21.0.12.1-files.json");
  const javaInventory = JSON.parse(await readFile(javaInventoryPath, "utf8"));
  assert.equal(`sha256:${javaInventory.sourceZipSha256}`, manifest.java.checksum);
  await copyFile(javaInventoryPath, resolve(setup, "languagetool-java-files.json"));
  const size = Math.round((manifest.snapshot.size + manifest.java.size) / 1_000_000);
  const messages = ["[CustomMessages]"];
  for (const name of [
    "desktopIcon",
    "launchApp",
    "webviewFailed",
    "reviewTask",
    "reviewPreparing",
    "reviewFailed",
  ]) {
    const text = ptBR[`installer.${name}`].replaceAll("{downloadSize}", String(size));
    assert(!/[\r\n]/.test(text), "Mensagem do instalador deve ter uma linha");
    messages.push(`brazilianportuguese.${name}=${text}`);
  }
  await writeFile(resolve(installer, "messages.iss"), `\ufeff${messages.join("\n")}\n`, "utf8");
}
