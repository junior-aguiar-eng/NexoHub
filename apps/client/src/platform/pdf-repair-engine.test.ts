import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { repairPdfDocument } from "./pdf-repair-engine";

describe("motor de reparo de PDF (repairPdfDocument)", () => {
  it("rejeita documento vazio com EMPTY_DOCUMENT", async () => {
    await expect(repairPdfDocument(new Uint8Array(0))).rejects.toThrow("EMPTY_DOCUMENT");
  });

  it("rejeita arquivo não PDF sem objetos recuperáveis com CORRUPTED_DOCUMENT", async () => {
    const junk = new TextEncoder().encode("Este é um arquivo de texto qualquer e não é PDF.");
    await expect(repairPdfDocument(junk)).rejects.toThrow("CORRUPTED_DOCUMENT");
  });

  it("repara PDF com lixo inserido antes do cabeçalho %PDF-", async () => {
    const validDoc = await PDFDocument.create();
    validDoc.addPage([300, 300]);
    validDoc.addPage([400, 400]);
    const validBytes = await validDoc.save();

    // Injeta lixo antes do %PDF-
    const prefix = new TextEncoder().encode("LIXO_INICIAL_OU_BOM_12345");
    const corruptedBytes = new Uint8Array(prefix.length + validBytes.length);
    corruptedBytes.set(prefix, 0);
    corruptedBytes.set(validBytes, prefix.length);

    const result = await repairPdfDocument(corruptedBytes);
    expect(result.report.fixedHeader).toBe(true);
    expect(result.report.recoveredPages).toBe(2);
    expect(result.report.totalDetectedPages).toBe(2);

    // Valida que o PDF resultante é válido
    const loaded = await PDFDocument.load(result.pdfBytes);
    expect(loaded.getPageCount()).toBe(2);
  });

  it("repara PDF truncado no final sem marcador %%EOF", async () => {
    const validDoc = await PDFDocument.create();
    validDoc.addPage([200, 200]);
    const validBytes = await validDoc.save();

    // Corta os últimos 6 bytes (removendo %%EOF)
    const truncatedBytes = validBytes.subarray(0, validBytes.length - 6);

    const result = await repairPdfDocument(truncatedBytes);
    expect(result.report.fixedEof).toBe(true);
    expect(result.report.recoveredPages).toBe(1);

    const loaded = await PDFDocument.load(result.pdfBytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("repara PDF com startxref e %%EOF ausentes restaurando o apontador", async () => {
    const validDoc = await PDFDocument.create();
    validDoc.addPage([200, 200]);
    const validBytes = await validDoc.save();

    // Corta os últimos 18 bytes (removendo startxref e %%EOF)
    const truncatedBytes = validBytes.subarray(0, validBytes.length - 18);

    const result = await repairPdfDocument(truncatedBytes);
    expect(result.report.fixedEof).toBe(true);
    expect(result.report.recoveredPages).toBe(1);

    const loaded = await PDFDocument.load(result.pdfBytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("repara documento íntegro gerando novo artifact sanitizado e relatório completo", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([500, 500]);
    const docBytes = await doc.save();

    const result = await repairPdfDocument(docBytes);
    expect(result.report.recoveredPages).toBe(1);
    expect(result.report.originalSize).toBe(docBytes.length);
    expect(result.report.repairedSize).toBeGreaterThan(0);
    expect(result.pdfBytes.length).toBeGreaterThan(0);
  });
});
