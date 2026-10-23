import { decodePDFRawStream, degrees, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { getDocument, Util } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { cropPdfDocument, signPdfDocument } from "./pdf-crop-sign";

async function fixture(rotation = 0) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.setCropBox(20, 30, 200, 100);
  page.setRotation(degrees(rotation));
  page.drawText("ORIGINAL", { x: 50, y: 65, size: 10 });
  return doc.save();
}

const margins = { top: 10, bottom: 20, left: 5, right: 15 };
const placement = { xPercent: 10, yPercent: 5, widthPercent: 70, heightPercent: 30 };

function content(doc: PDFDocument) {
  const streams = doc.getPage(0).node.Contents();
  if (!(streams instanceof PDFArray)) throw new Error("Sem streams");
  return streams
    .asArray()
    .map((ref) => {
      const stream = doc.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) throw new Error("Sem stream");
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    })
    .join("\n");
}

describe("recorte em coordenadas visuais", () => {
  it.each([
    [0, { x: 30, y: 50, width: 160, height: 70 }],
    [90, { x: 40, y: 35, width: 140, height: 80 }],
    [180, { x: 50, y: 40, width: 160, height: 70 }],
    [270, { x: 60, y: 45, width: 140, height: 80 }],
  ])("respeita margens visuais, CropBox e Rotate %s", async (angle, expected) => {
    const result = await PDFDocument.load(await cropPdfDocument(await fixture(angle), { margins }));
    expect(result.getPage(0).getCropBox()).toEqual(expected);
    expect(result.getPage(0).getMediaBox()).toEqual(expected);
    expect(content(result)).toContain("4F524947494E414C");
  });

  it.each([NaN, Infinity, -Infinity])("recusa margem não finita %s", async (left) => {
    await expect(
      cropPdfDocument(await fixture(), { margins: { ...margins, left } }),
    ).rejects.toThrow("MARGEM_INVALIDA");
  });
  it.each([[], [0], [2], [1.5], [NaN], [1, 2]])(
    "recusa seleção inválida sem recortar tudo: %s",
    async (...pages) => {
      const selectedPages = Array.isArray(pages[0]) ? pages[0] : (pages as number[]);
      await expect(
        cropPdfDocument(await fixture(), { margins, scope: "selected", selectedPages }),
      ).rejects.toThrow("PAGINAS_INVALIDAS");
    },
  );
  it("preserva páginas fora da seleção", async () => {
    const doc = await PDFDocument.load(await fixture(90));
    doc.addPage([100, 100]);
    const output = await PDFDocument.load(
      await cropPdfDocument(await doc.save(), { margins, scope: "selected", selectedPages: [2] }),
    );
    expect(output.getPage(0).getCropBox()).toEqual({ x: 20, y: 30, width: 200, height: 100 });
    expect(output.getPage(1).getCropBox()).toEqual({ x: 5, y: 20, width: 80, height: 70 });
  });
});

describe("assinatura visual em PDF vetorial", () => {
  it.each([0, 90, 180, 270])(
    "mantém metadados visíveis e horizontais com CropBox e Rotate %s",
    async (angle) => {
      const bytes = await signPdfDocument(await fixture(angle), {
        signerName: "Ana Pereira",
        includeDate: true,
        dateText: "23/10/2026",
        placement,
      });
      const task = getDocument({ data: bytes, disableFontFace: true, useSystemFonts: true });
      const doc = await task.promise;
      try {
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const text = await page.getTextContent();
        const items = text.items.filter((item) => "str" in item);
        expect(items.some((item) => item.str === "ORIGINAL")).toBe(true);
        const signature = items.filter(
          (item) => item.str.includes("Ana Pereira") || item.str.includes("23/10/2026"),
        );
        expect(signature).toHaveLength(2);
        for (const item of signature) {
          const visual = Util.transform(viewport.transform, item.transform);
          expect(visual[1]).toBeCloseTo(0);
          expect(visual[2]).toBeCloseTo(0);
          expect(visual[4]).toBeGreaterThanOrEqual(0);
          expect(visual[4] + item.width).toBeLessThanOrEqual(viewport.width + 0.01);
          expect(visual[5]).toBeGreaterThanOrEqual(item.height * 0.5);
          expect(visual[5]).toBeLessThanOrEqual(viewport.height);
        }
      } finally {
        await task.destroy();
      }
    },
  );
  it.each([NaN, Infinity, -1, 101])("recusa posição inválida %s", async (xPercent) => {
    await expect(
      signPdfDocument(await fixture(), {
        signerName: "Ana",
        placement: { ...placement, xPercent },
      }),
    ).rejects.toThrow("POSICAO_ASSINATURA_INVALIDA");
  });
  it.each([0, 2, 1.5, NaN])("recusa página inválida %s", async (page) => {
    await expect(
      signPdfDocument(await fixture(), { signerName: "Ana", placement: { ...placement, page } }),
    ).rejects.toThrow("PAGINAS_INVALIDAS");
  });
});

it.each([0, 90, 180, 270])(
  "mantém proporção 4:1 da imagem e conteúdo vetorial em Rotate %s",
  async (angle) => {
    const image = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAACgAAAAKCAIAAABJ+IsHAAAAGklEQVR4nGP4z8AwIGhgbB21eNTiUYuHhcUAaRuOgDO6NfgAAAAASUVORK5CYII=",
      ),
      (char) => char.charCodeAt(0),
    );
    const output = await PDFDocument.load(
      await signPdfDocument(await fixture(angle), { signatureImageBytes: image, placement }),
    );
    const operators = content(output);
    expect(operators).toContain("4F524947494E414C");
    const matrices = Array.from(
      operators.matchAll(/([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g),
    );
    expect(
      matrices.some(
        (matrix) =>
          Number(matrix[1]) > 1 && Math.abs(Number(matrix[1]) / Number(matrix[2]) - 4) < 0.001,
      ),
    ).toBe(true);
    expect(operators.match(/ Do/g)).toHaveLength(1);
  },
);
