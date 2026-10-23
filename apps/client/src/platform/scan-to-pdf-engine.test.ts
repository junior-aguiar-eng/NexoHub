import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { applyScanFilter, compileScannedPagesToPdf } from "./scan-to-pdf-engine";

const minimalPng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("scan-to-pdf-engine", () => {
  it("compila páginas escaneadas em um documento PDF consolidado", async () => {
    const pages = [
      {
        id: "scan-1",
        imageBytes: minimalPng,
        mimeType: "image/png",
        filter: "original" as const,
      },
      {
        id: "scan-2",
        imageBytes: minimalPng,
        mimeType: "image/png",
        rotation: 90,
        filter: "bw" as const,
      },
    ];

    const pdfBytes = await compileScannedPagesToPdf(pages, {
      pageSize: "A4",
      margin: "small",
      orientation: "portrait",
    });

    expect(pdfBytes.length).toBeGreaterThan(500);
    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBe(2);

    const page2 = doc.getPage(1);
    expect(page2.getRotation().angle).toBe(90);
  });

  it("suporta modo fit para preservar tamanho exato das capturas", async () => {
    const pages = [
      {
        id: "scan-fit",
        imageBytes: minimalPng,
        mimeType: "image/png",
      },
    ];

    const pdfBytes = await compileScannedPagesToPdf(pages, {
      pageSize: "fit",
      margin: "none",
    });

    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPage(0);
    expect(page.getWidth()).toBe(1);
    expect(page.getHeight()).toBe(1);
  });

  it("rejeita compilação sem páginas digitalizadas", async () => {
    await expect(compileScannedPagesToPdf([])).rejects.toThrow("NENHUMA_PAGINA_DIGITALIZADA");
  });

  it("mantém os bytes inalterados quando filtro é original", async () => {
    const out = await applyScanFilter(minimalPng, "original");
    expect(out).toBe(minimalPng);
  });
});
