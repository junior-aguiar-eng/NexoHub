import { strFromU8, unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, it } from "vitest";
import {
  createXlC1Corpus,
  xlC1Expected,
  xlC1Region,
  xlC1Separators,
} from "./__fixtures__/xl-c1/corpus";
import { convertPdfToExcelDocument, extractPdfSpreadsheetData } from "./excel-converter";

function cells(
  bytes: Uint8Array,
  sheet = 1,
): Record<string, { text: string; type: string | null }> {
  const xml = new DOMParser().parseFromString(
    strFromU8(unzipSync(bytes)[`xl/worksheets/sheet${sheet}.xml`]),
    "application/xml",
  );
  return Object.fromEntries(
    Array.from(xml.getElementsByTagName("c"), (cell) => [
      cell.getAttribute("r"),
      { text: cell.textContent ?? "", type: cell.getAttribute("t") },
    ]),
  );
}

it.each([false, true])(
  "seleciona página e região com bordas=%s sem inventar células ou converter códigos",
  async (borders) => {
    const bytes = await createXlC1Corpus(borders);
    const options = {
      selectedPages: [2],
      region: xlC1Region,
      columnSeparators: xlC1Separators,
      preserveText: true,
    };
    const preview = await extractPdfSpreadsheetData(bytes, options);
    expect(preview.sheets.map((sheet) => sheet.pageIndex)).toEqual([1]);
    expect(preview.previewRows).toEqual(xlC1Expected[1]);
    const result = await convertPdfToExcelDocument(bytes, options);
    expect(result.previewRows).toEqual(preview.previewRows);
    expect(cells(result.data)).toMatchObject({
      A2: { text: "00456", type: "inlineStr" },
      B3: { text: "", type: "inlineStr" },
      C2: { text: "2.000,00", type: "inlineStr" },
    });
  },
);

it("preserva identificador numérico curto e números pt-BR como texto por escolha explícita", async () => {
  const output = await convertPdfToExcelDocument(await createXlC1Corpus(), {
    region: xlC1Region,
    columnSeparators: xlC1Separators,
    preserveText: true,
  });
  expect(cells(output.data)).toMatchObject({
    A3: { text: "123", type: "inlineStr" },
    C2: { text: "1.234,56", type: "inlineStr" },
    C3: { text: "15.50", type: "inlineStr" },
  });
  expect(output.totalSheets).toBe(2);
});

it("CSV e XLSX usam a mesma seleção e não exportam cabeçalho abrangente nem rodapé", async () => {
  const result = await convertPdfToExcelDocument(await createXlC1Corpus(), {
    selectedPages: [1],
    region: xlC1Region,
    columnSeparators: xlC1Separators,
    outputFormat: "csv",
  });
  const text = new TextDecoder().decode(result.data);
  expect(text.split("\r\n")).toEqual(xlC1Expected[0].map((row) => row.join(";")));
});

it("mantém texto do cabeçalho abrangente sem inferir mesclagens OpenXML", async () => {
  const output = await convertPdfToExcelDocument(await createXlC1Corpus(true));
  expect(output.previewRows[0]).toEqual(["Inventário com cabeçalho abrangente", "", ""]);
  expect(strFromU8(unzipSync(output.data)["xl/worksheets/sheet1.xml"])).not.toContain("mergeCells");
});

it.each([0, 90, 180, 270])("seleção usa página lógica antes da rotação %s", async (angle) => {
  const result = await extractPdfSpreadsheetData(await createXlC1Corpus(false, angle), {
    selectedPages: [1],
    region: xlC1Region,
    columnSeparators: xlC1Separators,
  });
  expect(result.previewRows).toEqual(xlC1Expected[0]);
});

it("não insere espaços entre fragmentos contíguos do mesmo código", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText("000", { x: 40, y: 700, font, size: 11 });
  page.drawText("123", { x: 40 + font.widthOfTextAtSize("000", 11), y: 700, font: bold, size: 11 });
  page.drawText("A", { x: 90, y: 700, font, size: 11 });
  const result = await extractPdfSpreadsheetData(await doc.save(), {
    columnSeparators: [85 / 600],
  });
  expect(result.previewRows).toEqual([["000123", "A"]]);
});

it.each([
  { selectedPages: [] },
  { selectedPages: [3] },
  { selectedPages: [1.5] },
  { region: { left: 0, top: 0, width: 2, height: 1 } },
  { columnSeparators: [0.6, 0.3] },
  { columnSeparators: [Number.NaN] },
])("recusa configuração inválida %j", async (options) => {
  await expect(extractPdfSpreadsheetData(await createXlC1Corpus(), options)).rejects.toThrow(
    "OPCOES_PLANILHA_INVALIDAS",
  );
});
it("recusa região ou separador que corta um fragmento em vez de adivinhar valores", async () => {
  const bytes = await createXlC1Corpus();
  await expect(
    extractPdfSpreadsheetData(bytes, { region: { left: 0.1, top: 0, width: 0.9, height: 1 } }),
  ).rejects.toThrow("PDF_REGIAO_CORTA_TEXTO");
  await expect(
    extractPdfSpreadsheetData(bytes, { region: xlC1Region, columnSeparators: [0.08] }),
  ).rejects.toThrow("PDF_SEPARADOR_CORTA_TEXTO");
});
it("cancelamento antes da extração não gera arquivo", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    extractPdfSpreadsheetData(await createXlC1Corpus(), { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
});
