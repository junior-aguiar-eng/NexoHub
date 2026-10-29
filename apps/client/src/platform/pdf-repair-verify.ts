import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import parserUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

/** Reabre todas as páginas da saída em leitor independente, sem executar scripts do documento. */
export async function verifyRepairedPdf(bytes: Uint8Array, expectedPages: number): Promise<void> {
  let task: pdfjs.PDFDocumentLoadingTask | undefined;
  try {
    if (typeof process === "undefined" || !process.versions?.node)
      pdfjs.GlobalWorkerOptions.workerSrc = parserUrl;
    task = pdfjs.getDocument({
      data: bytes.slice(),
      stopAtErrors: true,
      disableFontFace: true,
      useSystemFonts: false,
      maxImageSize: 16_000_000,
    });
    const pdf = await task.promise;
    if (pdf.numPages !== expectedPages) throw new Error("PDF_REPAIR_VERIFICATION");
    for (let page = 1; page <= pdf.numPages; page++) {
      const item = await pdf.getPage(page);
      await item.getOperatorList();
      await item.getTextContent();
      await item.getAnnotations();
      item.cleanup();
    }
    await pdf.getAttachments();
    await pdf.getMetadata();
  } catch {
    throw new Error("PDF_REPAIR_VERIFICATION");
  } finally {
    if (task) await task.destroy();
  }
}
