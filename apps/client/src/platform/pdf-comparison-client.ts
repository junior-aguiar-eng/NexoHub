import type {
  PdfComparisonOptions,
  PdfComparisonProgress,
  PdfComparisonResult,
} from "./pdf-comparison-types";

export interface PdfComparisonBundle {
  readonly comparison: PdfComparisonResult;
  readonly report: Uint8Array;
  readonly json: string;
}
export async function performBrowserPdfComparison(
  left: Uint8Array,
  right: Uint8Array,
  names: readonly string[],
  options: PdfComparisonOptions = {},
): Promise<PdfComparisonBundle> {
  if (options.signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    const cleanup = () => {
      options.signal?.removeEventListener("abort", abort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
    };
    const abort = () => {
      cleanup();
      reject(new Error("OPERACAO_CANCELADA"));
    };
    try {
      worker = new Worker(new URL("./pdf-comparison.worker.ts", import.meta.url), {
        type: "module",
      });
      options.signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = ({
        data,
      }: MessageEvent<
        | { type: "progress"; info: PdfComparisonProgress }
        | { type: "result"; bundle: PdfComparisonBundle }
        | { type: "error"; code: string }
      >) => {
        if (data.type === "progress") options.onProgress?.(data.info);
        else {
          cleanup();
          if (data.type === "result") resolve(data.bundle);
          else reject(new Error(data.code));
        }
      };
      worker.onerror = worker.onmessageerror = () => {
        cleanup();
        reject(new Error("PDF_COMPARACAO_WORKER_INDISPONIVEL"));
      };
      const l = left.slice().buffer,
        r = right.slice().buffer;
      worker.postMessage({ left: l, right: r, names }, [l, r]);
    } catch {
      cleanup();
      reject(new Error("PDF_COMPARACAO_WORKER_INDISPONIVEL"));
    }
  });
}
