import type { OcrLineResult } from "@nexohub/contracts";

export interface BrowserOcrOutcome {
  text: string;
  lines: OcrLineResult[];
  pages: number;
  engine: string;
}

/**
 * Executa OCR local de imagens usando Tesseract.js no navegador.
 */
export async function performBrowserOcr(
  blob: Blob,
  language: string = "por",
): Promise<BrowserOcrOutcome> {
  if (blob.type === "application/pdf") {
    throw new Error("OCR_PDF_UNAVAILABLE_IN_BROWSER");
  }

  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("OCR_WORKER_UNAVAILABLE");
  }

  try {
    const { createWorker } = await import("tesseract.js");
    const langCode = language === "por" ? "por" : language === "spa" ? "spa" : "eng";

    // Inicializa o worker do Tesseract.js
    const worker = await createWorker(langCode);
    let ret: Awaited<ReturnType<typeof worker.recognize>>;
    try {
      ret = await worker.recognize(blob);
    } finally {
      await worker.terminate();
    }

    const recognizedText = ret.data.text.trim();
    if (!recognizedText) throw new Error("OCR_NO_TEXT_FOUND");
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
    const lines: OcrLineResult[] = rawLines.map((line) => ({
      pageNumber: 1,
      text: line.text.trim(),
      confidence: (line.confidence ?? ret.data.confidence) / 100,
      bounds: [line.bbox?.x0 ?? 0, line.bbox?.y0 ?? 0, line.bbox?.x1 ?? 0, line.bbox?.y1 ?? 0],
    }));

    return {
      text: recognizedText,
      pages: 1,
      lines,
      engine: "tesseract.js-wasm",
    };
  } catch {
    throw new Error("OCR_PROCESSING_FAILED");
  }
}
