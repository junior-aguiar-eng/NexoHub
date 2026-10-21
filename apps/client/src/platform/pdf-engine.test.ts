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

  it("descarta metadados redundantes e miniaturas na compressão", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 200]);
    const { PDFName } = await import("pdf-lib");
    page.node.set(PDFName.of("Thumb"), pdf.context.obj({ Type: "XObject" }));
    page.node.set(PDFName.of("PieceInfo"), pdf.context.obj({}));
    pdf.catalog.set(PDFName.of("PieceInfo"), pdf.context.obj({}));
    const compressed = await compressPdfDocument(await pdf.save());
    const reloaded = await PDFDocument.load(compressed.bytes);
    const reloadedPage = reloaded.getPage(0);
    expect(reloadedPage.node.has(PDFName.of("Thumb"))).toBe(false);
    expect(reloadedPage.node.has(PDFName.of("PieceInfo"))).toBe(false);
    expect(reloaded.catalog.has(PDFName.of("PieceInfo"))).toBe(false);
  });

  it("converte imagens PNG e JPG em documento PDF multipágina", async () => {
    const { convertImagesToPdfDocument } = await import("./pdf-engine");
    const minimalPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const minimalJpg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
      0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b,
      0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31,
      0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff,
      0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00, 0xff, 0xd9,
    ]);

    const pdfBytes = await convertImagesToPdfDocument([
      { bytes: minimalPng, mimeType: "image/png" },
      { bytes: minimalJpg, mimeType: "image/jpeg" },
    ]);

    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
  });

  it("converte páginas de um PDF em imagens JPG válidas", async () => {
    const { convertPdfPagesToJpgImages } = await import("./pdf-engine");
    const source = await makePdf(2);
    const images = await convertPdfPagesToJpgImages(source);
    expect(images).toHaveLength(2);
    expect(images[0].name).toBe("pagina_1.jpg");
    expect(images[1].name).toBe("pagina_2.jpg");
    expect(images[0].data[0]).toBe(0xff);
    expect(images[0].data[1]).toBe(0xd8);
  });

  it("aplica estampa de marca d'água de texto no PDF preservando páginas", async () => {
    const { addWatermarkToPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(2);
    const watermarkedBytes = await addWatermarkToPdfDocument(source, {
      text: "CONFIDENCIAL TESTE",
      angle: 45,
      opacity: 0.4,
      color: "red",
    });

    const doc = await PDFDocument.load(watermarkedBytes);
    expect(doc.getPageCount()).toBe(2);
    expect(watermarkedBytes.length).toBeGreaterThan(source.length);
  });

  it("insere numeração de páginas alinhada respeitando página inicial", async () => {
    const { addPageNumbersToPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(3);
    const numberedBytes = await addPageNumbersToPdfDocument(source, {
      position: "bottom-right",
      format: "pageXofY",
      startPage: 2,
    });

    const doc = await PDFDocument.load(numberedBytes);
    expect(doc.getPageCount()).toBe(3);
    expect(numberedBytes.length).toBeGreaterThan(source.length);
  });

  it("gera PDF pesquisável injetando camada de texto sobre o documento original", async () => {
    const { generateSearchablePdf } = await import("./pdf-engine");
    const source = await makePdf(1);
    const searchablePdf = await generateSearchablePdf(source, [
      {
        pageNumber: 1,
        text: "CONTRATO SOCIAL CLAUSULA PRIMEIRA",
        width: 200,
        height: 200,
        lines: [
          {
            text: "CONTRATO SOCIAL",
            bbox: { x0: 20, y0: 30, x1: 180, y1: 50 },
          },
          {
            text: "CLAUSULA PRIMEIRA",
            bbox: { x0: 20, y0: 60, x1: 180, y1: 80 },
          },
        ],
      },
    ]);

    const doc = await PDFDocument.load(searchablePdf);
    expect(doc.getPageCount()).toBe(1);
    expect(searchablePdf.length).toBeGreaterThan(source.length);
  });
});
