import { readFileSync } from "node:fs";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { expect, it, vi } from "vitest";
import { createEmbeddedRasterCorpus } from "./__fixtures__/q-c0-raster/corpus";
import { convertImagesToPdfDocument } from "./pdf-engine";
import { extractImagesFromPdf } from "./pdf-image-extraction";

vi.mock("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url", async () => {
  const { createRequire } = await import("node:module"),
    { pathToFileURL } = await import("node:url");
  return {
    default: pathToFileURL(
      createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ).href,
  };
});
const jpeg = new Uint8Array(readFileSync("src/platform/fixtures/extraction-red-2x1.jpg"));

it.each(["none", "small", "big"] as const)(
  "imagem→PDF fit com margem %s preserva JPEG e original",
  async (margin) => {
    const snapshot = jpeg.slice(),
      space = { none: 0, small: 20, big: 40 }[margin];
    const doc = await PDFDocument.load(
      await convertImagesToPdfDocument([{ bytes: jpeg, mimeType: "image/jpeg" }], {
        pageSize: "fit",
        margin,
      }),
    );
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 2 + space * 2, height: 1 + space * 2 });
    const resources = doc.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
    if (!resources) throw new Error("JPEG ausente");
    const image = resources.lookup(resources.keys()[0]);
    expect(image).toBeInstanceOf(PDFRawStream);
    if (!(image instanceof PDFRawStream)) throw new Error("JPEG inválido");
    expect(image.getContents()).toEqual(jpeg);
    expect(jpeg).toEqual(snapshot);
  },
);
it("extrai imagens por página, incorpora alpha e não duplica a máscara", async () => {
  const source = await createEmbeddedRasterCorpus(jpeg),
    snapshot = source.slice();
  const result = await extractImagesFromPdf(source, { minWidth: 0, minHeight: 0 });
  expect(
    result.map((image) => [image.pageNumber, image.width, image.height, image.format]),
  ).toEqual([
    [1, 32, 16, "png"],
    [2, 2, 1, "jpeg"],
    [3, 32, 16, "png"],
  ]);
  expect(result[1].data).toEqual(jpeg);
  expect(result[0].data).toEqual(result[2].data);
  expect(new Set(result.map((image) => image.id)).size).toBe(3);
  expect(source).toEqual(snapshot);
});
it("filtro padrão ignora JPEG pequeno e seleção preserva somente a página escolhida", async () => {
  const source = await createEmbeddedRasterCorpus(jpeg),
    snapshot = source.slice();
  expect((await extractImagesFromPdf(source)).map((image) => image.pageNumber)).toEqual([1, 3]);
  const selected = await extractImagesFromPdf(source, {
    minWidth: 0,
    minHeight: 0,
    selectedPages: [2],
  });
  expect(selected).toHaveLength(1);
  const [image] = selected;
  expect(image.data).toEqual(jpeg);
  expect(image.pageNumber).toBe(2);
  expect(source).toEqual(snapshot);
});
it("entrada vazia ou incompatível não vira PDF de sucesso", async () => {
  await expect(convertImagesToPdfDocument([])).rejects.toThrow();
  await expect(
    convertImagesToPdfDocument([{ bytes: new Uint8Array([1, 2, 3]) }]),
  ).rejects.toThrow();
  await expect(
    convertImagesToPdfDocument([
      { bytes: jpeg, mimeType: "image/jpeg" },
      { bytes: new Uint8Array([1, 2, 3]) },
    ]),
  ).rejects.toThrow();
});
