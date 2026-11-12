import {
  FileDigit,
  FileLock2,
  FilePenLine,
  FileSearch,
  FileStack,
  FileText,
  Images,
  Maximize2,
  Zap,
} from "lucide-react";
import type React from "react";
import { translate } from "@/i18n";

export interface ToolChainingBarProps {
  currentToolId: string;
  outputBlob: Blob;
  outputFileName: string;
  onChainToTool: (targetToolId: string, file: File) => void;
}

interface ChainingOption {
  toolId: string;
  labelKey:
    | "chaining.compressPdf"
    | "chaining.protectPdf"
    | "chaining.pageNumbers"
    | "chaining.signPdf"
    | "chaining.ocrPdf"
    | "chaining.pdfToWord"
    | "chaining.organizePdf"
    | "chaining.imagesToPdf"
    | "chaining.compressImage"
    | "chaining.resizeImage";
  icon: React.ReactNode;
  colorClass: string;
}

const PDF_CHAINING_OPTIONS: ChainingOption[] = [
  {
    toolId: "pdf-compress",
    labelKey: "chaining.compressPdf",
    icon: <Zap size={16} />,
    colorClass: "text-amber-500",
  },
  {
    toolId: "pdf-protect",
    labelKey: "chaining.protectPdf",
    icon: <FileLock2 size={16} />,
    colorClass: "text-rose-500",
  },
  {
    toolId: "pdf-page-numbers",
    labelKey: "chaining.pageNumbers",
    icon: <FileDigit size={16} />,
    colorClass: "text-cyan-500",
  },
  {
    toolId: "pdf-sign",
    labelKey: "chaining.signPdf",
    icon: <FilePenLine size={16} />,
    colorClass: "text-violet-500",
  },
  {
    toolId: "pdf-ocr",
    labelKey: "chaining.ocrPdf",
    icon: <FileSearch size={16} />,
    colorClass: "text-emerald-500",
  },
  {
    toolId: "pdf-to-word",
    labelKey: "chaining.pdfToWord",
    icon: <FileText size={16} />,
    colorClass: "text-blue-500",
  },
  {
    toolId: "pdf-organize",
    labelKey: "chaining.organizePdf",
    icon: <FileStack size={16} />,
    colorClass: "text-purple-500",
  },
];

const IMAGE_CHAINING_OPTIONS: ChainingOption[] = [
  {
    toolId: "images-to-pdf",
    labelKey: "chaining.imagesToPdf",
    icon: <Images size={16} />,
    colorClass: "text-blue-500",
  },
  {
    toolId: "image-compress",
    labelKey: "chaining.compressImage",
    icon: <Zap size={16} />,
    colorClass: "text-amber-500",
  },
  {
    toolId: "image-resize",
    labelKey: "chaining.resizeImage",
    icon: <Maximize2 size={16} />,
    colorClass: "text-emerald-500",
  },
];

export const ToolChainingBar: React.FC<ToolChainingBarProps> = ({
  currentToolId,
  outputBlob,
  outputFileName,
  onChainToTool,
}) => {
  const isPdf =
    outputBlob.type === "application/pdf" || outputFileName.toLowerCase().endsWith(".pdf");
  const isImage =
    outputBlob.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|avif|bmp|tiff?)$/i.test(outputFileName.toLowerCase());

  const options = isPdf
    ? PDF_CHAINING_OPTIONS.filter((op) => op.toolId !== currentToolId).slice(0, 4)
    : isImage
      ? IMAGE_CHAINING_OPTIONS.filter((op) => op.toolId !== currentToolId).slice(0, 3)
      : [];

  if (options.length === 0) return null;

  const handleActionClick = (targetToolId: string) => {
    const file = new File([outputBlob], outputFileName, {
      type: outputBlob.type || (isPdf ? "application/pdf" : "application/octet-stream"),
      lastModified: Date.now(),
    });
    onChainToTool(targetToolId, file);
  };

  return (
    <section className="tool-chaining-bar" aria-label={translate("chaining.title")}>
      <span className="tool-chaining-bar__title">{translate("chaining.title")}</span>
      <div className="tool-chaining-bar__actions">
        {options.map((option) => (
          <button
            key={option.toolId}
            type="button"
            className="tool-chaining-btn"
            onClick={() => handleActionClick(option.toolId)}
          >
            <span className={`tool-chaining-btn__icon ${option.colorClass}`}>{option.icon}</span>
            <span>{translate(option.labelKey)}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
