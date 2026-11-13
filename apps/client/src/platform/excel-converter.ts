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

type Matrix = readonly [number, number, number, number, number, number];

interface VerticalVectorLine {
  readonly x: number;
  readonly yMin: number;
  readonly yMax: number;
}

interface TextSpan {
  readonly x: number;
  readonly right: number;
  readonly text: string;
  readonly fontSize: number;
}

interface ExtractedCell {
  x: number;
  right: number;
  text: string;
  column?: number;
}

const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

function toMatrix(value: unknown): Matrix | undefined {
  if (
    (Array.isArray(value) || ArrayBuffer.isView(value)) &&
    "length" in value &&
    typeof value.length === "number" &&
    value.length >= 6
  ) {
    const arr = value as ArrayLike<unknown>;
    const nums = [arr[0], arr[1], arr[2], arr[3], arr[4], arr[5]];
    if (nums.every((n): n is number => typeof n === "number" && Number.isFinite(n))) {
      return [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
    }
  }
  return undefined;
}

function multiplyMatrix(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): readonly [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function collectVerticalSegmentsFromSubpaths(
  subpaths: ReadonlyArray<{ points: ReadonlyArray<readonly [number, number]>; closed: boolean }>,
  isStroke: boolean,
  isFill: boolean,
  forceClose: boolean,
  output: VerticalVectorLine[],
): void {
  for (const subpath of subpaths) {
    const { points } = subpath;
    if (points.length < 2) continue;

    if (isStroke) {
      const segCount = subpath.closed || forceClose ? points.length : points.length - 1;
      for (let i = 0; i < segCount; i++) {
        const p0 = points[i];
        const p1 = points[(i + 1) % points.length];
        if (Math.abs(p1[0] - p0[0]) <= 1.5 && Math.abs(p1[1] - p0[1]) >= 8) {
          output.push({
            x: (p0[0] + p1[0]) / 2,
            yMin: Math.min(p0[1], p1[1]),
            yMax: Math.max(p0[1], p1[1]),
          });
        }
      }
    }

    if (isFill && points.length >= 3) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [px, py] of points) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      if (maxX - minX <= 4 && maxY - minY >= 8) {
        output.push({
          x: (minX + maxX) / 2,
          yMin: minY,
          yMax: maxY,
        });
      }
    }
  }
}

function decodeDrawOpsSubpaths(
  data: ArrayLike<number>,
  transform: Matrix,
): Array<{ points: Array<readonly [number, number]>; closed: boolean }> {
  const subpaths: Array<{ points: Array<readonly [number, number]>; closed: boolean }> = [];
  let current: { points: Array<readonly [number, number]>; closed: boolean } | undefined;

  for (let i = 0; i < data.length; ) {
    const op = data[i++];
    if (op === 0) {
      // DrawOPS.moveTo
      const x = data[i++];
      const y = data[i++];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        current = { points: [applyMatrix(transform, x, y)], closed: false };
        subpaths.push(current);
      }
    } else if (op === 1) {
      // DrawOPS.lineTo
      const x = data[i++];
      const y = data[i++];
      if (current && Number.isFinite(x) && Number.isFinite(y)) {
        current.points.push(applyMatrix(transform, x, y));
      }
    } else if (op === 2) {
      // DrawOPS.curveTo (cp1x, cp1y, cp2x, cp2y, x, y)
      i += 4;
      const x = data[i++];
      const y = data[i++];
      if (current && Number.isFinite(x) && Number.isFinite(y)) {
        current.points.push(applyMatrix(transform, x, y));
      }
    } else if (op === 3) {
      // DrawOPS.quadraticCurveTo (cpx, cpy, x, y)
      i += 2;
      const x = data[i++];
      const y = data[i++];
      if (current && Number.isFinite(x) && Number.isFinite(y)) {
        current.points.push(applyMatrix(transform, x, y));
      }
    } else if (op === 4) {
      // DrawOPS.closePath
      if (current) current.closed = true;
    } else {
      break;
    }
  }

  return subpaths;
}

/**
 * Extrai segmentos vetoriais verticais (bordas de tabela/retângulos finos) via OperatorList,
 * mapeando CTM e viewport e respeitando o recorte de região.
 */
async function extractVerticalVectorSegments(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>["getPage"]>>,
  viewport: { readonly width: number; readonly height: number; readonly transform: number[] },
  region?: SpreadsheetRegion,
): Promise<VerticalVectorLine[]> {
  if (typeof page.getOperatorList !== "function" || !pdfjsLib.OPS) return [];
  const ops = await page.getOperatorList();
  if (!ops?.fnArray || !ops?.argsArray) return [];

  const OPS = pdfjsLib.OPS;
  const viewportMatrix = toMatrix(viewport.transform) ?? IDENTITY_MATRIX;
  const strokeOps = new Set(
    [
      OPS.stroke,
      OPS.closeStroke,
      OPS.fillStroke,
      OPS.eoFillStroke,
      OPS.closeFillStroke,
      OPS.closeEOFillStroke,
    ].filter((n): n is number => typeof n === "number"),
  );
  const fillOps = new Set(
    [OPS.fill, OPS.eoFill, OPS.rawFillPath].filter((n): n is number => typeof n === "number"),
  );
  const closeStrokeOps = new Set(
    [OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter(
      (n): n is number => typeof n === "number",
    ),
  );

  const rawSegments: VerticalVectorLine[] = [];
  let ctm: Matrix = IDENTITY_MATRIX;
  const ctmStack: Matrix[] = [];
  let pendingSubpaths: Array<{ points: Array<readonly [number, number]>; closed: boolean }> = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === OPS.save) {
      ctmStack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = ctmStack.pop() ?? IDENTITY_MATRIX;
    } else if (fn === OPS.transform) {
      const m = toMatrix(args);
      if (m) ctm = multiplyMatrix(ctm, m);
    } else if (fn === OPS.constructPath && Array.isArray(args)) {
      const paintOp = typeof args[0] === "number" ? args[0] : -1;
      const isStroke = strokeOps.has(paintOp);
      const isFill = fillOps.has(paintOp);
      if (!isStroke && !isFill) continue;

      const rawPathArg = args[1];
      const drawData = Array.isArray(rawPathArg) ? rawPathArg[0] : rawPathArg;
      if (drawData && typeof (drawData as ArrayLike<number>).length === "number") {
        const fullTransform = multiplyMatrix(viewportMatrix, ctm);
        const subpaths = decodeDrawOpsSubpaths(drawData as ArrayLike<number>, fullTransform);
        collectVerticalSegmentsFromSubpaths(
          subpaths,
          isStroke,
          isFill,
          closeStrokeOps.has(paintOp),
          rawSegments,
        );
      }
    } else if (fn === OPS.moveTo && Array.isArray(args) && args.length >= 2) {
      const fullTransform = multiplyMatrix(viewportMatrix, ctm);
      pendingSubpaths.push({
        points: [applyMatrix(fullTransform, Number(args[0]), Number(args[1]))],
        closed: false,
      });
    } else if (fn === OPS.lineTo && Array.isArray(args) && args.length >= 2) {
      const current = pendingSubpaths.at(-1);
      if (current) {
        const fullTransform = multiplyMatrix(viewportMatrix, ctm);
        current.points.push(applyMatrix(fullTransform, Number(args[0]), Number(args[1])));
      }
    } else if (fn === OPS.rectangle && Array.isArray(args) && args.length >= 4) {
      const x = Number(args[0]);
      const y = Number(args[1]);
      const w = Number(args[2]);
      const h = Number(args[3]);
      const fullTransform = multiplyMatrix(viewportMatrix, ctm);
      pendingSubpaths.push({
        points: [
          applyMatrix(fullTransform, x, y),
          applyMatrix(fullTransform, x + w, y),
          applyMatrix(fullTransform, x + w, y + h),
          applyMatrix(fullTransform, x, y + h),
        ],
        closed: true,
      });
    } else if (fn === OPS.closePath) {
      const current = pendingSubpaths.at(-1);
      if (current) current.closed = true;
    } else if (strokeOps.has(fn) || fillOps.has(fn)) {
      if (pendingSubpaths.length > 0) {
        collectVerticalSegmentsFromSubpaths(
          pendingSubpaths,
          strokeOps.has(fn),
          fillOps.has(fn),
          closeStrokeOps.has(fn),
          rawSegments,
        );
        pendingSubpaths = [];
      }
    } else if (fn === OPS.endPath) {
      pendingSubpaths = [];
    }
  }

  if (!region) return rawSegments;
  const rLeft = region.left * viewport.width;
  const rRight = (region.left + region.width) * viewport.width;
  const rTop = region.top * viewport.height;
  const rBottom = (region.top + region.height) * viewport.height;

  const filtered: VerticalVectorLine[] = [];
  for (const seg of rawSegments) {
    if (seg.x < rLeft || seg.x > rRight || seg.yMax <= rTop || seg.yMin >= rBottom) continue;
    const yMin = Math.max(seg.yMin, rTop);
    const yMax = Math.min(seg.yMax, rBottom);
    if (yMax - yMin >= 4) filtered.push({ x: seg.x, yMin, yMax });
  }
  return filtered;
}

function hasVectorLineBetween(
  leftEdge: number,
  rightEdge: number,
  lineY: number,
  fontSize: number,
  vectorLines: readonly VerticalVectorLine[],
): boolean {
  return vectorLines.some(
    (v) =>
      v.x >= leftEdge - 1 &&
      v.x <= rightEdge + 1 &&
      v.yMin <= lineY + 2 &&
      v.yMax >= lineY - fontSize - 2,
  );
}

function detectGlobalColumnBoundaries(
  lineSpans: ReadonlyArray<{
    readonly y: number;
    readonly fontSize: number;
    readonly spans: readonly TextSpan[];
  }>,
  vectorLines: readonly VerticalVectorLine[],
): number[] {
  const multiSpanLines = lineSpans.filter((l) => l.spans.length >= 2);
  if (multiSpanLines.length === 0) return [];

  let minSpanX = Infinity;
  let maxSpanX = -Infinity;
  const events: Array<{ x: number; delta: 1 | -1 }> = [];

  for (const line of multiSpanLines) {
    for (const span of line.spans) {
      if (span.x < minSpanX) minSpanX = span.x;
      if (span.right > maxSpanX) maxSpanX = span.right;
      events.push({ x: span.x, delta: 1 }, { x: span.right, delta: -1 });
    }
  }

  events.sort((a, b) => a.x - b.x || a.delta - b.delta);

  const candidates: number[] = [];
  let active = 0;
  let prevX = minSpanX;

  for (const event of events) {
    if (active === 0 && event.x > prevX && prevX >= minSpanX && event.x <= maxSpanX) {
      const gapWidth = event.x - prevX;
      const matchingVector = vectorLines.find(
        (v) =>
          v.x >= prevX - 1 &&
          v.x <= event.x + 1 &&
          multiSpanLines.some((l) => v.yMin <= l.y + 2 && v.yMax >= l.y - l.fontSize - 2),
      );
      if (gapWidth >= 8) {
        candidates.push(matchingVector ? matchingVector.x : (prevX + event.x) / 2);
      } else if (gapWidth >= 3 && matchingVector) {
        candidates.push(matchingVector.x);
      }
    }
    active += event.delta;
    prevX = event.x;
  }

  // Bordas vetoriais internas também podem separar colunas de sub-tabelas quando há texto nos dois lados
  for (const v of vectorLines) {
    const overlappingLines = lineSpans.filter(
      (l) => v.yMin <= l.y + 2 && v.yMax >= l.y - l.fontSize - 2,
    );
    if (overlappingLines.length === 0) continue;
    const cutsSpan = overlappingLines.some((l) =>
      l.spans.some((s) => s.x + 1 < v.x && v.x < s.right - 1),
    );
    if (cutsSpan) continue;
    const hasLeft = overlappingLines.some((l) => l.spans.some((s) => s.right <= v.x + 1));
    const hasRight = overlappingLines.some((l) => l.spans.some((s) => s.x >= v.x - 1));
    if (hasLeft && hasRight) candidates.push(v.x);
  }

  const allSpans = lineSpans.flatMap((l) => l.spans);
  const filtered = candidates
    .filter((b) => allSpans.some((s) => s.right <= b + 1) && allSpans.some((s) => s.x >= b - 1))
    .sort((a, b) => a - b);

  const deduped: number[] = [];
  for (const b of filtered) {
    if (!deduped.length || b - deduped[deduped.length - 1] >= 4) {
      deduped.push(b);
    }
  }
  return deduped;
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

type ParsedOpenXmlCell =
  | { readonly kind: "string" }
  | { readonly kind: "number"; readonly value: string; readonly styleId: number };

function parseLocalizedNumber(numStr: string): { value: number; hasDecimals: boolean } | undefined {
  const trimmed = numStr.trim();
  if (!trimmed || /^-?0\d/.test(trimmed)) return undefined;

  let normalized: string | undefined;
  let hasDecimals = false;

  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
    normalized = trimmed;
    hasDecimals = trimmed.includes(".");
  } else if (/^-?(?:0|[1-9]\d{0,2}(?:\.\d{3})+|[1-9]\d*),\d+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
    hasDecimals = true;
  } else if (/^-?(?:0|[1-9]\d{0,2}(?:,\d{3})+)\.\d+$/.test(trimmed)) {
    normalized = trimmed.replace(/,/g, "");
    hasDecimals = true;
  }

  if (!normalized) return undefined;
  const significantDigits = normalized.replace(/[-.]/g, "").replace(/^0+/, "").length;
  if (significantDigits > 15) return undefined;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return undefined;
  return { value, hasDecimals };
}

function parseOpenXmlCellValue(raw: string): ParsedOpenXmlCell {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "string" };

  // Moeda brasileira (R$)
  const currencyMatch = /^(-?\s*)R\$\s*(-?)(.+)$/i.exec(trimmed);
  if (currencyMatch) {
    const negBefore = currencyMatch[1].includes("-");
    const negAfter = currencyMatch[2].includes("-");
    if (!(negBefore && negAfter)) {
      const parsed = parseLocalizedNumber(currencyMatch[3]);
      if (parsed) {
        const signed = negBefore || negAfter ? -Math.abs(parsed.value) : parsed.value;
        return { kind: "number", value: String(signed), styleId: 4 };
      }
    }
  }

  // Porcentagem (%)
  const percentMatch = /^(.+?)\s*%$/.exec(trimmed);
  if (percentMatch) {
    const parsed = parseLocalizedNumber(percentMatch[1]);
    if (parsed) {
      const pct = Number((parsed.value / 100).toPrecision(15));
      return { kind: "number", value: String(pct), styleId: 5 };
    }
  }

  // Data brasileira dd/mm/yyyy
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (dateMatch) {
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (day >= 1 && day <= daysInMonth) {
        const serial = Math.round(
          (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000,
        );
        return { kind: "number", value: String(serial), styleId: 6 };
      }
    }
  }

  // Número padrão ou pt-BR
  const plain = parseLocalizedNumber(trimmed);
  if (plain) {
    return {
      kind: "number",
      value: String(plain.value),
      styleId: plain.hasDecimals ? 3 : 2,
    };
  }

  return { kind: "string" };
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
      const vectorLines = options.columnSeparators
        ? []
        : await extractVerticalVectorSegments(page, viewport, options.region);
      options.signal?.throwIfAborted();
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
      const rawLines: RawTextItem[][] = [];
      let currentRawLine: RawTextItem[] = [];
      for (const item of items) {
        if (currentRawLine.length && Math.abs(item.y - currentRawLine[0].y) > 4) {
          currentRawLine.sort((a, b) => a.x - b.x);
          rawLines.push(currentRawLine);
          currentRawLine = [];
        }
        currentRawLine.push(item);
      }
      if (currentRawLine.length) {
        currentRawLine.sort((a, b) => a.x - b.x);
        rawLines.push(currentRawLine);
      }

      const lines: Array<{ y: number; cells: ExtractedCell[] }> = [];
      let globalBoundaries: number[] = [];

      if (options.columnSeparators) {
        const boundaries = options.columnSeparators.map((value) => value * viewport.width);
        for (const rawLine of rawLines) {
          const cells: ExtractedCell[] = [];
          for (const item of rawLine) {
            const column = boundaries.filter((x) => item.x >= x).length;
            if (column < boundaries.length && item.x + item.width > boundaries[column] + 0.01)
              throw new Error("PDF_SEPARADOR_CORTA_TEXTO");
            const existing = cells.find((cell) => cell.column === column);
            if (existing) {
              existing.text +=
                (item.x - existing.right > item.fontSize * 0.15 ? " " : "") + item.str;
              existing.right = Math.max(existing.right, item.x + item.width);
            } else {
              cells.push({ x: item.x, right: item.x + item.width, text: item.str, column });
            }
          }
          lines.push({ y: rawLine[0].y, cells });
        }
      } else {
        // 1. Pré-agrupa fragmentos/palavras contíguas na mesma linha sem borda vetorial separadora
        const lineSpans = rawLines.map((rawLine) => {
          const lineY = rawLine[0].y;
          const spans: TextSpan[] = [];
          for (const item of rawLine) {
            const prev = spans.at(-1);
            if (!prev) {
              spans.push({
                x: item.x,
                right: item.x + item.width,
                text: item.str,
                fontSize: item.fontSize,
              });
              continue;
            }
            const gap = item.x - prev.right;
            const wordThreshold = Math.max(Math.max(prev.fontSize, item.fontSize) * 0.55, 4);
            const hasBorder = hasVectorLineBetween(
              prev.right,
              item.x,
              lineY,
              Math.max(prev.fontSize, item.fontSize),
              vectorLines,
            );
            if (!hasBorder && gap <= wordThreshold) {
              spans[spans.length - 1] = {
                x: prev.x,
                right: Math.max(prev.right, item.x + item.width),
                text: prev.text + (gap > item.fontSize * 0.15 ? " " : "") + item.str,
                fontSize: Math.max(prev.fontSize, item.fontSize),
              };
            } else {
              spans.push({
                x: item.x,
                right: item.x + item.width,
                text: item.str,
                fontSize: item.fontSize,
              });
            }
          }
          const maxFont = spans.reduce((m, s) => Math.max(m, s.fontSize), 12);
          return { y: lineY, fontSize: maxFont, spans };
        });

        // 2. Detecta fronteiras globais por projeção X + linhas vetoriais verticais
        globalBoundaries = detectGlobalColumnBoundaries(lineSpans, vectorLines);

        // 3. Divide cada linha usando fronteiras globais, bordas vetoriais locais ou lacuna larga (> 18pt)
        for (const entry of lineSpans) {
          const cells: ExtractedCell[] = [];
          for (const span of entry.spans) {
            const prevCell = cells.at(-1);
            if (!prevCell) {
              cells.push({ x: span.x, right: span.right, text: span.text });
              continue;
            }
            const gap = span.x - prevCell.right;
            const crossesGlobalBoundary = globalBoundaries.some(
              (b) => prevCell.right <= b + 1 && span.x >= b - 1,
            );
            const crossesLocalBorder =
              gap >= 1 &&
              hasVectorLineBetween(
                prevCell.right,
                span.x,
                entry.y,
                Math.max(entry.fontSize, span.fontSize),
                vectorLines,
              );
            if (crossesGlobalBoundary || crossesLocalBorder || gap > 18) {
              cells.push({ x: span.x, right: span.right, text: span.text });
            } else {
              prevCell.text += (gap > span.fontSize * 0.15 ? " " : "") + span.text;
              prevCell.right = Math.max(prevCell.right, span.right);
            }
          }
          lines.push({ y: entry.y, cells });
        }
      }

      const reference = lines.reduce<(typeof lines)[number] | undefined>(
        (best, candidate) =>
          !best || candidate.cells.length > best.cells.length ? candidate : best,
        undefined,
      );
      const canUseGlobalBuckets =
        !options.columnSeparators &&
        globalBoundaries.length >= 1 &&
        lines.every((entry) => {
          let prevCol = -1;
          for (const cell of entry.cells) {
            const col = globalBoundaries.filter((b) => cell.x >= b - 1).length;
            if (col <= prevCol) return false;
            prevCol = col;
          }
          return true;
        });

      const anchors = reference?.cells.map((cell) => cell.x) ?? [];
      const detectedColumnCount = canUseGlobalBuckets
        ? globalBoundaries.length + 1
        : anchors.length;
      const tableLines = lines.filter((entry) => entry.cells.length >= 2);
      const firstTableY = tableLines[0]?.y ?? Infinity;
      const lastTableY = tableLines.at(-1)?.y ?? -Infinity;
      const rows = lines
        .filter(
          (entry) =>
            !options.detectTablesOnly ||
            (options.columnSeparators && options.columnSeparators.length >= 1) ||
            (detectedColumnCount >= 2 && entry.y >= firstTableY && entry.y <= lastTableY),
        )
        .map((entry) => {
          if (options.columnSeparators) {
            const row = Array<string>(options.columnSeparators.length + 1).fill("");
            for (const cell of entry.cells) row[cell.column ?? 0] = cell.text;
            return row;
          }
          if (canUseGlobalBuckets) {
            const row = Array<string>(globalBoundaries.length + 1).fill("");
            for (const cell of entry.cells) {
              const col = globalBoundaries.filter((b) => cell.x >= b - 1).length;
              row[col] = cell.text;
            }
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
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/>
    <numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;
  files.push({ name: "xl/styles.xml", data: encoder.encode(stylesXml) });

  // 6. xl/worksheets/sheet${i + 1}.xml
  for (let sIdx = 0; sIdx < effectiveSheets.length; sIdx++) {
    const sheet = effectiveSheets[sIdx];
    const rowElements: string[] = [];
    const maxColCount = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0);
    const colWidths = Array.from({ length: maxColCount }, (_, cIdx) => {
      const maxLen = sheet.rows.reduce((max, row) => Math.max(max, (row[cIdx] ?? "").length), 8);
      return Math.min(60, maxLen + 4);
    });
    const colsXml =
      colWidths.length > 0
        ? `  <cols>\n${colWidths
            .map(
              (width, cIdx) =>
                `    <col min="${cIdx + 1}" max="${cIdx + 1}" width="${width}" customWidth="1"/>`,
            )
            .join("\n")}\n  </cols>\n`
        : "";

    for (let rIdx = 0; rIdx < sheet.rows.length; rIdx++) {
      const row = sheet.rows[rIdx];
      const cellElements: string[] = [];
      const rowIndexNumber = rIdx + 1;
      const applyHeaderStyle = rIdx === 0 && sheet.rows.length > 1 && !preserveText;

      for (let cIdx = 0; cIdx < row.length; cIdx++) {
        const cellValue = row[cIdx];
        const cellRef = `${getExcelColumnLetter(cIdx)}${rowIndexNumber}`;

        if (applyHeaderStyle) {
          cellElements.push(
            `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXml(cellValue)}</t></is></c>`,
          );
          continue;
        }

        if (!preserveText) {
          const parsed = parseOpenXmlCellValue(cellValue);
          if (parsed.kind === "number") {
            cellElements.push(
              `<c r="${cellRef}" t="n" s="${parsed.styleId}"><v>${parsed.value}</v></c>`,
            );
            continue;
          }
        }

        cellElements.push(
          `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(cellValue)}</t></is></c>`,
        );
      }

      rowElements.push(`<row r="${rowIndexNumber}">${cellElements.join("")}</row>`);
    }

    const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}  <sheetData>
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
