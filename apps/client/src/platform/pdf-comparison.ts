import { diffText, tokenizeWords } from "@nexohub/domain";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import pixelmatch from "pixelmatch";
import type {
  PdfComparisonOptions,
  PdfComparisonPair,
  PdfComparisonRegion,
  PdfComparisonResult,
} from "./pdf-comparison-types";

/** Limites técnicos locais; textos que excedem o orçamento são recusados, nunca truncados. */
export const PDF_COMPARISON_LIMITS = Object.freeze({
  maxFileBytes: 64 * 1024 * 1024,
  maxPages: 40,
  maxRenderLongSide: 1200,
  maxWorkPixels: 100_000_000,
  maxPageCharacters: 20_000,
  maxPageTokens: 4_000,
  maxTotalCharacters: 100_000,
});

// Também necessário dentro do worker de comparação, onde window não existe.
if (typeof process === "undefined" || !process.versions?.node) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

type CanvasPair = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
type CanvasFactory = {
  create(width: number, height: number): CanvasPair;
  destroy(pair: CanvasPair): void;
};

/** PDF.js pressupõe canvas DOM por padrão; workers precisam desta fábrica explícita.
 * O cast descreve a API 2D comum usada pelo PDF.js, sem depender de document no worker. */
class WorkerCanvasFactory {
  create(width: number, height: number): CanvasPair {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("PDF_COMPARACAO_RENDERIZACAO_INDISPONIVEL");
    return {
      canvas: canvas as unknown as HTMLCanvasElement,
      context: context as unknown as CanvasRenderingContext2D,
    };
  }
  reset(pair: CanvasPair, width: number, height: number) {
    pair.canvas.width = width;
    pair.canvas.height = height;
  }
  destroy(pair: CanvasPair) {
    pair.canvas.width = 0;
    pair.canvas.height = 0;
  }
}

type PageInfo = {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  words: ReadonlySet<string>;
  signature: Uint8ClampedArray;
};
type Alignment = { left: PageInfo | null; right: PageInfo | null };

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Comparação cancelada", "AbortError");
}

async function png(pair: CanvasPair): Promise<string> {
  if (typeof pair.canvas.toDataURL === "function") return pair.canvas.toDataURL("image/png");
  const blob = await (pair.canvas as unknown as OffscreenCanvas).convertToBlob({
    type: "image/png",
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Blocos evitam estouro da pilha em páginas pouco compressíveis.
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

function similarity(left: PageInfo, right: PageInfo): number {
  let difference = 0;
  let ink = 0;
  for (let i = 0; i < left.signature.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const a = left.signature[i + channel] ?? 255;
      const b = right.signature[i + channel] ?? 255;
      difference += Math.abs(a - b);
      ink += Math.max(255 - a, 255 - b);
    }
  }
  const visual = ink ? Math.max(0, 1 - difference / ink) : 1;
  if (left.text && right.text) {
    if (left.text === right.text) return 0.95 + 0.05 * visual;
    let common = 0;
    for (const word of left.words) if (right.words.has(word)) common++;
    const union = left.words.size + right.words.size - common;
    return 0.85 * (union ? common / union : 0) + 0.15 * visual;
  }
  return visual;
}

/** Alinhamento global, limitado a 40×40 células; assinaturas evitam comparar textos quadraticamente. */
function align(left: readonly PageInfo[], right: readonly PageInfo[]): Alignment[] {
  const costs = Array.from({ length: left.length + 1 }, () => new Float64Array(right.length + 1));
  const moves = Array.from({ length: left.length + 1 }, () => new Uint8Array(right.length + 1));
  for (let i = 1; i <= left.length; i++) {
    costs[i][0] = i * 0.6;
    moves[i][0] = 1;
  }
  for (let j = 1; j <= right.length; j++) {
    costs[0][j] = j * 0.6;
    moves[0][j] = 2;
  }
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const replace = costs[i - 1][j - 1] + (1 - similarity(left[i - 1], right[j - 1]));
      const remove = costs[i - 1][j] + 0.6;
      const add = costs[i][j - 1] + 0.6;
      costs[i][j] = Math.min(replace, remove, add);
      moves[i][j] = replace <= remove && replace <= add ? 0 : remove <= add ? 1 : 2;
    }
  }
  const pairs: Alignment[] = [];
  let i = left.length;
  let j = right.length;
  while (i || j) {
    const move = moves[i][j];
    if (move === 1) pairs.push({ left: left[--i], right: null });
    else if (move === 2) pairs.push({ left: null, right: right[--j] });
    else pairs.push({ left: left[--i], right: right[--j] });
  }
  return pairs.reverse();
}

/** Células contíguas da máscara agrupadas em regiões; no máximo 24×24 regiões. */
function regions(mask: Uint8ClampedArray, width: number, height: number): PdfComparisonRegion[] {
  const cell = Math.max(1, Math.ceil(Math.max(width, height) / 24));
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const changed = new Uint8Array(columns * rows);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[(y * width + x) * 4 + 3])
        changed[Math.floor(y / cell) * columns + Math.floor(x / cell)] = 1;
    }
  }
  const result: PdfComparisonRegion[] = [];
  for (let start = 0; start < changed.length; start++) {
    if (!changed[start]) continue;
    changed[start] = 0;
    const queue = [start];
    let minX = columns;
    let minY = rows;
    let maxX = 0;
    let maxY = 0;
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      const x = current % columns;
      const y = Math.floor(current / columns);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
        const neighbor = ny * columns + nx;
        if (changed[neighbor]) {
          changed[neighbor] = 0;
          queue.push(neighbor);
        }
      }
    }
    result.push({
      x: (minX * cell) / width,
      y: (minY * cell) / height,
      width: (Math.min(width, (maxX + 1) * cell) - minX * cell) / width,
      height: (Math.min(height, (maxY + 1) * cell) - minY * cell) / height,
    });
  }
  return result;
}

export async function comparePdfDocuments(
  left: Uint8Array,
  right: Uint8Array,
  options: PdfComparisonOptions = {},
): Promise<PdfComparisonResult> {
  const { signal, onProgress } = options;
  abortIfNeeded(signal);
  if ([left, right].some((bytes) => bytes.byteLength > PDF_COMPARISON_LIMITS.maxFileBytes))
    throw new Error("PDF_COMPARACAO_LIMITE_EXCEDIDO");
  const tasks: pdfjs.PDFDocumentLoadingTask[] = [];
  let activeRender: pdfjs.RenderTask | undefined;
  let workPixels = 0;
  let totalCharacters = 0;
  let renderCount = 0,
    peakPairPixelBytes = 0;
  const reserve = (pixels: number) => {
    workPixels += pixels;
    if (!Number.isFinite(workPixels) || workPixels > PDF_COMPARISON_LIMITS.maxWorkPixels)
      throw new Error("PDF_COMPARACAO_LIMITE_EXCEDIDO");
  };
  const cancel = () => {
    activeRender?.cancel();
    for (const task of tasks) void task.destroy().catch(() => undefined);
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const progress = (
    phase: "reading" | "aligning" | "comparing" | "done",
    value: number,
    currentPage?: number,
    totalPages?: number,
  ) => {
    abortIfNeeded(signal);
    onProgress?.({ phase, progress: value * 100, currentPage, totalPages });
    abortIfNeeded(signal);
  };
  async function open(bytes: Uint8Array) {
    const inWorker = typeof document === "undefined" && typeof OffscreenCanvas !== "undefined";
    const task = pdfjs.getDocument({
      data: bytes.slice(),
      useSystemFonts: !inWorker,
      disableFontFace: inWorker,
      useWorkerFetch: inWorker,
      stopAtErrors: true,
      // Laços de renderização/chamadas continuam locais; PDFs não podem pedir fontes externas.
      ...(typeof location !== "undefined"
        ? {
            standardFontDataUrl: new URL(
              `${import.meta.env.BASE_URL}standard_fonts/`,
              location.origin,
            ).href,
          }
        : {}),
      ...(inWorker ? { CanvasFactory: WorkerCanvasFactory } : {}),
    });
    tasks.push(task);
    const doc = await task.promise;
    abortIfNeeded(signal);
    if (doc.numPages > PDF_COMPARISON_LIMITS.maxPages)
      throw new Error("PDF_COMPARACAO_LIMITE_EXCEDIDO");
    return doc;
  }
  async function render(
    doc: pdfjs.PDFDocumentProxy,
    info: PageInfo,
    scale: number,
    width: number,
    height: number,
    pair: CanvasPair,
  ) {
    abortIfNeeded(signal);
    const page = await doc.getPage(info.pageNumber);
    const viewport = page.getViewport({ scale });
    // Preenchimento branco em um canvas compartilhado: nunca estica páginas para igualar dimensões.
    pair.context.fillStyle = "#ffffff";
    pair.context.fillRect(0, 0, width, height);
    activeRender = page.render({
      canvas: pair.canvas,
      canvasContext: pair.context,
      viewport,
      background: "rgb(255,255,255)",
    });
    renderCount++;
    try {
      await activeRender.promise;
      abortIfNeeded(signal);
    } finally {
      activeRender = undefined;
      page.cleanup();
    }
  }
  async function read(
    doc: pdfjs.PDFDocumentProxy,
    offset: number,
    total: number,
  ): Promise<PageInfo[]> {
    const factory = doc.canvasFactory as CanvasFactory;
    const pages: PageInfo[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      abortIfNeeded(signal);
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      if (![viewport.width, viewport.height].every((value) => Number.isFinite(value) && value > 0))
        throw new Error("PDF_COMPARACAO_PDF_INVALIDO");
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .normalize("NFC")
        .replace(/\s+/gu, " ")
        .trim();
      totalCharacters += text.length;
      if (
        text.length > PDF_COMPARISON_LIMITS.maxPageCharacters ||
        totalCharacters > PDF_COMPARISON_LIMITS.maxTotalCharacters ||
        tokenizeWords(text).length > PDF_COMPARISON_LIMITS.maxPageTokens
      )
        throw new Error("PDF_COMPARACAO_TEXTO_LIMITE_EXCEDIDO");
      const info: PageInfo = {
        pageNumber: number,
        width: viewport.width,
        height: viewport.height,
        rotation: page.rotate,
        text,
        words: new Set(text.toLocaleLowerCase("pt-BR").match(/[\p{L}\p{M}\p{N}]+/gu) ?? []),
        signature: new Uint8ClampedArray(),
      };
      const scale = 96 / Math.max(info.width, info.height);
      // Canvas quadrado com padding estabiliza assinaturas e preserva proporções.
      reserve(96 * 96);
      const pair = factory.create(96, 96);
      try {
        await render(doc, info, scale, 96, 96, pair);
        info.signature = pair.context.getImageData(0, 0, 96, 96).data;
      } finally {
        factory.destroy(pair);
      }
      pages.push(info);
      progress("reading", ((offset + number) / total) * 0.3, offset + number, total);
    }
    return pages;
  }
  try {
    progress("reading", 0);
    const leftDoc = await open(left);
    const rightDoc = await open(right);
    const totalPages = leftDoc.numPages + rightDoc.numPages;
    async function previewInfo(
      doc: pdfjs.PDFDocumentProxy,
      number: number | null,
      text: string,
    ): Promise<PageInfo[]> {
      if (number === null) return [];
      if (!Number.isInteger(number) || number < 1 || number > doc.numPages)
        throw new Error("PDF_COMPARACAO_PDF_INVALIDO");
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      page.cleanup();
      if (![viewport.width, viewport.height].every((value) => Number.isFinite(value) && value > 0))
        throw new Error("PDF_COMPARACAO_PDF_INVALIDO");
      return [
        {
          pageNumber: number,
          width: viewport.width,
          height: viewport.height,
          rotation: page.rotate,
          text,
          words: new Set(),
          signature: new Uint8ClampedArray(),
        },
      ];
    }
    const detail = options.previewPair;
    const leftPages = detail
      ? await previewInfo(leftDoc, detail.leftPage, detail.leftText)
      : await read(leftDoc, 0, totalPages);
    const rightPages = detail
      ? await previewInfo(rightDoc, detail.rightPage, detail.rightText)
      : await read(rightDoc, leftPages.length, totalPages);
    progress("aligning", 0.32);
    const aligned: Alignment[] = detail
      ? [{ left: leftPages[0] ?? null, right: rightPages[0] ?? null }]
      : align(leftPages, rightPages);
    const pairs: PdfComparisonPair[] = [];
    const factory = leftDoc.canvasFactory as CanvasFactory;
    for (const [index, alignment] of aligned.entries()) {
      progress("comparing", 0.35 + (0.65 * index) / aligned.length, index + 1, aligned.length);
      const a = alignment.left;
      const b = alignment.right;
      const scale = Math.min(
        1.5,
        PDF_COMPARISON_LIMITS.maxRenderLongSide /
          Math.max(a?.width ?? 0, a?.height ?? 0, b?.width ?? 0, b?.height ?? 0),
      );
      const width = Math.ceil(Math.max(a?.width ?? 0, b?.width ?? 0) * scale);
      const height = Math.ceil(Math.max(a?.height ?? 0, b?.height ?? 0) * scale);
      reserve(width * height * 3);
      // Três canvases e três ImageData simultâneos; não é o heap/RSS total do processo.
      peakPairPixelBytes = Math.max(peakPairPixelBytes, width * height * 24);
      const leftCanvas = factory.create(width, height);
      const rightCanvas = factory.create(width, height);
      const diffCanvas = factory.create(width, height);
      try {
        for (const [doc, info, canvas] of [
          [leftDoc, a, leftCanvas],
          [rightDoc, b, rightCanvas],
        ] as const) {
          if (info) await render(doc, info, scale, width, height, canvas);
          else {
            canvas.context.fillStyle = "#ffffff";
            canvas.context.fillRect(0, 0, width, height);
          }
        }
        const leftPixels = leftCanvas.context.getImageData(0, 0, width, height);
        const rightPixels = rightCanvas.context.getImageData(0, 0, width, height);
        const mask = diffCanvas.context.createImageData(width, height);
        const changed = pixelmatch(leftPixels.data, rightPixels.data, mask.data, width, height, {
          threshold: 0.1,
          includeAA: false,
          diffMask: true,
          diffColor: [255, 0, 0],
        });
        diffCanvas.context.putImageData(mask, 0, 0);
        const textChanged = (a?.text ?? "") !== (b?.text ?? "");
        const structuralChange = !a || !b;
        const geometryChanged = Boolean(
          a && b && (a.width !== b.width || a.height !== b.height || a.rotation !== b.rotation),
        );
        const visualChanged = changed > 0 || structuralChange || geometryChanged;
        const status = !a
          ? "added"
          : !b
            ? "removed"
            : textChanged || visualChanged
              ? "modified"
              : "unchanged";
        const pair: PdfComparisonPair = {
          index: detail?.index ?? index,
          leftPage: a?.pageNumber ?? null,
          rightPage: b?.pageNumber ?? null,
          status,
          leftText: a?.text ?? "",
          rightText: b?.text ?? "",
          textDiff: diffText(a?.text ?? "", b?.text ?? ""),
          textChanged,
          visualChanged,
          geometryChanged,
          visualDifferenceRatio: changed / (width * height),
          regions:
            structuralChange || geometryChanged
              ? [{ x: 0, y: 0, width: 1, height: 1 }]
              : regions(mask.data, width, height),
          leftImage: a ? await png(leftCanvas) : undefined,
          rightImage: b ? await png(rightCanvas) : undefined,
          diffImage: options.retainImages === false ? undefined : await png(diffCanvas),
          width,
          height,
        };
        await options.onPair?.(pair);
        const { leftImage: _l, rightImage: _r, diffImage: _d, ...metadata } = pair;
        pairs.push(options.retainImages === false ? metadata : pair);
        abortIfNeeded(signal);
      } finally {
        factory.destroy(leftCanvas);
        factory.destroy(rightCanvas);
        factory.destroy(diffCanvas);
      }
    }
    progress("done", 1);
    return {
      metrics: {
        renderCount,
        peakPairPixelBytes,
        retainedImageCharacters: pairs.reduce(
          (sum, pair) =>
            sum +
            (pair.leftImage?.length ?? 0) +
            (pair.rightImage?.length ?? 0) +
            (pair.diffImage?.length ?? 0),
          0,
        ),
      },
      pairs,
      leftPageCount: leftDoc.numPages,
      rightPageCount: rightDoc.numPages,
      leftHasText: leftPages.some((page) => Boolean(page.text)),
      rightHasText: rightPages.some((page) => Boolean(page.text)),
    };
  } catch (error) {
    abortIfNeeded(signal);
    if (error instanceof Error && error.message.startsWith("PDF_COMPARACAO_")) throw error;
    if (error instanceof Error && error.name === "PasswordException")
      throw new Error("PDF_COMPARACAO_SENHA_NECESSARIA");
    throw new Error("PDF_COMPARACAO_PDF_INVALIDO");
  } finally {
    signal?.removeEventListener("abort", cancel);
    await Promise.allSettled(tasks.map((task) => task.destroy()));
  }
}
