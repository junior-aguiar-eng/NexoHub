import type { OcrLineResult } from "@nexohub/contracts";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { generateSearchablePdf, type OcrPageData } from "./pdf-engine";

if (typeof window !== "undefined") {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    }
  } catch {
    // Fallback silencioso
  }
}

export interface OcrProgressInfo {
  status: string;
  page: number;
  totalPages: number;
  progress: number;
}

export interface BrowserOcrOptions {
  language?: "por" | "eng" | "spa";
  enhanceContrast?: boolean;
  onProgress?: (info: OcrProgressInfo) => void;
}

export interface BrowserOcrOutcome {
  text: string;
  pages: number;
  lines: OcrLineResult[];
  pageResults: OcrPageData[];
  engine: string;
  searchablePdfBytes?: Uint8Array;
}

/**
 * Aplica realce de contraste adaptativo e conversão para escala de cinza em canvas 2D
 * para maximizar a acurácia de OCR em digitalizações com sombras ou ruído.
 */
export function applyContrastEnhancement(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;
  const contrast = 1.35;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < len; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let adjusted = factor * (gray - 128) + 128;
    if (adjusted < 0) adjusted = 0;
    if (adjusted > 255) adjusted = 255;
    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }
  ctx.putImageData(imgData, 0, 0);
}

async function imageBlobToCanvas(
  blob: Blob,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  let imgWidth = 0;
  let imgHeight = 0;
  let source: CanvasImageSource | null = null;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      imgWidth = bitmap.width;
      imgHeight = bitmap.height;
      source = bitmap;
    } catch {
      // Fallback para Image element
    }
  }

  if (!source) {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
        img.src = url;
      });
      imgWidth = img.naturalWidth || img.width;
      imgHeight = img.naturalHeight || img.height;
      source = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = imgWidth;
  canvas.height = imgHeight;
  const ctx = canvas.getContext("2d");
  if (ctx && source) {
    ctx.drawImage(source, 0, 0);
  }
  return { canvas, width: imgWidth, height: imgHeight };
}

async function renderPdfPageToCanvas(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale = 2.0,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Executa OCR local usando Tesseract.js (WebAssembly) no navegador.
 * Suporta documentos PDF multipágina e imagens (JPG, PNG, WebP) escaneadas,
 * com pré-processamento de contraste e geração de PDF pesquisável.
 */
export async function performBrowserOcr(
  blob: Blob,
  options: BrowserOcrOptions = {},
): Promise<BrowserOcrOutcome> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("OCR_WORKER_UNAVAILABLE");
  }

  const isPdf =
    blob.type === "application/pdf" ||
    blob.type.includes("pdf") ||
    ("name" in blob && typeof blob.name === "string" && blob.name.toLowerCase().endsWith(".pdf"));

  const rawBytes = new Uint8Array(await blob.arrayBuffer());
  const langCode = options.language === "eng" ? "eng" : options.language === "spa" ? "spa" : "por";
  const enhanceContrast = options.enhanceContrast ?? true;

  try {
    const { createWorker } = await import("tesseract.js");

    let currentWorkerPage = 1;
    let totalWorkerPages = 1;

    const worker = await createWorker(langCode, 1, {
      logger: (m) => {
        if (options.onProgress && typeof m.progress === "number") {
          const pageBase = (currentWorkerPage - 1) / totalWorkerPages;
          const pageFraction = (1 / totalWorkerPages) * (m.progress || 0);
          const totalProgress = Math.min(Math.round((pageBase + pageFraction) * 100), 99);
          options.onProgress({
            status: m.status || "recognizing text",
            page: currentWorkerPage,
            totalPages: totalWorkerPages,
            progress: totalProgress,
          });
        }
      },
    });

    const pageResults: OcrPageData[] = [];
    const allLines: OcrLineResult[] = [];
    const pageTexts: string[] = [];

    try {
      if (isPdf) {
        const loadingTask = pdfjsLib.getDocument({
          data: rawBytes.slice(),
          useSystemFonts: true,
          standardFontDataUrl:
            typeof window !== "undefined" && window.location?.origin
              ? `${window.location.origin}/standard_fonts/`
              : undefined,
        });
        const pdfDoc = await loadingTask.promise;
        totalWorkerPages = pdfDoc.numPages;

        for (let i = 1; i <= totalWorkerPages; i++) {
          currentWorkerPage = i;
          const { canvas, width, height } = await renderPdfPageToCanvas(pdfDoc, i);
          const ctx = canvas.getContext("2d");
          if (ctx && enhanceContrast) {
            applyContrastEnhancement(ctx, width, height);
          }

          const ret = await worker.recognize(canvas);
          const pageText = ret.data.text.trim();
          pageTexts.push(pageText);

          const rawLines =
            (
              ret.data as unknown as {
                lines?: Array<{
                  text: string;
                  confidence?: number;
                  bbox?: { x0: number; y0: number; x1: number; y1: number };
                }>;
              }
            ).lines || [];

          const pageLines: OcrPageData["lines"] = rawLines.map((line) => ({
            text: line.text.trim(),
            confidence: (line.confidence ?? ret.data.confidence) / 100,
            bbox: line.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
          }));

          for (const line of pageLines) {
            const { x0 = 0, y0 = 0, x1 = 0, y1 = 0 } = line.bbox ?? {};
            allLines.push({
              pageNumber: i,
              text: line.text,
              confidence: line.confidence ?? 0.8,
              bounds: [x0, y0, x1, y1],
            });
          }

          pageResults.push({
            pageNumber: i,
            text: pageText,
            width,
            height,
            lines: pageLines,
          });
        }
      } else {
        totalWorkerPages = 1;
        currentWorkerPage = 1;

        const { canvas, width, height } = await imageBlobToCanvas(blob);
        const ctx = canvas.getContext("2d");
        if (ctx && enhanceContrast) {
          applyContrastEnhancement(ctx, width, height);
        }

        const ret = await worker.recognize(canvas);
        const text = ret.data.text.trim();
        pageTexts.push(text);

        const rawLines =
          (
            ret.data as unknown as {
              lines?: Array<{
                text: string;
                confidence?: number;
                bbox?: { x0: number; y0: number; x1: number; y1: number };
              }>;
            }
          ).lines || [];

        const pageLines: OcrPageData["lines"] = rawLines.map((line) => ({
          text: line.text.trim(),
          confidence: (line.confidence ?? ret.data.confidence) / 100,
          bbox: line.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
        }));

        for (const line of pageLines) {
          const { x0 = 0, y0 = 0, x1 = 0, y1 = 0 } = line.bbox ?? {};
          allLines.push({
            pageNumber: 1,
            text: line.text,
            confidence: line.confidence ?? 0.8,
            bounds: [x0, y0, x1, y1],
          });
        }

        pageResults.push({
          pageNumber: 1,
          text,
          width,
          height,
          lines: pageLines,
        });
      }
    } finally {
      await worker.terminate();
    }

    const fullText =
      pageTexts.length > 1
        ? pageTexts.map((txt, idx) => `--- Página ${idx + 1} ---\n${txt}`).join("\n\n")
        : pageTexts[0] || "";

    if (!fullText.trim()) {
      throw new Error("OCR_NO_TEXT_FOUND");
    }

    if (options.onProgress) {
      options.onProgress({
        status: "completed",
        page: totalWorkerPages,
        totalPages: totalWorkerPages,
        progress: 100,
      });
    }

    // Gera o PDF pesquisável com camada de texto invisível sobre o documento original
    let searchablePdfBytes: Uint8Array | undefined;
    try {
      searchablePdfBytes = await generateSearchablePdf(rawBytes, pageResults, blob.type);
    } catch (pdfErr) {
      console.warn("Falha ao gerar camada de PDF pesquisável:", pdfErr);
    }

    return {
      text: fullText,
      pages: totalWorkerPages,
      lines: allLines,
      pageResults,
      engine: "tesseract.js-wasm",
      searchablePdfBytes,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "OCR_NO_TEXT_FOUND") {
      throw err;
    }
    throw new Error("OCR_PROCESSING_FAILED");
  }
}
