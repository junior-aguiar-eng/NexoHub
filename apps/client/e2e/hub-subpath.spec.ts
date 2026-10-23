import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test.skip(process.env.NEXOHUB_BASE_PATH !== "/hub/", "Exige build de validação com base /hub/.");

async function document() {
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText("Contrato original", { x: 60, y: 450 });
  pdf.addPage([400, 600]).drawText("Segunda pagina");
  return Buffer.from(await pdf.save());
}
async function download(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  return readFile(await (await pending).path());
}

test("catálogo, histórico, acesso direto e favicons ficam em /hub/", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && !url.pathname.startsWith("/hub/"))
      outside.push(url.pathname);
  });
  await page.goto("/hub/");
  await expect(page).toHaveURL(/\/hub\/pdf$/);
  await expect(page.locator(".tool-card")).toHaveCount(28);
  await page.getByRole("button", { name: /alternar para modo imagem/i }).click();
  await expect(page).toHaveURL(/\/hub\/img$/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/hub/favicon-img.svg");
  await page.goBack();
  await expect(page).toHaveURL(/\/hub\/pdf$/);
  await expect(page.locator(".tool-card")).toHaveCount(28);
  await page.locator('.tool-card[aria-label="Juntar PDF"]').click();
  await expect(page).toHaveURL(/\/hub\/juntar-pdf$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Juntar PDF", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
  await expect(page).toHaveURL(/\/hub\/pdf$/);
  expect(outside).toEqual([]);
});

test("revisão carrega os dicionários reais dentro de /hub/", async ({ page }) => {
  const aff = page.waitForResponse((response) =>
    response.url().endsWith("/hub/dictionaries/pt-BR/pt_BR.aff"),
  );
  const dic = page.waitForResponse((response) =>
    response.url().endsWith("/hub/dictionaries/pt-BR/pt_BR.dic"),
  );
  await page.goto("/hub/revisar-texto");
  await page.getByRole("button", { name: "Digitar Texto" }).click();
  await page.locator("#dedicated-tool-direct-textarea").fill("Eu fasso e fasso.");
  await page.getByRole("button", { name: "Revisar Texto", exact: true }).click();
  expect((await aff).ok()).toBe(true);
  expect((await dic).ok()).toBe(true);
  await page.getByRole("button", { name: "Aplicar Todas as Correções" }).click();
  await expect(page.locator(".text-review-textarea")).toHaveValue("Eu faço e faço.");
});

test("PDF mantém upload e download na subpasta", async ({ page }) => {
  await page.goto("/hub/rotacionar-pdf");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "original.pdf",
      mimeType: "application/pdf",
      buffer: await document(),
    });
  await page.getByRole("button", { name: /Girar Direita/ }).click();
  const result = await PDFDocument.load(await download(page));
  expect(result.getPageCount()).toBe(2);
  expect(result.getPage(0).getRotation().angle).toBe(90);
});

test("editor carrega WASM e comparação executa worker em /hub/", async ({ page }) => {
  const wasm = page.waitForResponse(
    (response) =>
      response.url().includes("/hub/assets/pdfium-") && response.url().endsWith(".wasm"),
  );
  await page.goto("/hub/editar-pdf");
  const buffer = await document();
  await page
    .getByLabel("Selecionar PDF", { exact: true })
    .setInputFiles({ name: "original.pdf", mimeType: "application/pdf", buffer });
  await expect(
    page.getByRole("button", { name: "Editar texto existente", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  expect((await wasm).ok()).toBe(true);
  await page.goto("/hub/comparar-pdf");
  for (const side of ["original", "revisado"]) {
    await page
      .getByLabel(`PDF ${side}`, { exact: true })
      .setInputFiles({ name: `${side}.pdf`, mimeType: "application/pdf", buffer });
  }
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  const report = page.getByRole("button", { name: "Baixar relatório PDF", exact: true });
  await expect(report).toBeVisible({ timeout: 30000 });
  const pending = page.waitForEvent("download");
  await report.click();
  expect(
    (await PDFDocument.load(await readFile(await (await pending).path()))).getPageCount(),
  ).toBeGreaterThan(0);
});

test("imagem exporta pelo worker na subpasta", async ({ page }) => {
  await page.goto("/hub/girar-imagem");
  const png = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 40;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    if (!blob) throw new Error("Imagem não gerada");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(png) });
  const bytes = await download(page);
  const size = await page.evaluate(async (bytes) => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
    const result = [image.width, image.height];
    image.close();
    return result;
  }, Array.from(bytes));
  expect(size).toEqual([40, 80]);
});
