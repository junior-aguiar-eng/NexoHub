import { extractTextFromPdf } from "./pdf-engine";

/**
 * Lê o conteúdo em texto de um arquivo, detectando automaticamente se é um PDF
 * (executando extração de texto via PDF.js) ou arquivo textual comum (.txt, .md, .csv, etc.).
 */
export async function readDocumentText(file: File): Promise<string> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const extracted = await extractTextFromPdf(buffer);
      return extracted.trim();
    } catch (err) {
      console.warn("Falha na extração de texto do PDF:", err);
      return "";
    }
  }

  try {
    return await file.text();
  } catch (err) {
    console.error("Erro ao ler conteúdo do arquivo como texto:", err);
    return "";
  }
}
