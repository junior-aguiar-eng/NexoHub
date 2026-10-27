import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, ".."),
  out = resolve(root, ".superpowers/sdd/2026-10-26-im-c4-avif");
const result = JSON.parse(readFileSync(resolve(out, "comparison.json"), "utf8"));
const sources = JSON.parse(readFileSync(resolve(out, "sources.json"), "utf8"));
assert.equal(result.rows.length, 64);
assert.equal(result.corpus.length, 8);
assert.equal(result.originalsUnchanged, true);
assert.equal(result.invalid.invalidRejected, true);
assert.equal(result.cancellation.lateResults, 0);
assert.equal(
  result.recovery.sha256,
  result.rows.find((row) => row.source === "coffee" && row.profile === "avif50" && row.run === 0)
    .sha256,
);
assert.ok(result.cancellation.terminatedAfterPhaseMs < 1000);
assert.ok(!result.requests.some((path) => path.includes("avif_enc_mt")));
const baseline = JSON.parse(
  readFileSync(resolve(root, "docs/benchmarks/2026-10-24-imc4-avif.json"), "utf8"),
);
assert.equal(sources.packages[0].tarSha256, baseline.codecs.avif.tarSha256);
for (const source of result.corpus)
  for (const profile of result.profiles)
    for (let run = 0; run < 2; run++) {
      const rows = result.rows.filter(
        (row) => row.source === source.id && row.profile === profile.id && row.run === run,
      );
      assert.equal(rows.length, 1);
      const row = rows[0],
        bytes = readFileSync(resolve(out, `${source.id}-${profile.id}-${run}.${profile.codec}`));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), row.sha256);
      assert.equal(bytes.length, row.outputBytes);
      assert.equal(row.native.error, undefined);
      assert.ok(Number.isFinite(row.encodeMs) && row.encodeMs >= 0);
      if (profile.codec !== "jpeg") {
        assert.equal(row.quality.alphaMaxError, 0);
        assert.equal(row.native.alphaMaxError, 0);
      }
    }
console.log(
  "64 saídas conferidas; alpha AVIF/WebP exato; originais, cancelamento, recusa inválida e hashes aprovados",
);
