import { readFileSync } from "node:fs";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { performBrowserOcr } from "./browser-ocr";

const recognition = vi.hoisted(() => ({ text: "Texto OCR № 漢字 😀 e\u0301" }));

// Só o reconhecimento e a rasterização são substituídos; o PDF de saída é real.
vi.mock("tesseract.js", () => ({
  createWorker: async () => ({
    recognize: async (_image: unknown, _options: unknown, output?: { blocks?: boolean }) => ({
      data: {
        text: recognition.text,
        confidence: 95,
        blocks: output?.blocks
          ? [
              {
                paragraphs: [
                  {
                    lines: [
                      {
                        text: recognition.text,
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
    recognition.text = "Texto OCR № 漢字 😀 e\u0301";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(readFileSync("public/standard_fonts/LiberationSans-Regular.ttf")),
      ),
    );
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

  it("rejeita PDF multipágina sem texto antes de inserir cabeçalhos", async () => {
    recognition.text = "";
    const source = await PDFDocument.create();
    source.addPage([100, 100]);
    source.addPage([100, 100]);
    await expect(
      performBrowserOcr(
        new Blob([(await source.save()) as unknown as BlobPart], { type: "application/pdf" }),
        { enhanceContrast: false },
      ),
    ).rejects.toThrow("OCR_NO_TEXT_FOUND");
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
        expect(content).toContain("3 Tr");
      }
      const loadingTask = getDocument({
        data: result.searchablePdfBytes.slice(),
        disableFontFace: true,
      });
      const parsed = await loadingTask.promise;
      try {
        for (let pageNumber = 1; pageNumber <= parsed.numPages; pageNumber++) {
          const text = await (await parsed.getPage(pageNumber)).getTextContent({
            disableNormalization: true,
          });
          expect(
            text.items
              .filter((item) => "str" in item)
              .map((item) => item.str)
              .join(""),
          ).toBe(recognition.text);
        }
      } finally {
        await loadingTask.destroy();
      }
      expect(result.lines).toHaveLength(kind === "pdf" ? 2 : 1);
      expect(result.lines[0]?.confidence).toBe(0.95);
    },
  );
});
