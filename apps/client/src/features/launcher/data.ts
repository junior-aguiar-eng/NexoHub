import { coreToolRegistry } from "@nexohub/tool-registry";
import { resolveToolAvailability, StaticCapabilityProvider } from "@nexohub/tool-sdk";
import {
  BetweenHorizontalStart,
  FileArchive,
  FileScan,
  GitCompareArrows,
  ListFilter,
  SpellCheck2,
} from "lucide-react";
import { translate } from "@/i18n";
import type { LauncherTool, Suite } from "./model";

export const suites: readonly Suite[] = [
  { id: "overview", labelKey: "suite.overview" },
  { id: "pdf", labelKey: "suite.pdf" },
  { id: "text", labelKey: "suite.text" },
  { id: "intelligence", labelKey: "suite.intelligence" },
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
  "intelligence-extract": {
    suite: "intelligence",
    titleKey: "tool.intelligenceExtract.title",
    descriptionKey: "tool.intelligenceExtract.description",
    icon: ListFilter,
  },
} as const;

const browserCapabilities = new StaticCapabilityProvider({
  "documents.read": { available: true },
  "documents.write": { available: true },
  "pdf.transform": { available: false, reason: translate("tools.unavailable.pdf") },
  "ocr.execute": { available: false, reason: translate("tools.unavailable.ocr") },
  "text.compare": { available: false, reason: translate("tools.unavailable.compare") },
  "text.review": { available: false, reason: translate("tools.unavailable.review") },
  "intelligence.extract": {
    available: false,
    reason: translate("tools.unavailable.extract"),
  },
});

export const launcherTools: readonly LauncherTool[] = coreToolRegistry
  .list("quick")
  .map((manifest) => ({
    ...presentation[manifest.id as keyof typeof presentation],
    id: manifest.id,
    manifest,
    availability: resolveToolAvailability(manifest, browserCapabilities),
  }));
