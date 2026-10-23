import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function output(page: Page, path: string, bytes: Uint8Array) {
  await page.goto(path);
  await page.locator('input[type="file"]').setInputFiles({
    name: "ação.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
}

async function executeAndDownload(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  return new Uint8Array(await readFile(await (await download).path()));
}

test("PDF para JPG entrega 150 DPI e preserva cores e dimensões", async ({ page }) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([720, 360]);
  sheet.drawRectangle({ x: 0, y: 0, width: 360, height: 360, color: rgb(1, 0, 0) });
  sheet.drawRectangle({ x: 360, y: 0, width: 360, height: 360, color: rgb(0, 0, 1) });
  await output(page, "/pdf-para-jpg", await pdf.save());
  const jpg = await executeAndDownload(page);
  const image = await page.evaluate(
    async (data) => {
      const bitmap = await createImageBitmap(
        new Blob([new Uint8Array(data)], { type: "image/jpeg" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");
      context.drawImage(bitmap, 0, 0);
      const left = [...context.getImageData(bitmap.width / 4, bitmap.height / 2, 1, 1).data];
      const right = [...context.getImageData((bitmap.width * 3) / 4, bitmap.height / 2, 1, 1).data];
      const result = { width: bitmap.width, height: bitmap.height, left, right };
      bitmap.close();
      return result;
    },
    [...jpg],
  );
  expect(image.width).toBe(1500);
  expect(image.height).toBe(750);
  expect(image.left[0]).toBeGreaterThan(240);
  expect(image.left[2]).toBeLessThan(15);
  expect(image.right[2]).toBeGreaterThan(240);
  expect(image.right[0]).toBeLessThan(15);
});

for (const rotation of [0, 90, 180, 270]) {
  test(`numeração respeita área visível e rotação ${rotation}°`, async ({ page }) => {
    const pdf = await PDFDocument.create();
    const sheet = pdf.addPage([600, 800]);
    sheet.setCropBox(150, 200, 300, 400);
    sheet.setRotation(degrees(rotation));
    await output(page, "/numeros-de-pagina", await pdf.save());
    const bytes = await executeAndDownload(page);
    const task = getDocument({
      data: bytes,
      standardFontDataUrl: fileURLToPath(new URL("../public/standard_fonts/", import.meta.url)),
    });
    const parsed = await task.promise;
    try {
      const parsedPage = await parsed.getPage(1);
      const viewport = parsedPage.getViewport({ scale: 1 });
      const items = (await parsedPage.getTextContent()).items.filter((item) => "str" in item);
      const label = items.find((item) => item.str === "Página 1 de 1");
      expect(label).toBeDefined();
      if (!label) throw new Error("Numeração ausente da página visível");
      const [x, y] = viewport.convertToViewportPoint(label.transform[4], label.transform[5]);
      expect(x + label.width / 2).toBeCloseTo(viewport.width / 2, 0);
      expect(y).toBeCloseTo(viewport.height - 30, 0);
      const baselineY =
        viewport.transform[1] * label.transform[0] + viewport.transform[3] * label.transform[1];
      expect(Math.abs(baselineY)).toBeLessThan(0.01);
    } finally {
      await task.destroy();
    }
  });
}

test("marca d’água longa cabe na página recortada sem perder o texto original", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([600, 800]);
  sheet.setCropBox(150, 200, 300, 400);
  sheet.setRotation(degrees(90));
  sheet.drawText("Original preservado", {
    x: 200,
    y: 400,
    font: await pdf.embedFont(StandardFonts.Helvetica),
  });
  const stamp = "DOCUMENTO CONFIDENCIAL PARA ANÁLISE";
  await output(page, "/marca-dagua", await pdf.save());
  await page.locator("#watermark-input-text").fill(stamp);
  await expect(page.locator("#watermark-input-text")).toHaveValue(stamp);
  await page.getByRole("button", { name: "Horizontal (0°)", exact: true }).click();
  const bytes = await executeAndDownload(page);
  const task = getDocument({
    data: bytes,
    standardFontDataUrl: fileURLToPath(new URL("../public/standard_fonts/", import.meta.url)),
  });
  const parsed = await task.promise;
  try {
    const parsedPage = await parsed.getPage(1);
    const viewport = parsedPage.getViewport({ scale: 1 });
    const items = (await parsedPage.getTextContent()).items.filter((item) => "str" in item);
    expect(items.some((item) => item.str === "Original preservado")).toBe(true);
    const label = items.find((item) => item.str === stamp);
    expect(label).toBeDefined();
    if (!label) throw new Error("Estampa cortada ou ausente");
    const [x, y] = viewport.convertToViewportPoint(label.transform[4], label.transform[5]);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x + label.width).toBeLessThanOrEqual(viewport.width);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(viewport.height);
  } finally {
    await task.destroy();
  }
});
