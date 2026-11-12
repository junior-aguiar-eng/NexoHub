import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { addPageNumbersToPdfDocument } from "./pdf-engine";

async function makePdf(pages = 2): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([200, 200]);
  return pdf.save();
}

describe("numeração de páginas forense e judicial", () => {
  it("insere numeração forense (flsXofY) com prefixo customizado de processo judicial", async () => {
    const source = await makePdf(2);
    const numberedBytes = await addPageNumbersToPdfDocument(source, {
      position: "top-right",
      format: "flsXofY",
      customPrefix: "Processo 0001234-56.2026",
      startPage: 1,
    });

    const doc = await PDFDocument.load(numberedBytes);
    expect(doc.getPageCount()).toBe(2);
    expect(numberedBytes.length).toBeGreaterThan(source.length);
  });

  it("insere numeração forense formato Fls. X (flsX)", async () => {
    const source = await makePdf(3);
    const numberedBytes = await addPageNumbersToPdfDocument(source, {
      position: "bottom-right",
      format: "flsX",
      startPage: 1,
    });

    const doc = await PDFDocument.load(numberedBytes);
    expect(doc.getPageCount()).toBe(3);
    expect(numberedBytes.length).toBeGreaterThan(source.length);
  });
});
