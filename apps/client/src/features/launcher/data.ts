import { coreToolRegistry } from "@nexohub/tool-registry";
import { resolveToolAvailability } from "@nexohub/tool-sdk";
import {
  ArrowLeftRight,
  BetweenHorizontalStart,
  Camera,
  Crop,
  EyeOff,
  FileArchive,
  FileCode2,
  FileOutput,
  FileScan,
  FileSpreadsheet,
  FileText,
  FileType,
  FileX2,
  FolderInput,
  FormInput,
  GitCompareArrows,
  Globe,
  Hash,
  Image,
  Images,
  Languages,
  Lock,
  Maximize2,
  Minimize2,
  Pencil,
  PenTool,
  RotateCw,
  Scissors,
  SpellCheck2,
  Stamp,
  Unlock,
} from "lucide-react";
import type { LauncherTool, Suite } from "./model";

export const pdfSuites: readonly Suite[] = [
  { id: "overview", labelKey: "suite.all", ariaLabel: "Todas" },
  { id: "organize", labelKey: "suite.organize", ariaLabel: "Organizar PDF" },
  { id: "optimize", labelKey: "suite.optimize", ariaLabel: "Otimizar PDF" },
  { id: "convert", labelKey: "suite.convert", ariaLabel: "Converter PDF" },
  { id: "text", labelKey: "suite.text", ariaLabel: "Texto e OCR" },
  { id: "security", labelKey: "suite.security", ariaLabel: "Segurança" },
];

export const imageSuites: readonly Suite[] = [
  { id: "overview", labelKey: "suite.all", ariaLabel: "Todas" },
  { id: "img-optimize", labelKey: "suite.imgOptimize", ariaLabel: "Otimizar" },
  { id: "img-edit", labelKey: "suite.imgEdit", ariaLabel: "Editar" },
  { id: "img-convert", labelKey: "suite.imgConvert", ariaLabel: "Converter" },
  { id: "img-security", labelKey: "suite.imgSecurity", ariaLabel: "Marca d'água" },
];

export const suites: readonly Suite[] = pdfSuites;

const presentation = {
  "pdf-edit": {
    suite: "organize" as const,
    titleKey: "editor.title" as const,
    descriptionKey: "editor.description" as const,
    uploadTaglineKey: "editor.tagline" as const,
    icon: Pencil,
    accentColor: "#e76b53",
  },
  "pdf-compare": {
    suite: "text" as const,
    titleKey: "pdfCompare.title" as const,
    descriptionKey: "pdfCompare.toolDescription" as const,
    uploadTaglineKey: "pdfCompare.tagline" as const,
    icon: GitCompareArrows,
    accentColor: "#4f46e5",
  },
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
    searchAliases: ["reduzir", "diminuir", "compactar"],
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
  "pdf-redact": {
    suite: "security" as const,
    titleKey: "tool.pdfRedact.title" as const,
    descriptionKey: "tool.pdfRedact.description" as const,
    uploadTaglineKey: "tool.pdfRedact.tagline" as const,
    icon: EyeOff,
    accentColor: "#DC2626", // Vermelho Alerta / Tarja
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
  "pdf-to-excel": {
    suite: "convert" as const,
    titleKey: "tool.pdfToExcel.title" as const,
    descriptionKey: "tool.pdfToExcel.description" as const,
    uploadTaglineKey: "tool.pdfToExcel.tagline" as const,
    icon: FileSpreadsheet,
    accentColor: "#107C41", // Verde Esmeralda Excel
  },
  "pdf-remove-pages": {
    suite: "organize" as const,
    titleKey: "tool.pdfRemovePages.title" as const,
    descriptionKey: "tool.pdfRemovePages.description" as const,
    icon: FileX2,
    accentColor: "#DC2626", // Vermelho Alerta / Remoção
  },
  "pdf-extract-pages": {
    suite: "organize" as const,
    titleKey: "tool.pdfExtractPages.title" as const,
    descriptionKey: "tool.pdfExtractPages.description" as const,
    icon: FileOutput,
    accentColor: "#EA580C", // Laranja Extração
  },
  "html-to-pdf": {
    suite: "convert" as const,
    titleKey: "tool.htmlToPdf.title" as const,
    descriptionKey: "tool.htmlToPdf.description" as const,
    icon: Globe,
    accentColor: "#D97706", // Âmbar Ouro Web
  },
  "scan-to-pdf": {
    suite: "convert" as const,
    titleKey: "tool.scanToPdf.title" as const,
    descriptionKey: "tool.scanToPdf.description" as const,
    icon: Camera,
    accentColor: "#0284C7", // Azul Céu / Scanner
  },
  "image-compress": {
    searchAliases: ["reduzir", "diminuir", "compactar"],
    suite: "img-optimize" as const,
    titleKey: "tool.imageCompress.title" as const,
    descriptionKey: "tool.imageCompress.description" as const,
    uploadTaglineKey: "tool.imageCompress.tagline" as const,
    icon: Minimize2,
    accentColor: "#0284C7", // Azul Sky
  },
  "image-resize": {
    suite: "img-edit" as const,
    titleKey: "tool.imageResize.title" as const,
    descriptionKey: "tool.imageResize.description" as const,
    uploadTaglineKey: "tool.imageResize.tagline" as const,
    icon: Maximize2,
    accentColor: "#2563EB", // Azul Royal
  },
  "image-crop": {
    suite: "img-edit" as const,
    titleKey: "tool.imageCrop.title" as const,
    descriptionKey: "tool.imageCrop.description" as const,
    uploadTaglineKey: "tool.imageCrop.tagline" as const,
    icon: Crop,
    accentColor: "#0EA5E9", // Azul Ciano
  },
  "image-convert": {
    suite: "img-convert" as const,
    titleKey: "tool.imageConvert.title" as const,
    descriptionKey: "tool.imageConvert.description" as const,
    uploadTaglineKey: "tool.imageConvert.tagline" as const,
    icon: ArrowLeftRight,
    accentColor: "#3B82F6", // Azul Vivo
  },
  "image-rotate": {
    suite: "img-edit" as const,
    titleKey: "tool.imageRotate.title" as const,
    descriptionKey: "tool.imageRotate.description" as const,
    uploadTaglineKey: "tool.imageRotate.tagline" as const,
    icon: RotateCw,
    accentColor: "#4F46E5", // Índigo
  },
  "image-watermark": {
    suite: "img-security" as const,
    titleKey: "tool.imageWatermark.title" as const,
    descriptionKey: "tool.imageWatermark.description" as const,
    uploadTaglineKey: "tool.imageWatermark.tagline" as const,
    icon: Stamp,
    accentColor: "#6366F1", // Violeta Índigo
  },
} as const;

import type { CapabilityProvider } from "@nexohub/tool-sdk";
import type { DocumentCorePort } from "@/platform/document-core";

const browserSupportedToolIds = new Set([
  "pdf-edit",
  "pdf-compare",
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
  "pdf-protect",
  "pdf-redact",
  "pdf-to-excel",
  "pdf-remove-pages",
  "pdf-extract-pages",
  "html-to-pdf",
  "scan-to-pdf",
  "image-compress",
  "image-resize",
  "image-crop",
  "image-convert",
  "image-rotate",
  "image-watermark",
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
