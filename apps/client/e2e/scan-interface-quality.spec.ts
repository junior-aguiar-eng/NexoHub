import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import {
  bwBands,
  contrastBands,
  createScanImage,
  grayscaleBands,
  scanBands,
} from "../src/platform/__fixtures__/q-c0-compress-scan/corpus";

// Percorre o foco real: não usa focus(), click() ou selectOption() para operar a mesa.
async function reach(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let step = 0; step < 80; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}
async function activate(page: Page, target: Locator) {
  await reach(page, target);
  await page.keyboard.press("Enter");
}
async function choose(page: Page, target: Locator, keys: string[], value: string) {
  await reach(page, target);
  for (const key of keys) await page.keyboard.press(key);
  await expect(target).toHaveValue(value);
}
async function showPart(page: Page, name: string) {
  const tab = page.getByRole("button", { name, exact: true });
  if (await tab.isVisible()) await activate(page, tab);
}
async function fits(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
  for (const selector of [
    "[data-workspace-part=toolbar]",
    "[data-workspace-part=options]",
    "[data-workspace-part=document]",
  ]) {
    for (const part of await page.locator(selector).all()) {
      if (await part.isVisible())
        expect(
          await part.evaluate((element) => element.scrollWidth - element.clientWidth),
          selector,
        ).toBeLessThanOrEqual(1);
    }
  }
}

for (const width of [390, 768, 1024, 1366])
  for (const theme of ["light", "dark"]) {
    test(`scanner teclado ${width} tema ${theme}: entrada, filtros, ordem, erro e download`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}digitalizar-pdf`);
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const panel = page.getByTestId("scan-to-pdf-panel");
      await expect(panel).toBeVisible();
      await fits(page, width);
      const png = await page.evaluate(createScanImage, {
        width: 192,
        height: 96,
        mime: "image/png",
      });
      const chooser = page.waitForEvent("filechooser");
      await activate(
        page,
        page.getByRole("button", { name: "Carregar Fotos do Dispositivo", exact: true }),
      );
      await (await chooser).setFiles(
        Array.from({ length: 5 }, (_, index) => ({
          name: `faixas-${index}.png`,
          mimeType: "image/png",
          buffer: Buffer.from(png, "base64"),
        })),
      );
      await showPart(page, "Documento");
      await expect(page.getByTestId("scanned-item-5")).toBeVisible();
      await activate(
        page,
        page.getByTestId("scanned-item-5").getByRole("button", { name: "Remover", exact: true }),
      );
      await expect(page.getByTestId("scanned-item-5")).toHaveCount(0);
      const filters = page.locator('select[id^="filter-"]');
      for (const [index, value] of ["original", "bw", "grayscale", "contrast"].entries())
        await choose(
          page,
          filters.nth(index),
          ["Home", ...Array.from({ length: index }, () => "ArrowDown"), "Tab"],
          value,
        );
      await activate(
        page,
        page.getByTestId("scanned-item-2").getByRole("button", { name: "Girar 90°", exact: true }),
      );
      await activate(
        page,
        page
          .getByTestId("scanned-item-4")
          .getByRole("button", { name: "Mover para Esquerda", exact: true }),
      );
      for (const [index, value] of ["original", "bw", "contrast", "grayscale"].entries())
        await expect(filters.nth(index)).toHaveValue(value);
      for (const card of await page.locator('[data-testid^="scanned-item-"]').all()) {
        const bounds = await card.boundingBox();
        const number = await card.locator("span").first().boundingBox();
        expect(number?.height).toBeLessThanOrEqual(30);
        expect(bounds).not.toBeNull();
        for (const button of await card.getByRole("button").all()) {
          const box = await button.boundingBox();
          expect(box).not.toBeNull();
          if (bounds && box) {
            expect(box.x).toBeGreaterThanOrEqual(bounds.x);
            expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
          }
        }
      }
      await fits(page, width);
      await page.screenshot({ path: info.outputPath("scanner-documento.png") });
      await showPart(page, "Opções");
      await choose(page, page.locator("#scan-page-size"), ["End", "Tab"], "fit");
      await choose(
        page,
        page.locator("#scan-orientation"),
        ["Home", "ArrowDown", "Tab"],
        "portrait",
      );
      await choose(page, page.locator("#scan-margins"), ["Home", "Tab"], "none");
      await fits(page, width);
      await page.screenshot({ path: info.outputPath("scanner-opcoes.png") });
      // Falha de encoder no Chromium real, sem alterar o motor ou seus pixels.
      await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = (callback) => {
          HTMLCanvasElement.prototype.toBlob = original;
          callback(null);
        };
      });
      const action = page.locator(".ilovepdf-action-red-btn");
      await activate(page, action);
      await expect(page.getByRole("alert")).toContainText("Não foi possível aplicar o filtro.");
      if (width <= 900) {
        const alert = await page.getByRole("alert").boundingBox();
        const button = await action.boundingBox();
        expect(alert?.width).toBeGreaterThanOrEqual(width - 40);
        if (alert && button) expect(button.y).toBeGreaterThanOrEqual(alert.y + alert.height);
      }
      const result = page.getByRole("link", { name: "Baixar arquivo gerado", exact: true });
      await expect(result).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("nexohub:recent-operations:v2") ?? "[]"),
        ),
      ).toEqual([]);
      await fits(page, width);
      await page.screenshot({ path: info.outputPath("scanner-erro.png") });
      // Repetir a operação recupera a falha transitória e preserva os filtros escolhidos.
      await activate(page, action);
      await expect(result).toBeVisible();
      await fits(page, width);
      const pending = page.waitForEvent("download");
      await activate(page, result);
      const output = await readFile(await (await pending).path());
      const doc = await PDFDocument.load(output);
      expect(doc.getPageCount()).toBe(4);
      expect(doc.getPages().map((sheet) => sheet.getRotation().angle)).toEqual([0, 90, 0, 0]);
      for (const [index, sheet] of doc.getPages().entries()) {
        expect([sheet.getWidth(), sheet.getHeight()]).toEqual([192, 96]);
        const resources = sheet.node.Resources()?.lookup(PDFName.of("XObject"));
        if (!resources || !("keys" in resources)) throw new Error("XObject ausente");
        const image = doc.context.lookup(resources.get(resources.keys()[0]));
        if (!(image instanceof PDFRawStream)) throw new Error("Imagem ausente");
        const pixels = decodePDFRawStream(image).getBytes();
        for (const [band, x] of [32, 96, 160].entries()) {
          const offset = (48 * 192 + x) * 3;
          expect([...pixels.slice(offset, offset + 3)]).toEqual(
            [scanBands, bwBands, contrastBands, grayscaleBands][index][band],
          );
        }
      }
      await page.screenshot({ path: info.outputPath("scanner-resultado.png") });
    });
  }
