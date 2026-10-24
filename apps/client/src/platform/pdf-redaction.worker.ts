import { init } from "@embedpdf/pdfium";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import type { RedactPdfOptions } from "./pdf-engine";
import { redactPreservingWithPdfium } from "./pdf-redaction-engine";

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ bytes: Uint8Array; options: RedactPdfOptions }>) => void;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error("PDF_OCULTACAO_WORKER");
    const api = await init({ wasmBinary: await response.arrayBuffer() });
    api.PDFiumExt_Init();
    const bytes = await redactPreservingWithPdfium(api, data.bytes, data.options);
    scope.postMessage({ bytes }, [bytes.buffer]);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    scope.postMessage({
      error: /^(?:PDF_OCULTACAO_|AREA_OCULTACAO_|EMPTY_DOCUMENT$)/.test(code)
        ? code
        : "PDF_OCULTACAO_OPERACAO",
    });
  }
};
