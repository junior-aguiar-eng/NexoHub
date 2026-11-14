import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { workspaceOptions } from "./workspace-views";

const base = process.env.NEXOHUB_BASE_PATH ?? "/";

async function createStandardFontPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 420]);
  page.drawText("Documento para arquivamento PDF/A-2b", { x: 36, y: 340, size: 16 });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
]) {
  test(`PDF/A-2b E2E em ${viewport.width}x${viewport.height}: converte, verifica ICC/XMP/ID e sem overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${base}pdf-para-pdfa`);
    await page.locator('input[type="file"]').setInputFiles({
      name: "peticao-arquivavel.pdf",
      mimeType: "application/pdf",
      buffer: await createStandardFontPdf(),
    });

    await workspaceOptions(page);
    const submitBtn = page.getByRole("button", { name: "Converter para PDF/A", exact: true });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    const resultPanel = page.getByTestId("pdfa-success");
    await resultPanel.waitFor({ state: "visible", timeout: 45_000 });
    await expect(resultPanel.getByText(/Perfil sRGB ICC e pacote XMP/i)).toBeVisible();

    const pending = page.waitForEvent("download");
    await resultPanel.getByRole("link", { name: /Baixar PDF\/A/i }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("peticao-arquivavel_pdfa.pdf");

    const outBytes = new Uint8Array(await readFile(await download.path()));
    const parsed = await PDFDocument.load(outBytes, { updateMetadata: false });
    expect(parsed.getPageCount()).toBe(1);

    const intents = parsed.catalog.lookupMaybe(PDFName.of("OutputIntents"), PDFArray);
    expect(intents?.size()).toBe(1);
    const firstIntent = intents?.lookupMaybe(0, PDFDict);
    expect(firstIntent?.get(PDFName.of("S"))?.toString()).toBe("/GTS_PDFA1");

    const metaObj = parsed.context.lookup(parsed.catalog.get(PDFName.of("Metadata")));
    expect(metaObj).toBeInstanceOf(PDFRawStream);
    if (metaObj instanceof PDFRawStream) {
      const xml = new TextDecoder().decode(metaObj.contents);
      expect(xml).toContain("<pdfaid:part>2</pdfaid:part>");
      expect(xml).toContain("<pdfaid:conformance>B</pdfaid:conformance>");
    }

    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth - innerWidth,
      height: document.documentElement.scrollHeight - innerHeight,
    }));
    expect(overflow.width).toBeLessThanOrEqual(1);
    expect(overflow.height).toBeLessThanOrEqual(1);
  });
}
