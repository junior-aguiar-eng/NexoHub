import { readBrowserDocxText } from "./browser-docx";
import { extractTextFromPdf } from "./pdf-engine";

/**
 * Lê o conteúdo em texto de um arquivo, detectando automaticamente se é um PDF
 * (executando extração de texto via PDF.js) ou arquivo textual comum (.txt, .md, .csv, etc.).
 */
export async function readDocumentText(file: File): Promise<string> {
  if (
    file.name.toLowerCase().endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return readBrowserDocxText(file);
  }
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const extracted = await extractTextFromPdf(buffer);
      if (!extracted.trim())
        throw new ToolRunError("INVALID_INPUT", translate("document.errorPdfNoText"));
      return extracted.trim();
    } catch (err) {
      if (err instanceof ToolRunError) throw err;
      throw new ToolRunError("INVALID_INPUT", translate("document.errorPdfTextExtraction"));
    }
  }

  try {
    return await file.text();
  } catch {
    throw new ToolRunError("INVALID_INPUT", translate("document.errorTextRead"));
  }
}

import { ToolRunError } from "@nexohub/tool-sdk";
import { translate } from "@/i18n";
