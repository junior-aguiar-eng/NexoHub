import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { arch, cpus, platform, totalmem } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../apps/client/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { unzipSync, strFromU8 } = require("fflate");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const output = resolve(root, ".superpowers/sdd/2026-10-26-xl-c1");
await mkdir(output, { recursive: true });
const server = await createServer({
  root: resolve(root, "apps/client"),
  server: { host: "127.0.0.1", port: 4193, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4193/");
  const result = await page.evaluate(async () => {
    const { createXlC1Corpus, xlC1Expected, xlC1Region, xlC1Separators } = await import(
      "/src/platform/__fixtures__/xl-c1/corpus.ts"
    );
    const { convertPdfToExcelDocument, extractPdfSpreadsheetData } = await import(
      "/src/platform/excel-converter.ts"
    );
    const fixtures = [],
      rows = [];
    const hash = async (bytes) =>
      Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    for (const borders of [false, true]) {
      const bytes = await createXlC1Corpus(borders),
        before = await hash(bytes);
      fixtures.push({
        name: borders ? "tabela-com-bordas.pdf" : "tabela-sem-bordas.pdf",
        bytes: Array.from(bytes),
        sha256: before,
      });
      for (const mode of ["automatic", "selected-region"]) {
        const options =
          mode === "automatic"
            ? { preserveText: true }
            : {
                selectedPages: [2],
                region: xlC1Region,
                columnSeparators: xlC1Separators,
                preserveText: true,
              };
        const expected =
          mode === "automatic"
            ? xlC1Expected.flatMap((data) => [
                ["Inventário com cabeçalho abrangente", "", ""],
                ...data,
                ["Rodapé fora da seleção", "", ""],
              ])
            : xlC1Expected[1];
        for (const pass of ["first", "repeat"]) {
          const start = performance.now();
          const preview = await extractPdfSpreadsheetData(bytes, options);
          const exported = await convertPdfToExcelDocument(bytes, options);
          const ms = performance.now() - start;
          if (
            JSON.stringify(preview.previewRows) !== JSON.stringify(expected) ||
            JSON.stringify(exported.previewRows) !== JSON.stringify(expected)
          )
            throw new Error("Matriz divergente do corpus");
          if ((await hash(bytes)) !== before) throw new Error("Original alterado");
          rows.push({
            borders,
            mode,
            pass,
            ms,
            totalRows: exported.totalRows,
            totalColumns: exported.totalColumns,
            totalSheets: exported.totalSheets,
            expected,
            sourceUnchanged: true,
            artifact: Array.from(exported.data),
          });
        }
      }
    }
    return {
      fixtures,
      rows,
      userAgent: navigator.userAgent,
      memory:
        "memory" in performance
          ? {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
            }
          : null,
    };
  });
  for (const fixture of result.fixtures) {
    const bytes = Buffer.from(fixture.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), fixture.sha256);
    fixture.size = bytes.length;
    delete fixture.bytes;
    await writeFile(resolve(output, fixture.name), bytes);
  }
  for (const row of result.rows) {
    const bytes = new Uint8Array(row.artifact),
      zip = unzipSync(bytes);
    for (let sheet = 1; sheet <= row.totalSheets; sheet++) {
      const xml = strFromU8(zip[`xl/worksheets/sheet${sheet}.xml`]);
      const expected =
        row.totalSheets === 1 ? row.expected : row.expected.slice((sheet - 1) * 5, sheet * 5);
      for (const [r, cells] of expected.entries())
        for (const [c, value] of cells.entries())
          assert(
            xml.includes(
              `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${value}</t>`,
            ),
          );
    }
    row.artifactBytes = bytes.length;
    row.artifactSha256 = createHash("sha256").update(bytes).digest("hex");
    row.cellsVerified = true;
    delete row.artifact;
  }
  result.measuredAt = new Date().toISOString();
  result.device = {
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
    platform: platform(),
    arch: arch(),
    node: process.version,
  };
  result.versions = {
    pdfLib: require("pdf-lib/package.json").version,
    pdfjs: require("pdfjs-dist/package.json").version,
  };
  result.origin =
    "Corpus sintético MPL-2.0 gerado por apps/client/src/platform/__fixtures__/xl-c1/corpus.ts";
  result.method =
    "ms inclui extração da prévia e nova extração/serialização do XLSX. first/repeat no mesmo contexto; não são processos frios independentes. Matrizes e todas as células verificadas. Snapshot JS não é pico e não mede workers.";
  await writeFile(resolve(output, "measurement.json"), JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      { fixtures: result.fixtures, rows: result.rows.map(({ expected, ...row }) => row) },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await server.close();
}
