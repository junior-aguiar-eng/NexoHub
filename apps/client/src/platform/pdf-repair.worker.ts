import { init, type WrappedPdfiumModule } from "@embedpdf/pdfium";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import "pdfjs-dist/legacy/build/pdf.worker.mjs?nexohub-worker-reader";
import { repairPdfDocument } from "./pdf-repair-engine";
import { verifyRepairedPdf } from "./pdf-repair-verify";

let pdfiumPromise: Promise<WrappedPdfiumModule | undefined> | undefined;

async function loadWorkerPdfium(): Promise<WrappedPdfiumModule | undefined> {
  try {
    if (!pdfiumPromise) {
      pdfiumPromise = (async () => {
        const response = await fetch(wasmUrl);
        if (!response.ok) return undefined;
        const api = await init({ wasmBinary: await response.arrayBuffer() });
        api.PDFiumExt_Init();
        return api;
      })();
    }
    const api = await pdfiumPromise;
    if (!api) pdfiumPromise = undefined;
    return api;
  } catch {
    pdfiumPromise = undefined;
    return undefined;
  }
}

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ bytes: Uint8Array }>) => void;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    const result = await repairPdfDocument(data.bytes, {
      onProgress: (progress) => scope.postMessage({ progress }),
      loadPdfium: loadWorkerPdfium,
    });
    await verifyRepairedPdf(result.pdfBytes, result.report.recoveredPages);
    scope.postMessage({ progress: 95 });
    scope.postMessage({ result }, [result.pdfBytes.buffer]);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    scope.postMessage({
      error:
        /^(?:PDF_REPAIR_|EMPTY_DOCUMENT$|CORRUPTED_DOCUMENT$|SENHA_OBRIGATORIA$|OPERACAO_CANCELADA$)/.test(
          code,
        )
          ? code
          : "CORRUPTED_DOCUMENT",
    });
  }
};
