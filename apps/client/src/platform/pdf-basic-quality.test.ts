import { readFileSync } from "node:fs";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { basicPdfPages, createBasicPdfCorpus } from "./__fixtures__/q-c0-pdf/corpus";
import {
  extractPdfSelectedPages,
  mergePdfDocuments,
  reorganizePdfDocument,
  rotatePdfDocument,
  splitPdfByInterval,
} from "./pdf-engine";

const jpeg = new Uint8Array(readFileSync("src/platform/fixtures/extraction-red-2x1.jpg"));

async function inspect(bytes: Uint8Array, indices: number[], turns = indices.map(() => 0)) {
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(indices.length);
  const task = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const reader = await task.promise;
  try {
    expect(reader.numPages).toBe(indices.length);
    for (const [i, source] of indices.entries()) {
      const expected = basicPdfPages[source],
        page = doc.getPage(i);
      expect(page.getMediaBox()).toEqual({
        x: 0,
        y: 0,
        width: expected.width,
        height: expected.height,
      });
      expect(page.getCropBox()).toEqual({
        x: 10,
        y: 20,
        width: expected.width - 30,
        height: expected.height - 50,
      });
      expect(page.getRotation().angle).toBe((expected.rotation + turns[i]) % 360);
      const readPage = await reader.getPage(i + 1);
      const content = await readPage.getTextContent();
      expect(content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ")).toBe(
        expected.text,
      );
      const xObjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      expect(xObjects?.keys()).toHaveLength(1);
      if (!xObjects) throw new Error("Imagem de controle ausente");
      const image = xObjects.lookup(xObjects.keys()[0]);
      if (!(image instanceof PDFRawStream)) throw new Error("Stream JPEG ausente");
      expect(image.dict.lookup(PDFName.of("Subtype"))?.toString()).toBe("/Image");
      expect(image.getContents()).toEqual(jpeg);
      readPage.cleanup();
    }
  } finally {
    await task.destroy();
  }
}

describe("Q-C0: conteúdo das operações básicas PDF", () => {
  it("junta documentos na ordem escolhida sem perder texto, JPEG ou geometria", async () => {
    const source = await createBasicPdfCorpus(jpeg),
      snapshot = source.slice();
    const first = await splitPdfByInterval(source, 1, 2);
    const second = await splitPdfByInterval(source, 3, 4);
    const firstSnapshot = first.slice(),
      secondSnapshot = second.slice();
    await inspect(await mergePdfDocuments([second, first]), [2, 3, 0, 1]);
    expect(source).toEqual(snapshot);
    expect(first).toEqual(firstSnapshot);
    expect(second).toEqual(secondSnapshot);
  });
  it("divide intervalo inclusivo e preserva seu conteúdo", async () => {
    const source = await createBasicPdfCorpus(jpeg),
      snapshot = source.slice();
    await inspect(await splitPdfByInterval(source, 2, 3), [1, 2]);
    expect(source).toEqual(snapshot);
  });
  it("organiza seleção descontínua, ordem e rotação por página", async () => {
    const source = await createBasicPdfCorpus(jpeg),
      snapshot = source.slice();
    await inspect(
      await reorganizePdfDocument(source, [
        { originalIndex: 4, rotation: 90 },
        { originalIndex: 2, rotation: 180 },
      ]),
      [3, 1],
      [90, 180],
    );
    expect(source).toEqual(snapshot);
  });
  it.each([-90, 90, 180, 270])(
    "gira todas as páginas em %s somando à rotação anterior",
    async (angle) => {
      const source = await createBasicPdfCorpus(jpeg),
        snapshot = source.slice();
      await inspect(
        await rotatePdfDocument(source, angle),
        [0, 1, 2, 3],
        [angle, angle, angle, angle],
      );
      expect(source).toEqual(snapshot);
    },
  );
  it("divide seleção descontínua na ordem solicitada", async () => {
    const source = await createBasicPdfCorpus(jpeg),
      snapshot = source.slice();
    await inspect(await extractPdfSelectedPages(source, [4, 2]), [3, 1]);
    expect(source).toEqual(snapshot);
  });
  it.each(
    [
      [],
      [{ originalIndex: 0, rotation: 0 }],
      [{ originalIndex: 5, rotation: 0 }],
      [{ originalIndex: 1.5, rotation: 0 }],
      [{ originalIndex: 1, rotation: 45 }],
      [{ originalIndex: 1, rotation: Number.NaN }],
      [{ originalIndex: 1, rotation: Number.POSITIVE_INFINITY }],
    ].map((order) => ({ order })),
  )("recusa seleção/rotação inválida sem gerar PDF (%j)", async ({ order }) => {
    const source = await createBasicPdfCorpus(jpeg),
      snapshot = source.slice();
    await expect(reorganizePdfDocument(source, order)).rejects.toThrow(
      "SELECAO_DE_PAGINAS_INVALIDA",
    );
    expect(source).toEqual(snapshot);
  });
});
