// Somente benchmark: página mínima em servidor Vite temporário, sem abrir a UI.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const started = performance.now();
console.log(JSON.stringify({ phase: "initialize" }));
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../apps/client/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const [profile, input, output] = process.argv.slice(2);
const server = await createServer({
  root: resolve(root, "apps/client"),
  server: { host: "127.0.0.1", port: 4193, strictPort: true },
});
server.middlewares.use((req, res, next) => {
  if (req.url !== "/__xl_bench__") return next();
  res.setHeader("Content-Type", "text/html");
  res.end("<!doctype html><html lang='pt-BR'><title>XL-C1 isolado</title></html>");
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let workers = 0;
  let closedWorkers = 0;
  page.on("worker", (worker) => {
    workers++;
    worker.on("close", () => {
      closedWorkers++;
    });
  });
  await page.goto("http://127.0.0.1:4193/__xl_bench__");
  await page.evaluate(async () => {
    window.xlExtractor = (
      await import("/src/platform/excel-converter.ts")
    ).extractPdfSpreadsheetData;
  });
  const initializationMs = performance.now() - started;
  const bytes = Array.from(await readFile(input));
  const runs = [];
  for (let index = 0; index < 3; index++) {
    console.log(JSON.stringify({ phase: `extract-${index + 1}` }));
    runs.push(
      await page.evaluate(
        async ({ data, selected, pass }) => {
          const options = selected
            ? {
                selectedPages: [2],
                region: { left: 0, top: 0.1, width: 1, height: 0.2 },
                columnSeparators: [0.3, 0.62],
                preserveText: true,
              }
            : { preserveText: true };
          const before = performance.now();
          const result = await window.xlExtractor(new Uint8Array(data), options);
          return {
            pass,
            extractionMs: performance.now() - before,
            tables: result.sheets.map((s) => ({ page: s.pageIndex + 1, rows: s.rows })),
          };
        },
        { data: bytes, selected: profile.endsWith("roi"), pass: index + 1 },
      ),
    );
    console.log(JSON.stringify({ phase: "between" }));
  }
  await writeFile(
    output,
    JSON.stringify({
      profile,
      initializationMs,
      runs,
      runtime: {
        node: process.version,
        chromium: browser.version(),
        pdfjs: require("pdfjs-dist/package.json").version,
        workers,
        closedWorkers,
      },
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
