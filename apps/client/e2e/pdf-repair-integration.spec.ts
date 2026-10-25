import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

for (const width of [390, 1366]) {
  test(`reparo integrado preserva páginas e texto no download em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const original = await PDFDocument.create();
    for (const number of [1, 2]) {
      original.addPage([400, 400]).drawText(`Conteudo preservado ${number}`, { x: 30, y: 300 });
    }
    const corrupted = Buffer.concat([
      Buffer.from("LIXO_ANTES_DO_CABECALHO\n"),
      Buffer.from(await original.save()),
    ]);
    await test.info().attach("corpus-reparo-integrado", {
      contentType: "application/json",
      body: JSON.stringify({
        source: "PDF sintético gerado neste teste, com duas páginas e prefixo inválido",
        pages: 2,
        sha256: createHash("sha256").update(corrupted).digest("hex"),
        expected: ["Conteudo preservado 1", "Conteudo preservado 2"],
      }),
    });
    await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}reparar-pdf`);
    await page.locator('input[type="file"]').setInputFiles({
      name: "integracao-danificada.pdf",
      mimeType: "application/pdf",
      buffer: corrupted,
    });
    await page.getByTestId("pdf-repair-idle").getByRole("button", { name: "Reparar PDF" }).click();
    const result = page.getByTestId("pdf-repair-success");
    await result.waitFor({ state: "visible" });
    await expect(result.getByText(/2 de 2 páginas recuperadas/i)).toBeVisible();
    const pending = page.waitForEvent("download");
    await result.getByRole("link", { name: /Baixar PDF Reparado/i }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("integracao-danificada_reparado.pdf");
    const bytes = new Uint8Array(await readFile(await download.path()));
    const repaired = await PDFDocument.load(bytes);
    expect(repaired.getPageCount()).toBe(2);
    const task = getDocument({
      data: bytes.slice(),
      standardFontDataUrl: fileURLToPath(
        new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
      ).replaceAll("\\", "/"),
      useSystemFonts: true,
    });
    try {
      const document = await task.promise;
      for (const number of [1, 2]) {
        const text = await (await document.getPage(number)).getTextContent();
        expect(
          text.items.some((item) => "str" in item && item.str === `Conteudo preservado ${number}`),
        ).toBe(true);
      }
    } finally {
      await task.destroy();
    }
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth - innerWidth,
      height: document.documentElement.scrollHeight - innerHeight,
    }));
    expect(overflow.width).toBeLessThanOrEqual(1);
    expect(overflow.height).toBeLessThanOrEqual(1);
  });
}
