import { repairPdfDocument } from "./pdf-repair-engine";
import { verifyRepairedPdf } from "./pdf-repair-verify";

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ bytes: Uint8Array }>) => void;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    const result = await repairPdfDocument(data.bytes, {
      onProgress: (progress) => scope.postMessage({ progress }),
    });
    await verifyRepairedPdf(result.pdfBytes, result.report.recoveredPages);
    scope.postMessage({ progress: 95 });
    scope.postMessage({ result }, [result.pdfBytes.buffer]);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    scope.postMessage({
      error: /^(?:PDF_REPAIR_|EMPTY_DOCUMENT$|CORRUPTED_DOCUMENT$|SENHA_OBRIGATORIA$)/.test(code)
        ? code
        : "CORRUPTED_DOCUMENT",
    });
  }
};
