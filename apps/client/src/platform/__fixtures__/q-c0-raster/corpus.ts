import { degrees, PDFDocument, PDFName, rgb } from "pdf-lib";

// Conteúdo sintético autoral MPL-2.0, sem documento ou fotografia de terceiro.
export const rasterReference = {
  width: 32,
  height: 16,
  alphaProbes: [
    [0, 0, 0, 0],
    [0, 255, 0, 128],
    [0, 0, 255, 255],
  ],
  opaqueProbes: [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
  ],
  whiteCompositeProbes: [
    [255, 255, 255, 255],
    [127, 255, 127, 255],
    [0, 0, 255, 255],
  ],
  jpegTolerance: 8,
} as const;

function dates(doc: PDFDocument) {
  doc.setCreationDate(new Date("2026-01-01T00:00:00Z"));
  doc.setModificationDate(new Date("2026-01-01T00:00:00Z"));
}

export async function createVectorRasterCorpus(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  dates(doc);
  for (const angle of [0, 90, 180, 270]) {
    const page = doc.addPage([144, 72]);
    page.drawRectangle({ x: 0, y: 0, width: 72, height: 72, color: rgb(1, 0, 0) });
    page.drawRectangle({ x: 72, y: 0, width: 72, height: 72, color: rgb(0, 0, 1) });
    if (angle !== 0) {
      page.setCropBox(24, 12, 96, 48);
      page.setRotation(degrees(angle));
    }
  }
  return doc.save();
}

export async function createEmbeddedRasterCorpus(jpeg: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  dates(doc);
  const samples = new Uint8Array(32 * 16 * 3),
    alpha = new Uint8Array(32 * 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 32; x++) {
      const band = x < 11 ? 0 : x < 22 ? 1 : 2,
        i = y * 32 + x;
      samples[i * 3 + band] = 255;
      alpha[i] = [0, 128, 255][band];
    }
  const mask = doc.context.register(
    doc.context.flateStream(alpha, {
      Type: "XObject",
      Subtype: "Image",
      Width: 32,
      Height: 16,
      ColorSpace: "DeviceGray",
      BitsPerComponent: 8,
    }),
  );
  const image = doc.context.register(
    doc.context.flateStream(samples, {
      Type: "XObject",
      Subtype: "Image",
      Width: 32,
      Height: 16,
      ColorSpace: "DeviceRGB",
      BitsPerComponent: 8,
      SMask: mask,
    }),
  );
  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([144, 72]);
    if (i === 1) page.drawImage(await doc.embedJpg(jpeg), { x: 0, y: 0, width: 144, height: 72 });
    else {
      page.node.set(PDFName.of("Resources"), doc.context.obj({ XObject: { Raster: image } }));
      page.node.set(
        PDFName.of("Contents"),
        doc.context.register(doc.context.flateStream("q 144 0 0 72 0 0 cm /Raster Do Q")),
      );
    }
  }
  return doc.save();
}
