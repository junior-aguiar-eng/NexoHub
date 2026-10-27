import { readFileSync } from "node:fs";
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { getDocument, Util } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, it } from "vitest";
import { basicPdfPages, createBasicPdfCorpus } from "./__fixtures__/q-c0-pdf/corpus";
import { overlayReference as reference } from "./__fixtures__/q-c0-pdf/overlay";
import { cropPdfDocument, signPdfDocument } from "./pdf-crop-sign";
import { addPageNumbersToPdfDocument, addWatermarkToPdfDocument } from "./pdf-engine";

const jpeg = new Uint8Array(readFileSync("src/platform/fixtures/extraction-red-2x1.jpg"));
const signature = Uint8Array.from(atob(reference.signaturePngBase64), (char) => char.charCodeAt(0));

function streams(doc: PDFDocument, i: number) {
  const contents = doc.getPage(i).node.Contents();
  if (!(contents instanceof PDFArray)) throw new Error("Streams de controle ausentes");
  return contents.asArray().map((ref) => {
    const value = doc.context.lookup(ref);
    if (!(value instanceof PDFRawStream)) throw new Error("Stream inválido");
    return new TextDecoder().decode(decodePDFRawStream(value).decode());
  });
}

async function preserve(source: Uint8Array, result: Uint8Array, cropped: number[] = []) {
  const before = await PDFDocument.load(source),
    after = await PDFDocument.load(result);
  expect(after.getPageCount()).toBe(4);
  for (let i = 0; i < 4; i++) {
    const oldPage = before.getPage(i),
      page = after.getPage(i);
    const expected = cropped.includes(i) ? reference.croppedBoxes[i] : oldPage.getCropBox();
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(page.getCropBox()[key]).toBeCloseTo(expected[key], 6);
      expect(page.getMediaBox()[key]).toBeCloseTo(
        cropped.includes(i) ? expected[key] : oldPage.getMediaBox()[key],
        6,
      );
    }
    expect(page.getRotation().angle).toBe(oldPage.getRotation().angle);
    const content = streams(after, i).join("\n");
    for (const original of streams(before, i)) expect(content).toContain(original);
    const resources = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
    if (!resources) throw new Error("Imagem original ausente");
    const images = resources
      .keys()
      .map((key) => resources.lookup(key))
      .filter((value) => value instanceof PDFRawStream);
    expect(
      images.some(
        (image) =>
          image.getContents().length === jpeg.length &&
          image.getContents().every((byte, j) => byte === jpeg[j]),
      ),
    ).toBe(true);
  }
}

async function labels(
  bytes: Uint8Array,
  expected: (page: number) => string[],
  position?: string,
  signaturePages?: readonly number[],
) {
  const imageDocument = signaturePages ? await PDFDocument.load(bytes) : undefined;
  const task = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const doc = await task.promise;
  try {
    for (let i = 0; i < 4; i++) {
      if (imageDocument && signaturePages) {
        const resources = imageDocument
          .getPage(i)
          .node.Resources()
          ?.lookup(PDFName.of("XObject"), PDFDict);
        if (!resources) throw new Error("Recursos de imagem ausentes");
        const painted = [
          ...streams(imageDocument, i)
            .join("\n")
            .matchAll(/\/([A-Za-z0-9_-]+)\s+Do\b/g),
        ].map((match) => PDFName.of(match[1]));
        const selected = signaturePages.includes(i);
        // O corpus tem um JPEG 2×1 por página; o selo PNG 40×10 deve ser desenhado só nas escolhidas.
        expect(painted).toHaveLength(selected ? 2 : 1);
        const signaturePaints = painted.filter((name) => {
          const object = resources.lookup(name);
          return (
            object instanceof PDFRawStream &&
            object.dict.lookup(PDFName.of("Subtype"))?.toString() === "/Image" &&
            object.dict.lookup(PDFName.of("Width"))?.toString() === "40" &&
            object.dict.lookup(PDFName.of("Height"))?.toString() === "10"
          );
        });
        expect(signaturePaints).toHaveLength(selected ? 1 : 0);
      }
      const page = await doc.getPage(i + 1),
        view = page.getViewport({ scale: 1 });
      const items = (await page.getTextContent()).items.filter((item) => "str" in item);
      expect(items.some((item) => item.str === basicPdfPages[i].text)).toBe(true);
      const additions = items.filter(
        (item) => item.str.trim() && item.str !== basicPdfPages[i].text,
      );
      expect(additions.map((item) => item.str).sort()).toEqual(expected(i).sort());
      for (const item of additions) {
        const visual = Util.transform(view.transform, item.transform);
        expect(visual[1]).toBeCloseTo(0, 5);
        expect(visual[2]).toBeCloseTo(0, 5);
        expect(visual[4]).toBeGreaterThanOrEqual(0);
        expect(visual[4] + item.width).toBeLessThanOrEqual(view.width + 0.01);
        expect(visual[5]).toBeGreaterThanOrEqual(0);
        expect(visual[5]).toBeLessThanOrEqual(view.height);
        if (position === "stamp") {
          expect(Math.abs(visual[4] + item.width / 2 - view.width / 2)).toBeLessThanOrEqual(
            reference.textAlignmentTolerance,
          );
          expect(Math.abs(visual[0])).toBeLessThan(200);
        } else if (position) {
          const expectedX = position.endsWith("left")
            ? reference.numberMargin
            : position.endsWith("right")
              ? view.width - reference.numberMargin - item.width
              : (view.width - item.width) / 2;
          expect(Math.abs(visual[4] - expectedX)).toBeLessThanOrEqual(
            reference.textAlignmentTolerance,
          );
          expect(visual[5]).toBeCloseTo(
            position.startsWith("top")
              ? reference.numberTopBaseline
              : view.height - reference.numberMargin,
            5,
          );
        }
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
}

it("recorta só páginas selecionadas e conserva streams/imagem mesmo quando conteúdo fica oculto", async () => {
  const source = await createBasicPdfCorpus(jpeg),
    snapshot = source.slice();
  await preserve(
    source,
    await cropPdfDocument(source, {
      margins: reference.cropMargins,
      scope: "selected",
      selectedPages: [2, 4],
    }),
    [1, 3],
  );
  expect(source).toEqual(snapshot);
});
it("recorta as quatro rotações conforme as caixas explícitas de referência", async () => {
  const source = await createBasicPdfCorpus(jpeg),
    snapshot = source.slice();
  await preserve(
    source,
    await cropPdfDocument(source, { margins: reference.cropMargins }),
    [0, 1, 2, 3],
  );
  expect(source).toEqual(snapshot);
});
it("marca d'água cabe na área visível sem perder conteúdo original nas quatro rotações", async () => {
  const source = await createBasicPdfCorpus(jpeg),
    snapshot = source.slice();
  const result = await addWatermarkToPdfDocument(source, {
    text: reference.stamp,
    angle: 0,
    fontSize: 200,
  });
  await preserve(source, result);
  await labels(result, () => [reference.stamp], "stamp");
  expect(source).toEqual(snapshot);
});
it.each([
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-left",
  "top-right",
] as const)(
  "numeração %s conserva texto/imagem e respeita início na página 2",
  async (position) => {
    const source = await createBasicPdfCorpus(jpeg),
      snapshot = source.slice();
    const result = await addPageNumbersToPdfDocument(source, { position, startPage: 2 });
    await preserve(source, result);
    await labels(result, (i) => (i === 0 ? [] : [`Página ${i + 1} de 4`]), position);
    expect(source).toEqual(snapshot);
  },
);
it.each(["first", "last", "all", 2] as const)(
  "assinatura visual em %s mantém nome/data na área visível e preserva as outras páginas",
  async (target) => {
    const source = await createBasicPdfCorpus(jpeg),
      snapshot = source.slice();
    const result = await signPdfDocument(source, {
      signatureImageBytes: signature,
      signerName: reference.signer,
      includeDate: true,
      dateText: reference.date,
      placement: { page: target, xPercent: 15, yPercent: 10, widthPercent: 60, heightPercent: 25 },
    });
    await preserve(source, result);
    const selected =
      target === "all"
        ? [0, 1, 2, 3]
        : target === "first"
          ? [0]
          : target === "last"
            ? [3]
            : [target - 1];
    await labels(
      result,
      (i) =>
        selected.includes(i)
          ? [`Assinado por: ${reference.signer}`, `Data: ${reference.date}`]
          : [],
      undefined,
      selected,
    );
    expect(source).toEqual(snapshot);
  },
);
it("os oráculos recusam original sem carimbo e alteração de caixa inesperada", async () => {
  const source = await createBasicPdfCorpus(jpeg);
  await expect(labels(source, () => [reference.stamp])).rejects.toThrow();
  const modified = await PDFDocument.load(source);
  modified.getPage(0).setCropBox(20, 20, 200, 200);
  await expect(preserve(source, await modified.save())).rejects.toThrow();
});
it.each(["ausente", "pagina-errada"])(
  "o oráculo recusa imagem de assinatura %s mesmo com textos corretos",
  async (kind) => {
    const source = await createBasicPdfCorpus(jpeg);
    const placement = {
      page: "first" as const,
      xPercent: 15,
      yPercent: 10,
      widthPercent: 60,
      heightPercent: 25,
    };
    let result = await signPdfDocument(source, {
      signerName: reference.signer,
      includeDate: true,
      dateText: reference.date,
      placement,
    });
    if (kind === "pagina-errada")
      result = await signPdfDocument(result, {
        signatureImageBytes: signature,
        placement: { ...placement, page: "last" },
      });
    await expect(
      labels(
        result,
        (i) => (i === 0 ? [`Assinado por: ${reference.signer}`, `Data: ${reference.date}`] : []),
        undefined,
        [0],
      ),
    ).rejects.toThrow();
  },
);
it("o oráculo recusa numeração com conteúdo correto na posição errada", async () => {
  const source = await createBasicPdfCorpus(jpeg);
  const result = await addPageNumbersToPdfDocument(source, {
    position: "bottom-left",
    startPage: 2,
  });
  await expect(
    labels(result, (i) => (i === 0 ? [] : [`Página ${i + 1} de 4`]), "top-right"),
  ).rejects.toThrow();
});
