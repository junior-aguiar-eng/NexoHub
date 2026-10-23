import { readFileSync } from "node:fs";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { performBrowserOcr } from "./browser-ocr";

// Só o reconhecimento e a rasterização são substituídos; o PDF de saída é real.
vi.mock("tesseract.js", () => ({
  createWorker: async () => ({
    recognize: async (_image: unknown, _options: unknown, output?: { blocks?: boolean }) => ({
      data: {
        text: "Texto OCR",
        confidence: 95,
        blocks: output?.blocks
          ? [
              {
                paragraphs: [
                  {
                    lines: [
                      {
                        text: "Texto OCR",
                        confidence: 95,
                        bbox: { x0: 10, y0: 20, x1: 90, y1: 40 },
                      },
                    ],
                  },
                ],
              },
            ]
          : null,
      },
    }),
    terminate: async () => {},
  }),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async () => ({
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    }),
  }),
}));

describe("PDF pesquisável com Tesseract 7", () => {
  beforeEach(() => {
    vi.stubGlobal("Worker", class {});
    vi.stubGlobal("createImageBitmap", async () => ({ width: 100, height: 100 }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(["image", "pdf"] as const)(
    "inclui texto invisível nas páginas de entrada %s",
    async (kind) => {
      const source = await PDFDocument.create();
      source.addPage([100, 100]);
      source.addPage([100, 100]);
      const bytes =
        kind === "pdf" ? await source.save() : readFileSync("src/assets/nexohub-icon.png");
      const result = await performBrowserOcr(
        new Blob([bytes as unknown as BlobPart], {
          type: kind === "pdf" ? "application/pdf" : "image/png",
        }),
        { enhanceContrast: false },
      );
      if (!result.searchablePdfBytes) throw new Error("PDF pesquisável ausente.");
      const pdf = await PDFDocument.load(result.searchablePdfBytes);
      expect(pdf.getPageCount()).toBe(kind === "pdf" ? 2 : 1);
      for (const page of pdf.getPages()) {
        const streams = page.node.Contents();
        if (!(streams instanceof PDFArray)) throw new Error("Página sem camada de texto.");
        const content = streams
          .asArray()
          .map((ref) => {
            const stream = pdf.context.lookup(ref);
            if (!(stream instanceof PDFRawStream)) throw new Error("Conteúdo PDF inválido.");
            return new TextDecoder().decode(decodePDFRawStream(stream).decode());
          })
          .join("\n");
        expect(content.toUpperCase()).toContain("<546578746F204F4352> TJ");
      }
      expect(result.lines).toHaveLength(kind === "pdf" ? 2 : 1);
      expect(result.lines[0]?.confidence).toBe(0.95);
    },
  );
});
