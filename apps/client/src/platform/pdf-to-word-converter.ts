import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { zlibSync } from "fflate";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { withAppBase } from "./app-paths";
import { type BrowserOcrOptions, type BrowserOcrOutcome, performBrowserOcr } from "./browser-ocr";

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

const NUMBERED_LIST_REF = "nexohub-numbered-list";
const MAX_IMAGE_PIXELS = 12_000_000;
const MAX_SINGLE_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGES_BYTES = 24 * 1024 * 1024;
const MAX_IMAGES_PER_DOC = 50;
const MIN_IMAGE_DIMENSION_PX = 8;
const MAX_DOCX_IMAGE_WIDTH_PX = 560;
const MAX_DOCX_IMAGE_HEIGHT_PX = 720;
const MAX_CANVAS_FALLBACK_DIM = 1600;

const DRAW_OPS = {
  moveTo: 0,
  lineTo: 1,
  curveTo: 2,
  quadraticCurveTo: 3,
  closePath: 4,
} as const;

export interface PdfToWordReport {
  pageCount: number;
  wordCount: number;
  paragraphCount: number;
  originalBytes: number;
  convertedBytes: number;
  isScannedWarning: boolean;
  sampleText: string[];
  tableCount: number;
  imageCount: number;
  usedOcr: boolean;
}

export interface PdfToWordResult {
  docxBytes: Uint8Array;
  report: PdfToWordReport;
}

export interface PdfToWordOptions {
  onProgress?: (current: number, total: number) => void;
  preserveTables?: boolean;
  extractImages?: boolean;
  runOcrIfScanned?: boolean;
  ocrRunner?: (blob: Blob, options?: BrowserOcrOptions) => Promise<BrowserOcrOutcome>;
}

type Matrix6 = [number, number, number, number, number, number];

interface RawTextFragment {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

interface LineRun {
  text: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
}

interface ReconstructedLine {
  y: number;
  minX: number;
  maxX: number;
  fragments: RawTextFragment[];
  runs: LineRun[];
  cells: Array<{ x: number; right: number; runs: LineRun[]; text: string }>;
  fullText: string;
  fontSize: number;
  bold: boolean;
}

interface HSegment {
  y: number;
  x1: number;
  x2: number;
}

interface VSegment {
  x: number;
  y1: number;
  y2: number;
}

interface ExtractedPageImage {
  x: number;
  y: number;
  width: number;
  height: number;
  bytes: Uint8Array;
}

interface DecodedPdfImage {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: ImageBitmap;
}

interface TableCellData {
  runs: LineRun[];
  text: string;
}

interface ExtractedTableBlock {
  y: number;
  rows: TableCellData[][];
}

interface PageExtractedData {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  fragments: RawTextFragment[];
  hSegments: HSegment[];
  vSegments: VSegment[];
  images: ExtractedPageImage[];
  ocrLines: string[];
}

type PositionedDocxBlock =
  | { kind: "element"; bandY: number; y: number; bandOrder: number; element: Paragraph | Table }
  | { kind: "image"; bandY: number; y: number; bandOrder: number; image: ExtractedPageImage };

function normalizeFontStyles(fontName: string): { bold: boolean; italic: boolean } {
  const lower = fontName.toLowerCase();
  const bold =
    lower.includes("bold") ||
    lower.includes("black") ||
    lower.includes("heavy") ||
    lower.includes("semi-bold") ||
    lower.includes("semibold");
  const italic = lower.includes("italic") || lower.includes("oblique");
  return { bold, italic };
}

function applyMatrixPoint(m: Matrix6, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of out.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  view.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
  return out;
}

function encodePngFromRgba(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;

  const stride = width * 4;
  const rows = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rows.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const chunks = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlibSync(rows)),
    pngChunk("IEND", new Uint8Array(0)),
  ];

  const totalLength = chunks.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of chunks) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

function fitImageDimensions(
  pixelWidth: number,
  pixelHeight: number,
  displayWidthPt: number,
  displayHeightPt: number,
): { width: number; height: number } {
  const aspect = pixelWidth > 0 && pixelHeight > 0 ? pixelWidth / pixelHeight : 1;
  // Converte pontos PDF (72 DPI) para pixels Word (96 DPI) preservando proporção
  let width = displayWidthPt > 4 ? displayWidthPt * (96 / 72) : pixelWidth;
  let height = displayHeightPt > 4 ? displayHeightPt * (96 / 72) : pixelHeight;

  if (width <= 0 || height <= 0) {
    width = Math.max(16, pixelWidth);
    height = Math.max(16, pixelHeight);
  } else {
    height = width / aspect;
  }

  if (width > MAX_DOCX_IMAGE_WIDTH_PX) {
    width = MAX_DOCX_IMAGE_WIDTH_PX;
    height = width / aspect;
  }
  if (height > MAX_DOCX_IMAGE_HEIGHT_PX) {
    height = MAX_DOCX_IMAGE_HEIGHT_PX;
    width = height * aspect;
  }

  return {
    width: Math.max(12, Math.round(width)),
    height: Math.max(12, Math.round(height)),
  };
}

async function decodeImageToPngBytes(img: DecodedPdfImage): Promise<Uint8Array | null> {
  const width = Math.round(img.width);
  const height = Math.round(img.height);
  if (
    width < MIN_IMAGE_DIMENSION_PX ||
    height < MIN_IMAGE_DIMENSION_PX ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    return null;
  }

  if (img.data && img.data.length > 0) {
    const pixelCount = width * height;
    let rgba: Uint8Array;

    if (img.kind === pdfjsLib.ImageKind.RGBA_32BPP || img.data.length === pixelCount * 4) {
      rgba = img.data instanceof Uint8Array ? img.data : new Uint8Array(img.data);
    } else if (img.kind === pdfjsLib.ImageKind.RGB_24BPP || img.data.length === pixelCount * 3) {
      rgba = new Uint8Array(pixelCount * 4);
      for (let i = 0; i < pixelCount; i++) {
        rgba[i * 4] = img.data[i * 3];
        rgba[i * 4 + 1] = img.data[i * 3 + 1];
        rgba[i * 4 + 2] = img.data[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
    } else if (img.kind === pdfjsLib.ImageKind.GRAYSCALE_1BPP) {
      rgba = new Uint8Array(pixelCount * 4);
      const rowBytes = Math.ceil(width / 8);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const sample = (img.data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
          const out = (y * width + x) * 4;
          rgba[out] = sample;
          rgba[out + 1] = sample;
          rgba[out + 2] = sample;
          rgba[out + 3] = 255;
        }
      }
    } else {
      return null;
    }

    const encoded = encodePngFromRgba(width, height, rgba);
    return encoded.byteLength <= MAX_SINGLE_IMAGE_BYTES ? encoded : null;
  }

  if (img.bitmap && typeof document !== "undefined") {
    const scale = Math.min(1, MAX_CANVAS_FALLBACK_DIM / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img.bitmap, 0, 0, targetW, targetH);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/png"),
      );
      if (!blob || blob.size > MAX_SINGLE_IMAGE_BYTES) return null;
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return null;
}

async function resolvePageObject<T>(
  store: { has?: (id: string) => boolean; get: (id: string, cb?: (data: T) => void) => T },
  objId: string,
): Promise<T | null> {
  try {
    if (typeof store.has === "function" && store.has(objId)) {
      return store.get(objId) ?? null;
    }
    return await new Promise<T | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 1500);
      try {
        store.get(objId, (data: T) => {
          clearTimeout(timer);
          resolve(data ?? null);
        });
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

function isStrokeOp(op: number): boolean {
  return (
    op === pdfjsLib.OPS.stroke ||
    op === pdfjsLib.OPS.closeStroke ||
    op === pdfjsLib.OPS.fillStroke ||
    op === pdfjsLib.OPS.eoFillStroke ||
    op === pdfjsLib.OPS.closeFillStroke ||
    op === pdfjsLib.OPS.closeEOFillStroke
  );
}

function isFillOp(op: number): boolean {
  return (
    op === pdfjsLib.OPS.fill ||
    op === pdfjsLib.OPS.eoFill ||
    op === pdfjsLib.OPS.fillStroke ||
    op === pdfjsLib.OPS.eoFillStroke ||
    op === pdfjsLib.OPS.closeFillStroke ||
    op === pdfjsLib.OPS.closeEOFillStroke
  );
}

async function extractPageGeometry(
  pageNum: number,
  page: pdfjsLib.PDFPageProxy,
  extractImages: boolean,
  remainingImageBudget: { bytes: number; count: number },
): Promise<PageExtractedData> {
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const styles = (textContent.styles ?? {}) as Record<string, { fontFamily?: string }>;
  const fragments: RawTextFragment[] = [];

  for (const item of textContent.items) {
    if (!("str" in item) || typeof item.str !== "string" || !item.str) continue;

    const transformed = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontSize =
      Math.hypot(transformed[2], transformed[3]) ||
      Math.abs(item.transform[0]) ||
      Math.abs(item.transform[3]) ||
      item.height ||
      12;
    const styleFamily = styles[item.fontName]?.fontFamily ?? "";
    const combinedFontName = `${item.fontName || ""} ${styleFamily}`.trim();

    fragments.push({
      text: item.str,
      x: transformed[4] || 0,
      y: transformed[5] || 0,
      width: item.width || 0,
      height: item.height || fontSize,
      fontSize,
      fontName: combinedFontName,
    });
  }

  const hSegments: HSegment[] = [];
  const vSegments: VSegment[] = [];
  const images: ExtractedPageImage[] = [];

  try {
    const opList = await page.getOperatorList();
    let ctm: Matrix6 = [...viewport.transform] as Matrix6;
    const ctmStack: Matrix6[] = [];

    const recordSegment = (x1: number, y1: number, x2: number, y2: number) => {
      const [vx1, vy1] = applyMatrixPoint(ctm, x1, y1);
      const [vx2, vy2] = applyMatrixPoint(ctm, x2, y2);
      if (Math.abs(vy1 - vy2) <= 1.5 && Math.abs(vx2 - vx1) >= 8) {
        hSegments.push({
          y: (vy1 + vy2) / 2,
          x1: Math.min(vx1, vx2),
          x2: Math.max(vx1, vx2),
        });
      } else if (Math.abs(vx1 - vx2) <= 1.5 && Math.abs(vy2 - vy1) >= 8) {
        vSegments.push({
          x: (vx1 + vx2) / 2,
          y1: Math.min(vy1, vy2),
          y2: Math.max(vy1, vy2),
        });
      }
    };

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i] as unknown[];

      if (fn === pdfjsLib.OPS.save) {
        ctmStack.push([...ctm] as Matrix6);
      } else if (fn === pdfjsLib.OPS.restore) {
        ctm = ctmStack.pop() ?? ([...viewport.transform] as Matrix6);
      } else if (fn === pdfjsLib.OPS.transform && Array.isArray(args) && args.length >= 6) {
        ctm = pdfjsLib.Util.transform(ctm, args as number[]) as Matrix6;
      } else if (fn === pdfjsLib.OPS.constructPath && Array.isArray(args)) {
        const drawOp = args[0] as number;
        const data = args[1] as [ArrayLike<number>?] | undefined;
        const minMax = args[2] as ArrayLike<number> | undefined;
        const pathOps = data?.[0];

        if (isStrokeOp(drawOp) && pathOps && pathOps.length > 0) {
          let cx = 0;
          let cy = 0;
          let startX = 0;
          let startY = 0;
          let idx = 0;
          while (idx < pathOps.length) {
            const cmd = pathOps[idx++];
            if (cmd === DRAW_OPS.moveTo && idx + 1 < pathOps.length) {
              cx = pathOps[idx++];
              cy = pathOps[idx++];
              startX = cx;
              startY = cy;
            } else if (cmd === DRAW_OPS.lineTo && idx + 1 < pathOps.length) {
              const nx = pathOps[idx++];
              const ny = pathOps[idx++];
              recordSegment(cx, cy, nx, ny);
              cx = nx;
              cy = ny;
            } else if (cmd === DRAW_OPS.curveTo && idx + 5 < pathOps.length) {
              cx = pathOps[idx + 4];
              cy = pathOps[idx + 5];
              idx += 6;
            } else if (cmd === DRAW_OPS.quadraticCurveTo && idx + 3 < pathOps.length) {
              cx = pathOps[idx + 2];
              cy = pathOps[idx + 3];
              idx += 4;
            } else if (cmd === DRAW_OPS.closePath) {
              recordSegment(cx, cy, startX, startY);
              cx = startX;
              cy = startY;
            } else {
              break;
            }
          }
        } else if (isFillOp(drawOp) && minMax && minMax.length >= 4) {
          const [vx1, vy1] = applyMatrixPoint(ctm, minMax[0], minMax[1]);
          const [vx2, vy2] = applyMatrixPoint(ctm, minMax[2], minMax[3]);
          const minX = Math.min(vx1, vx2);
          const maxX = Math.max(vx1, vx2);
          const minY = Math.min(vy1, vy2);
          const maxY = Math.max(vy1, vy2);
          const w = maxX - minX;
          const h = maxY - minY;
          if (h <= 3 && w >= 12) {
            hSegments.push({ y: (minY + maxY) / 2, x1: minX, x2: maxX });
          } else if (w <= 3 && h >= 12) {
            vSegments.push({ x: (minX + maxX) / 2, y1: minY, y2: maxY });
          }
        }
      } else if (
        extractImages &&
        remainingImageBudget.count < MAX_IMAGES_PER_DOC &&
        remainingImageBudget.bytes < MAX_TOTAL_IMAGES_BYTES &&
        (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject)
      ) {
        const corners = [
          applyMatrixPoint(ctm, 0, 0),
          applyMatrixPoint(ctm, 1, 0),
          applyMatrixPoint(ctm, 0, 1),
          applyMatrixPoint(ctm, 1, 1),
        ];
        const xs = corners.map((p) => p[0]);
        const ys = corners.map((p) => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const displayW = maxX - minX;
        const displayH = maxY - minY;
        if (displayW < 4 || displayH < 4) continue;

        let decoded: DecodedPdfImage | null = null;
        if (fn === pdfjsLib.OPS.paintInlineImageXObject) {
          decoded = (args[0] as DecodedPdfImage | undefined) ?? null;
        } else if (args[0] !== undefined) {
          const objId = String(args[0]);
          const store = objId.startsWith("g_") ? page.commonObjs : page.objs;
          decoded = await resolvePageObject<DecodedPdfImage>(
            store as unknown as {
              has?: (id: string) => boolean;
              get: (id: string, cb?: (data: DecodedPdfImage) => void) => DecodedPdfImage;
            },
            objId,
          );
        }

        if (!decoded) continue;
        const pngBytes = await decodeImageToPngBytes(decoded);
        if (!pngBytes) continue;
        if (remainingImageBudget.bytes + pngBytes.byteLength > MAX_TOTAL_IMAGES_BYTES) continue;

        remainingImageBudget.bytes += pngBytes.byteLength;
        remainingImageBudget.count += 1;

        const fitted = fitImageDimensions(decoded.width, decoded.height, displayW, displayH);
        images.push({
          x: minX,
          y: minY,
          width: fitted.width,
          height: fitted.height,
          bytes: pngBytes,
        });
      }
    }
  } catch {
    // Segue com a extração textual caso a lista de operadores falhe em algum PDF malformado
  }

  return {
    pageNumber: pageNum,
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    fragments,
    hSegments,
    vSegments,
    images,
    ocrLines: [],
  };
}

function mergeAxisCoords(coords: number[], tolerance: number): number[] {
  if (coords.length === 0) return [];
  const sorted = [...coords].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const current = groups[groups.length - 1];
    if (sorted[i] - current[current.length - 1] <= tolerance) {
      current.push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
}

function detectVectorGridTables(
  fragments: RawTextFragment[],
  hSegments: HSegment[],
  vSegments: VSegment[],
): { tables: ExtractedTableBlock[]; remainingFragments: RawTextFragment[] } {
  if (hSegments.length < 3 || vSegments.length < 3 || fragments.length === 0) {
    return { tables: [], remainingFragments: fragments };
  }

  // Agrupa segmentos horizontais e verticais em componentes conectados de grade
  const visitedH = new Array<boolean>(hSegments.length).fill(false);
  const visitedV = new Array<boolean>(vSegments.length).fill(false);
  const intersects = (h: HSegment, v: VSegment) =>
    v.x >= h.x1 - 3 && v.x <= h.x2 + 3 && h.y >= v.y1 - 3 && h.y <= v.y2 + 3;

  const tables: ExtractedTableBlock[] = [];
  const consumedIndices = new Set<number>();

  for (let startH = 0; startH < hSegments.length; startH++) {
    if (visitedH[startH]) continue;
    const compH: HSegment[] = [];
    const compV: VSegment[] = [];
    const queue: Array<{ kind: "h" | "v"; index: number }> = [{ kind: "h", index: startH }];
    visitedH[startH] = true;

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) break;
      if (node.kind === "h") {
        const h = hSegments[node.index];
        compH.push(h);
        for (let vIdx = 0; vIdx < vSegments.length; vIdx++) {
          if (!visitedV[vIdx] && intersects(h, vSegments[vIdx])) {
            visitedV[vIdx] = true;
            queue.push({ kind: "v", index: vIdx });
          }
        }
      } else {
        const v = vSegments[node.index];
        compV.push(v);
        for (let hIdx = 0; hIdx < hSegments.length; hIdx++) {
          if (!visitedH[hIdx] && intersects(hSegments[hIdx], v)) {
            visitedH[hIdx] = true;
            queue.push({ kind: "h", index: hIdx });
          }
        }
      }
    }

    const rowBounds = mergeAxisCoords(
      compH.map((h) => h.y),
      2.5,
    );
    const colBounds = mergeAxisCoords(
      compV.map((v) => v.x),
      2.5,
    );

    if (rowBounds.length < 3 || colBounds.length < 3 || colBounds.length > 16) continue;

    const minX = colBounds[0];
    const maxX = colBounds[colBounds.length - 1];
    const minY = rowBounds[0];
    const maxY = rowBounds[rowBounds.length - 1];

    const gridRows: TableCellData[][] = Array.from({ length: rowBounds.length - 1 }, () =>
      Array.from({ length: colBounds.length - 1 }, () => ({ runs: [], text: "" })),
    );
    const localConsumed: number[] = [];
    const cellFragments: Array<{ row: number; col: number; frag: RawTextFragment }> = [];

    for (let fIdx = 0; fIdx < fragments.length; fIdx++) {
      if (consumedIndices.has(fIdx)) continue;
      const frag = fragments[fIdx];
      if (!frag.text.trim()) continue;
      const cx = frag.x + Math.max(frag.width, 4) / 2;
      const cy = frag.y - frag.fontSize * 0.25;
      if (cx < minX - 2 || cx > maxX + 2 || cy < minY - 2 || cy > maxY + 2) continue;

      let rIdx = -1;
      for (let r = 0; r < rowBounds.length - 1; r++) {
        if (cy >= rowBounds[r] - 2 && cy <= rowBounds[r + 1] + 2) {
          rIdx = r;
          break;
        }
      }
      let cIdx = -1;
      for (let c = 0; c < colBounds.length - 1; c++) {
        if (cx >= colBounds[c] - 2 && cx <= colBounds[c + 1] + 2) {
          cIdx = c;
          break;
        }
      }
      if (rIdx >= 0 && cIdx >= 0) {
        localConsumed.push(fIdx);
        cellFragments.push({ row: rIdx, col: cIdx, frag });
      }
    }

    const populatedRows = new Set(cellFragments.map((c) => c.row));
    const populatedCols = new Set(cellFragments.map((c) => c.col));
    if (populatedRows.size < 2 || populatedCols.size < 2) continue;

    for (const idx of localConsumed) consumedIndices.add(idx);

    for (let r = 0; r < gridRows.length; r++) {
      for (let c = 0; c < gridRows[r].length; c++) {
        const frags = cellFragments
          .filter((item) => item.row === r && item.col === c)
          .map((item) => item.frag)
          .sort((a, b) => a.y - b.y || a.x - b.x);
        if (frags.length > 0) {
          const runs = mergeFragmentsToRuns(frags);
          gridRows[r][c] = {
            runs,
            text: runs
              .map((run) => run.text)
              .join("")
              .trim(),
          };
        }
      }
    }

    tables.push({ y: minY, rows: gridRows });
  }

  const remainingFragments = fragments.filter((_, idx) => !consumedIndices.has(idx));
  return { tables, remainingFragments };
}

function mergeFragmentsToRuns(frags: RawTextFragment[]): LineRun[] {
  const runs: LineRun[] = [];
  for (const frag of frags) {
    const { bold, italic } = normalizeFontStyles(frag.fontName);
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun.bold === bold && lastRun.italic === italic) {
      const needsSpace =
        lastRun.text.length > 0 &&
        !lastRun.text.endsWith(" ") &&
        !frag.text.startsWith(" ") &&
        !frag.text.startsWith(",") &&
        !frag.text.startsWith(".");
      lastRun.text += (needsSpace ? " " : "") + frag.text;
    } else {
      const prevEndsSpace = !lastRun || lastRun.text.endsWith(" ");
      const needsSpace =
        Boolean(lastRun) &&
        !prevEndsSpace &&
        !frag.text.startsWith(" ") &&
        !frag.text.startsWith(",") &&
        !frag.text.startsWith(".");
      runs.push({
        text: (needsSpace ? " " : "") + frag.text,
        bold,
        italic,
        fontSize: frag.fontSize,
      });
    }
  }
  return runs;
}

function groupFragmentsIntoLines(fragments: RawTextFragment[]): ReconstructedLine[] {
  if (fragments.length === 0) return [];
  const sorted = [...fragments].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: RawTextFragment[][] = [];

  for (const frag of sorted) {
    if (!frag.text.trim()) continue;
    const current = groups[groups.length - 1];
    const tolerance = Math.min(4.0, Math.max(2.5, frag.fontSize * 0.35));
    if (current && Math.abs(current[0].y - frag.y) <= tolerance) {
      current.push(frag);
    } else {
      groups.push([frag]);
    }
  }

  return groups.map((group) => {
    group.sort((a, b) => a.x - b.x);
    const cells: Array<{ x: number; right: number; frags: RawTextFragment[] }> = [];

    for (const frag of group) {
      const right = frag.x + Math.max(frag.width, frag.text.length * frag.fontSize * 0.45);
      const prev = cells[cells.length - 1];
      const gap = prev ? frag.x - prev.right : Infinity;
      const cellThreshold = Math.max(14, frag.fontSize * 1.25);

      if (!prev || gap > cellThreshold) {
        cells.push({ x: frag.x, right, frags: [frag] });
      } else {
        prev.frags.push(frag);
        prev.right = Math.max(prev.right, right);
      }
    }

    const builtCells = cells.map((cell) => {
      const runs = mergeFragmentsToRuns(cell.frags);
      const text = runs
        .map((r) => r.text)
        .join("")
        .trim();
      return { x: cell.x, right: cell.right, runs, text };
    });

    const allRuns = mergeFragmentsToRuns(group);
    const fullText = builtCells
      .map((c) => c.text)
      .join(" ")
      .trim();
    const maxFontSize = Math.max(...group.map((f) => f.fontSize));
    const minX = Math.min(...group.map((f) => f.x));
    const maxX = Math.max(
      ...group.map((f) => f.x + Math.max(f.width, f.text.length * f.fontSize * 0.45)),
    );
    const bold = allRuns.length > 0 && allRuns.every((r) => r.bold || !r.text.trim());

    return {
      y: group[0].y,
      minX,
      maxX,
      fragments: group,
      runs: allRuns,
      cells: builtCells,
      fullText,
      fontSize: maxFontSize,
      bold,
    };
  });
}

interface ReadingGroupBand {
  bandY: number | null;
  lines: ReconstructedLine[];
}

function splitIntoReadingGroups(
  fragments: RawTextFragment[],
  pageWidth: number,
): ReadingGroupBand[] {
  const lines = groupFragmentsIntoLines(fragments);
  if (lines.length === 0) return [];

  const middle = pageWidth / 2;
  const groups: ReadingGroupBand[] = [];
  let bandFragments: RawTextFragment[] = [];
  let bandLineCount = 0;

  const findGutterX = (frags: RawTextFragment[]): number | null => {
    const minGutter = pageWidth * 0.35;
    const maxGutter = pageWidth * 0.65;
    const intervals = frags
      .map((f) => ({
        left: f.x,
        right: f.x + Math.max(f.width, f.text.length * f.fontSize * 0.45),
      }))
      .sort((a, b) => a.left - b.left);

    const crossesMiddle = intervals.some((iv) => iv.left < middle - 4 && iv.right > middle + 4);
    if (!crossesMiddle) return middle;

    // Procura o maior vão horizontal livre dentro da faixa central
    let maxRight = 0;
    let bestGap = 0;
    let bestCenter: number | null = null;
    for (const iv of intervals) {
      if (iv.left > maxRight) {
        const gapStart = Math.max(maxRight, minGutter);
        const gapEnd = Math.min(iv.left, maxGutter);
        if (gapEnd - gapStart > bestGap) {
          bestGap = gapEnd - gapStart;
          bestCenter = (gapStart + gapEnd) / 2;
        }
      }
      maxRight = Math.max(maxRight, iv.right);
    }
    if (bestCenter !== null && bestGap >= 16) {
      const crossesBest = intervals.some(
        (iv) => iv.left < bestCenter - 2 && iv.right > bestCenter + 2,
      );
      if (!crossesBest) return bestCenter;
    }
    return null;
  };

  const flushBand = () => {
    if (bandFragments.length === 0) return;
    if (bandLineCount >= 3) {
      const gutterX = findGutterX(bandFragments);
      if (gutterX !== null) {
        const leftFrags = bandFragments.filter(
          (f) => f.x + Math.max(f.width, f.text.length * f.fontSize * 0.4) <= gutterX + 4,
        );
        const rightFrags = bandFragments.filter((f) => f.x >= gutterX - 4);

        if (
          leftFrags.length > 0 &&
          rightFrags.length > 0 &&
          leftFrags.length + rightFrags.length === bandFragments.length
        ) {
          const leftLines = groupFragmentsIntoLines(leftFrags);
          const rightLines = groupFragmentsIntoLines(rightFrags);

          if (leftLines.length >= 3 && rightLines.length >= 3) {
            const leftWidths = leftLines.map((l) => l.maxX - l.minX).sort((a, b) => a - b);
            const rightWidths = rightLines.map((l) => l.maxX - l.minX).sort((a, b) => a - b);
            const leftMedianW = leftWidths[Math.floor(leftWidths.length / 2)] ?? 0;
            const rightMedianW = rightWidths[Math.floor(rightWidths.length / 2)] ?? 0;

            const avgWordsLeft =
              leftLines.reduce(
                (sum, l) => sum + l.fullText.split(/\s+/).filter(Boolean).length,
                0,
              ) / leftLines.length;
            const avgWordsRight =
              rightLines.reduce(
                (sum, l) => sum + l.fullText.split(/\s+/).filter(Boolean).length,
                0,
              ) / rightLines.length;

            const yOverlap =
              Math.max(leftLines[0].y, rightLines[0].y) <=
              Math.min(leftLines[leftLines.length - 1].y, rightLines[rightLines.length - 1].y);

            const looksLikeTwoColumnProse =
              yOverlap &&
              leftMedianW >= pageWidth * 0.22 &&
              rightMedianW >= pageWidth * 0.22 &&
              (avgWordsLeft >= 3.5 ||
                avgWordsRight >= 3.5 ||
                Math.abs(leftLines.length - rightLines.length) >= 2);

            if (looksLikeTwoColumnProse) {
              const bandTopY = Math.min(leftLines[0].y, rightLines[0].y);
              groups.push(
                { bandY: bandTopY, lines: leftLines },
                { bandY: bandTopY, lines: rightLines },
              );
              bandFragments = [];
              bandLineCount = 0;
              return;
            }
          }
        }
      }
    }

    groups.push({ bandY: null, lines: groupFragmentsIntoLines(bandFragments) });
    bandFragments = [];
    bandLineCount = 0;
  };

  for (const line of lines) {
    const crossesCenter =
      line.cells.length === 1 && line.minX < middle - 8 && line.maxX > middle + 8;

    if (crossesCenter) {
      flushBand();
      groups.push({ bandY: null, lines: [line] });
    } else {
      bandFragments.push(...line.fragments);
      bandLineCount += 1;
    }
  }
  flushBand();

  return groups;
}

function buildDocxTable(rows: TableCellData[][]): Table {
  const colCount = Math.max(1, ...rows.map((r) => r.length));
  const colPct = Math.floor(100 / colCount);
  const thinBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "CBD5E1",
  } as const;

  const tableRows = rows.map(
    (row, rIdx) =>
      new TableRow({
        tableHeader: rIdx === 0,
        children: Array.from({ length: colCount }, (_, cIdx) => {
          const cell = row[cIdx];
          const textRuns =
            cell && cell.runs.length > 0
              ? cell.runs.map(
                  (run) =>
                    new TextRun({
                      text: run.text,
                      bold: run.bold || rIdx === 0,
                      italics: run.italic,
                      size: Math.round(run.fontSize * 2),
                    }),
                )
              : [new TextRun({ text: cell?.text ?? "" })];

          return new TableCell({
            width: { size: colPct, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 110, right: 110 },
            shading: rIdx === 0 ? { fill: "F1F5F9" } : undefined,
            children: [
              new Paragraph({
                children: textRuns,
              }),
            ],
          });
        }),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
      insideHorizontal: thinBorder,
      insideVertical: thinBorder,
    },
    rows: tableRows,
  });
}

function stripRunPrefix(runs: LineRun[], prefixLength: number): LineRun[] {
  let remaining = prefixLength;
  const out: LineRun[] = [];
  for (const run of runs) {
    if (remaining <= 0) {
      out.push({ ...run });
      continue;
    }
    if (run.text.length <= remaining) {
      remaining -= run.text.length;
    } else {
      out.push({
        ...run,
        text: run.text.slice(remaining),
      });
      remaining = 0;
    }
  }
  return out;
}

function createTextRuns(runs: LineRun[], forceBold = false): TextRun[] {
  return runs.map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: forceBold || run.bold,
        italics: run.italic,
        size: Math.round(run.fontSize * 2),
      }),
  );
}

function detectAlignedTable(candidateLines: ReconstructedLine[]): TableCellData[][] | null {
  if (candidateLines.length < 2) return null;

  // Constrói intervalos horizontais [left, right] para todas as células candidatas
  const intervals = candidateLines
    .flatMap((line) =>
      line.cells.map((cell) => ({
        left: cell.x,
        right: Math.max(cell.right, cell.x + 8),
      })),
    )
    .sort((a, b) => a.left - b.left);

  if (intervals.length < 4) return null;

  const colBands: Array<{ left: number; right: number }> = [];
  for (const iv of intervals) {
    const last = colBands[colBands.length - 1];
    if (last && iv.left <= last.right + 4) {
      last.right = Math.max(last.right, iv.right);
    } else {
      colBands.push({ left: iv.left, right: iv.right });
    }
  }

  if (colBands.length < 2 || colBands.length > 15) return null;

  const colHitCounts = new Array<number>(colBands.length).fill(0);
  const rows: TableCellData[][] = candidateLines.map((line) => {
    const rowCells: TableCellData[] = Array.from({ length: colBands.length }, () => ({
      runs: [],
      text: "",
    }));
    const rowHit = new Array<boolean>(colBands.length).fill(false);

    for (const cell of line.cells) {
      const cellCenter = (cell.x + Math.max(cell.right, cell.x + 8)) / 2;
      let targetCol = colBands.findIndex(
        (band) => cell.x <= band.right + 4 && Math.max(cell.right, cell.x + 8) >= band.left - 4,
      );
      if (targetCol < 0) {
        let bestDist = Infinity;
        colBands.forEach((band, idx) => {
          const dist = Math.abs(cellCenter - (band.left + band.right) / 2);
          if (dist < bestDist) {
            bestDist = dist;
            targetCol = idx;
          }
        });
      }

      if (targetCol >= 0) {
        rowHit[targetCol] = true;
        const existing = rowCells[targetCol];
        if (existing.text) {
          existing.runs = [
            ...existing.runs,
            { text: " ", bold: false, italic: false, fontSize: line.fontSize },
            ...cell.runs,
          ];
          existing.text = `${existing.text} ${cell.text}`.trim();
        } else {
          existing.runs = cell.runs;
          existing.text = cell.text;
        }
      }
    }

    rowHit.forEach((hit, idx) => {
      if (hit) colHitCounts[idx] += 1;
    });
    return rowCells;
  });

  const activeCols = colHitCounts.filter((count) => count >= 2).length;
  if (activeCols < 2) return null;

  return rows;
}

function buildBlocksForReadingGroup(
  lines: ReconstructedLine[],
  medianFontSize: number,
  preserveTables: boolean,
  bandY: number | null,
  bandOrder: number,
  numberedInstanceCounter: { current: number },
  counters: { tableCount: number; paragraphCount: number },
): PositionedDocxBlock[] {
  const blocks: PositionedDocxBlock[] = [];
  let tableBuffer: ReconstructedLine[] = [];
  let currentParaRuns: TextRun[] = [];
  let currentParaY = 0;
  let lastLineY: number | null = null;
  let inNumberedList = false;

  const pushElement = (y: number, element: Paragraph | Table) => {
    blocks.push({ kind: "element", bandY: bandY ?? y, y, bandOrder, element });
  };

  const flushParagraph = () => {
    if (currentParaRuns.length === 0) return;
    pushElement(currentParaY, new Paragraph({ children: currentParaRuns }));
    counters.paragraphCount += 1;
    currentParaRuns = [];
  };

  const emitSingleLine = (line: ReconstructedLine) => {
    const text = line.fullText;
    if (!text) return;

    const bulletMatch = text.match(/^([•◦▪▫●○■□►▸]|[-*])\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      inNumberedList = false;
      const prefixLen = bulletMatch[0].length - bulletMatch[2].length;
      const cleanedRuns = stripRunPrefix(line.runs, prefixLen);
      pushElement(
        line.y,
        new Paragraph({
          bullet: { level: 0 },
          children: createTextRuns(cleanedRuns),
        }),
      );
      counters.paragraphCount += 1;
      lastLineY = line.y;
      return;
    }

    const numberedMatch = text.match(/^(\d+[.)])\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      if (!inNumberedList) {
        numberedInstanceCounter.current += 1;
        inNumberedList = true;
      }
      const prefixLen = numberedMatch[0].length - numberedMatch[2].length;
      const cleanedRuns = stripRunPrefix(line.runs, prefixLen);
      pushElement(
        line.y,
        new Paragraph({
          numbering: {
            reference: NUMBERED_LIST_REF,
            level: 0,
            instance: numberedInstanceCounter.current,
          },
          children: createTextRuns(cleanedRuns),
        }),
      );
      counters.paragraphCount += 1;
      lastLineY = line.y;
      return;
    }

    inNumberedList = false;

    const isH1 = line.fontSize >= medianFontSize * 1.55 && text.length <= 140;
    const isH2 = !isH1 && line.fontSize >= medianFontSize * 1.25 && text.length <= 140;
    const isH3 =
      !isH1 &&
      !isH2 &&
      line.fontSize >= medianFontSize * 1.12 &&
      line.bold &&
      text.length <= 100 &&
      !/[.!?]$/.test(text);

    if (isH1 || isH2 || isH3) {
      flushParagraph();
      pushElement(
        line.y,
        new Paragraph({
          heading: isH1
            ? HeadingLevel.HEADING_1
            : isH2
              ? HeadingLevel.HEADING_2
              : HeadingLevel.HEADING_3,
          children: createTextRuns(line.runs, true),
        }),
      );
      counters.paragraphCount += 1;
      lastLineY = line.y;
      return;
    }

    const lineSpacing = lastLineY !== null ? Math.abs(line.y - lastLineY) : 0;
    if (lastLineY !== null && lineSpacing > line.fontSize * 1.85) {
      flushParagraph();
    }

    if (currentParaRuns.length === 0) {
      currentParaY = line.y;
    }

    for (let rIdx = 0; rIdx < line.runs.length; rIdx++) {
      const run = line.runs[rIdx];
      const prependSpace = currentParaRuns.length > 0 && rIdx === 0 && !run.text.startsWith(" ");
      currentParaRuns.push(
        new TextRun({
          text: (prependSpace ? " " : "") + run.text,
          bold: run.bold,
          italics: run.italic,
          size: Math.round(run.fontSize * 2),
        }),
      );
    }

    lastLineY = line.y;
  };

  const flushTableBuffer = () => {
    if (tableBuffer.length === 0) return;
    const tableRows = preserveTables ? detectAlignedTable(tableBuffer) : null;
    if (tableRows) {
      flushParagraph();
      inNumberedList = false;
      pushElement(tableBuffer[0].y, buildDocxTable(tableRows));
      counters.tableCount += 1;
      counters.paragraphCount += tableRows.length;
      lastLineY = tableBuffer[tableBuffer.length - 1].y;
    } else {
      for (const bufferedLine of tableBuffer) {
        emitSingleLine(bufferedLine);
      }
    }
    tableBuffer = [];
  };

  for (const line of lines) {
    if (preserveTables && line.cells.length >= 2) {
      if (tableBuffer.length > 0) {
        const prev = tableBuffer[tableBuffer.length - 1];
        if (Math.abs(line.y - prev.y) > Math.max(line.fontSize, prev.fontSize) * 3.5) {
          flushTableBuffer();
        }
      }
      tableBuffer.push(line);
    } else {
      flushTableBuffer();
      emitSingleLine(line);
    }
  }

  flushTableBuffer();
  flushParagraph();
  return blocks;
}

export async function convertPdfToWord(
  pdfBytes: Uint8Array,
  options: PdfToWordOptions = {},
): Promise<PdfToWordResult> {
  if (pdfBytes.length === 0) {
    throw new Error("DOCUMENTO_VAZIO");
  }

  const preserveTables = options.preserveTables !== false;
  const extractImages = options.extractImages !== false;
  const runOcrIfScanned = options.runOcrIfScanned !== false;

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  if (numPages === 0) {
    throw new Error("DOCUMENTO_INVALIDO");
  }

  const extractedPages: PageExtractedData[] = [];
  const allFontSizes: number[] = [];
  let totalWords = 0;
  const sampleLines: string[] = [];
  const remainingImageBudget = { bytes: 0, count: 0 };

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      options.onProgress?.(pageNum, numPages);
      const page = await pdf.getPage(pageNum);
      try {
        const data = await extractPageGeometry(pageNum, page, extractImages, remainingImageBudget);
        extractedPages.push(data);
        for (const frag of data.fragments) {
          if (frag.text.trim().length > 0) {
            allFontSizes.push(frag.fontSize);
          }
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  // Stage 4: Local OCR fallback para páginas sem texto vetorial
  let usedOcr = false;
  const pageVectorWordCounts = extractedPages.map((p) => {
    const joined = p.fragments
      .map((f) => f.text)
      .join(" ")
      .trim();
    return joined ? joined.split(/\s+/).filter(Boolean).length : 0;
  });

  const pagesNeedingOcr = extractedPages.filter((_, idx) => pageVectorWordCounts[idx] === 0);
  if (pagesNeedingOcr.length > 0 && runOcrIfScanned) {
    try {
      const ocrFn = options.ocrRunner ?? performBrowserOcr;
      const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const ocrOutcome = await ocrFn(pdfBlob, { language: "por", enhanceContrast: true });

      for (const pageData of pagesNeedingOcr) {
        const ocrPage = ocrOutcome.pageResults.find((p) => p.pageNumber === pageData.pageNumber);
        if (!ocrPage?.text.trim()) continue;

        const linesFromOcr =
          ocrPage.lines.length > 0
            ? ocrPage.lines.map((l) => l.text.trim()).filter(Boolean)
            : ocrPage.text
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean);

        if (linesFromOcr.length > 0) {
          pageData.ocrLines = linesFromOcr;
          usedOcr = true;
        }
      }
    } catch {
      // Ambiente sem Worker/Canvas ou falha no OCR local: mantém fallback gracioso sem crash
    }
  }

  allFontSizes.sort((a, b) => a - b);
  const medianFontSize =
    allFontSizes.length > 0 ? allFontSizes[Math.floor(allFontSizes.length / 2)] : 12;

  const docxChildren: Array<Paragraph | Table> = [];
  const counters = { tableCount: 0, paragraphCount: 0, imageCount: 0 };
  const numberedInstanceCounter = { current: 0 };

  for (let pageIdx = 0; pageIdx < extractedPages.length; pageIdx++) {
    const pageData = extractedPages[pageIdx];
    const pageBlocks: PositionedDocxBlock[] = [];

    if (pageData.ocrLines.length > 0) {
      pageData.ocrLines.forEach((ocrLine, lineIdx) => {
        const words = ocrLine.split(/\s+/).filter(Boolean);
        totalWords += words.length;
        if (sampleLines.length < 5) sampleLines.push(ocrLine);
        const y = 40 + lineIdx * 18;
        pageBlocks.push({
          kind: "element",
          bandY: y,
          y,
          bandOrder: lineIdx,
          element: new Paragraph({
            children: [new TextRun({ text: ocrLine, size: 22 })],
          }),
        });
        counters.paragraphCount += 1;
      });
    } else {
      const gridResult = preserveTables
        ? detectVectorGridTables(pageData.fragments, pageData.hSegments, pageData.vSegments)
        : { tables: [], remainingFragments: pageData.fragments };

      for (const table of gridResult.tables) {
        for (const row of table.rows) {
          const rowText = row
            .map((cell) => cell.text)
            .filter(Boolean)
            .join(" ");
          if (rowText) {
            totalWords += rowText.split(/\s+/).filter(Boolean).length;
            if (sampleLines.length < 5) sampleLines.push(rowText);
          }
        }
        pageBlocks.push({
          kind: "element",
          bandY: table.y,
          y: table.y,
          bandOrder: 0,
          element: buildDocxTable(table.rows),
        });
        counters.tableCount += 1;
        counters.paragraphCount += table.rows.length;
      }

      const readingGroups = splitIntoReadingGroups(
        gridResult.remainingFragments,
        pageData.pageWidth,
      );

      readingGroups.forEach((groupBand, gIdx) => {
        for (const line of groupBand.lines) {
          if (line.fullText) {
            totalWords += line.fullText.split(/\s+/).filter(Boolean).length;
            if (sampleLines.length < 5) sampleLines.push(line.fullText);
          }
        }
        const groupBlocks = buildBlocksForReadingGroup(
          groupBand.lines,
          medianFontSize,
          preserveTables,
          groupBand.bandY,
          gIdx + 1,
          numberedInstanceCounter,
          counters,
        );
        pageBlocks.push(...groupBlocks);
      });
    }

    if (extractImages) {
      for (const img of pageData.images) {
        pageBlocks.push({
          kind: "image",
          bandY: img.y,
          y: img.y,
          bandOrder: 0,
          image: img,
        });
      }
    }

    // Ordenação lexicográfica estrita: Y da banda -> ordem da banda/coluna -> Y interno
    pageBlocks.sort((a, b) => a.bandY - b.bandY || a.bandOrder - b.bandOrder || a.y - b.y);

    const isFirstPage = pageIdx === 0;
    if (pageBlocks.length === 0) {
      if (!isFirstPage) {
        docxChildren.push(
          new Paragraph({
            pageBreakBefore: true,
            children: [new TextRun({ text: "" })],
          }),
        );
      }
      continue;
    }

    let insertedPageBreak = isFirstPage;
    for (const block of pageBlocks) {
      if (block.kind === "image") {
        const para = new Paragraph({
          pageBreakBefore: !insertedPageBreak,
          children: [
            new ImageRun({
              type: "png",
              data: block.image.bytes,
              transformation: {
                width: block.image.width,
                height: block.image.height,
              },
              altText: {
                name: `imagem_p${pageData.pageNumber}_${counters.imageCount + 1}`,
                title: `Imagem página ${pageData.pageNumber}`,
                description: `Imagem extraída da página ${pageData.pageNumber}`,
              },
            }),
          ],
        });
        insertedPageBreak = true;
        docxChildren.push(para);
        counters.imageCount += 1;
        counters.paragraphCount += 1;
      } else {
        if (!insertedPageBreak) {
          docxChildren.push(
            new Paragraph({
              pageBreakBefore: true,
              children: [new TextRun({ text: "" })],
            }),
          );
          insertedPageBreak = true;
        }
        docxChildren.push(block.element);
      }
    }
  }

  const isScannedWarning = totalWords === 0;
  if (isScannedWarning) {
    const warningParagraphs = [
      new Paragraph({
        children: [
          new TextRun({
            text: "Aviso: Este documento PDF parece ser uma digitalização/imagem e não contém texto vetorial selecionável.",
            bold: true,
            color: "E11D48",
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Para extrair o texto de documentos escaneados, utilize a ferramenta OCR (Reconhecimento Óptico de Caracteres) do NexoHub.",
            italics: true,
          }),
        ],
      }),
    ];
    docxChildren.unshift(...warningParagraphs);
    counters.paragraphCount += warningParagraphs.length;
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: NUMBERED_LIST_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: docxChildren,
      },
    ],
  });

  const arrayBuffer = await Packer.toArrayBuffer(doc);
  const docxBytes = new Uint8Array(arrayBuffer);

  const report: PdfToWordReport = {
    pageCount: numPages,
    wordCount: totalWords,
    paragraphCount: counters.paragraphCount,
    originalBytes: pdfBytes.byteLength,
    convertedBytes: docxBytes.byteLength,
    isScannedWarning,
    sampleText: sampleLines,
    tableCount: counters.tableCount,
    imageCount: counters.imageCount,
    usedOcr,
  };

  return {
    docxBytes,
    report,
  };
}
