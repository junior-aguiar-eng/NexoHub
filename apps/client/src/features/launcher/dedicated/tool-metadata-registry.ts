import type { ProcessingMode } from "@nexohub/contracts";
import { type MessageKey, translate } from "@/i18n";

const ACTION_LABEL_KEYS: Record<string, MessageKey> = {
  "pdf-split": "dedicated.actionSplit",
  "pdf-compress": "dedicated.actionCompress",
  "pdf-repair": "dedicated.actionRepair",
  "pdf-to-pdfa": "dedicated.actionPdfToPdfa",
  "pdf-summarize": "dedicated.actionSummarize",
  "pdf-to-word": "dedicated.actionPdfToWord",
  "pdf-merge": "dedicated.actionMerge",
  "pdf-rotate": "dedicated.actionRotate",
  "pdf-crop": "dedicated.actionCrop",
  "pdf-sign": "dedicated.actionSign",
  "pdf-form-fill": "dedicated.actionFormFill",
  "pdf-unlock": "dedicated.actionUnlock",
  "pdf-protect": "protect.actionSubmit",
  "pdf-redact": "redact.actionSubmit",
  "pdf-to-excel": "excel.actionSubmit",
  "pdf-remove-pages": "removePages.confirmButton",
  "pdf-extract-pages": "extractPages.confirmButton",
  "html-to-pdf": "htmlToPdf.confirmButton",
  "scan-to-pdf": "scanToPdf.confirmButton",
  "pdf-organize": "dedicated.actionOrganize",
  "images-to-pdf": "dedicated.actionImagesToPdf",
  "pdf-extract-images": "dedicated.actionExtractImages",
  "pdf-to-jpg": "dedicated.actionPdfToJpg",
  "pdf-to-markdown": "dedicated.actionPdfToMarkdown",
  "pdf-watermark": "dedicated.actionWatermark",
  "pdf-page-numbers": "dedicated.actionPageNumbers",
  "pdf-ocr": "dedicated.actionOcr",
  "text-compare": "dedicated.actionCompare",
  "text-review": "dedicated.actionReview",
  "image-compress": "dedicated.actionImageCompress",
  "image-resize": "dedicated.actionImageResize",
  "image-crop": "dedicated.actionImageCrop",
  "image-convert": "dedicated.actionImageConvert",
  "image-rotate": "dedicated.actionImageRotate",
};

export function resolveDedicatedActionLabel(
  toolId: string,
  processingMode: ProcessingMode,
  compositionMode: boolean,
): string {
  const isCloudEligible = toolId === "pdf-ocr" || toolId === "text-translate";
  if (isCloudEligible && processingMode === "cloud") {
    return translate("cloudProcessing.actionCloud");
  }
  if (toolId === "image-watermark") {
    return translate(compositionMode ? "composition.export" : "dedicated.actionImageWatermark");
  }
  const key = ACTION_LABEL_KEYS[toolId];
  return translate(key ?? "dedicated.actionRun");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function parseSelectedPages(input: string, maxPages: number): number[] {
  const pages = new Set<number>();
  if (!input.trim() || !Number.isSafeInteger(maxPages) || maxPages < 1) return [];
  for (const part of input.split(",").map((value) => value.trim())) {
    if (!/^\d+(?:\s*-\s*\d+)?$/.test(part)) return [];
    const [first, last = first] = part.split("-").map(Number);
    if (![first, last].every((page) => Number.isSafeInteger(page) && page >= 1 && page <= maxPages))
      return [];
    // A faixa é validada antes de expandir: nunca itera além das páginas existentes.
    for (let page = Math.min(first, last); page <= Math.max(first, last); page++) pages.add(page);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function isPdfCandidate(file: File | undefined): boolean {
  return Boolean(file && (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")));
}
