import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";

async function document(texts: string[], scanned = false) {
  const pdf = await PDFDocument.create();
  for (const [index, text] of texts.entries()) {
    const page = pdf.addPage([400, 600]);
    if (scanned)
      page.drawRectangle({
        x: 40,
        y: 300,
        width: 160 + index * 10,
        height: 90,
        color: rgb(index / 10, 0.3, 0.7),
      });
    else page.drawText(text, { x: 40, y: 500, size: 16 });
  }
  return pdf.save();
}
async function select(page: Page, side: "original" | "revisado", bytes: Uint8Array) {
  await page.getByLabel(`PDF ${side}`, { exact: true }).setInputFiles({
    name: `${side}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
}
async function download(page: Page, name: string) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return new Uint8Array(await readFile(await (await waiting).path()));
}
async function compare(page: Page, left: Uint8Array, right: Uint8Array) {
  await page.goto("/comparar-pdf");
  await select(page, "original", left);
  await select(page, "revisado", right);
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Baixar relatório PDF", exact: true })).toBeVisible(
    { timeout: 30000 },
  );
}

test("compara PDFs reais no worker, alinha inserção e exporta relatório e JSON", async ({
  page,
}) => {
  await compare(
    page,
    await document(["Primeira pagina", "Ultima pagina"]),
    await document(["Primeira pagina", "Nova pagina", "Ultima pagina"]),
  );
  const json = JSON.parse(new TextDecoder().decode(await download(page, "Baixar dados JSON")));
  expect(
    json.pairs.map(
      (pair: { leftPage: number | null; rightPage: number | null; status: string }) => [
        pair.leftPage,
        pair.rightPage,
        pair.status,
      ],
    ),
  ).toEqual([
    [1, 1, "unchanged"],
    [null, 2, "added"],
    [2, 3, "unchanged"],
  ]);
  const pdf = await PDFDocument.load(await download(page, "Baixar relatório PDF"));
  expect(pdf.getPageCount()).toBe(2);
  await page.getByRole("button", { name: /Página — ↔ 2/ }).click();
  await expect(page.getByText("Nova pagina", { exact: false }).last()).toBeVisible();
  await page.getByRole("button", { name: "Visual", exact: true }).click();
  await expect(page.getByText("Página ausente neste documento", { exact: true })).toBeVisible();
});

test("documentos sem texto usam modo visual e permitem sobreposição e zoom", async ({ page }) => {
  const left = await document([""], true);
  const pdf = await PDFDocument.load(left);
  pdf.getPage(0).drawRectangle({ x: 150, y: 200, width: 100, height: 80, color: rgb(1, 0, 0) });
  await compare(page, left, await pdf.save());
  await expect(page.getByRole("button", { name: "Texto", exact: true })).toBeDisabled();
  await expect(page.getByText(/Texto indisponível em um dos PDFs/)).toBeVisible();
  await page.getByLabel("Sobrepor revisado ao original").check();
  await expect(page.getByLabel("Opacidade da sobreposição")).toBeVisible();
  await page.getByRole("button", { name: "Ampliar zoom" }).click();
  const json = JSON.parse(new TextDecoder().decode(await download(page, "Baixar dados JSON")));
  expect(json.pairs[0].visualChanged).toBe(true);
  expect(json.pairs[0].textChanged).toBe(false);
});

test("cancelar encerra o worker e uma nova seleção descarta o resultado anterior", async ({
  page,
}) => {
  await page.goto("/comparar-pdf");
  const large = await document(Array.from({ length: 30 }, (_, i) => `Pagina ${i}`));
  await select(page, "original", large);
  await select(page, "revisado", large);
  const started = page.waitForEvent("worker");
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  const worker = await started;
  const ended = worker.waitForEvent("close");
  await page.getByRole("button", { name: "Cancelar comparação" }).click();
  await ended;
  await expect(page.getByRole("button", { name: "Comparar PDFs", exact: true })).toBeEnabled();
  await select(page, "original", await document(["Antes"]));
  await select(page, "revisado", await document(["Depois"]));
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Baixar relatório PDF" })).toBeVisible({
    timeout: 30000,
  });
  await select(page, "original", await document(["Outro documento"]));
  await expect(page.getByRole("button", { name: "Baixar relatório PDF" })).toHaveCount(0);
});

test("PDF protegido recebe erro legível e permite nova tentativa", async ({ page }) => {
  const protectedBytes = new Uint8Array(
    await readFile(new URL("../src/platform/__fixtures__/pdf-unlock/AES-256.pdf", import.meta.url)),
  );
  await page.goto("/comparar-pdf");
  await select(page, "original", protectedBytes);
  await select(page, "revisado", await document(["Exemplo"]));
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("exige senha", { timeout: 30000 });
  await expect(page.getByRole("button", { name: "Comparar PDFs", exact: true })).toBeEnabled();
});

test("comparador com resultado cabe nas quatro larguras e mantém foco visível", async ({
  page,
}, testInfo) => {
  await compare(page, await document(["Versao antiga"]), await document(["Versao nova"]));
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Visual", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath(`comparar-${width}.png`), fullPage: true });
    const zoom = page.getByRole("button", { name: "Ampliar zoom" });
    await zoom.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(zoom).toBeFocused();
    await expect(zoom).toHaveCSS("outline-style", "solid");
  }
});
