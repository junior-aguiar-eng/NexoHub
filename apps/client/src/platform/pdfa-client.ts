import {
  convertPdfToPdfA,
  inspectPdfForPdfa,
  PDFA_LIMITS,
  type PdfAConversionOptions,
  type PdfAConversionResult,
  type PdfADiagnosticReport,
} from "./pdfa-converter";

type WorkerMessage = {
  readonly progress?: number;
  readonly diagnostic?: PdfADiagnosticReport;
  readonly result?: PdfAConversionResult;
  readonly error?: string;
};

function runInWorker<T>(
  payload: Record<string, unknown>,
  bytes: Uint8Array,
  options: {
    readonly signal?: AbortSignal;
    readonly onProgress?: (percent: number) => void;
    readonly extractResult: (message: WorkerMessage) => T | undefined;
  },
): Promise<T> {
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
      worker = new Worker(new URL("./pdfa.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
        if (settled) return;
        if (typeof data.progress === "number") {
          options.onProgress?.(data.progress);
          return;
        }
        const value = options.extractResult(data);
        if (value !== undefined) {
          settled = true;
          cleanup();
          resolve(value);
          return;
        }
        fail(data.error ?? "PDFA_WORKER_ERROR");
      };
      worker.onerror = worker.onmessageerror = () => fail("PDFA_WORKER_ERROR");
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) {
        abort();
        return;
      }
      timer = setTimeout(() => fail("PDFA_TIMEOUT"), PDFA_LIMITS.timeoutMs);
      const copy = bytes.slice();
      worker.postMessage({ ...payload, bytes: copy }, [copy.buffer]);
    } catch {
      fail("PDFA_WORKER_ERROR");
    }
  });
}

export async function inspectBrowserPdfForPdfa(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<PdfADiagnosticReport> {
  if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  if (bytes.length === 0) throw new Error("PDFA_INVALID_INPUT");
  if (bytes.length > PDFA_LIMITS.inputBytes) throw new Error("PDFA_INPUT_LIMIT");

  if (typeof Worker === "undefined") {
    return inspectPdfForPdfa(bytes);
  }

  return runInWorker<PdfADiagnosticReport>({ kind: "inspect" }, bytes, {
    signal,
    extractResult: (message) => message.diagnostic,
  });
}

export async function convertBrowserPdfToPdfA(
  bytes: Uint8Array,
  options: Omit<
    PdfAConversionOptions,
    "pageRasterizer" | "pageTextExtractor" | "iccProfileBytes" | "ocrFontBytes"
  > = {},
): Promise<PdfAConversionResult> {
  if (options.signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  if (bytes.length === 0) throw new Error("PDFA_INVALID_INPUT");
  if (bytes.length > PDFA_LIMITS.inputBytes) throw new Error("PDFA_INPUT_LIMIT");

  if (typeof Worker === "undefined") {
    return convertPdfToPdfA(bytes, options);
  }

  return runInWorker<PdfAConversionResult>(
    {
      kind: "convert",
      conformance: options.conformance,
      fontStrategy: options.fontStrategy,
      allowDiscardSignatures: options.allowDiscardSignatures,
      dpi: options.dpi,
    },
    bytes,
    {
      signal: options.signal,
      onProgress: options.onProgress,
      extractResult: (message) => message.result,
    },
  );
}
