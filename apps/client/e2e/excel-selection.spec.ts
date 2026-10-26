import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { createXlC1Corpus, xlC1Expected } from "../src/platform/__fixtures__/xl-c1/corpus";

const base = process.env.NEXOHUB_BASE_PATH === "/hub/" ? "/hub" : "";
async function upload(page: Page) {
  await page.goto(`${base}/pdf-para-excel`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "corpus.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await createXlC1Corpus(true)),
  });
  await expect(page.getByTestId("excel-preview-table")).toContainText("00123");
}
async function select(page: Page) {
  await page.getByLabel("Páginas para exportar").fill("2");
  await page.getByLabel("Topo da região (%)").fill("10");
  await page.getByLabel("Altura da região (%)").fill("20");
  await page.getByLabel("Separadores de colunas (%)").fill("30;62");
  await expect(page.getByTestId("excel-preview-table")).toContainText("00456");
  await expect(page.getByTestId("excel-preview-table")).not.toContainText("Rodapé");
  await expect(page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn")).toBeEnabled();
}
async function download(page: Page) {
  await page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  return readFile(await (await pending).path());
}
test("XL-C1: página, região e separadores produzem as mesmas células na prévia e no XLSX", async ({
  page,
}) => {
  await upload(page);
  await select(page);
  const rows = await page
    .getByTestId("excel-preview-table")
    .locator("tr")
    .evaluateAll((elements) =>
      elements.map((element, index) =>
        Array.from(
          element.querySelectorAll(index === 0 ? ".col-text" : "td:not(.excel-row-num)"),
          (cell) => cell.textContent ?? "",
        ),
      ),
    );
  expect(rows).toEqual(xlC1Expected[1]);
  const files = unzipSync(await download(page));
  const xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
  for (const [r, row] of rows.entries())
    for (const [c, value] of row.entries())
      expect(xml).toContain(
        `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${value}</t>`,
      );
  expect(files["xl/worksheets/sheet2.xml"]).toBeUndefined();
  expect(strFromU8(files["xl/workbook.xml"])).toContain("Página 2");
});
test("XL-C1: CSV conserva zeros, vazios e números pt-BR da seleção", async ({ page }) => {
  await upload(page);
  await select(page);
  await page.getByTestId("format-csv-btn").click();
  const text = new TextDecoder().decode(await download(page));
  expect(text.split("\r\n")).toEqual(xlC1Expected[1].map((row) => row.join(";")));
});

test("XL-C1: páginas 1,3 podem ser revisadas e exportadas sem incluir a página 2", async ({
  page,
}) => {
  const source = await PDFDocument.load(await createXlC1Corpus());
  const third = source.addPage([600, 800]);
  third.drawText("Código", { x: 40, y: 700, size: 11 });
  third.drawText("Produto", { x: 210, y: 700, size: 11 });
  third.drawText("09999", { x: 40, y: 670, size: 11 });
  third.drawText("Terceira página", { x: 210, y: 670, size: 11 });
  await page.goto(`${base}/pdf-para-excel`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "tres.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await source.save()),
  });
  await expect(page.getByTestId("excel-preview-table")).toContainText("00123");
  await page.getByLabel("Páginas para exportar").fill("1,3");
  await page.getByRole("button", { name: "Próxima página", exact: true }).click();
  await expect(page.getByTestId("excel-preview-table")).toContainText("09999");
  await expect(page.getByTestId("excel-preview-table")).not.toContainText("00456");
  const zip = unzipSync(await download(page));
  expect(strFromU8(zip["xl/workbook.xml"])).toContain("Página 3");
  expect(strFromU8(zip["xl/workbook.xml"])).not.toContain("Página 2");
  expect(strFromU8(zip["xl/worksheets/sheet2.xml"])).toContain("09999");
});

test("XL-C1: cancelar durante a leitura descarta conclusão tardia e histórico", async ({
  page,
}) => {
  await upload(page);
  await page.evaluate(() => {
    const native = Blob.prototype.arrayBuffer;
    Object.assign(window, { xlNativeRead: native, xlReadStarted: false });
    Blob.prototype.arrayBuffer = async function () {
      Object.assign(window, { xlReadStarted: true });
      await new Promise<void>((resolve) => Object.assign(window, { xlReleaseRead: resolve }));
      return native.call(this);
    };
  });
  try {
    await page.locator(".ilovepdf-action-red-btn").click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "xlReadStarted"))).toBe(true);
    await page.getByRole("button", { name: "Cancelar conversão", exact: true }).click();
    await page.evaluate(() => Reflect.get(window, "xlReleaseRead")());
    await expect(page.locator(".ilovepdf-action-red-btn")).toBeEnabled();
    await expect(page.getByRole("link", { name: /Baixar arquivo gerado/ })).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("nexohub:recent-operations:v2") ?? "[]"),
      ),
    ).toEqual([]);
  } finally {
    await page.evaluate(() => {
      Blob.prototype.arrayBuffer = Reflect.get(window, "xlNativeRead");
    });
  }
});

test("XL-C1: seleção inválida e fronteira sobre texto não deixam exportar dados antigos", async ({
  page,
}) => {
  await upload(page);
  await select(page);
  await page.getByLabel("Páginas para exportar").fill("999");
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await expect(page.getByTestId("excel-preview-table")).toHaveCount(0);
  await page.getByLabel("Páginas para exportar").fill("1");
  await page.getByLabel("Páginas para exportar").fill("2");
  await expect(page.getByTestId("excel-preview-table")).toContainText("00456");
  await page.getByLabel("Separadores de colunas (%)").fill("8");
  await expect(page.getByText(/Um separador atravessa texto/)).toBeVisible();
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
});
test("XL-C1: controles e ação cabem nas quatro larguras em tema claro e escuro", async ({
  page,
}, info) => {
  await upload(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const options = page.getByRole("button", { name: "Opções", exact: true });
      if (await options.isVisible()) await options.click();
      await expect(page.getByLabel("Páginas para exportar")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await expect(
        page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn"),
      ).toBeInViewport();
      await page.screenshot({ path: info.outputPath(`xl-${width}-${theme}.png`), fullPage: true });
    }
  }
});
