import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { convertPdfToMarkdown } from "./markdown-converter";

async function createSyntheticSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Página 1: Título grande, subtítulo e corpo de texto com lista
  const page1 = doc.addPage([600, 800]);
  page1.drawText("Relatório Técnico Anual", {
    x: 50,
    y: 740,
    size: 24,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  page1.drawText("Visão Geral do Projeto", {
    x: 50,
    y: 690,
    size: 18,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page1.drawText("Este documento apresenta os resultados consolidados do sistema.", {
    x: 50,
    y: 650,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  page1.drawText("• Primeiro item de destaque", {
    x: 50,
    y: 620,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  page1.drawText("• Segundo item importante", {
    x: 50,
    y: 590,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Página 2: Tabela de dados
  const page2 = doc.addPage([600, 800]);
  page2.drawText("Métricas de Desempenho", {
    x: 50,
    y: 740,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  page2.drawText("Item                      Qtd                      Status", {
    x: 50,
    y: 680,
    size: 11,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page2.drawText("Servidores                12                       Ativo", {
    x: 50,
    y: 650,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  return await doc.save();
}

describe("convertPdfToMarkdown", () => {
  it("não inventa espaços dentro de palavras com mudança de fonte", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([400, 300]);
    page.drawText("con", { x: 30, y: 230, font, size: 12 });
    page.drawText("trato", {
      x: 30 + font.widthOfTextAtSize("con", 12),
      y: 230,
      font: bold,
      size: 12,
    });
    const result = await convertPdfToMarkdown(await doc.save(), { detectHeadings: false });
    expect(result.markdown).toBe("contrato");
  });

  it("preserva aspas tipográficas, travessões e reticências do original", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 300]);
    const text = "“Condição” — cláusula…";
    page.drawText(text, { x: 30, y: 230, size: 12 });
    const result = await convertPdfToMarkdown(await doc.save(), { detectHeadings: false });
    expect(result.markdown).toBe(text);
  });

  it("orienta usar OCR quando o PDF não contém texto selecionável", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 300]);
    doc.addPage([400, 300]);
    await expect(convertPdfToMarkdown(await doc.save())).rejects.toThrow(
      "PDF_SEM_TEXTO_SELECIONAVEL",
    );
  });

  it("rejeita buffer vazio lançando erro DOCUMENTO_VAZIO", async () => {
    await expect(convertPdfToMarkdown(new Uint8Array())).rejects.toThrow("DOCUMENTO_VAZIO");
  });

  it("converte PDF sintético em Markdown estruturado com títulos e separadores", async () => {
    const pdfBytes = await createSyntheticSamplePdf();
    const result = await convertPdfToMarkdown(pdfBytes, {
      detectHeadings: true,
      detectTables: true,
      includePageBreaks: true,
    });

    expect(result.pageCount).toBe(2);
    expect(result.characterCount).toBeGreaterThan(50);
    expect(result.wordCount).toBeGreaterThan(10);
    expect(result.lineCount).toBeGreaterThan(5);

    // Valida que o texto contém o título principal
    expect(result.markdown).toContain("Relatório Técnico Anual");
    expect(result.markdown).toContain("Visão Geral do Projeto");
    expect(result.markdown).toContain("Este documento apresenta os resultados consolidados");

    // Valida que os bullets foram tratados como lista markdown (- )
    expect(result.markdown).toMatch(/- Primeiro item de destaque/);

    // Valida que há divisor de página entre a página 1 e página 2
    expect(result.markdown).toContain("---");
  });

  it("permite desativar separadores de página opcionais", async () => {
    const pdfBytes = await createSyntheticSamplePdf();
    const result = await convertPdfToMarkdown(pdfBytes, {
      detectHeadings: true,
      detectTables: true,
      includePageBreaks: false,
    });

    expect(result.pageCount).toBe(2);
    expect(result.markdown).not.toContain("---");
  });
});
