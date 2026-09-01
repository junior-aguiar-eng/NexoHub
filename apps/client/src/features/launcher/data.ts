import {
  BetweenHorizontalStart,
  FileArchive,
  FileScan,
  GitCompareArrows,
  ListFilter,
  SpellCheck2,
} from "lucide-react";
import type { LauncherTool, Suite } from "./model";

export const suites: readonly Suite[] = [
  { id: "overview", labelKey: "suite.overview" },
  { id: "pdf", labelKey: "suite.pdf" },
  { id: "text", labelKey: "suite.text" },
  { id: "intelligence", labelKey: "suite.intelligence" },
];

export const launcherTools: readonly LauncherTool[] = [
  {
    id: "pdf-organize",
    suite: "pdf",
    titleKey: "tool.pdfOrganize.title",
    descriptionKey: "tool.pdfOrganize.description",
    icon: BetweenHorizontalStart,
    status: "coming-soon",
  },
  {
    id: "pdf-compress",
    suite: "pdf",
    titleKey: "tool.pdfCompress.title",
    descriptionKey: "tool.pdfCompress.description",
    icon: FileArchive,
    status: "coming-soon",
  },
  {
    id: "pdf-ocr",
    suite: "pdf",
    titleKey: "tool.pdfOcr.title",
    descriptionKey: "tool.pdfOcr.description",
    icon: FileScan,
    status: "coming-soon",
  },
  {
    id: "text-compare",
    suite: "text",
    titleKey: "tool.textCompare.title",
    descriptionKey: "tool.textCompare.description",
    icon: GitCompareArrows,
    status: "coming-soon",
  },
  {
    id: "text-review",
    suite: "text",
    titleKey: "tool.textReview.title",
    descriptionKey: "tool.textReview.description",
    icon: SpellCheck2,
    status: "coming-soon",
  },
  {
    id: "intelligence-extract",
    suite: "intelligence",
    titleKey: "tool.intelligenceExtract.title",
    descriptionKey: "tool.intelligenceExtract.description",
    icon: ListFilter,
    status: "coming-soon",
  },
];
