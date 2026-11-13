import "pdfjs-dist/legacy/build/pdf.worker.mjs?nexohub-worker-reader";
import {
  convertPdfToPdfA,
  inspectPdfForPdfa,
  type PdfAConformance,
  type PdfAFontStrategy,
} from "./pdfa-converter";

type WorkerRequest =
  | {
      readonly kind: "inspect";
      readonly bytes: Uint8Array;
    }
  | {
      readonly kind: "convert";
      readonly bytes: Uint8Array;
      readonly conformance?: PdfAConformance;
      readonly fontStrategy?: PdfAFontStrategy;
      readonly allowDiscardSignatures?: boolean;
      readonly dpi?: number;
    };

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<WorkerRequest>) => void;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    if (data.kind === "inspect") {
      const diagnostic = await inspectPdfForPdfa(data.bytes);
      scope.postMessage({ diagnostic });
      return;
    }
    const result = await convertPdfToPdfA(data.bytes, {
      conformance: data.conformance,
      fontStrategy: data.fontStrategy,
      allowDiscardSignatures: data.allowDiscardSignatures,
      dpi: data.dpi,
      onProgress: (progress) => scope.postMessage({ progress }),
    });
    scope.postMessage({ progress: 100 });
    scope.postMessage({ result }, [result.pdfBytes.buffer]);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const normalized = code.startsWith("PDFA_") ? code : "PDFA_INVALID_INPUT";
    scope.postMessage({ error: normalized });
  }
};
