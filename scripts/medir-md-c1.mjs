import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus, totalmem } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../apps/client/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const output = resolve(root, ".superpowers/sdd/2026-10-26-md-c1");
await mkdir(output, { recursive: true });
const server = await createServer({
  root: resolve(root, "apps/client"),
  server: { host: "127.0.0.1", port: 4193, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4193/");
  const result = await page.evaluate(async () => {
    const { createMdC1Corpus, mdLeft, mdRight, mdTable } = await import(
      "/src/platform/__fixtures__/md-c1/corpus.ts"
    );
    const { convertPdfToMarkdown } = await import("/src/platform/markdown-converter.ts");
    const bytes = await createMdC1Corpus();
    const hash = async (data) =>
      Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    const before = await hash(bytes);
    const rows = [];
    for (const options of [
      {},
      { includePageBreaks: false },
      { readingOrder: "rows", detectTables: false },
    ]) {
      for (const pass of ["first", "repeat"]) {
        const start = performance.now();
        const converted = await convertPdfToMarkdown(bytes, options);
        const ms = performance.now() - start;
        for (const line of [...mdLeft, ...mdRight]) {
          if (converted.markdown.split(line.replace(/^• /, "- ")).length !== 2)
            throw new Error("Texto omitido ou duplicado");
        }
        if (
          JSON.stringify(converted.pagesWithoutText) !== "[3]" ||
          !converted.markdown.includes("Fim.")
        )
          throw new Error("Relatório divergente");
        if (
          options.readingOrder !== "rows" &&
          converted.markdown.indexOf(mdRight[0]) <= converted.markdown.indexOf(mdLeft[3])
        )
          throw new Error("Ordem divergente");
        if ((await hash(bytes)) !== before) throw new Error("Original alterado");
        rows.push({ options, pass, ms, ...converted, sourceUnchanged: true });
      }
    }
    return {
      rows,
      fixture: { bytes: Array.from(bytes), sha256: before },
      expected: { left: mdLeft, right: mdRight, table: mdTable },
      userAgent: navigator.userAgent,
    };
  });
  const bytes = Buffer.from(result.fixture.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), result.fixture.sha256);
  await writeFile(resolve(output, "corpus-md-c1.pdf"), bytes);
  result.fixture.size = bytes.length;
  delete result.fixture.bytes;
  for (const [index, row] of result.rows.entries()) {
    const text = Buffer.from(row.markdown, "utf8");
    row.outputSha256 = createHash("sha256").update(text).digest("hex");
    row.utf8Bytes = text.length;
    await writeFile(resolve(output, `saida-${index + 1}.md`), text);
  }
  result.measuredAt = new Date().toISOString();
  result.device = {
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
  };
  result.versions = {
    pdfjs: require("pdfjs-dist/package.json").version,
    pdfLib: require("pdf-lib/package.json").version,
    chromium: browser.version(),
  };
  result.method =
    "6 extrações locais do mesmo corpus. ms somente conversão; first/repeat no mesmo navegador e cache de disco não esvaziado. Hash de entrada conferido antes/depois. Todas as linhas das duas colunas presentes uma vez. Não mede pico de memória nem homologa layouts arbitrários.";
  await writeFile(resolve(output, "measurement.json"), JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        fixture: result.fixture,
        rows: result.rows.map(({ markdown, pageReports, ...row }) => row),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
