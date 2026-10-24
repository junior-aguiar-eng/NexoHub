import type { RedactPdfOptions } from "./pdf-engine";
export async function redactBrowserPdf(
  bytes: Uint8Array,
  options: RedactPdfOptions,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
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
    const failed = () => {
      cleanup();
      reject(new Error("PDF_OCULTACAO_WORKER"));
    };
    try {
      worker = new Worker(new URL("./pdf-redaction.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<{ bytes?: Uint8Array; error?: string }>) => {
        cleanup();
        if (event.data.bytes) resolve(event.data.bytes);
        else reject(new Error(event.data.error ?? "PDF_OCULTACAO_WORKER"));
      };
      worker.onerror = worker.onmessageerror = failed;
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(failed, 60_000);
      const copy = bytes.slice();
      worker.postMessage({ bytes: copy, options }, [copy.buffer]);
    } catch {
      failed();
    }
  });
}
