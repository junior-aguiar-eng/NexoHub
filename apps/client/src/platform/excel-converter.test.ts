import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
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

async function tablePdf(rows: string[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  rows.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) page.drawText(value, { x: 40 + c * 180, y: 740 - r * 30, size: 11, font });
    });
  });
  return doc.save();
}

it("mantém células vazias alinhadas com as colunas das outras linhas", async () => {
  const result = await convertPdfToExcelDocument(
    await tablePdf([
      ["Código", "Produto", "Preço"],
      ["00123", "", "15.50"],
      ["00234", "Teclado", "25.00"],
    ]),
  );
  expect(result.previewRows[1]).toEqual(["00123", "", "15.50"]);
});

it("XLSX preserva identificadores com zeros e mais de 15 dígitos como texto", async () => {
  const result = await convertPdfToExcelDocument(
    await tablePdf([["00123", "12345678901234567890"]]),
  );
  const { unzipSync, strFromU8 } = await import("fflate");
  const xml = strFromU8(unzipSync(result.data)["xl/worksheets/sheet1.xml"]);
  expect(xml).toContain('<c r="A1" t="inlineStr"><is><t>00123</t>');
  expect(xml).toContain('<c r="B1" t="inlineStr"><is><t>12345678901234567890</t>');
});

it("CSV impede fórmulas vindas do texto do PDF, preservando números negativos", async () => {
  const result = await convertPdfToExcelDocument(await tablePdf([["=1+1", "-42"]]), {
    outputFormat: "csv",
  });
  const csv = new TextDecoder().decode(result.data);
  expect(csv).toContain("'=1+1");
  expect(csv).toContain(";-42");
});

it("recusa sucesso com planilha vazia quando o PDF precisa de OCR", async () => {
  await expect(convertPdfToExcelDocument(await tablePdf([]))).rejects.toThrow(
    "PDF_SEM_TEXTO_SELECIONAVEL",
  );
});

it("informa ausência de tabela em vez de gerar arquivo vazio", async () => {
  await expect(
    convertPdfToExcelDocument(await tablePdf([["Um parágrafo sem colunas"]]), {
      detectTablesOnly: true,
    }),
  ).rejects.toThrow("PDF_SEM_TABELAS");
});

it("mantém pontuação original e a tabela lógica em páginas com rotação", async () => {
  for (const angle of [0, 90, 180, 270]) {
    const doc = await PDFDocument.load(
      await tablePdf([
        ["Nome", "Observação"],
        ["001", "“Válido” — sim"],
      ]),
    );
    doc.getPage(0).setRotation(degrees(angle));
    const result = await convertPdfToExcelDocument(await doc.save());
    expect(result.previewRows).toEqual([
      ["Nome", "Observação"],
      ["001", "“Válido” — sim"],
    ]);
  }
});

it("planilha única e CSV não inserem rótulos artificiais nas linhas de dados", async () => {
  const source = await PDFDocument.load(await tablePdf([["001", "Produto"]]));
  const [copy] = await source.copyPages(source, [0]);
  source.addPage(copy);
  const input = await source.save();
  const xlsx = await convertPdfToExcelDocument(input, { sheetMode: "single-sheet" });
  const { unzipSync, strFromU8 } = await import("fflate");
  const xml = strFromU8(unzipSync(xlsx.data)["xl/worksheets/sheet1.xml"]);
  expect(xml.match(/<row /g)).toHaveLength(xlsx.totalRows);
  expect(xml).not.toContain("===");
  const csv = await convertPdfToExcelDocument(input, { outputFormat: "csv" });
  expect(new TextDecoder().decode(csv.data).split("\r\n")).toHaveLength(csv.totalRows);
  expect(csv.totalSheets).toBe(1);
});

it("mantém valores alinhados à direita e células ausentes em suas colunas", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  for (const [text, x, y] of [
    ["Produto", 40, 740],
    ["Preço", 400, 740],
    ["Teclado", 40, 710],
    ["12345.67", 370, 710],
    ["99999.99", 370, 680],
  ] as const)
    page.drawText(text, { x, y, size: 12 });
  const result = await convertPdfToExcelDocument(await doc.save());
  expect(result.previewRows[1]).toEqual(["Teclado", "12345.67"]);
  expect(result.previewRows[2]).toEqual(["", "99999.99"]);
});
