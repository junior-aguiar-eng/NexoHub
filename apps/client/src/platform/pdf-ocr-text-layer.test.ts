import { readFileSync } from "node:fs";
import {
  decodePDFRawStream,
  degrees,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  type PDFObject,
  PDFRawStream,
} from "pdf-lib";
import { getDocument, Util } from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrPageData } from "./pdf-engine";
import { addOcrTextLayer } from "./pdf-ocr-text-layer";

const fontBytes = readFileSync("public/standard_fonts/LiberationSans-Regular.ttf");

function decoded(stream: PDFRawStream): string {
  return new TextDecoder().decode(decodePDFRawStream(stream).decode());
}

function raw(doc: PDFDocument, object: PDFObject | undefined): PDFRawStream {
  const stream = doc.context.lookup(object);
  if (!(stream instanceof PDFRawStream)) throw new Error("Stream ausente");
  return stream;
}

function pageData(text = "A№漢😀e\u0301"): OcrPageData[] {
  return [
    {
      pageNumber: 1,
      text,
      width: 200,
      height: 100,
      lines: [{ text, bbox: { x0: 10, y0: 10, x1: 130, y1: 30 } }],
    },
  ];
}

describe("camada OCR Unicode invisível", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fontBytes, { status: 200 })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("incorpora fonte real e mapeia CIDs para Unicode, inclusive pares substitutos", async () => {
    const source = await PDFDocument.create();
    source.addPage([200, 100]).drawRectangle({ x: 1, y: 1, width: 10, height: 10 });
    await source.save();
    await addOcrTextLayer(source, pageData());
    const doc = await PDFDocument.load(await source.save());
    const fonts = doc.getPage(0).node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
    if (!fonts) throw new Error("Fontes ausentes");
    const font = fonts.lookup(fonts.keys()[0], PDFDict);
    expect(font.lookup(PDFName.of("Subtype"), PDFName).toString()).toBe("/Type0");
    const unicode = decoded(raw(doc, font.get(PDFName.of("ToUnicode"))));
    for (const mapping of [
      "<0002> <2116>",
      "<0003> <6f22>",
      "<0004> <d83dde00>",
      "<0006> <0301>",
    ]) {
      expect(unicode).toContain(mapping);
    }
    const cid = font.lookup(PDFName.of("DescendantFonts"), PDFArray).lookup(0, PDFDict);
    const descriptor = cid.lookup(PDFName.of("FontDescriptor"), PDFDict);
    const embeddedFont = raw(doc, descriptor.get(PDFName.of("FontFile2")));
    expect(decodePDFRawStream(embeddedFont).decode()).toEqual(new Uint8Array(fontBytes));
    const contents = doc.getPage(0).node.Contents();
    if (!(contents instanceof PDFArray)) throw new Error("Conteúdo ausente");
    const content = contents
      .asArray()
      .map((ref) => decoded(raw(doc, ref)))
      .join("\n");
    expect(content).toContain("3 Tr");
    expect(content).toContain("24 0 0 20 10 70 Tm");
    expect(content).toContain("<000100020003000400050006> Tj");
  });

  it.each([0, 90, 180, 270])(
    "salva camada com CropBox deslocado e rotação %s",
    async (rotation) => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([300, 200]);
      page.setCropBox(20, 30, 200, 100);
      page.setRotation(degrees(rotation));
      await addOcrTextLayer(doc, pageData());
      const result = await PDFDocument.load(await doc.save());
      expect(result.getPage(0).getCropBox()).toEqual({ x: 20, y: 30, width: 200, height: 100 });
      expect(result.getPage(0).getRotation().angle).toBe(rotation);
      const loadingTask = getDocument({ data: await doc.save(), disableFontFace: true });
      const parsed = await loadingTask.promise;
      try {
        const parsedPage = await parsed.getPage(1);
        const text = await parsedPage.getTextContent({ disableNormalization: true });
        const items = text.items.filter((item) => "str" in item);
        expect(items.map((item) => item.str).join("")).toBe(pageData()[0].text);
        const visualTransform = Util.transform(
          parsedPage.getViewport({ scale: 1 }).transform,
          items[0].transform,
        );
        const swapped = rotation === 90 || rotation === 270;
        expect(visualTransform[1]).toBeCloseTo(0);
        expect(visualTransform[2]).toBeCloseTo(0);
        expect(visualTransform[4]).toBeCloseTo(swapped ? 5 : 10);
        expect(visualTransform[5]).toBeCloseTo(swapped ? 60 : 30);
        expect(items[0].width).toBeCloseTo(swapped ? 60 : 120);
        expect(items[0].height).toBeCloseTo(swapped ? 40 : 20);
      } finally {
        await loadingTask.destroy();
      }
    },
  );

  it("não transforma falha de carregamento de fonte em PDF sem texto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    const doc = await PDFDocument.create();
    doc.addPage([200, 100]);
    await expect(addOcrTextLayer(doc, pageData())).rejects.toThrow("OCR_FONT_UNAVAILABLE");
  });

  it("não carrega fonte em páginas sem linhas reconhecidas", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 100]);
    await addOcrTextLayer(doc, [{ ...pageData()[0], text: "", lines: [] }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recusa caixas que extrapolam a imagem em vez de inserir texto desalinhado", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 100]);
    const data = pageData();
    data[0].lines[0].bbox = { x0: -1, y0: 10, x1: 201, y1: 30 };
    await expect(addOcrTextLayer(doc, data)).rejects.toThrow("OCR_INVALID_LINE_GEOMETRY");
  });

  it("aborta antes de baixar a fonte ou escrever uma camada", async () => {
    const controller = new AbortController();
    controller.abort();
    const doc = await PDFDocument.create();
    doc.addPage([200, 100]);
    await expect(
      addOcrTextLayer(doc, pageData(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
