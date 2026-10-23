import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function source() {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([500, 700]);
  for (let line = 0; line < 24; line++)
    page.drawText(`Linha ${line + 1}: documento para conferir a leitura.`, {
      x: 35,
      y: 650 - line * 24,
      size: 12,
    });
  return pdf.save();
}
async function upload(page: Page, route: string) {
  await page.goto(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "leitura.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await source()),
    });
}
const previews = [
  ["/recortar-pdf", ".ilovepdf-file-thumb-img"],
  ["/assinar-pdf", ".ilovepdf-file-thumb-img"],
  ["/comprimir-pdf", ".ilovepdf-file-thumb-img"],
  ["/numeros-de-pagina", ".ilovepdf-file-thumb-img"],
  ["/marca-dagua", ".ilovepdf-file-thumb-img"],
  ["/proteger-pdf", ".protect-thumb-img"],
  ["/ocultar-pdf", ".redact-thumb-image"],
  ["/preencher-formulario", ".form-fill-preview-image"],
  ["/rotacionar-pdf", ".ilovepdf-rotate-thumb-img"],
] as const;
for (const [route, selector] of previews)
  test(`mesa ${route} usa a tela larga e apresenta página legível`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await upload(page, route);
    const image = page.locator(selector).first();
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".dedicated-tool-page--workspace")
          .evaluate((e) => e.getBoundingClientRect().width),
      )
      .toBeGreaterThan(1800);
    await expect
      .poll(() => image.evaluate((e) => e.getBoundingClientRect().width))
      .toBeGreaterThanOrEqual(600);
    await expect
      .poll(() => image.evaluate((e) => (e as HTMLImageElement).naturalWidth))
      .toBeGreaterThanOrEqual(800);
    const darkPixels = await image.evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return 0;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100) dark++;
      return dark;
    });
    expect(darkPixels).toBeGreaterThan(500);
    if (route === "/proteger-pdf" || route === "/ocultar-pdf") {
      const title = page
        .locator(route === "/proteger-pdf" ? ".protect-section-title" : ".redact-section-title")
        .first();
      const contrast = await title.evaluate((e) => {
        const channels = getComputedStyle(e)
          .color.match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number);
        if (channels?.length !== 3) return 0;
        const linear = channels.map((c) => {
          const v = c / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 1.05 / (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
    await page.screenshot({ path: info.outputPath("mesa-1920.png"), fullPage: true });
  });
test("mesas ampliadas continuam sem rolagem horizontal nas quatro larguras", async ({
  page,
}, info) => {
  for (const route of ["/recortar-pdf", "/ocultar-pdf", "/preencher-formulario"]) {
    await upload(page, route);
    await expect(page.locator(".dedicated-tool-page--workspace")).toBeVisible();
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      await page.screenshot({
        path: info.outputPath(`${route.slice(1)}-${width}.png`),
        fullPage: true,
      });
    }
  }
});
test("rotação ampliada mantém a página inteira dentro da sua mesa", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1000 });
  await upload(page, "/rotacionar-pdf");
  await expect(page.locator(".ilovepdf-rotate-thumb-img")).toBeVisible();
  await page.locator(".ilovepdf-rotate-control-btn").last().click();
  const stage = page.locator(".ilovepdf-rotate-rotation-stage");
  await expect(stage).toBeVisible();
  await expect
    .poll(async () => {
      const a = await stage.boundingBox(),
        b = await page.locator(".ilovepdf-rotate-thumb-img").boundingBox();
      return !!a && !!b && b.x >= a.x - 2 && b.x + b.width <= a.x + a.width + 2;
    })
    .toBe(true);
});
