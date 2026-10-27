import {
  PDF_REPAIR_LIMITS,
  type PdfRepairOptions,
  type PdfRepairResult,
} from "./pdf-repair-engine";

export async function repairBrowserPdf(
  bytes: Uint8Array,
  options: PdfRepairOptions = {},
): Promise<PdfRepairResult> {
  if (options.signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  if (bytes.length > PDF_REPAIR_LIMITS.inputBytes) throw new Error("PDF_REPAIR_LIMIT");
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
    };
    const fail = (code: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(code));
    };
    const abort = () => fail("OPERACAO_CANCELADA");
    try {
      worker = new Worker(new URL("./pdf-repair.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = ({
        data,
      }: MessageEvent<{ progress?: number; result?: PdfRepairResult; error?: string }>) => {
        if (settled) return;
        if (typeof data.progress === "number") {
          options.onProgress?.(data.progress);
          return;
        }
        if (data.result) {
          settled = true;
          cleanup();
          resolve(data.result);
        } else fail(data.error ?? "PDF_REPAIR_WORKER");
      };
      worker.onerror = worker.onmessageerror = () => fail("PDF_REPAIR_WORKER");
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) {
        abort();
        return;
      }
      timer = setTimeout(() => fail("PDF_REPAIR_TIMEOUT"), PDF_REPAIR_LIMITS.timeoutMs);
      const copy = bytes.slice();
      worker.postMessage({ bytes: copy }, [copy.buffer]);
    } catch {
      fail("PDF_REPAIR_WORKER");
    }
  });
}
