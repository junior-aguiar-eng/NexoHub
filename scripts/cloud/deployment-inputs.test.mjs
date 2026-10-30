import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const docker = readFileSync(new URL("../../Dockerfile", import.meta.url), "utf8");
test("imagem do servidor inclui os manifestos de nuvem usados em include_str", () => {
  const stage = docker
    .split("FROM rust:bookworm AS rust-builder")[1]
    .split("FROM debian:bookworm-slim")[0];
  assert.match(stage, /COPY scripts\/cloud \.\/scripts\/cloud/);
  for (const name of ["hybrid-policy.json", "hybrid-pricing.json"])
    assert.doesNotThrow(() => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8")));
});
