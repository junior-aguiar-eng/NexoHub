import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  compressPdfDocument,
  extractPdfSelectedPages,
  mergePdfDocuments,
  splitPdfByInterval,
} from "./pdf-engine";

async function makePdf(pages = 2): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([200, 200]);
  return pdf.save();
}

describe("operações PDF no navegador", () => {
  it("relata a variação real de tamanho na compressão", async () => {
    const source = await makePdf();
    const result = await compressPdfDocument(source);
    expect(result.savedBytes).toBe(source.length - result.bytes.length);
    expect(result.savedPercent).toBe(Math.round((result.savedBytes / source.length) * 100));
  });

  it("recusa regravar PDF com ByteRange de assinatura", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const signature = pdf.context.obj({ Type: "Sig", ByteRange: [0, 1, 2, 3] });
    pdf.context.register(signature);
    await expect(compressPdfDocument(await pdf.save())).rejects.toThrow(
      "PDF_ASSINADO_NAO_SUPORTADO",
    );
  });

  it("interrompe a junção quando um dos arquivos é inválido", async () => {
    await expect(mergePdfDocuments([await makePdf(), new Uint8Array([1, 2, 3])])).rejects.toThrow();
  });

  it("não devolve o original quando a seleção de páginas é inválida", async () => {
    const source = await makePdf();
    await expect(extractPdfSelectedPages(source, [])).rejects.toThrow();
    await expect(extractPdfSelectedPages(source, [3])).rejects.toThrow();
    await expect(splitPdfByInterval(source, 3, 4)).rejects.toThrow();
  });
});
