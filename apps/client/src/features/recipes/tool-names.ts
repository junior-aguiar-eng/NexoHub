import { coreToolManifests } from "@nexohub/tool-registry";
import { translate } from "@/i18n";

const toolTitleKeys: Record<
  string,
  | "tool.pdfOrganize.title"
  | "tool.pdfCompress.title"
  | "tool.pdfOcr.title"
  | "tool.textCompare.title"
  | "tool.textReview.title"
  | "tool.textTranslate.title"
  | "tool.intelligenceExtract.title"
> = {
  "pdf-organize": "tool.pdfOrganize.title",
  "pdf-compress": "tool.pdfCompress.title",
  "pdf-ocr": "tool.pdfOcr.title",
  "text-compare": "tool.textCompare.title",
  "text-review": "tool.textReview.title",
  "text-translate": "tool.textTranslate.title",
  "intelligence-extract": "tool.intelligenceExtract.title",
};

/**
 * Retorna o nome amigável e canônico em português para o identificador da ferramenta.
 */
export function getFriendlyToolName(toolId: string): string {
  const titleKey = toolTitleKeys[toolId];
  if (titleKey) {
    return translate(titleKey);
  }
  const manifest = coreToolManifests.find((item) => item.id === toolId);
  return manifest ? manifest.name : toolId;
}
