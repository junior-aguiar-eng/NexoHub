import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { arch, cpus, platform, totalmem } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../apps/client/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const output = resolve(root, ".superpowers/sdd/2026-10-25-ocr-c1");
await mkdir(output, { recursive: true });
const cvPath = resolve(process.argv[2] ?? resolve(output, "package/dist/opencv.js"));
const cvBytes = await readFile(cvPath);
const server = await createServer({
  root: resolve(root, "apps/client"),
  server: { host: "127.0.0.1", port: 4192, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const runtimeDownloads = [];
try {
  // Apenas recursos públicos de runtime. Documentos sintéticos ficam no navegador.
  await context.route("https://cdn.jsdelivr.net/**", async (route) => {
    const response = await context.request.get(route.request().url(), { timeout: 90000 });
    if (!response.ok()) throw new Error(`Recurso OCR indisponível: ${route.request().url()}`);
    const resource = await response.body();
    runtimeDownloads.push({
      url: route.request().url(),
      bytes: resource.length,
      sha256: createHash("sha256").update(resource).digest("hex"),
    });
    await route.fulfill({
      response,
      headers: { ...response.headers(), "access-control-allow-origin": "*" },
    });
  });
  const page = await context.newPage();
  page.on("console", (message) => console.log("browser:", message.text()));
  page.on("pageerror", (error) => console.error("browser-error:", error.message));
  await page.route("**/ocr-proof-opencv.js", (route) =>
    route.fulfill({ body: cvBytes, contentType: "application/javascript" }),
  );
  await page.goto("http://127.0.0.1:4192/");
  console.log("page ready");
  const result = await page.evaluate(async () => {
    const { performBrowserOcr } = await import("/src/platform/browser-ocr.ts");
    console.log("OCR imported");
    const font = new FontFace("OcrCorpus", "url(/standard_fonts/LiberationSans-Regular.ttf)");
    document.fonts.add(await font.load());
    console.log("font ready");
    const expected =
      "Ação pública e certidão de São Luís.\nÓrgão responsável: informação e saúde.\nProcesso 0001234-56.2026.8.02.0001\nValor R$ 1.234,56 — vencimento 25/10/2026.";
    const fixtures = [];
    const blob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    for (const kind of [
      "acentos-numeros",
      "baixo-contraste",
      "foto-inclinada",
      "foto-perspectiva",
    ]) {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 550;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = kind === "baixo-contraste" ? "#d8d8d8" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      if (kind === "foto-inclinada") {
        ctx.translate(100, 0);
        ctx.rotate((5 * Math.PI) / 180);
      }
      if (kind === "foto-perspectiva") ctx.transform(0.95, 0.025, 0.05, 0.88, 25, 20);
      ctx.font = "48px OcrCorpus";
      ctx.fillStyle = kind === "baixo-contraste" ? "#adadad" : "#151515";
      expected.split("\n").forEach((line, index) => {
        ctx.fillText(line, 60, 110 + index * 95);
      });
      ctx.restore();
      fixtures.push({
        kind,
        canvas,
        bytes: Array.from(new Uint8Array(await (await blob(canvas)).arrayBuffer())),
      });
    }
    const initStarted = performance.now();
    const workerUrl = URL.createObjectURL(
      new Blob(
        [
          'importScripts("http://127.0.0.1:4192/ocr-proof-opencv.js"); const ready = c => { self.postMessage({ready:true,version:c.getBuildInformation()}); self.onmessage = e => { const started=performance.now(); const input=c.matFromImageData(new ImageData(new Uint8ClampedArray(e.data.data),e.data.width,e.data.height)); const gray=new c.Mat(),out=new c.Mat(); try { c.cvtColor(input,gray,c.COLOR_RGBA2GRAY); c.adaptiveThreshold(gray,out,255,c.ADAPTIVE_THRESH_GAUSSIAN_C,c.THRESH_BINARY,31,15); self.postMessage({data:Array.from(out.data),ms:performance.now()-started}); } finally { input.delete(); gray.delete(); out.delete(); } }; }; if (cv.Mat) ready(cv); else cv.onRuntimeInitialized = () => ready(cv);',
        ],
        { type: "application/javascript" },
      ),
    );
    const worker = new Worker(workerUrl);
    let buildInfo;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("OPENCV_INIT_TIMEOUT")), 60000);
      worker.onmessage = (e) => {
        clearTimeout(timer);
        buildInfo = e.data.version;
        resolve();
      };
      worker.onerror = (event) => {
        clearTimeout(timer);
        reject(new Error(event.message));
      };
    });
    console.log("opencv ready");
    const cvInitMs = performance.now() - initStarted;
    const rows = [];
    try {
      for (const fixture of fixtures) {
        for (const method of ["original", "linear-1.35", "opencv-adaptive"]) {
          for (const temperature of ["cold", "warm"]) {
            const pipelineStarted = performance.now();
            let input = new Blob([new Uint8Array(fixture.bytes)], { type: "image/png" });
            let preparationMs = 0;
            if (method === "opencv-adaptive") {
              const ctx = fixture.canvas.getContext("2d");
              const prepared = await new Promise((resolve, reject) => {
                worker.onmessage = (e) => resolve(e.data);
                worker.onerror = reject;
                worker.postMessage({
                  data: Array.from(ctx.getImageData(0, 0, 1600, 550).data),
                  width: 1600,
                  height: 550,
                });
              });
              preparationMs = prepared.ms;
              const image = ctx.createImageData(1600, 550);
              for (let i = 0; i < prepared.data.length; i++) {
                image.data[4 * i] =
                  image.data[4 * i + 1] =
                  image.data[4 * i + 2] =
                    prepared.data[i];
                image.data[4 * i + 3] = 255;
              }
              const canvas = document.createElement("canvas");
              canvas.width = 1600;
              canvas.height = 550;
              canvas.getContext("2d").putImageData(image, 0, 0);
              input = await blob(canvas);
              canvas.width = canvas.height = 0;
            }
            const start = performance.now();
            console.log("measure", fixture.kind, method, temperature);
            try {
              const recognized = await performBrowserOcr(input, {
                language: "por",
                enhanceContrast: method === "linear-1.35",
              });
              rows.push({
                fixture: fixture.kind,
                method,
                temperature,
                ms: performance.now() - start,
                pipelineMs: performance.now() - pipelineStarted,
                preparationMs,
                text: recognized.text,
                confidence: recognized.pageReports[0].confidence,
                searchableBytes: recognized.searchablePdfBytes?.length ?? 0,
              });
            } catch (error) {
              rows.push({
                fixture: fixture.kind,
                method,
                temperature,
                ms: performance.now() - start,
                error: String(error),
              });
            }
          }
        }
      }
      return {
        expected,
        rows,
        fixtures: fixtures.map(({ kind, bytes }) => ({ kind, bytes })),
        cvInitMs,
        buildInfo,
        resources: performance.getEntriesByType("resource").map((r) => ({
          url: r.name,
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
        })),
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        memory:
          "memory" in performance
            ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
              }
            : null,
      };
    } finally {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      for (const f of fixtures) f.canvas.width = f.canvas.height = 0;
    }
  });
  function distance(a, b) {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++)
        next[j] = Math.min(
          next[j - 1] + 1,
          row[j] + 1,
          row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      row = next;
    }
    return row[b.length];
  }
  const normalize = (text) => text.normalize("NFC").replace(/\s+/g, " ").trim();
  const reference = normalize(result.expected);
  for (const row of result.rows)
    if (row.text !== undefined) {
      row.cer = distance([...reference], [...normalize(row.text)]) / reference.length;
      row.wer =
        distance(reference.split(" "), normalize(row.text).split(" ")) /
        reference.split(" ").length;
    }
  for (const fixture of result.fixtures) {
    if (!fixture.bytes) continue;
    const bytes = Buffer.from(fixture.bytes);
    await writeFile(resolve(output, `${fixture.kind}.png`), bytes);
    fixture.sha256 = createHash("sha256").update(bytes).digest("hex");
    fixture.size = bytes.length;
    delete fixture.bytes;
  }
  const { PDFDocument, PDFDict, PDFName, PDFRawStream, StandardFonts } = require("pdf-lib");
  const mixed = await PDFDocument.create();
  const nativePage = mixed.addPage([800, 275]);
  const regular = await mixed.embedFont(StandardFonts.Helvetica);
  nativePage.drawText("Original 000123", { x: 40, y: 200, size: 20, font: regular });
  const image = await mixed.embedPng(await readFile(resolve(output, "acentos-numeros.png")));
  mixed.addPage([800, 275]).drawImage(image, { x: 0, y: 0, width: 800, height: 275 });
  const mixedBytes = await mixed.save();
  const beforeHash = createHash("sha256").update(mixedBytes).digest("hex");
  const recognized = await page.evaluate(async (bytes) => {
    const { performBrowserOcr } = await import("/src/platform/browser-ocr.ts");
    const outcome = await performBrowserOcr(
      new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      { enhanceContrast: false },
    );
    return {
      text: outcome.text,
      pageReports: outcome.pageReports,
      lines: outcome.pageResults[1].lines,
      output: Array.from(outcome.searchablePdfBytes ?? []),
    };
  }, Array.from(mixedBytes));
  assert.deepEqual(
    recognized.pageReports.map((p) => p.source),
    ["existing-text", "ocr"],
  );
  const outputBytes = new Uint8Array(recognized.output);
  const exported = await PDFDocument.load(outputBytes);
  function imageHashes(doc) {
    const resources = doc.getPage(1).node.Resources().lookup(PDFName.of("XObject"), PDFDict);
    return resources
      .keys()
      .map((key) => resources.lookup(key))
      .filter(
        (value) =>
          value instanceof PDFRawStream &&
          value.dict.lookup(PDFName.of("Subtype")) === PDFName.of("Image"),
      )
      .map((value) => createHash("sha256").update(value.contents).digest("hex"));
  }
  assert.deepEqual(imageHashes(exported), imageHashes(mixed));
  const { getDocument, Util } = await import(
    pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
  );
  const parsing = getDocument({ data: outputBytes.slice(), disableFontFace: true });
  const parsed = await parsing.promise;
  try {
    const content = await (await parsed.getPage(1)).getTextContent();
    const nativeText = content.items
      .filter((item) => "str" in item)
      .map((item) => item.str)
      .join("");
    assert.equal(nativeText, "Original 000123");
    const sheet = await parsed.getPage(2);
    const text = await sheet.getTextContent();
    const first = text.items.find((item) => "str" in item && item.str.trim());
    assert(first);
    const transform = Util.transform(sheet.getViewport({ scale: 2 }).transform, first.transform);
    const box = recognized.lines[0].bbox;
    assert(Math.abs(transform[4] - box.x0) < 1);
    assert(Math.abs(transform[5] - box.y1) < 1);
    // PDF.js separa palavras e espaços em itens; compara a extensão da linha inteira.
    const lineItems = text.items.filter(
      (item) =>
        "str" in item &&
        item.str.trim() &&
        Math.abs(
          Util.transform(sheet.getViewport({ scale: 2 }).transform, item.transform)[5] - box.y1,
        ) < 1,
    );
    const lineEnd = Math.max(...lineItems.map((item) => item.transform[4] * 2 + item.width * 2));
    assert(Math.abs(lineEnd - box.x1) < 1);
    assert.equal(beforeHash, createHash("sha256").update(mixedBytes).digest("hex"));
    result.mixed = {
      sourceSha256: beforeHash,
      outputSha256: createHash("sha256").update(outputBytes).digest("hex"),
      originalUnchanged: true,
      imagesUnchanged: true,
      nativeText,
      ocrPageReports: recognized.pageReports,
      firstLineBbox: box,
      firstTextTransformAtScale2: transform,
      textWidthAtScale2: lineEnd - box.x0,
    };
  } finally {
    await parsing.destroy();
  }
  await writeFile(resolve(output, "mixed-source.pdf"), mixedBytes);
  await writeFile(resolve(output, "mixed-searchable.pdf"), outputBytes);
  result.candidate = {
    package: "@techstark/opencv-js",
    version: "4.12.0-release.1",
    bytes: cvBytes.length,
    sha256: createHash("sha256").update(cvBytes).digest("hex"),
  };
  result.measuredAt = new Date().toISOString();
  result.device = {
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
    platform: platform(),
    arch: arch(),
    node: process.version,
  };
  assert.match(result.buildInfo, /OpenCV 4\.12\.0/);
  result.runtimeDownloads = runtimeDownloads;
  result.cachePolicy =
    "cold = primeira chamada de cada método/fixture com worker novo; warm = repetição com worker novo. Apenas a primeira chamada da sessão começa com IndexedDB vazio. Rotas de runtime são interceptadas pelo harness, sem cache HTTP; não representam rede do usuário.";
  await writeFile(resolve(output, "measurement.json"), JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        cvInitMs: result.cvInitMs,
        fixtures: result.fixtures,
        rows: result.rows.map(({ text, ...r }) => r),
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
