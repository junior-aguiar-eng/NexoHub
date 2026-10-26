import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { withAppBase } from "./app-paths";
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
    ? new URL(withAppBase("standard_fonts/"), window.location.origin).href
    : undefined;

export interface PdfToExcelOptions {
  readonly outputFormat?: "xlsx" | "csv";
  readonly sheetMode?: "per-page" | "single-sheet";
  readonly csvDelimiter?: "," | ";" | "\t";
  readonly detectTablesOnly?: boolean;
  readonly selectedPages?: readonly number[];
  /** Frações da página lógica/CropBox antes da rotação, origem superior esquerda. */
  readonly region?: SpreadsheetRegion;
  /** Posições X absolutas normalizadas, estritamente crescentes e dentro da região. */
  readonly columnSeparators?: readonly number[];
  readonly preserveText?: boolean;
  readonly signal?: AbortSignal;
}

export interface SpreadsheetRegion {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function validateSpreadsheetSelection(options: PdfToExcelOptions, pageCount: number): void {
  const region = options.region ?? { left: 0, top: 0, width: 1, height: 1 };
  const pages = options.selectedPages;
  const columns = options.columnSeparators;
  if (
    (pages &&
      (!pages.length ||
        pages.some((page) => !Number.isSafeInteger(page) || page < 1 || page > pageCount))) ||
    ![region.left, region.top, region.width, region.height].every(Number.isFinite) ||
    region.left < 0 ||
    region.top < 0 ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.left + region.width > 1 + 1e-9 ||
    region.top + region.height > 1 + 1e-9 ||
    (columns &&
      (columns.length > 255 ||
        columns.some(
          (x, index) =>
            !Number.isFinite(x) ||
            x <= region.left ||
            x >= region.left + region.width ||
            (index > 0 && x <= columns[index - 1]),
        )))
  ) {
    throw new Error("OPCOES_PLANILHA_INVALIDAS");
  }
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
  return raw.replace(/\u00A0/g, " ").trim();
}

function escapeXml(unsafe: string): string {
  return (
    unsafe
      // biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 rejeita esses caracteres vindos do PDF.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  );
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

function escapeCsvCell(raw: string, delimiter: string): string {
  // Aspas CSV não impedem execução de fórmulas pelos programas de planilha.
  const val = /^[\s\uFEFF]*[=+@-]/.test(raw) && !isNumericValue(raw) ? `'${raw}` : raw;
  if (val.includes(delimiter) || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function isNumericValue(val: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  // Aceita inteiros e decimais regulares (ponto ou vírgula em padrão limpo)
  return (
    /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed) &&
    trimmed.replace(/[-.]/g, "").replace(/^0+/, "").length <= 15
  );
}

export interface PdfSpreadsheetData {
  readonly pageCount: number;
  readonly sheets: readonly ExtractedSheetData[];
  readonly totalRows: number;
  readonly totalColumns: number;
  readonly previewRows: string[][];
}

/** Extrai uma prévia real sem gerar nem baixar um arquivo. Colunas são heurísticas espaciais. */
export async function extractPdfSpreadsheetData(
  pdfBytes: Uint8Array,
  options: PdfToExcelOptions = {},
): Promise<PdfSpreadsheetData> {
  options.signal?.throwIfAborted();
  if (!pdfBytes.length) throw new Error("DOCUMENTO_VAZIO");
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  let pdf: Awaited<typeof loadingTask.promise> | undefined;
  const abort = () => {
    void loadingTask.destroy().catch(() => {});
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    pdf = await loadingTask.promise;
    options.signal?.throwIfAborted();
    validateSpreadsheetSelection(options, pdf.numPages);
    const sheets: ExtractedSheetData[] = [];
    let hasText = false;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      options.signal?.throwIfAborted();
      if (options.selectedPages && !options.selectedPages.includes(pageNum)) continue;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1, rotation: 0 });
      const content = await page.getTextContent();
      const items: RawTextItem[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const str = sanitizeCellText(item.str);
        if (!str) continue;
        hasText = true;
        const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontSize = Math.hypot(transform[2], transform[3]) || 12;
        if (options.region) {
          const r = options.region;
          const left = r.left * viewport.width,
            right = (r.left + r.width) * viewport.width;
          const top = r.top * viewport.height,
            bottom = (r.top + r.height) * viewport.height;
          const itemTop = transform[5] - (item.height || fontSize),
            itemRight = transform[4] + item.width;
          if (
            itemRight <= left ||
            transform[4] >= right ||
            transform[5] <= top ||
            itemTop >= bottom
          )
            continue;
          if (
            transform[4] < left - 0.01 ||
            itemRight > right + 0.01 ||
            itemTop < top - 0.01 ||
            transform[5] > bottom + 0.01
          )
            throw new Error("PDF_REGIAO_CORTA_TEXTO");
        }
        items.push({
          str,
          x: transform[4],
          y: transform[5],
          width: item.width,
          height: item.height,
          fontSize,
        });
      }
      items.sort((a, b) => a.y - b.y || a.x - b.x);
      const lines: Array<{
        y: number;
        cells: Array<{ x: number; right: number; text: string; column?: number }>;
      }> = [];
      let line: RawTextItem[] = [];
      const flush = () => {
        if (!line.length) return;
        line.sort((a, b) => a.x - b.x);
        const cells: Array<{ x: number; right: number; text: string; column?: number }> = [];
        let right = -Infinity;
        for (const item of line) {
          if (options.columnSeparators) {
            const boundaries = options.columnSeparators.map((value) => value * viewport.width);
            const column = boundaries.filter((x) => item.x >= x).length;
            if (column < boundaries.length && item.x + item.width > boundaries[column] + 0.01)
              throw new Error("PDF_SEPARADOR_CORTA_TEXTO");
            const existing = cells.find((cell) => cell.column === column);
            if (existing) {
              existing.text +=
                (item.x - existing.right > item.fontSize * 0.15 ? " " : "") + item.str;
              existing.right = Math.max(existing.right, item.x + item.width);
            } else cells.push({ x: item.x, right: item.x + item.width, text: item.str, column });
            continue;
          }
          if (!cells.length || item.x - right > 18) {
            cells.push({ x: item.x, right: item.x + item.width, text: item.str });
          } else {
            cells[cells.length - 1].text +=
              (item.x - right > item.fontSize * 0.15 ? " " : "") + item.str;
            cells[cells.length - 1].right = Math.max(
              cells[cells.length - 1].right,
              item.x + item.width,
            );
          }
          right = item.x + item.width;
        }
        lines.push({ y: line[0].y, cells });
        line = [];
      };
      for (const item of items) {
        if (line.length && Math.abs(item.y - line[0].y) > 4) flush();
        line.push(item);
      }
      flush();
      const reference = lines.reduce<(typeof lines)[number] | undefined>(
        (best, candidate) =>
          !best || candidate.cells.length > best.cells.length ? candidate : best,
        undefined,
      );
      const anchors = reference?.cells.map((cell) => cell.x) ?? [];
      const tableLines = lines.filter((entry) => entry.cells.length >= 2);
      const firstTableY = tableLines[0]?.y ?? Infinity;
      const lastTableY = tableLines.at(-1)?.y ?? -Infinity;
      const rows = lines
        .filter(
          (entry) =>
            !options.detectTablesOnly ||
            (options.columnSeparators && options.columnSeparators.length >= 1) ||
            (anchors.length >= 2 && entry.y >= firstTableY && entry.y <= lastTableY),
        )
        .map((entry) => {
          if (options.columnSeparators) {
            const row = Array<string>(options.columnSeparators.length + 1).fill("");
            for (const cell of entry.cells) row[cell.column ?? 0] = cell.text;
            return row;
          }
          const row = Array<string>(Math.max(1, anchors.length)).fill("");
          let previousColumn = -1;
          entry.cells.forEach((cell, index) => {
            const lastCandidate = anchors.length - (entry.cells.length - index);
            let column = previousColumn + 1;
            let bestDistance = Infinity;
            // Cada célula ocupa uma coluna distinta. Considerar ambas as bordas
            // mantém números alinhados à direita junto do cabeçalho correspondente.
            for (let i = column; i <= lastCandidate; i++) {
              const referenceCell = reference?.cells[i];
              if (!referenceCell) continue;
              const distance = Math.min(
                Math.abs(cell.x - referenceCell.x),
                Math.abs(cell.right - referenceCell.right),
              );
              if (distance < bestDistance) {
                bestDistance = distance;
                column = i;
              }
            }
            row[column] = cell.text;
            previousColumn = column;
          });
          return row;
        });
      sheets.push({ name: `Página ${pageNum}`, pageIndex: pageNum - 1, rows });
      page.cleanup();
    }
    options.signal?.throwIfAborted();
    if (!hasText) throw new Error("PDF_SEM_TEXTO_SELECIONAVEL");
    const rows = sheets.flatMap((sheet) => sheet.rows);
    if (!rows.length)
      throw new Error(options.detectTablesOnly ? "PDF_SEM_TABELAS" : "PDF_SEM_DADOS_SELECAO");
    return {
      pageCount: pdf.numPages,
      sheets,
      totalRows: rows.length,
      totalColumns: sheets.reduce(
        (maximum, sheet) => sheet.rows.reduce((n, row) => Math.max(n, row.length), maximum),
        0,
      ),
      previewRows: rows.slice(0, 15),
    };
  } catch (error) {
    options.signal?.throwIfAborted();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    try {
      if (!options.signal?.aborted) await pdf?.cleanup();
    } finally {
      await loadingTask.destroy();
    }
  }
}

export async function convertPdfToExcelDocument(
  pdfBytes: Uint8Array,
  options: PdfToExcelOptions = {},
): Promise<PdfToExcelResult> {
  const { outputFormat = "xlsx", sheetMode = "per-page", csvDelimiter = ";" } = options;
  if (
    !["xlsx", "csv"].includes(outputFormat) ||
    !["per-page", "single-sheet"].includes(sheetMode) ||
    ![",", ";", "\t"].includes(csvDelimiter)
  ) {
    throw new Error("OPCOES_PLANILHA_INVALIDAS");
  }
  const extracted = await extractPdfSpreadsheetData(pdfBytes, options);
  options.signal?.throwIfAborted();
  const sheets =
    sheetMode === "single-sheet"
      ? [
          {
            name: "Dados Consolidados",
            pageIndex: 0,
            rows: extracted.sheets.flatMap((sheet) => sheet.rows),
          },
        ]
      : extracted.sheets;
  const csv = outputFormat === "csv";
  const data = csv
    ? new TextEncoder().encode(
        `\uFEFF${sheets
          .flatMap((sheet) => sheet.rows)
          .map((row) => row.map((cell) => escapeCsvCell(cell, csvDelimiter)).join(csvDelimiter))
          .join("\r\n")}`,
      )
    : buildOpenXmlWorkbook(sheets, options.preserveText ?? false);
  return {
    data,
    fileName: csv ? "planilha.csv" : "planilha.xlsx",
    mimeType: csv
      ? "text/csv;charset=utf-8;"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    totalSheets: csv ? 1 : sheets.length,
    totalRows: extracted.totalRows,
    totalColumns: extracted.totalColumns,
    previewRows: extracted.previewRows,
  };
}

/**
 * Monta a estrutura OpenXML (ECMA-376) nativa compactada em ZIP para Microsoft Excel.
 */
function buildOpenXmlWorkbook(
  sheets: readonly ExtractedSheetData[],
  preserveText = false,
): Uint8Array {
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

        if (!preserveText && isNumericValue(cellValue)) {
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
