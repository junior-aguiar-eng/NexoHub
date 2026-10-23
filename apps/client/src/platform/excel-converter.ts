import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createZipArchive } from "./browser-pdf-utils";

const isTestEnv =
  typeof window === "undefined" ||
  Boolean(
    typeof globalThis !== "undefined" &&
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env
        ?.NODE_ENV === "test",
  );

if (typeof window !== "undefined" && !isTestEnv) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch {
    // Fallback silencioso
  }
}

const STANDARD_FONT_DATA_URL =
  typeof window !== "undefined" && window.location?.origin
    ? `${window.location.origin}/standard_fonts/`
    : undefined;

export interface PdfToExcelOptions {
  readonly outputFormat?: "xlsx" | "csv";
  readonly sheetMode?: "per-page" | "single-sheet";
  readonly csvDelimiter?: "," | ";" | "\t";
  readonly detectTablesOnly?: boolean;
}

export interface ExtractedSheetData {
  readonly name: string;
  readonly pageIndex: number;
  readonly rows: Array<string[]>;
}

export interface PdfToExcelResult {
  readonly data: Uint8Array;
  readonly fileName: string;
  readonly mimeType: string;
  readonly totalSheets: number;
  readonly totalRows: number;
  readonly totalColumns: number;
  readonly previewRows: Array<string[]>;
}

interface RawTextItem {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}

function sanitizeCellText(raw: string): string {
  return raw
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .trim();
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getExcelColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function escapeCsvCell(val: string, delimiter: string): string {
  if (val.includes(delimiter) || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function isNumericValue(val: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  // Aceita inteiros e decimais regulares (ponto ou vírgula em padrão limpo)
  return /^-?\d+(\.\d+)?$/.test(trimmed);
}

/**
 * Converte bytes de um documento PDF em planilha Excel (.xlsx) ou arquivo CSV,
 * extraindo coordenadas espaciais para reconstruir linhas e colunas reais.
 */
export async function convertPdfToExcelDocument(
  pdfBytes: Uint8Array,
  options: PdfToExcelOptions = {},
): Promise<PdfToExcelResult> {
  const {
    outputFormat = "xlsx",
    sheetMode = "per-page",
    csvDelimiter = ";",
    detectTablesOnly = false,
  } = options;

  if (pdfBytes.length === 0) {
    throw new Error("DOCUMENTO_VAZIO");
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  if (numPages === 0) {
    const emptyBytes = outputFormat === "csv" ? new TextEncoder().encode("") : createEmptyXlsx();
    return {
      data: emptyBytes,
      fileName: outputFormat === "csv" ? "planilha.csv" : "planilha.xlsx",
      mimeType:
        outputFormat === "csv"
          ? "text/csv;charset=utf-8;"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      totalSheets: 0,
      totalRows: 0,
      totalColumns: 0,
      previewRows: [],
    };
  }

  try {
    const rawSheets: ExtractedSheetData[] = [];
    let grandTotalRows = 0;
    let grandMaxCols = 0;
    const allPreviewRows: Array<string[]> = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const rawItems: RawTextItem[] = [];

      for (const item of content.items) {
        if (!("str" in item) || typeof item.str !== "string") continue;
        const text = sanitizeCellText(item.str);
        if (!text) continue;

        const transform = item.transform || [1, 0, 0, 1, 0, 0];
        const scaleX = Math.abs(transform[0]) || 12;
        const scaleY = Math.abs(transform[3]) || 12;
        const fontSize = Math.max(scaleX, scaleY, item.height || 0);
        const x = transform[4] || 0;
        const y = transform[5] || 0;

        rawItems.push({
          str: text,
          x,
          y,
          width: item.width || 0,
          height: item.height || fontSize,
          fontSize,
        });
      }

      // Agrupa itens em linhas baseado na coordenada Y (tolerância de linha de 4px)
      rawItems.sort((a, b) => b.y - a.y || a.x - b.x);

      const pageRows: Array<string[]> = [];
      let currentLineItems: RawTextItem[] = [];
      let currentLineY: number | null = null;

      const processLine = (items: RawTextItem[]) => {
        if (items.length === 0) return;
        items.sort((a, b) => a.x - b.x);

        const columns: string[] = [];
        let currentCellParts: string[] = [];
        let prevRight = items[0].x;

        for (let idx = 0; idx < items.length; idx++) {
          const it = items[idx];
          const gap = it.x - prevRight;

          // Se o espaçamento horizontal for > 18px, quebramos em nova coluna
          if (idx > 0 && gap > 18) {
            if (currentCellParts.length > 0) {
              columns.push(currentCellParts.join(" ").trim());
              currentCellParts = [];
            }
          }

          currentCellParts.push(it.str);
          prevRight = it.x + it.width;
        }

        if (currentCellParts.length > 0) {
          columns.push(currentCellParts.join(" ").trim());
        }

        const filteredColumns = columns.filter((c) => c.length > 0);
        if (filteredColumns.length === 0) return;

        if (detectTablesOnly && filteredColumns.length < 2) {
          return;
        }

        pageRows.push(filteredColumns);
      };

      for (const item of rawItems) {
        if (currentLineY === null) {
          currentLineY = item.y;
          currentLineItems.push(item);
        } else if (Math.abs(item.y - currentLineY) <= 4.0) {
          currentLineItems.push(item);
        } else {
          processLine(currentLineItems);
          currentLineY = item.y;
          currentLineItems = [item];
        }
      }

      if (currentLineItems.length > 0) {
        processLine(currentLineItems);
      }

      rawSheets.push({
        name: `Página ${pageNum}`,
        pageIndex: pageNum - 1,
        rows: pageRows,
      });

      grandTotalRows += pageRows.length;
      for (const r of pageRows) {
        grandMaxCols = Math.max(grandMaxCols, r.length);
        if (allPreviewRows.length < 15) {
          allPreviewRows.push(r);
        }
      }
    }

    // Organização de planilhas conforme a preferência de modo
    let sheetsToExport: ExtractedSheetData[];
    if (sheetMode === "single-sheet" && rawSheets.length > 1) {
      const combinedRows: Array<string[]> = [];
      for (const sheet of rawSheets) {
        combinedRows.push([`=== ${sheet.name} ===`]);
        for (const row of sheet.rows) {
          combinedRows.push(row);
        }
      }
      sheetsToExport = [
        {
          name: "Dados Consolidados",
          pageIndex: 0,
          rows: combinedRows,
        },
      ];
    } else {
      sheetsToExport = rawSheets;
    }

    // Exportação em CSV
    if (outputFormat === "csv") {
      const csvLines: string[] = [];
      for (let sIdx = 0; sIdx < sheetsToExport.length; sIdx++) {
        const sheet = sheetsToExport[sIdx];
        if (sheetsToExport.length > 1) {
          csvLines.push(`# --- ${sheet.name} ---`);
        }
        for (const row of sheet.rows) {
          const line = row.map((cell) => escapeCsvCell(cell, csvDelimiter)).join(csvDelimiter);
          csvLines.push(line);
        }
      }

      // Adiciona BOM (\uFEFF) para compatibilidade perfeita com Excel no Windows
      const csvContent = `\uFEFF${csvLines.join("\r\n")}`;
      const csvBytes = new TextEncoder().encode(csvContent);

      return {
        data: csvBytes,
        fileName: "planilha.csv",
        mimeType: "text/csv;charset=utf-8;",
        totalSheets: sheetsToExport.length,
        totalRows: grandTotalRows,
        totalColumns: grandMaxCols,
        previewRows: allPreviewRows,
      };
    }

    // Exportação padrão em XLSX (OpenXML real em pacote ZIP)
    const xlsxBytes = buildOpenXmlWorkbook(sheetsToExport);

    return {
      data: xlsxBytes,
      fileName: "planilha.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      totalSheets: sheetsToExport.length,
      totalRows: grandTotalRows,
      totalColumns: grandMaxCols,
      previewRows: allPreviewRows,
    };
  } finally {
    try {
      pdf.cleanup();
      await loadingTask.destroy();
    } catch {
      // Ignora erro de limpeza
    }
  }
}

/**
 * Monta a estrutura OpenXML (ECMA-376) nativa compactada em ZIP para Microsoft Excel.
 */
function buildOpenXmlWorkbook(sheets: readonly ExtractedSheetData[]): Uint8Array {
  const effectiveSheets =
    sheets.length > 0 ? sheets : [{ name: "Planilha 1", pageIndex: 0, rows: [] }];
  const files: Array<{ name: string; data: Uint8Array }> = [];
  const encoder = new TextEncoder();

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${effectiveSheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("\n  ")}
</Types>`;
  files.push({ name: "[Content_Types].xml", data: encoder.encode(contentTypesXml) });

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  files.push({ name: "_rels/.rels", data: encoder.encode(rootRelsXml) });

  // 3. xl/_rels/workbook.xml.rels
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${effectiveSheets
    .map(
      (_, i) =>
        `<Relationship Id="rIdSheet${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("\n  ")}
</Relationships>`;
  files.push({ name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRelsXml) });

  // 4. xl/workbook.xml
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView xWindow="0" yWindow="0" windowWidth="20480" windowHeight="10240"/>
  </bookViews>
  <sheets>
    ${effectiveSheets
      .map(
        (s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rIdSheet${i + 1}"/>`,
      )
      .join("\n    ")}
  </sheets>
</workbook>`;
  files.push({ name: "xl/workbook.xml", data: encoder.encode(workbookXml) });

  // 5. xl/styles.xml
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;
  files.push({ name: "xl/styles.xml", data: encoder.encode(stylesXml) });

  // 6. xl/worksheets/sheet${i + 1}.xml
  for (let sIdx = 0; sIdx < effectiveSheets.length; sIdx++) {
    const sheet = effectiveSheets[sIdx];
    const rowElements: string[] = [];

    for (let rIdx = 0; rIdx < sheet.rows.length; rIdx++) {
      const row = sheet.rows[rIdx];
      const cellElements: string[] = [];
      const rowIndexNumber = rIdx + 1;

      for (let cIdx = 0; cIdx < row.length; cIdx++) {
        const cellValue = row[cIdx];
        const cellRef = `${getExcelColumnLetter(cIdx)}${rowIndexNumber}`;

        if (isNumericValue(cellValue)) {
          cellElements.push(`<c r="${cellRef}"><v>${cellValue.trim()}</v></c>`);
        } else {
          cellElements.push(
            `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(cellValue)}</t></is></c>`,
          );
        }
      }

      rowElements.push(`<row r="${rowIndexNumber}">${cellElements.join("")}</row>`);
    }

    const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rowElements.join("\n    ")}
  </sheetData>
</worksheet>`;

    files.push({
      name: `xl/worksheets/sheet${sIdx + 1}.xml`,
      data: encoder.encode(worksheetXml),
    });
  }

  return createZipArchive(files);
}

function createEmptyXlsx(): Uint8Array {
  return buildOpenXmlWorkbook([{ name: "Planilha 1", pageIndex: 0, rows: [] }]);
}
