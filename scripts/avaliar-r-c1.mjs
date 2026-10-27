/** Comparação isolada; qpdf WASM é baixado somente para a pasta ignorada do ensaio. */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../apps/client/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const out = resolve(root, ".superpowers/sdd/2026-10-26-r-c1");
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, ".gitignore"), "*\n");
const baselinePath = resolve(out, "baseline-repair.ts");
globalThis.__rC1BaselinePDFDocument = require("pdf-lib").PDFDocument;
writeFileSync(
  baselinePath,
  execFileSync("git", ["show", "bc3317b:apps/client/src/platform/pdf-repair-engine.ts"], {
    cwd: root,
  })
    .toString()
    .replace(
      'import { PDFDocument } from "pdf-lib";',
      "const PDFDocument = globalThis.__rC1BaselinePDFDocument;",
    ),
);
const server = await createServer({
  root: resolve(root, "apps/client"),
  server: { hmr: false },
  appType: "custom",
});
const { PDFDocument, PDFName, PDFDict, PDFArray } = require("pdf-lib");
const { createRepairCorpus } = await server.ssrLoadModule(
  "/src/platform/__fixtures__/r-c1/corpus.ts",
);
const { repairPdfDocument: baselineRepair } = await server.ssrLoadModule(baselinePath);
const { repairPdfDocument: currentRepair } = await server.ssrLoadModule(
  "/src/platform/pdf-repair-engine.ts",
);
const factory = require(resolve(out, "neslinesli93--qpdf-wasm/package--dist--qpdf.js"));
const record = {
  node: process.version,
  cases: [],
  scope: "Node/WASM isolado; RSS inclui Vite e verificador, não é memória exclusiva do motor.",
};
async function inspect(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  const attachments = names
    ?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict)
    ?.lookupMaybe(PDFName.of("Names"), PDFArray);
  return {
    pages: doc.getPageCount(),
    field:
      doc
        .getForm()
        .getFields()
        .find((field) => field.getName() === "nome")
        ?.getText() ?? null,
    attachments: (attachments?.size() ?? 0) / 2,
    title: doc.getTitle(),
    author: doc.getAuthor(),
    creation: doc.getCreationDate()?.toISOString(),
    crop: doc.getPage(0).getCropBox(),
  };
}
try {
  for (const item of await createRepairCorpus()) {
    writeFileSync(resolve(out, `${item.id}.pdf`), item.bytes);
    for (const engine of ["baseline", "qpdf-12.2.0-wasm", "r-c1"]) {
      const start = performance.now();
      const rss = process.memoryUsage().rss;
      const row = {
        id: item.id,
        engine,
        expected: item.recoverable,
        inputSha256: createHash("sha256").update(item.bytes).digest("hex"),
      };
      try {
        let bytes;
        if (engine === "baseline") bytes = (await baselineRepair(item.bytes)).pdfBytes;
        else if (engine === "r-c1") bytes = (await currentRepair(item.bytes)).pdfBytes;
        else {
          const q = await factory({
            locateFile: () => resolve(out, "neslinesli93--qpdf-wasm/package--dist--qpdf.wasm"),
          });
          q.FS.writeFile("/input.pdf", item.bytes);
          row.exit = q.callMain(["/input.pdf", "/output.pdf"]);
          bytes = q.FS.readFile("/output.pdf");
        }
        row.actual = await inspect(bytes);
        row.outputSha256 = createHash("sha256").update(bytes).digest("hex");
        writeFileSync(resolve(out, `${item.id}-${engine}.pdf`), bytes);
      } catch (error) {
        row.error = error instanceof Error ? error.message : String(error);
      }
      row.ms = performance.now() - start;
      row.inputUnchanged =
        createHash("sha256").update(item.bytes).digest("hex") === row.inputSha256;
      row.rssObservedBytes = Math.max(rss, process.memoryUsage().rss);
      record.cases.push(row);
      writeFileSync(resolve(out, "comparison.json"), JSON.stringify(record, null, 2));
      console.log(JSON.stringify(row));
    }
  }
} finally {
  await server.close();
  // O CLI WASM altera process.exitCode em entradas recusadas; isso é dado do ensaio.
  process.exitCode = 0;
  delete globalThis.__rC1BaselinePDFDocument;
}
