import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function upload(page: Page, route: string, bytes: Uint8Array) {
  await page.goto(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "auditoria.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
}
async function output(page: Page) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  return new Uint8Array(await readFile(await (await waiting).path()));
}
async function source(rows = [["SEGREDO"], ["PUBLICO"]]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 400]);
  rows.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) page.drawText(value, { x: 40 + c * 180, y: 330 - r * 30, size: 12 });
    });
  });
  return pdf.save();
}

test("proteção exporta senha exata e restrições reais de impressão", async ({ page }) => {
  await upload(page, "/proteger-pdf", await source());
  await page.getByLabel("Senha de abertura do documento", { exact: true }).fill(" senha exata ");
  await page.getByLabel("Confirmar senha", { exact: true }).fill(" senha exata ");
  await page.getByRole("checkbox", { name: "Permitir impressão do documento" }).uncheck();
  await page.locator(".ilovepdf-action-red-btn").click();
  const bytes = await output(page);
  const wrong = pdfjs.getDocument({ data: bytes.slice(), password: "senha exata" });
  await expect(wrong.promise).rejects.toThrow();
  await wrong.destroy();
  const task = pdfjs.getDocument({ data: bytes.slice(), password: " senha exata " });
  try {
    const document = await task.promise;
    const permissions = await document.getPermissions();
    expect(permissions).not.toContain(pdfjs.PermissionFlag.PRINT);
    expect(permissions).not.toContain(pdfjs.PermissionFlag.PRINT_HIGH_QUALITY);
    expect(permissions).not.toContain(pdfjs.PermissionFlag.ASSEMBLE);
    expect((await (await document.getPage(1)).getTextContent()).items.length).toBeGreaterThan(0);
  } finally {
    await task.destroy();
  }
});

test("documento protegido oferece desbloqueio e navega mantendo o arquivo", async ({ page }) => {
  const bytes = new Uint8Array(
    await readFile(new URL("../src/platform/__fixtures__/pdf-unlock/AES-256.pdf", import.meta.url)),
  );
  await upload(page, "/proteger-pdf", bytes);
  await page.getByRole("button", { name: "Ir para Desbloquear PDF" }).click();
  await expect(page).toHaveURL(/\/desbloquear-pdf$/);
  await expect(page.getByPlaceholder("Digite a senha do PDF...")).toBeVisible();
});

test("ocultação real gera documento sem texto original recuperável", async ({ page }) => {
  await upload(page, "/ocultar-pdf", await source());
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await page.getByRole("button", { name: "Adicionar Tarja Manual" }).click();
  await page.getByLabel("Posição horizontal (%)").fill("0");
  await page.getByLabel("Posição vertical (%)").fill("0");
  await page.getByLabel("Largura (%)").fill("100");
  await page.getByLabel("Altura (%)").fill("50");
  await page.locator(".ilovepdf-action-red-btn").click();
  const bytes = await output(page);
  const task = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const document = await task.promise;
    expect((await (await document.getPage(1)).getTextContent()).items).toHaveLength(0);
    expect(await (await document.getPage(1)).getAnnotations()).toHaveLength(0);
    expect(await document.getAttachments()).toBeNull();
    expect(document.numPages).toBe(1);
  } finally {
    await task.destroy();
  }
});

test("Excel mostra dados reais e exporta células vazias e códigos intactos", async ({ page }) => {
  await upload(
    page,
    "/pdf-para-excel",
    await source([
      ["Código", "Produto", "Valor"],
      ["00123", "", "15.50"],
    ]),
  );
  await expect(page.getByTestId("excel-preview-table")).toContainText("00123");
  await expect(page.getByTestId("excel-preview-table")).not.toContainText("Notebook Dell");
  await page.locator(".ilovepdf-action-red-btn").click();
  const bytes = await output(page);
  const xml = strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
  expect(xml).toContain('<c r="A2" t="inlineStr"><is><t>00123</t>');
  expect(xml).toContain('<c r="B2" t="inlineStr"><is><t></t>');
  expect(xml).toContain('<c r="C2"><v>15.50</v>');
});

test("Excel não anuncia sucesso quando o PDF precisa de OCR", async ({ page }) => {
  await upload(page, "/pdf-para-excel", await source([]));
  await expect(page.getByText(/Este PDF não contém texto selecionável/)).toBeVisible();
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
});

for (const route of ["/proteger-pdf", "/ocultar-pdf", "/pdf-para-excel"]) {
  test(`painel ${route} mantém controles na janela em quatro larguras`, async ({ page }) => {
    const bytes = await source([
      ["Código", "Produto", "Valor"],
      ["00123", "Teclado", "15.50"],
    ]);
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await upload(page, route, bytes);
      await expect(page.locator(".dedicated-tool-page--workspace")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      const outliers = await page
        .locator("main button, main input, main select")
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width && rect.height && (rect.left < -1 || rect.right > innerWidth + 1);
            })
            .map((element) => element.getAttribute("aria-label") || element.textContent),
        );
      expect(outliers).toEqual([]);
    }
  });
}
