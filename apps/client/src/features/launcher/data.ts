import { coreToolRegistry } from "@nexohub/tool-registry";
import { resolveToolAvailability, StaticCapabilityProvider } from "@nexohub/tool-sdk";
import {
  BetweenHorizontalStart,
  FileArchive,
  FileScan,
  GitCompareArrows,
  Images,
  Languages,
  ListFilter,
  SpellCheck2,
} from "lucide-react";
import { translate } from "@/i18n";
import type { LauncherTool, Suite } from "./model";

export const suites: readonly Suite[] = [
  { id: "overview", labelKey: "suite.all", ariaLabel: "Todas as ferramentas" },
  { id: "organize", labelKey: "suite.organize", ariaLabel: "Organizar PDF" },
  { id: "optimize", labelKey: "suite.optimize", ariaLabel: "Otimizar PDF" },
  { id: "text", labelKey: "suite.text", ariaLabel: "Texto" },
];

const presentation = {
  "pdf-organize": {
    suite: "organize" as const,
    titleKey: "tool.pdfOrganize.title" as const,
    descriptionKey: "tool.pdfOrganize.description" as const,
    icon: BetweenHorizontalStart,
    accentColor: "#EF4444", // Vermelho Coral
  },
  "pdf-compress": {
    suite: "optimize" as const,
    titleKey: "tool.pdfCompress.title" as const,
    descriptionKey: "tool.pdfCompress.description" as const,
    icon: FileArchive,
    accentColor: "#10B981", // Verde Esmeralda
  },
  "pdf-extract-images": {
    suite: "organize" as const,
    titleKey: "tool.pdfExtractImages.title" as const,
    descriptionKey: "tool.pdfExtractImages.description" as const,
    icon: Images,
    accentColor: "#F59E0B", // Âmbar / Ouro Solar
  },
  "pdf-ocr": {
    suite: "organize" as const,
    titleKey: "tool.pdfOcr.title" as const,
    descriptionKey: "tool.pdfOcr.description" as const,
    icon: FileScan,
    accentColor: "#8B5CF6", // Violeta Moderno
  },
  "text-compare": {
    suite: "text" as const,
    titleKey: "tool.textCompare.title" as const,
    descriptionKey: "tool.textCompare.description" as const,
    icon: GitCompareArrows,
    accentColor: "#3B82F6", // Azul Real
  },
  "text-review": {
    suite: "text" as const,
    titleKey: "tool.textReview.title" as const,
    descriptionKey: "tool.textReview.description" as const,
    icon: SpellCheck2,
    accentColor: "#6366F1", // Índigo
  },
  "text-translate": {
    suite: "text" as const,
    titleKey: "tool.textTranslate.title" as const,
    descriptionKey: "tool.textTranslate.description" as const,
    icon: Languages,
    accentColor: "#06B6D4", // Ciano / Turquesa
  },
} as const;

import type { CapabilityProvider } from "@nexohub/tool-sdk";
import type { DocumentCorePort } from "@/platform/document-core";

export function createDynamicCapabilitiesProvider(): CapabilityProvider {
  return new StaticCapabilityProvider({
    "documents.read": { available: true },
    "documents.write": { available: true },
    "pdf.transform": { available: true },
    "text.compare": { available: true },
    "text.review": { available: true },
    "ocr.execute": { available: true },
    "translation.execute": { available: true },
  });
}

export function resolveLauncherTools(
  _capabilities?: readonly unknown[],
  _documentCore?: DocumentCorePort,
): readonly LauncherTool[] {
  const provider = createDynamicCapabilitiesProvider();
  return coreToolRegistry
    .list("quick")
    .filter((manifest) => manifest.id in presentation)
    .map((manifest) => ({
      ...presentation[manifest.id as keyof typeof presentation],
      id: manifest.id,
      manifest,
      availability: resolveToolAvailability(manifest, provider),
    }))
    .filter((tool) => tool.availability.available);
}

export const launcherTools: readonly LauncherTool[] = resolveLauncherTools();
