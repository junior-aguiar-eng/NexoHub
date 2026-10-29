// Mantém o parser no próprio worker de comparação: workers filhos não recebem
// os recursos do protocolo Tauri de forma confiável no WebView2.
import "pdfjs-dist/legacy/build/pdf.worker.mjs?nexohub-worker-reader";
import { comparePdfDocuments } from "./pdf-comparison";
import { createComparisonReportWriter, serializePdfComparison } from "./pdf-comparison-report";
import type { PdfComparisonPair } from "./pdf-comparison-types";

const scope = globalThis as unknown as {
  onmessage: (
    event: MessageEvent<{
      left: ArrayBuffer;
      right: ArrayBuffer;
      names: string[];
      previewPair?: PdfComparisonPair;
    }>,
  ) => void;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    const writer = data.previewPair ? undefined : await createComparisonReportWriter();
    const comparison = await comparePdfDocuments(
      new Uint8Array(data.left),
      new Uint8Array(data.right),
      {
        previewPair: data.previewPair,
        retainImages: !!data.previewPair,
        onPair: writer ? (pair) => writer.appendPair(pair) : undefined,
        onProgress: (info) =>
          scope.postMessage({
            type: "progress",
            info: { ...info, progress: Math.min(95, info.progress) },
          }),
      },
    );
    scope.postMessage({ type: "progress", info: { phase: "reporting", progress: 96 } });
    const report = writer ? await writer.finish(comparison, data.names) : new Uint8Array();
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
