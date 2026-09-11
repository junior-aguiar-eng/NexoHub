import { coreToolRegistry } from "@nexohub/tool-registry";
import { resolveToolAvailability, StaticCapabilityProvider } from "@nexohub/tool-sdk";
import {
  BetweenHorizontalStart,
  FileArchive,
  FileScan,
  GitCompareArrows,
  Languages,
  ListFilter,
  SpellCheck2,
} from "lucide-react";
import { translate } from "@/i18n";
import type { LauncherTool, Suite } from "./model";

export const suites: readonly Suite[] = [
  { id: "overview", labelKey: "suite.all", ariaLabel: "Todas" },
  { id: "processing", labelKey: "suite.processing", ariaLabel: "Processamento" },
  { id: "review", labelKey: "suite.review", ariaLabel: "Revisão" },
  { id: "compliance", labelKey: "suite.compliance", ariaLabel: "Compliance" },
  { id: "extraction", labelKey: "suite.extraction", ariaLabel: "Extração" },
  { id: "flow", labelKey: "suite.flow", ariaLabel: "NexoFlow" },
];

const presentation = {
  "pdf-organize": {
    suite: "pdf",
    titleKey: "tool.pdfOrganize.title",
    descriptionKey: "tool.pdfOrganize.description",
    icon: BetweenHorizontalStart,
  },
  "pdf-compress": {
    suite: "pdf",
    titleKey: "tool.pdfCompress.title",
    descriptionKey: "tool.pdfCompress.description",
    icon: FileArchive,
  },
  "pdf-ocr": {
    suite: "pdf",
    titleKey: "tool.pdfOcr.title",
    descriptionKey: "tool.pdfOcr.description",
    icon: FileScan,
  },
  "text-compare": {
    suite: "text",
    titleKey: "tool.textCompare.title",
    descriptionKey: "tool.textCompare.description",
    icon: GitCompareArrows,
  },
  "text-review": {
    suite: "text",
    titleKey: "tool.textReview.title",
    descriptionKey: "tool.textReview.description",
    icon: SpellCheck2,
  },
  "text-translate": {
    suite: "text",
    titleKey: "tool.textTranslate.title",
    descriptionKey: "tool.textTranslate.description",
    icon: Languages,
  },
  "intelligence-extract": {
    suite: "text",
    titleKey: "tool.intelligenceExtract.title",
    descriptionKey: "tool.intelligenceExtract.description",
    icon: ListFilter,
  },
} as const;

import type { CapabilityItem } from "@nexohub/contracts";
import type { CapabilityProvider } from "@nexohub/tool-sdk";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import type { DocumentCorePort } from "@/platform/document-core";

export function createDynamicCapabilitiesProvider(
  capabilities?: readonly CapabilityItem[],
  documentCore?: DocumentCorePort,
): CapabilityProvider {
  const isTranslationInstalled = Boolean(
    capabilities?.some((c) => c.id === "translation.neural" && c.status === "installed"),
  );
  const isOcrInstalled = Boolean(
    capabilities?.some((c) => c.id === "ocr.vision" && c.status === "installed"),
  );
  const isReviewInstalled = Boolean(
    capabilities?.some((c) => c.id === "text.deep_review" && c.status === "installed"),
  );
  const isCompressInstalled = Boolean(
    capabilities?.some((c) => c.id === "pdf.super_compress" && c.status === "installed"),
  );

  const isNativeDocumentCore = Boolean(
    documentCore && !(documentCore instanceof BrowserDocumentCorePort),
  );

  return new StaticCapabilityProvider({
    "documents.read": { available: true },
    "documents.write": { available: true },
    "pdf.transform":
      isNativeDocumentCore || isCompressInstalled
        ? { available: true }
        : { available: false, reason: translate("tools.unavailable.pdf") },
    "ocr.execute": isOcrInstalled
      ? { available: true }
      : { available: false, reason: translate("tools.unavailable.ocr") },
    "text.compare": { available: false, reason: translate("tools.unavailable.compare") },
    "text.review": isReviewInstalled
      ? { available: true }
      : { available: false, reason: translate("tools.unavailable.review") },
    "translation.execute": isTranslationInstalled
      ? { available: true }
      : { available: false, reason: translate("tools.unavailable.translation") },
    "intelligence.extract": {
      available: false,
      reason: translate("tools.unavailable.extract"),
    },
  });
}

export function resolveLauncherTools(
  capabilities?: readonly CapabilityItem[],
  documentCore?: DocumentCorePort,
): readonly LauncherTool[] {
  const provider = createDynamicCapabilitiesProvider(capabilities, documentCore);
  return coreToolRegistry.list("quick").map((manifest) => ({
    ...presentation[manifest.id as keyof typeof presentation],
    id: manifest.id,
    manifest,
    availability: resolveToolAvailability(manifest, provider),
  }));
}

export const launcherTools: readonly LauncherTool[] = resolveLauncherTools();
