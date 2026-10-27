import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "apps/client/package.json"));
const { chromium } = require("@playwright/test");
const out = resolve(root, ".superpowers/sdd/2026-10-26-r-c1");
const server = createServer((req, res) => {
  const files = {
    "/__qpdf_glue__": ["neslinesli93--qpdf-wasm/package--dist--qpdf.js", "text/javascript"],
    "/__qpdf_wasm__": ["neslinesli93--qpdf-wasm/package--dist--qpdf.wasm", "application/wasm"],
  };
  if (files[req.url]) {
    res.setHeader("Content-Type", files[req.url][1]);
    res.end(readFileSync(resolve(out, files[req.url][0])));
    return;
  }
  if (req.url === "/__qpdf_worker__") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(
      `importScripts('/__qpdf_glue__');onmessage=async({data})=>{try{const start=performance.now();const q=await Module({locateFile:()=>'/__qpdf_wasm__'});q.FS.writeFile('/input.pdf',new Uint8Array(data));const exit=q.callMain(['/input.pdf','/output.pdf']);let bytes;try{bytes=q.FS.readFile('/output.pdf');}catch{}postMessage({exit,bytes:bytes?Array.from(bytes):null,ms:performance.now()-start});}catch(error){postMessage({error:String(error)});}};`,
    );
    return;
  }
  if (req.url === "/__bench__") {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>R-C1 local</title>");
    return;
  }
  res.statusCode = 404;
  res.end();
});
await new Promise((done) => server.listen(4195, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4195/__bench__");
  const rows = [];
  for (const id of [
    "integro",
    "prefixo",
    "sem-eof",
    "sem-startxref",
    "xref-incorreto",
    "sem-xref-trailer",
    "perda-fisica",
    "texto-objetos",
  ]) {
    const result = await page.evaluate(
      (data) =>
        new Promise((resolve) => {
          const worker = new Worker("/__qpdf_worker__");
          const timer = setTimeout(() => {
            worker.terminate();
            resolve({ error: "TIMEOUT_5000MS" });
          }, 5000);
          worker.onmessage = ({ data }) => {
            clearTimeout(timer);
            worker.terminate();
            resolve(data);
          };
          worker.onerror = (e) => {
            clearTimeout(timer);
            worker.terminate();
            resolve({ error: e.message });
          };
          worker.postMessage(data);
        }),
      Array.from(readFileSync(resolve(out, `${id}.pdf`))),
    );
    if (result.bytes) {
      writeFileSync(resolve(out, `${id}-browser-qpdf.pdf`), new Uint8Array(result.bytes));
      result.outputBytes = result.bytes.length;
      delete result.bytes;
    }
    rows.push({ id, ...result });
    console.log(JSON.stringify(rows.at(-1)));
  }
  writeFileSync(
    resolve(out, "browser-comparison.json"),
    JSON.stringify(
      { userAgent: await page.evaluate(() => navigator.userAgent), cases: rows },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
