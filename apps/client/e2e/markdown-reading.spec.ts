import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import {
  createMdC1Corpus,
  mdLeft,
  mdRight,
  mdTable,
} from "../src/platform/__fixtures__/md-c1/corpus";

const base = process.env.NEXOHUB_BASE_PATH ?? "/";
async function upload(page: Page, bytes?: Uint8Array) {
  await page.goto(`${base}pdf-para-markdown`);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "md-c1.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes ?? (await createMdC1Corpus())),
    });
  await expect(page.getByRole("img", { name: "Miniatura de md-c1.pdf" })).toBeVisible();
}
async function run(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect(page.getByRole("button", { name: "Baixar .md", exact: true })).toBeVisible();
}

test("MD-C1: ordem, texto, tabela e aviso coincidem no código, prévia e download", async ({
  page,
}) => {
  await upload(page);
  await run(page);
  const tableRows = await page
    .locator("table tr")
    .evaluateAll((rows) =>
      rows.map((row) => Array.from(row.querySelectorAll("th,td"), (cell) => cell.textContent)),
    );
  expect(tableRows).toEqual(mdTable);
  await expect(page.locator("ol").first()).toHaveAttribute("start", "1");
  await expect(page.getByText(/Páginas sem texto selecionável: 3/)).toBeVisible();
  await expect(page.getByText(/Leitura em duas colunas aplicada nas páginas: 1/)).toBeVisible();
  expect(await page.locator("teste").count()).toBe(0);
  await page.getByRole("button", { name: "Código Markdown", exact: true }).click();
  const code = await page.getByRole("textbox", { name: "Código Markdown" }).inputValue();
  expect(code.indexOf(mdRight[0])).toBeGreaterThan(code.indexOf(mdLeft[3]));
  expect(code).toContain("<!-- Página 3: sem texto selecionável -->");
  expect(code).toContain("Fim.");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar .md", exact: true }).click();
  expect(await readFile(await (await pending).path(), "utf8")).toBe(code);
});

test("MD-C1: alterar opções invalida a saída e mantém aviso com separadores desligados", async ({
  page,
}) => {
  await upload(page);
  await run(page);
  await page.getByRole("checkbox", { name: /^Incluir separadores de página/ }).uncheck();
  await expect(page.getByRole("button", { name: "Baixar .md", exact: true })).toHaveCount(0);
  await run(page);
  await page.getByRole("button", { name: "Código Markdown", exact: true }).click();
  const code = await page.getByRole("textbox", { name: "Código Markdown" }).inputValue();
  expect(code).not.toMatch(/^---$/m);
  expect(code).toContain("<!-- Página 3: sem texto selecionável -->");
  await page.getByRole("combobox", { name: "Ordem de leitura", exact: true }).selectOption("rows");
  await expect(page.getByRole("button", { name: "Baixar .md", exact: true })).toHaveCount(0);
});

test("MD-C1: texto curto não é classificado como escaneado e OCR exige clique explícito", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Fim.");
  await upload(page, await pdf.save());
  await run(page);
  await expect(page.getByText(/Páginas sem texto selecionável/)).toHaveCount(0);
  await expect(page.getByText(/Pouco texto encontrado/)).toHaveCount(0);
  await expect(page).toHaveURL(/pdf-para-markdown$/);
  await page.getByRole("button", { name: "Abrir Reconhecer Texto (OCR)", exact: true }).click();
  await expect(page).toHaveURL(/ocr-pdf$/);
  await expect(page.getByText("md-c1.pdf", { exact: true }).first()).toBeVisible();
});

test("MD-C1: cancelamento descarta leitura tardia sem criar download ou histórico", async ({
  page,
}) => {
  await upload(page);
  await page.evaluate(() => {
    const original = Blob.prototype.arrayBuffer;
    Object.assign(window, { mdOriginal: original, mdStarted: false });
    Blob.prototype.arrayBuffer = async function () {
      Object.assign(window, { mdStarted: true });
      await new Promise<void>((resolve) => Object.assign(window, { mdRelease: resolve }));
      return original.call(this);
    };
  });
  try {
    await page.locator(".ilovepdf-action-red-btn").click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "mdStarted"))).toBe(true);
    await page.getByRole("button", { name: "Cancelar conversão Markdown", exact: true }).click();
    await page.evaluate(() => Reflect.get(window, "mdRelease")());
    await expect(page.locator(".ilovepdf-action-red-btn")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Baixar .md", exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("nexohub:recent-operations:v2") ?? "[]"),
      ),
    ).toEqual([]);
  } finally {
    await page.evaluate(() => {
      Blob.prototype.arrayBuffer = Reflect.get(window, "mdOriginal");
    });
  }
});

test("MD-C1: opções e resultado cabem nas quatro larguras e nos dois temas", async ({
  page,
}, info) => {
  await upload(page);
  await run(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"])
    for (const width of [390, 768, 1024, 1440]) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      await page.setViewportSize({ width, height: 900 });
      const documentTab = page.getByRole("button", { name: "Documento", exact: true });
      if (await documentTab.isVisible()) await documentTab.click();
      const download = page.getByRole("button", { name: "Baixar .md", exact: true });
      await download.scrollIntoViewIfNeeded();
      await expect(download).toBeInViewport();
      await page.screenshot({
        path: info.outputPath(`md-${width}-${theme}-document.png`),
        fullPage: true,
      });
      const options = page.getByRole("button", { name: "Opções", exact: true });
      if (await options.isVisible()) await options.click();
      await expect(
        page.getByRole("combobox", { name: "Ordem de leitura", exact: true }),
      ).toBeVisible();
      const contrast = await page
        .getByRole("combobox", { name: "Ordem de leitura", exact: true })
        .evaluate((select) => {
          const label = select.parentElement;
          if (!label) throw new Error("Rótulo da ordem ausente");
          let ancestor: Element | null = label;
          let background = "rgba(0, 0, 0, 0)";
          while (ancestor && background === "rgba(0, 0, 0, 0)") {
            background = getComputedStyle(ancestor).backgroundColor;
            ancestor = ancestor.parentElement;
          }
          const luminance = (color: string) => {
            const rgb = (color.match(/[\d.]+/g) ?? [])
              .slice(0, 3)
              .map(Number)
              .map((value) => {
                const channel = value / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
              });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          };
          const a = luminance(getComputedStyle(label).color),
            b = luminance(background);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await expect(
        page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn"),
      ).toBeInViewport();
      await page.screenshot({ path: info.outputPath(`md-${width}-${theme}.png`), fullPage: true });
    }
});

test("MD-C1: barras e traços literais não somem na visualização nem viram tabela", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage();
  sheet.drawText("| --- | --- |", { x: 40, y: 700, size: 11 });
  sheet.drawText("---", { x: 40, y: 675, size: 11 });
  await upload(page, await pdf.save());
  await run(page);
  await expect(page.getByText("| --- | --- |", { exact: true })).toBeVisible();
  await expect(page.getByText("---", { exact: true })).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
});
