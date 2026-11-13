// @vitest-environment node
import { JpegEmbedder, PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { convertPdfPagesToJpgImages } from "./pdf-engine";

async function makeMultiPagePdf(pages: number, width = 200, height = 100): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage([width, height]);
    page.drawText(`Pagina ${i + 1}`, { x: 20, y: 50, size: 14 });
  }
  return pdf.save();
}

describe("convertPdfPagesToJpgImages (DPI e seleção de páginas)", () => {
  it("filtra apenas as páginas solicitadas em selectedPages mantendo ordem e número", async () => {
    const source = await makeMultiPagePdf(4);
    const images = await convertPdfPagesToJpgImages(source, {
      selectedPages: [2, 4],
    });
    expect(images).toHaveLength(2);
    expect(images[0].pageNumber).toBe(2);
    expect(images[0].name).toBe("pagina_2.jpg");
    expect(images[1].pageNumber).toBe(4);
    expect(images[1].name).toBe("pagina_4.jpg");
  });

  it("escala as dimensões da imagem gerada proporcionalmente ao DPI configurado (72 vs 300)", async () => {
    const source = await makeMultiPagePdf(1, 200, 100);
    const [lowDpi] = await convertPdfPagesToJpgImages(source, { scale: 72 / 72 });
    const [highDpi] = await convertPdfPagesToJpgImages(source, { scale: 300 / 72 });

    const lowHeader = await JpegEmbedder.for(lowDpi.data);
    const highHeader = await JpegEmbedder.for(highDpi.data);

    expect(lowHeader.width).toBe(200);
    expect(lowHeader.height).toBe(100);
    expect(highHeader.width).toBeGreaterThan(800);
    expect(highHeader.height).toBeGreaterThan(400);
  });
});
