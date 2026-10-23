import { coreToolRegistry } from "@nexohub/tool-registry";
import { resolveToolAvailability } from "@nexohub/tool-sdk";
import {
  BetweenHorizontalStart,
  Crop,
  FileArchive,
  FileCode2,
  FileScan,
  FileText,
  FileType,
  FolderInput,
  FormInput,
  GitCompareArrows,
  Hash,
  Image,
  Images,
  Languages,
  Lock,
  PenTool,
  RotateCw,
  Scissors,
  SpellCheck2,
  Stamp,
  Unlock,
} from "lucide-react";
import type { LauncherTool, Suite } from "./model";

export const suites: readonly Suite[] = [
  { id: "overview", labelKey: "suite.all", ariaLabel: "Todas" },
  { id: "organize", labelKey: "suite.organize", ariaLabel: "Organizar PDF" },
  { id: "optimize", labelKey: "suite.optimize", ariaLabel: "Otimizar PDF" },
  { id: "convert", labelKey: "suite.convert", ariaLabel: "Converter PDF" },
  { id: "text", labelKey: "suite.text", ariaLabel: "Texto e OCR" },
  { id: "security", labelKey: "suite.security", ariaLabel: "Segurança" },
];

const presentation = {
  "pdf-organize": {
    suite: "organize" as const,
    titleKey: "tool.pdfOrganize.title" as const,
    descriptionKey: "tool.pdfOrganize.description" as const,
    uploadTaglineKey: "tool.pdfOrganize.tagline" as const,
    icon: BetweenHorizontalStart,
    accentColor: "#EF4444", // Vermelho Coral
  },
  "pdf-merge": {
    suite: "organize" as const,
    titleKey: "tool.pdfMerge.title" as const,
    descriptionKey: "tool.pdfMerge.description" as const,
    uploadTaglineKey: "tool.pdfMerge.tagline" as const,
    icon: FolderInput,
    accentColor: "#E11D48", // Rosa Rubi
  },
  "pdf-split": {
    suite: "organize" as const,
    titleKey: "tool.pdfSplit.title" as const,
    descriptionKey: "tool.pdfSplit.description" as const,
    uploadTaglineKey: "tool.pdfSplit.tagline" as const,
    icon: Scissors,
    accentColor: "#EA580C", // Laranja Vivo
  },
  "pdf-rotate": {
    suite: "organize" as const,
    titleKey: "tool.pdfRotate.title" as const,
    descriptionKey: "tool.pdfRotate.description" as const,
    uploadTaglineKey: "tool.pdfRotate.tagline" as const,
    icon: RotateCw,
    accentColor: "#D97706", // Ouro Âmbar
  },
  "pdf-crop": {
    suite: "organize" as const,
    titleKey: "tool.pdfCrop.title" as const,
    descriptionKey: "tool.pdfCrop.description" as const,
    uploadTaglineKey: "tool.pdfCrop.tagline" as const,
    icon: Crop,
    accentColor: "#EA580C", // Laranja Abrasivo
  },
  "pdf-compress": {
    suite: "optimize" as const,
    titleKey: "tool.pdfCompress.title" as const,
    descriptionKey: "tool.pdfCompress.description" as const,
    uploadTaglineKey: "tool.pdfCompress.tagline" as const,
    icon: FileArchive,
    accentColor: "#00875F", // Verde Esmeralda
  },
  "pdf-to-word": {
    suite: "convert" as const,
    titleKey: "tool.pdfToWord.title" as const,
    descriptionKey: "tool.pdfToWord.description" as const,
    uploadTaglineKey: "tool.pdfToWord.tagline" as const,
    icon: FileType,
    accentColor: "#2563EB", // Azul Royal
  },
  "word-to-pdf": {
    suite: "convert" as const,
    titleKey: "tool.wordToPdf.title" as const,
    descriptionKey: "tool.wordToPdf.description" as const,
    uploadTaglineKey: "tool.wordToPdf.tagline" as const,
    icon: FileCode2,
    accentColor: "#0284C7", // Azul Céu
  },
  "images-to-pdf": {
    suite: "convert" as const,
    titleKey: "tool.imagesToPdf.title" as const,
    descriptionKey: "tool.imagesToPdf.description" as const,
    uploadTaglineKey: "tool.imagesToPdf.tagline" as const,
    icon: Image,
    accentColor: "#059669", // Verde Jade
  },
  "pdf-to-jpg": {
    suite: "convert" as const,
    titleKey: "tool.pdfToJpg.title" as const,
    descriptionKey: "tool.pdfToJpg.description" as const,
    uploadTaglineKey: "tool.pdfToJpg.tagline" as const,
    icon: Images,
    accentColor: "#B77900", // Âmbar Dourado
  },
  "pdf-watermark": {
    suite: "security" as const,
    titleKey: "tool.pdfWatermark.title" as const,
    descriptionKey: "tool.pdfWatermark.description" as const,
    uploadTaglineKey: "tool.pdfWatermark.tagline" as const,
    icon: Stamp,
    accentColor: "#0284C7", // Azul Oceano
  },
  "pdf-page-numbers": {
    suite: "organize" as const,
    titleKey: "tool.pdfPageNumbers.title" as const,
    descriptionKey: "tool.pdfPageNumbers.description" as const,
    uploadTaglineKey: "tool.pdfPageNumbers.tagline" as const,
    icon: Hash,
    accentColor: "#6366F1", // Índigo
  },
  "pdf-protect": {
    suite: "security" as const,
    titleKey: "tool.pdfProtect.title" as const,
    descriptionKey: "tool.pdfProtect.description" as const,
    uploadTaglineKey: "tool.pdfProtect.tagline" as const,
    icon: Lock,
    accentColor: "#475569", // Ardósia
  },
  "pdf-sign": {
    suite: "security" as const,
    titleKey: "tool.pdfSign.title" as const,
    descriptionKey: "tool.pdfSign.description" as const,
    uploadTaglineKey: "tool.pdfSign.tagline" as const,
    icon: PenTool,
    accentColor: "#059669", // Esmeralda Seguro
  },
  "pdf-extract-images": {
    suite: "convert" as const,
    titleKey: "tool.pdfExtractImages.title" as const,
    descriptionKey: "tool.pdfExtractImages.description" as const,
    uploadTaglineKey: "tool.pdfExtractImages.tagline" as const,
    icon: Images,
    accentColor: "#B77900", // Âmbar com contraste no cartão claro
  },
  "pdf-ocr": {
    suite: "text" as const,
    titleKey: "tool.pdfOcr.title" as const,
    descriptionKey: "tool.pdfOcr.description" as const,
    uploadTaglineKey: "tool.pdfOcr.tagline" as const,
    icon: FileScan,
    accentColor: "#8B5CF6", // Violeta Moderno
  },
  "text-compare": {
    suite: "text" as const,
    titleKey: "tool.textCompare.title" as const,
    descriptionKey: "tool.textCompare.description" as const,
    uploadTaglineKey: "tool.textCompare.tagline" as const,
    icon: GitCompareArrows,
    accentColor: "#3B82F6", // Azul Real
  },
  "text-review": {
    suite: "text" as const,
    titleKey: "tool.textReview.title" as const,
    descriptionKey: "tool.textReview.description" as const,
    uploadTaglineKey: "tool.textReview.tagline" as const,
    icon: SpellCheck2,
    accentColor: "#6366F1", // Índigo
  },
  "text-translate": {
    suite: "text" as const,
    titleKey: "tool.textTranslate.title" as const,
    descriptionKey: "tool.textTranslate.description" as const,
    uploadTaglineKey: "tool.textTranslate.tagline" as const,
    icon: Languages,
    accentColor: "#0891B2", // Ciano / Turquesa
  },
  "pdf-to-markdown": {
    suite: "convert" as const,
    titleKey: "tool.pdfToMarkdown.title" as const,
    descriptionKey: "tool.pdfToMarkdown.description" as const,
    uploadTaglineKey: "tool.pdfToMarkdown.tagline" as const,
    icon: FileText,
    accentColor: "#9333EA", // Roxo Ametista
  },
  "pdf-form-fill": {
    suite: "text" as const,
    titleKey: "tool.pdfFormFill.title" as const,
    descriptionKey: "tool.pdfFormFill.description" as const,
    uploadTaglineKey: "tool.pdfFormFill.tagline" as const,
    icon: FormInput,
    accentColor: "#2563EB", // Azul Cobalto
  },
  "pdf-unlock": {
    suite: "security" as const,
    titleKey: "tool.pdfUnlock.title" as const,
    descriptionKey: "tool.pdfUnlock.description" as const,
    uploadTaglineKey: "tool.pdfUnlock.tagline" as const,
    icon: Unlock,
    accentColor: "#E11D48", // Rosa Rubi Segurança
  },
} as const;

import type { CapabilityProvider } from "@nexohub/tool-sdk";
import type { DocumentCorePort } from "@/platform/document-core";

const browserSupportedToolIds = new Set([
  "pdf-organize",
  "pdf-merge",
  "pdf-split",
  "pdf-rotate",
  "pdf-crop",
  "pdf-sign",
  "pdf-compress",
  "text-compare",
  "images-to-pdf",
  "pdf-to-jpg",
  "pdf-to-markdown",
  "pdf-extract-images",
  "pdf-watermark",
  "pdf-page-numbers",
  "pdf-ocr",
  "text-translate",
  "text-review",
  "pdf-form-fill",
  "pdf-unlock",
]);

export function createDynamicCapabilitiesProvider(
  supportedToolIds: ReadonlySet<string>,
  toolId: string,
): CapabilityProvider {
  return {
    get: () => ({
      available: supportedToolIds.has(toolId),
      reason: "Ferramenta indisponível nesta plataforma.",
    }),
  };
}

export function resolveLauncherTools(
  _capabilities?: readonly unknown[],
  documentCore?: DocumentCorePort,
): readonly LauncherTool[] {
  const supportedToolIds = documentCore?.supportedToolIds ?? browserSupportedToolIds;
  return coreToolRegistry
    .list("quick")
    .filter((manifest) => manifest.id in presentation)
    .map((manifest) => ({
      ...presentation[manifest.id as keyof typeof presentation],
      id: manifest.id,
      manifest,
      availability: resolveToolAvailability(
        manifest,
        createDynamicCapabilitiesProvider(supportedToolIds, manifest.id),
      ),
    }))
    .filter((tool) => tool.availability.available);
}

export const launcherTools: readonly LauncherTool[] = resolveLauncherTools();
