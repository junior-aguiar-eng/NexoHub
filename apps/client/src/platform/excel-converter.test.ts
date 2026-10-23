import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { convertPdfToExcelDocument, getExcelColumnLetter } from "./excel-converter";

async function createSyntheticTablePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Página 1: Tabela de Inventário
  const page1 = doc.addPage([600, 800]);
  page1.drawText("Relatório de Estoque", {
    x: 50,
    y: 740,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  page1.drawText("Código              Produto              Qtd              Preço", {
    x: 50,
    y: 680,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page1.drawText("PROD-001            Notebook Pro         5                4500.00", {
    x: 50,
    y: 650,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  page1.drawText("PROD-002            Monitor 4K           12               1850.50", {
    x: 50,
    y: 620,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Página 2: Tabela de Fornecedores
  const page2 = doc.addPage([600, 800]);
  page2.drawText("Lista de Fornecedores", {
    x: 50,
    y: 740,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  page2.drawText("ID                  Empresa              Cidade", {
    x: 50,
    y: 680,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page2.drawText("101                 TechCorp             São Paulo", {
    x: 50,
    y: 650,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  return await doc.save();
}

describe("excel-converter", () => {
  it("converte índices de coluna corretamente para letras de coluna Excel", () => {
    expect(getExcelColumnLetter(0)).toBe("A");
    expect(getExcelColumnLetter(1)).toBe("B");
    expect(getExcelColumnLetter(25)).toBe("Z");
    expect(getExcelColumnLetter(26)).toBe("AA");
    expect(getExcelColumnLetter(27)).toBe("AB");
    expect(getExcelColumnLetter(51)).toBe("AZ");
    expect(getExcelColumnLetter(52)).toBe("BA");
  });

  it("rejeita buffer vazio lançando erro DOCUMENTO_VAZIO", async () => {
    await expect(convertPdfToExcelDocument(new Uint8Array())).rejects.toThrow("DOCUMENTO_VAZIO");
  });

  it("converte PDF sintético em planilha OpenXML (.xlsx) real", async () => {
    const pdfBytes = await createSyntheticTablePdf();
    const result = await convertPdfToExcelDocument(pdfBytes, {
      outputFormat: "xlsx",
      sheetMode: "per-page",
    });

    expect(result.fileName).toBe("planilha.xlsx");
    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(result.totalSheets).toBe(2);
    expect(result.totalRows).toBeGreaterThanOrEqual(4);
    expect(result.totalColumns).toBeGreaterThanOrEqual(3);
    expect(result.data.length).toBeGreaterThan(500);

    // Valida que o binário é um arquivo ZIP válido (assinatura PK\x03\x04)
    expect(result.data[0]).toBe(0x50); // 'P'
    expect(result.data[1]).toBe(0x4b); // 'K'
    expect(result.data[2]).toBe(0x03);
    expect(result.data[3]).toBe(0x04);
  });

  it("converte PDF sintético em arquivo CSV com delimitador customizado e BOM", async () => {
    const pdfBytes = await createSyntheticTablePdf();
    const result = await convertPdfToExcelDocument(pdfBytes, {
      outputFormat: "csv",
      csvDelimiter: ";",
    });

    expect(result.fileName).toBe("planilha.csv");
    expect(result.mimeType).toContain("text/csv");
    expect(result.totalRows).toBeGreaterThanOrEqual(4);

    expect(result.data[0]).toBe(0xef); // Byte order mark UTF-8
    expect(result.data[1]).toBe(0xbb);
    expect(result.data[2]).toBe(0xbf);
    const text = new TextDecoder().decode(result.data);
    expect(text).toContain(";");
    expect(text).toContain("Notebook Pro");
    expect(text).toContain("São Paulo");
  });

  it("suporta modo de planilha única consolidando dados de várias páginas", async () => {
    const pdfBytes = await createSyntheticTablePdf();
    const result = await convertPdfToExcelDocument(pdfBytes, {
      outputFormat: "xlsx",
      sheetMode: "single-sheet",
    });

    expect(result.totalSheets).toBe(1);
    expect(result.totalRows).toBeGreaterThanOrEqual(4);
  });
});
