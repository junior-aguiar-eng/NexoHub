import type { Page } from "tesseract.js";

export interface OcrRecognitionSession {
  recognize(
    canvas: HTMLCanvasElement,
    options?: unknown,
    output?: unknown,
  ): Promise<{ data: Page }>;
  terminate(): Promise<void>;
}
type Reply =
  | { type: "ready" }
  | { type: "progress"; status: string; progress: number }
  | { type: "result"; data: Page }
  | { type: "error" };

/** A plataforma mantém um handle terminável desde o início, inclusive durante download do modelo. */
export function createOcrRecognitionSession(
  language: "por" | "eng" | "spa",
  onProgress: (message: { status: string; progress: number }) => void,
  signal?: AbortSignal,
): Promise<OcrRecognitionSession> {
  signal?.throwIfAborted();
  const worker = new Worker(new URL("./ocr-recognition.worker.ts", import.meta.url), {
    type: "module",
  });
  let disposed = false;
  let rejectReady!: (reason: Error) => void;
  let resolveReady!: (session: OcrRecognitionSession) => void;
  let pending:
    | { resolve: (value: { data: Page }) => void; reject: (error: Error) => void }
    | undefined;
  const ready = new Promise<OcrRecognitionSession>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  let timer: ReturnType<typeof setTimeout>;
  const dispose = (reason: Error = new DOMException("OCR_CANCELLED", "AbortError")) => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    worker.onmessage = worker.onerror = worker.onmessageerror = null;
    worker.terminate();
    rejectReady(reason);
    pending?.reject(reason);
    pending = undefined;
  };
  const abort = () => dispose();
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => dispose(new Error("OCR_WORKER_TIMEOUT")), 60_000);
  };
  const session: OcrRecognitionSession = {
    async recognize(canvas) {
      signal?.throwIfAborted();
      if (disposed) throw new DOMException("OCR_CANCELLED", "AbortError");
      if (pending) throw new Error("OCR_WORKER_BUSY");
      const image = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("OCR_IMAGE_ENCODING_FAILED"))),
          "image/png",
        ),
      );
      signal?.throwIfAborted();
      if (disposed) throw new DOMException("OCR_CANCELLED", "AbortError");
      touch();
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        worker.postMessage({ type: "recognize", image });
      });
    },
    async terminate() {
      dispose();
    },
  };
  worker.onmessage = (event: MessageEvent<Reply>) => {
    if (disposed) return;
    const reply = event.data;
    if (reply.type === "progress") {
      touch();
      onProgress(reply);
    } else if (reply.type === "ready") {
      clearTimeout(timer);
      resolveReady(session);
    } else if (reply.type === "result") {
      clearTimeout(timer);
      pending?.resolve({ data: reply.data });
      pending = undefined;
    } else if (reply.type === "error") dispose(new Error("OCR_PROCESSING_FAILED"));
  };
  worker.onerror = worker.onmessageerror = () => dispose(new Error("OCR_PROCESSING_FAILED"));
  signal?.addEventListener("abort", abort, { once: true });
  touch();
  worker.postMessage({ type: "initialize", language });
  return ready;
}
