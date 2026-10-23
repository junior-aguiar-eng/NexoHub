import { comparePdfDocuments } from "./pdf-comparison";
import { createPdfComparisonReport, serializePdfComparison } from "./pdf-comparison-report";

const scope = globalThis as unknown as {
  onmessage: (
    event: MessageEvent<{ left: ArrayBuffer; right: ArrayBuffer; names: string[] }>,
  ) => void;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    const comparison = await comparePdfDocuments(
      new Uint8Array(data.left),
      new Uint8Array(data.right),
      {
        onProgress: (info) =>
          scope.postMessage({
            type: "progress",
            info: { ...info, progress: Math.min(95, info.progress) },
          }),
      },
    );
    const report = await createPdfComparisonReport(comparison, data.names);
    const json = serializePdfComparison(comparison, data.names);
    scope.postMessage({ type: "progress", info: { phase: "done", progress: 100 } });
    scope.postMessage({ type: "result", bundle: { comparison, report, json } }, [report.buffer]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    scope.postMessage({
      type: "error",
      code: message.startsWith("PDF_COMPARACAO_") ? message : "PDF_COMPARACAO_PDF_INVALIDO",
    });
  }
};
