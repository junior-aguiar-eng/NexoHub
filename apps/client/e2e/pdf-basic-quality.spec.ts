import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { basicPdfPages, createBasicPdfCorpus } from "../src/platform/__fixtures__/q-c0-pdf/corpus";

const base = process.env.NEXOHUB_BASE_PATH ?? "/";
const payload = async () => ({
  name: "corpus.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(
    await createBasicPdfCorpus(
      new Uint8Array(await readFile("src/platform/fixtures/extraction-red-2x1.jpg")),
    ),
  ),
});

async function checkDownload(bytes: Uint8Array, indices: number[], rotation = 0) {
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(indices.length);
  const task = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const reader = await task.promise;
  try {
    for (const [i, source] of indices.entries()) {
      const expected = basicPdfPages[source],
        page = doc.getPage(i);
      expect(page.getCropBox()).toEqual({
        x: 10,
        y: 20,
        width: expected.width - 30,
        height: expected.height - 50,
      });
      expect(page.getRotation().angle).toBe((expected.rotation + rotation) % 360);
      const text = await (await reader.getPage(i + 1)).getTextContent();
      expect(text.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ")).toBe(
        expected.text,
      );
    }
  } finally {
    await task.destroy();
  }
}

for (const tool of ["juntar-pdf", "dividir-pdf", "organizar-pdf", "rotacionar-pdf"]) {
  test(`Q-C0: download de ${tool} mantém texto e geometria`, async ({ page }) => {
    await page.goto(`${base}${tool}`);
    const file = await payload();
    await page
      .locator('input[type="file"]')
      .setInputFiles(tool === "juntar-pdf" ? [file, { ...file, name: "segundo.pdf" }] : file);
    let indices = [0, 1, 2, 3],
      rotation = 0;
    if (tool === "juntar-pdf") indices = [...indices, ...indices];
    if (tool === "organizar-pdf") {
      await expect(page.locator(".pdf-page-card")).toHaveCount(4);
      await page.getByTitle("Excluir esta página").last().click();
      indices = [0, 1, 2];
    }
    if (tool === "dividir-pdf") {
      await page.getByRole("button", { name: "Páginas", exact: true }).click();
      await page.locator(".ilovepdf-page-mini-card").nth(0).click();
      await page.locator(".ilovepdf-page-mini-card").nth(2).click();
      indices = [2];
    }
    if (tool === "rotacionar-pdf") {
      await page.getByRole("button", { name: /Girar Direita/ }).click();
      rotation = 90;
    }
    await page.locator(".ilovepdf-action-red-btn").click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await checkDownload(new Uint8Array(await readFile(await download.path())), indices, rotation);
  });
}
