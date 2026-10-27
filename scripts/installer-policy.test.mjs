import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertInstallerPolicy } from "./installer-policy.mjs";

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
