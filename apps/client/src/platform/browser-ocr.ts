import type { OcrLineResult } from "@nexohub/contracts";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Page as TesseractPage } from "tesseract.js";
import { withAppBase } from "./app-paths";
import { createOcrRecognitionSession, type OcrRecognitionSession } from "./ocr-recognition-session";
import { generateSearchablePdf, type OcrPageData } from "./pdf-engine";

if (typeof window !== "undefined") pdfjsLib.GlobalWorkerOptions.workerSrc ||= pdfjsWorker;
export interface OcrProgressInfo {
  status: string;
  page: number;
  totalPages: number;
  progress: number;
}
export interface OcrPageReport {
  pageNumber: number;
  source: "existing-text" | "ocr";
  /** Indicador do motor, sem garantia de acerto. Não se aplica a texto existente. */
  confidence: number | null;
  durationMs: number;
}
export interface BrowserOcrOptions {
  language?: "por" | "eng" | "spa";
  enhanceContrast?: boolean;
  signal?: AbortSignal;
  onProgress?: (info: OcrProgressInfo) => void;
}
export interface BrowserOcrOutcome {
  text: string;
  pages: number;
  lines: OcrLineResult[];
  pageResults: OcrPageData[];
  pageReports: OcrPageReport[];
  engine: string;
  searchablePdfBytes?: Uint8Array;
}
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("OCR_CANCELLED", "AbortError");
}
/** Não depende de a biblioteca resolver um job depois de terminate(). */
async function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  checkAbort(signal);
  if (!signal) return promise;
  let onAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new DOMException("OCR_CANCELLED", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
function confidence(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value / 100))
    : null;
}
function readOcrLines(data: Pick<TesseractPage, "blocks" | "confidence">): OcrPageData["lines"] {
  return (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        text: line.text.trim(),
        confidence: confidence(line.confidence ?? data.confidence) ?? undefined,
        bbox: line.bbox,
      })),
    ),
  );
}
/** Ganho linear 1,35 em escala de cinza; não é contraste adaptativo. */
export function applyContrastEnhancement(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const image = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
    const adjusted = Math.min(255, Math.max(0, 1.35 * (gray - 128) + 128));
    image.data[i] = image.data[i + 1] = image.data[i + 2] = adjusted;
  }
  ctx.putImageData(image, 0, 0);
}
const MAX_PIXELS = 20_000_000;
function canvasFor(width: number, height: number): HTMLCanvasElement {
  if (!Number.isFinite(width * height) || width <= 0 || height <= 0 || width * height > MAX_PIXELS)
    throw new Error("OCR_PAGE_LIMIT");
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  return canvas;
}
async function imageBlobToCanvas(blob: Blob, signal?: AbortSignal): Promise<HTMLCanvasElement> {
  checkAbort(signal);
  if (typeof createImageBitmap === "function") {
    const pending = createImageBitmap(blob);
    void pending.then(
      (bitmap) => {
        if (signal?.aborted) bitmap.close?.();
      },
      () => {},
    );
    const bitmap = await abortable(pending, signal);
    try {
      const canvas = canvasFor(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
      ctx.drawImage(bitmap, 0, 0);
      return canvas;
    } finally {
      bitmap.close?.();
    }
  }
  const image = new Image();
  const url = URL.createObjectURL(blob);
  try {
    await abortable(
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
        image.src = url;
      }),
      signal,
    );
    const canvas = canvasFor(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    image.onload = image.onerror = null;
    image.src = "";
    URL.revokeObjectURL(url);
  }
}
/** Páginas com texto extraível mantêm a camada original, sem texto duplicado. */
export async function performBrowserOcr(
  blob: Blob,
  options: BrowserOcrOptions = {},
): Promise<BrowserOcrOutcome> {
  const { signal } = options;
  checkAbort(signal);
  if (typeof window === "undefined" || typeof Worker === "undefined")
    throw new Error("OCR_WORKER_UNAVAILABLE");
  if (!blob.size || blob.size > 64 * 1024 * 1024) throw new Error("OCR_INPUT_LIMIT");
  const rawBytes = new Uint8Array(await abortable(blob.arrayBuffer(), signal));
  const isPdf =
    rawBytes[0] === 37 && rawBytes[1] === 80 && rawBytes[2] === 68 && rawBytes[3] === 70;
  let worker: OcrRecognitionSession | undefined;
  let workerPromise: Promise<OcrRecognitionSession> | undefined;
  let terminated = false;
  let loading: ReturnType<typeof pdfjsLib.getDocument> | undefined;
  let render: ReturnType<pdfjsLib.PDFPageProxy["render"]> | undefined;
  let current = 1;
  let total = 1;
  const pageResults: OcrPageData[] = [],
    pageReports: OcrPageReport[] = [],
    lines: OcrLineResult[] = [],
    texts: string[] = [];
  const terminate = async () => {
    if (worker && !terminated) {
      terminated = true;
      await worker.terminate();
    }
  };
  const abort = () => {
    render?.cancel();
    void terminate().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  const progress = (status: string, value: number) => {
    if (!signal?.aborted)
      options.onProgress?.({
        status,
        page: current,
        totalPages: total,
        progress: Math.min(99, Math.round(((current - 1 + value) / total) * 100)),
      });
  };
  async function recognize(canvas: HTMLCanvasElement): Promise<void> {
    checkAbort(signal);
    if (!workerPromise) {
      checkAbort(signal);
      workerPromise = createOcrRecognitionSession(
        options.language ?? "por",
        (message) => {
          if (typeof message.progress === "number") progress(message.status, message.progress);
        },
        signal,
      );
      void workerPromise
        .then(
          async (ready) => {
            worker = ready;
            if (signal?.aborted) await terminate();
          },
          () => {},
        )
        .catch(() => {});
    }
    worker = await abortable(workerPromise, signal);
    checkAbort(signal);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
    if (options.enhanceContrast ?? true) applyContrastEnhancement(ctx, canvas.width, canvas.height);
    const result = await abortable(worker.recognize(canvas, {}, { blocks: true }), signal);
    checkAbort(signal);
    const pageLines = readOcrLines(result.data);
    texts.push(result.data.text.trim());
    pageResults.push({
      pageNumber: current,
      text: result.data.text.trim(),
      width: canvas.width,
      height: canvas.height,
      lines: pageLines,
    });
    for (const line of pageLines) {
      if (!line.bbox) continue;
      const { x0, y0, x1, y1 } = line.bbox;
      lines.push({
        pageNumber: current,
        text: line.text,
        confidence: line.confidence ?? 0,
        bounds: [x0, y0, x1, y1],
      });
    }
    pageReports.push({
      pageNumber: current,
      source: "ocr",
      confidence: confidence(result.data.confidence),
      durationMs: 0,
    });
  }
  try {
    if (isPdf) {
      loading = pdfjsLib.getDocument({
        data: rawBytes.slice(),
        useSystemFonts: true,
        standardFontDataUrl: new URL(withAppBase("standard_fonts/"), window.location.origin).href,
      });
      const pdf = await abortable(loading.promise, signal);
      total = pdf.numPages;
      if (total < 1 || total > 500) throw new Error("OCR_PAGE_LIMIT");
      for (current = 1; current <= total; current++) {
        checkAbort(signal);
        const started = performance.now();
        const page = await abortable(pdf.getPage(current), signal);
        let canvas: HTMLCanvasElement | undefined;
        try {
          const content = await abortable(page.getTextContent(), signal);
          const text = content.items
            .filter((item) => "str" in item)
            .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
            .join("")
            .trim();
          const viewport = page.getViewport({ scale: 2 });
          if (text) {
            texts.push(text);
            pageResults.push({
              pageNumber: current,
              text,
              width: viewport.width,
              height: viewport.height,
              lines: [],
            });
            pageReports.push({
              pageNumber: current,
              source: "existing-text",
              confidence: null,
              durationMs: 0,
            });
          } else {
            canvas = canvasFor(viewport.width, viewport.height);
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
            render = page.render({ canvasContext: ctx, viewport, canvas });
            await abortable(render.promise, signal);
            render = undefined;
            await recognize(canvas);
          }
          pageReports[pageReports.length - 1].durationMs = performance.now() - started;
          progress("page-completed", 1);
        } finally {
          render = undefined;
          if (canvas) canvas.width = canvas.height = 0;
          page.cleanup();
        }
      }
    } else {
      const started = performance.now();
      const canvas = await imageBlobToCanvas(blob, signal);
      try {
        await recognize(canvas);
        pageReports[0].durationMs = performance.now() - started;
      } finally {
        canvas.width = canvas.height = 0;
      }
    }
    checkAbort(signal);
    if (!texts.some((text) => text.trim())) throw new Error("OCR_NO_TEXT_FOUND");
    let searchablePdfBytes: Uint8Array | undefined;
    try {
      searchablePdfBytes = await abortable(
        generateSearchablePdf(rawBytes, pageResults, blob.type, { signal }),
        signal,
      );
    } catch {
      checkAbort(signal);
    }
    checkAbort(signal);
    options.onProgress?.({ status: "completed", page: total, totalPages: total, progress: 100 });
    return {
      text:
        total > 1
          ? texts.map((text, index) => `--- Página ${index + 1} ---\n${text}`).join("\n\n")
          : texts[0],
      pages: total,
      lines,
      pageResults,
      pageReports,
      engine: "tesseract.js-wasm",
      searchablePdfBytes,
    };
  } catch (error) {
    checkAbort(signal);
    if (error instanceof Error && /^(OCR_|CANVAS_)/.test(error.message)) throw error;
    throw new Error("OCR_PROCESSING_FAILED");
  } finally {
    signal?.removeEventListener("abort", abort);
    await terminate();
    await loading?.destroy();
  }
}
