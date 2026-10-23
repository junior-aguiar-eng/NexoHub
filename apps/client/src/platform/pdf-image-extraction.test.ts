import { readFileSync } from "node:fs";
import { unzlibSync } from "fflate";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { extractImagesFromPdf } from "./pdf-image-extraction";

vi.mock("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url", async () => {
  const { createRequire } = await import("node:module");
  const { pathToFileURL } = await import("node:url");
  return {
    default: pathToFileURL(
      createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ).href,
  };
});

function pngPixels(png: Uint8Array) {
  const chunks: Uint8Array[] = [];
  for (let offset = 8; offset < png.length; ) {
    const size = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
    if (String.fromCharCode(...png.subarray(offset + 4, offset + 8)) === "IDAT")
      chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const data = new Uint8Array(chunks.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of chunks) {
    data.set(part, offset);
    offset += part.length;
  }
  return Array.from(unzlibSync(data));
}

async function imageDocument() {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const image = doc.context.flateStream(new Uint8Array([255, 0, 0, 0, 255, 0]), {
    Type: "XObject",
    Subtype: "Image",
    Width: 2,
    Height: 1,
    ColorSpace: "DeviceRGB",
    BitsPerComponent: 8,
  });
  page.node.set(
    PDFName.of("Resources"),
    doc.context.obj({
      XObject: doc.context.register(doc.context.obj({ Im: doc.context.register(image) })),
    }),
  );
  return doc.save();
}

describe("extração real de imagens embutidas", () => {
  it("não inventa imagens em páginas sem imagens", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    expect(await extractImagesFromPdf(await doc.save())).toEqual([]);
  });
  it("respeita seleção de páginas vazia", async () => {
    expect(await extractImagesFromPdf(await imageDocument(), { selectedPages: [] })).toEqual([]);
  });
  it("extrai recursos indiretos Flate sem confundir tamanho da página", async () => {
    const images = await extractImagesFromPdf(await imageDocument(), { minWidth: 0, minHeight: 0 });
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ width: 2, height: 1, format: "png", pageNumber: 1 });
    expect(Array.from(images[0].data.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
  it("mantém as amostras RGB e opacidade nativas", async () => {
    const [image] = await extractImagesFromPdf(await imageDocument(), {
      minWidth: 0,
      minHeight: 0,
    });
    expect(pngPixels(image.data)).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 255]);
  });
  it("ignora imagens abaixo dos limites de largura ou altura", async () => {
    expect(await extractImagesFromPdf(await imageDocument())).toEqual([]);
    expect(
      await extractImagesFromPdf(await imageDocument(), { minWidth: 2, minHeight: 2 }),
    ).toEqual([]);
  });
  it("preserva bytes JPEG reais com Filter PDFArray", async () => {
    const original = new Uint8Array(readFileSync("src/platform/fixtures/extraction-red-2x1.jpg"));
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const image = await doc.embedJpg(original);
    page.drawImage(image);
    await image.embed();
    const stream = doc.context.lookup(image.ref);
    if (!(stream instanceof (await import("pdf-lib")).PDFRawStream))
      throw new Error("fixture inválida");
    stream.dict.set(PDFName.of("Filter"), doc.context.obj(["DCTDecode"]));
    const result = await extractImagesFromPdf(await doc.save(), { minWidth: 0, minHeight: 0 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ width: 2, height: 1, format: "jpeg" });
    expect(result[0].data).toEqual(original);
  });
  it("atravessa Forms com recursos indiretos e encerra ciclos sem duplicar", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const image = doc.context.register(
      doc.context.flateStream(new Uint8Array([30, 50, 70]), {
        Type: "XObject",
        Subtype: "Image",
        Width: 1,
        Height: 1,
        ColorSpace: "DeviceRGB",
        BitsPerComponent: 8,
      }),
    );
    const form = doc.context.flateStream("/Im Do", {
      Type: "XObject",
      Subtype: "Form",
      BBox: [0, 0, 1, 1],
    });
    const formRef = doc.context.register(form);
    form.dict.set(
      PDFName.of("Resources"),
      doc.context.obj({
        XObject: doc.context.register(doc.context.obj({ Im: image, Self: formRef })),
      }),
    );
    page.node.set(
      PDFName.of("Resources"),
      doc.context.obj({ XObject: { Form: formRef, Duplicate: formRef } }),
    );
    const images = await extractImagesFromPdf(await doc.save(), { minWidth: 0, minHeight: 0 });
    expect(images).toHaveLength(1);
    expect(pngPixels(images[0].data)).toEqual([0, 30, 50, 70, 255]);
  });
  it("incorpora SMask sem transformar a máscara em imagem independente", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const mask = doc.context.register(
      doc.context.flateStream(new Uint8Array([0, 128]), {
        Type: "XObject",
        Subtype: "Image",
        Width: 2,
        Height: 1,
        ColorSpace: "DeviceGray",
        BitsPerComponent: 8,
      }),
    );
    const image = doc.context.register(
      doc.context.flateStream(new Uint8Array([255, 0, 0, 0, 255, 0]), {
        Type: "XObject",
        Subtype: "Image",
        Width: 2,
        Height: 1,
        ColorSpace: "DeviceRGB",
        BitsPerComponent: 8,
        SMask: mask,
      }),
    );
    page.node.set(PDFName.of("Resources"), doc.context.obj({ XObject: { Im: image } }));
    const images = await extractImagesFromPdf(await doc.save(), { minWidth: 0, minHeight: 0 });
    expect(images).toHaveLength(1);
    expect(pngPixels(images[0].data)).toEqual([0, 255, 0, 0, 0, 0, 255, 0, 128]);
  });
  it("resolve Indexed por nome nos recursos e Decode invertido", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const palette = PDFString.of(String.fromCharCode(255, 0, 0, 0, 0, 255));
    const image = doc.context.register(
      doc.context.flateStream(new Uint8Array([0, 255]), {
        Type: "XObject",
        Subtype: "Image",
        Width: 2,
        Height: 1,
        ColorSpace: "Palette",
        BitsPerComponent: 8,
        Decode: [1, 0],
      }),
    );
    page.node.set(
      PDFName.of("Resources"),
      doc.context.obj({
        XObject: { Im: image },
        ColorSpace: { Palette: ["Indexed", "DeviceRGB", 1, palette] },
      }),
    );
    const [result] = await extractImagesFromPdf(await doc.save(), { minWidth: 0, minHeight: 0 });
    expect(pngPixels(result.data)).toEqual([0, 0, 0, 255, 255, 255, 0, 0, 255]);
  });
  it("não extrai páginas fora da seleção e rejeita bytes vazios", async () => {
    expect(
      await extractImagesFromPdf(await imageDocument(), {
        selectedPages: [2],
        minWidth: 0,
        minHeight: 0,
      }),
    ).toEqual([]);
    await expect(extractImagesFromPdf(new Uint8Array())).rejects.toThrow("DOCUMENTO_VAZIO");
  });
  it("decodifica JPEG com DecodeParms em vez de perder a interpretação de cores", async () => {
    const original = new Uint8Array(readFileSync("src/platform/fixtures/extraction-red-2x1.jpg"));
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const image = doc.context.register(
      doc.context.stream(original, {
        Type: "XObject",
        Subtype: "Image",
        Width: 2,
        Height: 1,
        ColorSpace: "DeviceRGB",
        BitsPerComponent: 8,
        Filter: "DCTDecode",
        DecodeParms: { ColorTransform: 0 },
      }),
    );
    page.node.set(PDFName.of("Resources"), doc.context.obj({ XObject: { Im: image } }));
    const [result] = await extractImagesFromPdf(await doc.save(), { minWidth: 0, minHeight: 0 });
    expect(result.format).toBe("png");
    expect(pngPixels(result.data)).toHaveLength(9);
  });
});
