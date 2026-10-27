import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { decodePDFRawStream, PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import { captureAccessSnapshot } from "../src/platform/__fixtures__/q-c0-access/inspect";
import {
  bwBands,
  contrastBands,
  createCompressionCorpus,
  createScanImage,
  grayscaleBands,
  scanBands,
} from "../src/platform/__fixtures__/q-c0-compress-scan/corpus";

const route = (path: string) => `${process.env.NEXOHUB_BASE_PATH ?? "/"}${path}`;
async function download(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar arquivo gerado", exact: true }).click();
  return new Uint8Array(await readFile(await (await pending).path()));
}
async function heapSample(page: Page) {
  return page.evaluate(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return memory?.usedJSHeapSize ?? null;
  });
}
function imageStream(doc: PDFDocument) {
  const stream = doc.context
    .enumerateIndirectObjects()
    .map(([, value]) => value)
    .find(
      (value) =>
        value instanceof PDFRawStream &&
        value.dict.get(PDFName.of("Subtype")) === PDFName.of("Image") &&
        value.dict.get(PDFName.of("ColorSpace")) === PDFName.of("DeviceRGB"),
    );
  if (!(stream instanceof PDFRawStream)) throw new Error("Imagem RGB ausente");
  return stream;
}

for (const [level, expectedWidth] of [
  ["less", 2800],
  ["recommended", 2000],
  ["extreme", 1400],
] as const) {
  test(`compressão ${level} preserva documento rico e mede a imagem reamostrada`, async ({
    page,
  }) => {
    await page.goto(route("comprimir-pdf"));
    const jpeg = await page.evaluate(createScanImage, {
      width: 3000,
      height: 1800,
      mime: "image/jpeg",
      noise: true,
    });
    const source = await createCompressionCorpus(new Uint8Array(Buffer.from(jpeg, "base64")));
    const baseline = await captureAccessSnapshot(source);
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "corpus.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(source),
      });
    await page
      .locator(`.ilovepdf-level-card`)
      .nth(level === "extreme" ? 0 : level === "recommended" ? 1 : 2)
      .click();
    const heapBefore = await heapSample(page);
    const started = Date.now();
    await page.locator(".ilovepdf-action-red-btn").click();
    const output = await download(page);
    const elapsedMs = Date.now() - started;
    const heapAfter = await heapSample(page);
    expect(output.length).toBeLessThan(source.length);
    expect(await captureAccessSnapshot(output)).toEqual(baseline);
    const image = imageStream(await PDFDocument.load(output));
    expect(image.dict.lookup(PDFName.of("Width"), PDFNumber).asNumber()).toBe(expectedWidth);
    expect(image.dict.lookup(PDFName.of("Height"), PDFNumber).asNumber()).toBe(expectedWidth * 0.6);
    expect(image.dict.get(PDFName.of("Filter"))).toBe(PDFName.of("DCTDecode"));
    const quality = await page.evaluate(
      async ({ original, result }) => {
        const a = await createImageBitmap(
          new Blob([Uint8Array.from(atob(original), (char) => char.charCodeAt(0))], {
            type: "image/jpeg",
          }),
        );
        const b = await createImageBitmap(
          new Blob([Uint8Array.from(atob(result), (char) => char.charCodeAt(0))], {
            type: "image/jpeg",
          }),
        );
        try {
          const pixels: Uint8ClampedArray[] = [];
          for (const bitmap of [a, b]) {
            const canvas = document.createElement("canvas");
            canvas.width = b.width;
            canvas.height = b.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas");
            ctx.drawImage(bitmap, 0, 0, b.width, b.height);
            pixels.push(ctx.getImageData(0, 0, b.width, b.height).data);
          }
          let squared = 0,
            absolute = 0,
            count = 0;
          for (let i = 0; i < pixels[0].length; i++)
            if (i % 4 !== 3) {
              const difference = pixels[0][i] - pixels[1][i];
              squared += difference * difference;
              absolute += Math.abs(difference);
              count++;
            }
          return { psnr: 10 * Math.log10((255 * 255) / (squared / count)), mae: absolute / count };
        } finally {
          a.close();
          b.close();
        }
      },
      { original: jpeg, result: Buffer.from(image.getContents()).toString("base64") },
    );
    expect(quality.psnr).toBeGreaterThanOrEqual(25);
    console.log(
      "Q_C0_COMPRESS",
      JSON.stringify({
        level,
        inputBytes: source.length,
        outputBytes: output.length,
        elapsedMs,
        heapBefore,
        heapAfter,
        ...quality,
      }),
    );
  });
}

test("scanner confere pixels de quatro filtros, ordem e rotação no PDF baixado", async ({
  page,
}) => {
  await page.goto(route("digitalizar-pdf"));
  const png = await page.evaluate(createScanImage, { width: 192, height: 96, mime: "image/png" });
  await page.locator('input[accept="image/jpeg,image/png,image/webp"]').setInputFiles(
    Array.from({ length: 4 }, (_, i) => ({
      name: `faixas-${i}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    })),
  );
  const filters = page.locator('select[id^="filter-"]');
  await expect(filters).toHaveCount(4);
  for (const [i, filter] of ["original", "grayscale", "bw", "contrast"].entries())
    await filters.nth(i).selectOption(filter);
  await page.getByRole("button", { name: "Girar 90°", exact: true }).nth(1).click();
  await page.getByRole("button", { name: "Mover para Esquerda", exact: true }).nth(3).click();
  await page.locator("#scan-page-size").selectOption("fit");
  await page.locator("#scan-margins").selectOption("none");
  await page.locator(".ilovepdf-action-red-btn").click();
  const output = await download(page);
  const doc = await PDFDocument.load(output);
  expect(doc.getPageCount()).toBe(4);
  expect(doc.getPages().map((sheet) => sheet.getRotation().angle)).toEqual([0, 90, 0, 0]);
  const expected = [scanBands, grayscaleBands, contrastBands, bwBands];
  for (const [i, sheet] of doc.getPages().entries()) {
    expect([sheet.getWidth(), sheet.getHeight()]).toEqual([192, 96]);
    const resources = sheet.node.Resources()?.lookup(PDFName.of("XObject"));
    if (!resources || !("keys" in resources)) throw new Error("XObject ausente");
    const image = doc.context.lookup(resources.get(resources.keys()[0]));
    if (!(image instanceof PDFRawStream)) throw new Error("Imagem ausente");
    const pixels = decodePDFRawStream(image).getBytes();
    for (const [band, x] of [32, 96, 160].entries()) {
      const offset = (48 * 192 + x) * 3;
      expect([...pixels.slice(offset, offset + 3)]).toEqual(expected[i][band]);
    }
  }
});

for (const failure of ["decoder", "encoder"] as const) {
  test(`falha ${failure} do filtro não gera PDF e permite recuperar escolhendo Original`, async ({
    page,
  }) => {
    await page.goto(route("digitalizar-pdf"));
    const png = await page.evaluate(createScanImage, { width: 192, height: 96, mime: "image/png" });
    await page.locator('input[accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: "controle.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    await page.locator('select[id^="filter-"]').selectOption("bw");
    await page.evaluate((failure) => {
      if (failure === "decoder")
        Object.defineProperty(window, "createImageBitmap", {
          value: () => Promise.reject(new Error("decoder")),
        });
      else
        HTMLCanvasElement.prototype.toBlob = (callback) => {
          callback(null);
        };
    }, failure);
    await page.locator(".ilovepdf-action-red-btn").click();
    await expect(page.getByRole("alert")).toContainText("Não foi possível aplicar o filtro.");
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("nexohub:recent-operations:v2") ?? "[]"),
      ),
    ).toEqual([]);
    await expect(
      page.getByRole("link", { name: "Baixar arquivo gerado", exact: true }),
    ).toHaveCount(0);
    await page.locator('select[id^="filter-"]').selectOption("original");
    await page.locator(".ilovepdf-action-red-btn").click();
    expect((await PDFDocument.load(await download(page))).getPageCount()).toBe(1);
  });
}

for (const mime of ["image/jpeg", "image/webp"] as const) {
  test(`scanner ${mime} mantém faixas, proporção e margem em Letter automático`, async ({
    page,
  }) => {
    await page.goto(route("digitalizar-pdf"));
    const image = await page.evaluate(createScanImage, { width: 192, height: 96, mime });
    await page.locator('input[accept="image/jpeg,image/png,image/webp"]').setInputFiles({
      name: `controle.${mime === "image/jpeg" ? "jpg" : "webp"}`,
      mimeType: mime,
      buffer: Buffer.from(image, "base64"),
    });
    await page.locator("#scan-page-size").selectOption("Letter");
    await page.locator("#scan-margins").selectOption("normal");
    await page.locator(".ilovepdf-action-red-btn").click();
    const doc = await PDFDocument.load(await download(page));
    expect(doc.getPageCount()).toBe(1);
    const sheet = doc.getPage(0);
    expect([sheet.getWidth(), sheet.getHeight()]).toEqual([792, 612]);
    const stream = imageStream(doc);
    const bytes =
      mime === "image/jpeg" ? stream.getContents() : decodePDFRawStream(stream).getBytes();
    const actual =
      mime === "image/jpeg"
        ? await page.evaluate(
            async (data) => {
              const bitmap = await createImageBitmap(
                new Blob([new Uint8Array(data)], { type: "image/jpeg" }),
              );
              try {
                const canvas = document.createElement("canvas");
                canvas.width = 192;
                canvas.height = 96;
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error("Canvas");
                ctx.drawImage(bitmap, 0, 0);
                return [32, 96, 160].map((x) =>
                  [...ctx.getImageData(x, 48, 1, 1).data].slice(0, 3),
                );
              } finally {
                bitmap.close();
              }
            },
            [...bytes],
          )
        : [32, 96, 160].map((x) => [...bytes.slice((48 * 192 + x) * 3, (48 * 192 + x) * 3 + 3)]);
    for (let band = 0; band < 3; band++)
      for (let channel = 0; channel < 3; channel++)
        expect(Math.abs(actual[band][channel] - scanBands[band][channel])).toBeLessThanOrEqual(8);
    const contents = sheet.node.Contents();
    if (!contents || !("asArray" in contents)) throw new Error("Streams de página ausentes");
    const operators = contents
      .asArray()
      .map((ref) => {
        const raw = doc.context.lookup(ref);
        if (!(raw instanceof PDFRawStream)) throw new Error("Stream inválido");
        return new TextDecoder().decode(decodePDFRawStream(raw).getBytes());
      })
      .join("\n");
    expect(operators).toContain("1 0 0 1 300 258 cm");
    expect(operators).toContain("192 0 0 96 0 0 cm");
  });
}
