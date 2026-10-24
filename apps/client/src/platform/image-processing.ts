import type { ImageCompositionSnapshot } from "./image-composition-types";
import type {
  ImageCompressionOptions,
  ImageConvertOptions,
  ImageCropOptions,
  ImageResizeOptions,
  ImageRotateOptions,
  ImageWatermarkOptions,
} from "./image-engine";
import { executeImageJob } from "./image-job";
export type ImageJob = { blob: Blob } & (
  | { kind: "compress"; options: ImageCompressionOptions }
  | { kind: "resize"; options: ImageResizeOptions }
  | { kind: "crop"; options: ImageCropOptions }
  | { kind: "convert"; options: ImageConvertOptions }
  | { kind: "rotate"; options: ImageRotateOptions }
  | { kind: "watermark"; options: ImageWatermarkOptions }
  | { kind: "composition"; options: ImageCompositionSnapshot }
);
export function processImage(job: ImageJob, signal?: AbortSignal): Promise<Blob> {
  if (signal?.aborted) return Promise.reject(new Error("OPERACAO_CANCELADA"));
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined")
    return executeImageJob(job, signal);
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker?.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new Error("OPERACAO_CANCELADA"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("TEMPO_PROCESSAMENTO_IMAGEM"));
    }, 120000);
    try {
      worker = new Worker(new URL("./image-processing.worker.ts", import.meta.url), {
        type: "module",
      });
      signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = ({ data }: MessageEvent<{ blob?: Blob; error?: string }>) => {
        cleanup();
        if (data.blob) resolve(data.blob);
        else reject(new Error(data.error || "FALHA_EXPORTAR_IMAGEM"));
      };
      worker.onerror = worker.onmessageerror = () => {
        cleanup();
        reject(new Error("FALHA_EXPORTAR_IMAGEM"));
      };
      worker.postMessage(job);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
