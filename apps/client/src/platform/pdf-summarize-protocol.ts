/**
 * Contratos, constantes e protocolos de mensagens entre a UI e o Worker
 * estritamente local de resumo documental (`pdf-summarize`, ADR-017).
 */

export const SUMMARIZE_MODEL = {
  id: "onnx-community/Qwen2.5-0.5B-Instruct",
  label: "Qwen2.5 0.5B Instruct (ONNX Local)",
  revision: "main",
  license: "Apache-2.0",
  webgpuDtype: "q4f16",
  wasmDtype: "q4",
  approxDownloadMbWebGpu: 410,
  approxDownloadMbWasm: 390,
} as const;

export const SUMMARIZE_LIMITS = {
  maxInputBytes: 64 * 1024 * 1024, // 64 MB
  maxPages: 120,
  maxChunks: 18,
  chunkTargetChars: 3_600,
  chunkOverlapChars: 240,
  minExtractableChars: 40,
  inactivityTimeoutMs: 60_000,
} as const;

export type SummarizeMode = "executive" | "obligations-dates" | "by-section";

export type SummarizeDevice = "webgpu" | "wasm";

export type SummarizeErrorCode =
  | "SUMMARIZE_EMPTY_PDF"
  | "SUMMARIZE_INPUT_TOO_LARGE"
  | "SUMMARIZE_SCANNED_PDF_NO_TEXT"
  | "SUMMARIZE_MODEL_UNAVAILABLE"
  | "SUMMARIZE_NETWORK_ERROR"
  | "SUMMARIZE_DOWNLOAD_TIMEOUT"
  | "SUMMARIZE_CANCELLED"
  | "SUMMARIZE_RUNTIME_FAILED";

export interface SummarizeHardwareProfile {
  hasWebGpu: boolean;
  recommendedDevice: SummarizeDevice;
  recommendedDtype: "q4f16" | "q4";
  approxDownloadMb: number;
  deviceMemoryGb: number | null;
  lowMemoryWarning: boolean;
  cpuSlowWarning: boolean;
}

export interface PdfPageChunk {
  index: number;
  startPage: number;
  endPage: number;
  citationLabel: string;
  text: string;
}

export interface SummarizeProgress {
  phase: "extracting" | "downloading" | "initializing" | "mapping" | "reducing";
  progress: number;
  loadedBytes?: number;
  totalBytes?: number;
  currentChunk?: number;
  totalChunks?: number;
  device?: SummarizeDevice;
}

export interface VerifiedPageCitation {
  label: string;
  startPage: number;
  endPage: number;
}

export interface SummarizeWorkerStartRequest {
  type: "summarize";
  requestId: string;
  chunks: PdfPageChunk[];
  totalPages: number;
  mode: SummarizeMode;
  device: SummarizeDevice;
  dtype: "q4f16" | "q4";
}

export type SummarizeWorkerRequest = SummarizeWorkerStartRequest;

export type SummarizeWorkerResponse =
  | {
      type: "progress";
      requestId: string;
      progress: SummarizeProgress;
    }
  | {
      type: "result";
      requestId: string;
      summaryMarkdown: string;
      deviceUsed: SummarizeDevice;
      modelId: string;
    }
  | {
      type: "error";
      requestId: string;
      code: SummarizeErrorCode;
      message: string;
    };
