import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Executar somente após consentimento atual e confirmação de página preparada.
if (!process.argv.includes("--camera-autorizada"))
  throw new Error("Consentimento atual necessário.");
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../apps/client/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { PDFDocument, PDFName, PDFRawStream } = require("pdf-lib");
const { preview } = await import(pathToFileURL(require.resolve("vite")).href);
const output = resolve(
  root,
  ".superpowers/q-c0-2026-10-27/camera",
  new Date().toISOString().replaceAll(":", "-"),
);
await mkdir(output, { recursive: true });
const base = process.argv.includes("--base-hub") ? "/hub/" : "/";
const server = await preview({
  root: resolve(root, "apps/client"),
  base,
  preview: { host: "127.0.0.1", port: 4196, strictPort: true },
});
const headless = !process.argv.includes("--com-janela");
let browser;
let page;
try {
  browser = await chromium.launch({ headless });
  const context = await browser.newContext({ permissions: ["camera"] });
  page = await context.newPage();
  await page.addInitScript(() => {
    const acquire = MediaDevices.prototype.getUserMedia;
    MediaDevices.prototype.getUserMedia = async function (constraints) {
      try {
        return await acquire.call(this, constraints);
      } catch (error) {
        window.__qC0CameraFailure = { name: error.name, message: error.message };
        throw error;
      }
    };
  });
  await page.goto(`http://127.0.0.1:4196${base}digitalizar-pdf`);
  await page.getByRole("button", { name: "Iniciar Câmera", exact: true }).first().click();
  await page.waitForFunction(
    () => {
      const video = document.querySelector("video");
      return video?.readyState >= 2 && video.videoWidth > 0;
    },
    null,
    { timeout: 15000 },
  );
  const capture = await page.evaluate(() => {
    const video = document.querySelector("video");
    window.__qC0Tracks = video.srcObject.getTracks();
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      tracks: window.__qC0Tracks.map((track) => ({
        kind: track.kind,
        readyState: track.readyState,
      })),
    };
  });
  const captureButton = page.getByRole("button", { name: "Capturar Página", exact: true });
  if (process.argv.includes("--captura-manual")) {
    await captureButton.scrollIntoViewIfNeeded();
    console.log("Prévia aberta. Enquadre a folha e clique em Capturar Página no navegador.");
    await page.getByTestId("scanned-item-1").waitFor({ timeout: 120000 });
  } else {
    await captureButton.click();
    await page.getByTestId("scanned-item-1").waitFor();
  }
  await page.getByRole("button", { name: "Parar Câmera", exact: true }).click();
  const stopped = await page.evaluate(() => window.__qC0Tracks.map((track) => track.readyState));
  assert(stopped.every((state) => state === "ended"));
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar arquivo gerado", exact: true }).click();
  const bytes = await readFile(await (await pending).path());
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  const image = doc.context
    .enumerateIndirectObjects()
    .map(([, value]) => value)
    .find(
      (value) =>
        value instanceof PDFRawStream &&
        value.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"),
    );
  assert(image instanceof PDFRawStream);
  assert.equal(image.dict.get(PDFName.of("Filter")), PDFName.of("DCTDecode"));
  assert.equal(image.dict.lookup(PDFName.of("Width")).asNumber(), capture.width);
  assert.equal(image.dict.lookup(PDFName.of("Height")).asNumber(), capture.height);
  await writeFile(resolve(output, "captura.pdf"), bytes);
  await writeFile(resolve(output, "captura.jpg"), image.getContents());
  const manifest = {
    date: new Date().toISOString(),
    browser: browser.version(),
    headless,
    base,
    manualCapture: process.argv.includes("--captura-manual"),
    source:
      "Câmera física local; página preparada e captura autorizada pelo usuário nesta execução.",
    distribution:
      "Imagem privada de ensaio, não incluída no Git; licença de redistribuição não presumida.",
    capture,
    stopped,
    pages: 1,
    outputBytes: bytes.length,
    pdfSha256: createHash("sha256").update(bytes).digest("hex"),
    imageSha256: createHash("sha256").update(image.getContents()).digest("hex"),
  };
  await writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
} catch (error) {
  const diagnostic = await page
    ?.evaluate(() => {
      const video = document.querySelector("video");
      return {
        failure: window.__qC0CameraFailure ?? null,
        video: video
          ? { readyState: video.readyState, width: video.videoWidth, height: video.videoHeight }
          : null,
      };
    })
    .catch(() => null);
  await writeFile(
    resolve(output, "failure.json"),
    `${JSON.stringify({ date: new Date().toISOString(), status: "capture-not-completed", error: error.message, diagnostic }, null, 2)}\n`,
  );
  throw error;
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
  }
}
