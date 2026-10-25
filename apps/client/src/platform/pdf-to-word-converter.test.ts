import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { convertPdfToWord } from "./pdf-to-word-converter";

describe("pdf-to-word-converter", () => {
  it("rejeita documento vazio com erro estruturado", async () => {
    await expect(convertPdfToWord(new Uint8Array(0))).rejects.toThrow("DOCUMENTO_VAZIO");
  });

  it("converte PDF com texto simples para documento Word .docx válido", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([600, 400]);

    page.drawText("Relatório Financeiro NexoHub", {
      x: 50,
      y: 350,
      size: 20,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText("Este é um parágrafo de teste gerado para validação do conversor de Word.", {
      x: 50,
      y: 300,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    const result = await convertPdfToWord(pdfBytes);

    expect(result.docxBytes).toBeInstanceOf(Uint8Array);
    expect(result.docxBytes.byteLength).toBeGreaterThan(1000);
    // Assinatura PK do formato ZIP / OpenXML
    expect(result.docxBytes[0]).toBe(0x50);
    expect(result.docxBytes[1]).toBe(0x4b);

    expect(result.report.pageCount).toBe(1);
    expect(result.report.wordCount).toBeGreaterThanOrEqual(10);
    expect(result.report.isScannedWarning).toBe(false);
    expect(result.report.sampleText.length).toBeGreaterThan(0);
    expect(result.report.convertedBytes).toBe(result.docxBytes.byteLength);
  });

  it("converte PDF multipáginas e emite progresso", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Página 1
    const p1 = pdfDoc.addPage([600, 400]);
    p1.drawText("Capítulo 1: Introdução", {
      x: 50,
      y: 350,
      size: 18,
      font: boldFont,
    });
    p1.drawText("Conteúdo da primeira página com fluxo textual estruturado.", {
      x: 50,
      y: 310,
      size: 12,
      font,
    });

    // Página 2
    const p2 = pdfDoc.addPage([600, 400]);
    p2.drawText("Capítulo 2: Conclusão", {
      x: 50,
      y: 350,
      size: 18,
      font: boldFont,
    });
    p2.drawText("Segunda página do documento processada com quebra nativa de página.", {
      x: 50,
      y: 310,
      size: 12,
      font,
    });

    const pdfBytes = await pdfDoc.save();
    const onProgress = vi.fn();

    const result = await convertPdfToWord(pdfBytes, { onProgress });

    expect(result.report.pageCount).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
    expect(result.report.wordCount).toBeGreaterThan(10);
  });

  it("detecta PDF sem texto vetorial e emite aviso preventivo de digitalização", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    // Apenas desenha retângulos geométricos sem nenhuma camada de texto
    page.drawRectangle({
      x: 50,
      y: 50,
      width: 300,
      height: 300,
      color: rgb(0.8, 0.8, 0.8),
    });

    const pdfBytes = await pdfDoc.save();
    const result = await convertPdfToWord(pdfBytes);

    expect(result.report.pageCount).toBe(1);
    expect(result.report.wordCount).toBe(0);
    expect(result.report.isScannedWarning).toBe(true);
    // Mesmo sem texto vetorial, gera documento docx informando a orientação
    expect(result.docxBytes[0]).toBe(0x50);
    expect(result.docxBytes[1]).toBe(0x4b);
  });
});
