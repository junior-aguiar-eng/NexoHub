import type { OfficeConversionKind } from "@nexohub/contracts";
import { ToolRunError } from "@nexohub/tool-sdk";
import type { DocumentCorePort } from "./document-core";

export const OFFICE_MAX_INPUT_BYTES = 64 * 1024 * 1024;

export interface OfficeToolMetadata {
  readonly id: OfficeConversionKind;
  readonly accept: string;
  readonly supportedExtensions: readonly string[];
  readonly outputExtension: "pdf" | "pptx";
  readonly outputMimeType: string;
  readonly desktopOnly: boolean;
  readonly formatLabel: string;
}

export const OFFICE_TOOL_METADATA: Readonly<Record<OfficeConversionKind, OfficeToolMetadata>> = {
  "word-to-pdf": {
    id: "word-to-pdf",
    accept:
      ".docx,.doc,.odt,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.oasis.opendocument.text,application/rtf",
    supportedExtensions: ["docx", "doc", "odt", "rtf"],
    outputExtension: "pdf",
    outputMimeType: "application/pdf",
    desktopOnly: false,
    formatLabel: "DOCX / DOC / ODT / RTF → PDF",
  },
  "excel-to-pdf": {
    id: "excel-to-pdf",
    accept:
      ".xlsx,.xls,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet",
    supportedExtensions: ["xlsx", "xls", "ods"],
    outputExtension: "pdf",
    outputMimeType: "application/pdf",
    desktopOnly: false,
    formatLabel: "XLSX / XLS / ODS → PDF",
  },
  "powerpoint-to-pdf": {
    id: "powerpoint-to-pdf",
    accept:
      ".pptx,.ppt,.odp,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/vnd.oasis.opendocument.presentation",
    supportedExtensions: ["pptx", "ppt", "odp"],
    outputExtension: "pdf",
    outputMimeType: "application/pdf",
    desktopOnly: false,
    formatLabel: "PPTX / PPT / ODP → PDF",
  },
  "pdf-to-powerpoint": {
    id: "pdf-to-powerpoint",
    accept: ".pdf,application/pdf",
    supportedExtensions: ["pdf"],
    outputExtension: "pptx",
    outputMimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    desktopOnly: true,
    formatLabel: "PDF → PPTX",
  },
};

export interface OfficeConversionOutput {
  readonly blob: Blob;
  readonly fileName: string;
  readonly durationMs: number;
  readonly outputBytesLen: number;
}

export function getOfficeToolMetadata(toolId: string): OfficeToolMetadata | null {
  if (toolId in OFFICE_TOOL_METADATA) {
    return OFFICE_TOOL_METADATA[toolId as OfficeConversionKind];
  }
  return null;
}

export function validateOfficeInputFile(kind: OfficeConversionKind, file: File): void {
  if (file.size === 0) {
    throw new ToolRunError("INVALID_INPUT", "O arquivo selecionado está vazio.");
  }
  if (file.size > OFFICE_MAX_INPUT_BYTES) {
    throw new ToolRunError(
      "INVALID_INPUT",
      "O arquivo ultrapassa o limite de 64 MB para conversão Office.",
    );
  }
  const meta = OFFICE_TOOL_METADATA[kind];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!meta.supportedExtensions.includes(ext)) {
    throw new ToolRunError(
      "INVALID_INPUT",
      `Formato '.${ext || "?"}' incompatível com esta ferramenta. Formatos aceitos: ${meta.supportedExtensions.map((item) => `.${item}`).join(", ")}.`,
    );
  }
}

export function buildOfficeOutputFileName(sourceName: string, ext: "pdf" | "pptx"): string {
  const baseName = sourceName.replace(/\.[^/.]+$/, "").trim() || "documento";
  return `${baseName}.${ext}`;
}

function mapOfficeError(error: unknown): ToolRunError {
  if (error instanceof ToolRunError) return error;
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (code === "CAPABILITY_NOT_FOUND" || raw.includes("CAPABILITY_NOT_FOUND")) {
    return new ToolRunError(
      "TOOL_UNAVAILABLE",
      "Instale o Superpoder Suíte Office (~280 MB) para converter arquivos Office 100% offline neste dispositivo.",
    );
  }
  if (code === "SIDECAR_TIMEOUT" || raw.toLowerCase().includes("tempo limite")) {
    return new ToolRunError(
      "TIMEOUT",
      "A conversão Office atingiu o limite de 120 segundos. Tente dividir ou simplificar o arquivo.",
    );
  }
  if (code === "RESOURCE_LIMIT" || raw.includes("64 MB")) {
    return new ToolRunError(
      "INVALID_INPUT",
      raw || "O arquivo excede os limites de segurança para conversão.",
    );
  }
  if (code === "INVALID_ARGUMENT") {
    return new ToolRunError("INVALID_INPUT", raw || "Arquivo Office ou PDF inválido.");
  }
  return new ToolRunError(
    "EXECUTION_FAILED",
    raw || "Não foi possível concluir a conversão Office neste arquivo.",
  );
}

export async function convertOfficeWithDocumentCore(
  documentCore: DocumentCorePort,
  kind: OfficeConversionKind,
  file: File,
): Promise<OfficeConversionOutput> {
  validateOfficeInputFile(kind, file);
  const meta = OFFICE_TOOL_METADATA[kind];
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));

  try {
    const result = await documentCore.invoke("convert_office_document", {
      kind,
      fileName: file.name,
      bytes,
    });
    const outputBytes = new Uint8Array(result.bytes);
    if (outputBytes.byteLength === 0) {
      throw new ToolRunError("EXECUTION_FAILED", "O motor Office retornou um arquivo vazio.");
    }
    const blob = new Blob([outputBytes as unknown as BlobPart], {
      type: result.mimeType || meta.outputMimeType,
    });
    return {
      blob,
      fileName: result.fileName || buildOfficeOutputFileName(file.name, meta.outputExtension),
      durationMs: result.durationMs,
      outputBytesLen: result.outputBytesLen || outputBytes.byteLength,
    };
  } catch (error) {
    throw mapOfficeError(error);
  }
}
