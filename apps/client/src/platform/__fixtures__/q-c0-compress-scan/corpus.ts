import { PDFDocument } from "pdf-lib";
import { createAccessCorpus } from "../q-c0-access/corpus";

// Corpus autoral MPL-2.0. A imagem é gerada no Canvas real do navegador, sem rede.
export async function createScanImage(options: {
  width: number;
  height: number;
  mime: "image/png" | "image/jpeg" | "image/webp";
  noise?: boolean;
}): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas do corpus indisponível");
  const image = context.createImageData(options.width, options.height);
  let seed = 12345;
  const bands = [
    [200, 40, 20],
    [40, 180, 80],
    [30, 60, 210],
  ];
  for (let y = 0; y < options.height; y++) {
    for (let x = 0; x < options.width; x++) {
      const offset = (y * options.width + x) * 4;
      const band = bands[Math.min(2, Math.floor((x * 3) / options.width))];
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const variation = options.noise ? ((seed >>> 24) % 31) - 15 : 0;
      image.data[offset] = band[0] + variation;
      image.data[offset + 1] = band[1] + variation;
      image.data[offset + 2] = band[2] + variation;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.mime, 1));
  if (!blob) throw new Error("Codificador do corpus indisponível");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function createCompressionCorpus(image?: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await createAccessCorpus());
  if (image)
    doc.getPage(0).drawImage(await doc.embedJpg(image), {
      x: 30,
      y: 60,
      width: 300,
      height: 180,
    });
  return doc.save({ useObjectStreams: false });
}

export const scanBands = [
  [200, 40, 20],
  [40, 180, 80],
  [30, 60, 210],
] as const;
// Referência fixa da luminância e do limiar no corpus de três faixas iguais.
export const grayscaleBands = [
  [86, 86, 86],
  [127, 127, 127],
  [68, 68, 68],
] as const;
export const bwBands = [
  [0, 0, 0],
  [255, 255, 255],
  [0, 0, 0],
] as const;
export const contrastBands = [
  [255, 0, 0],
  [0, 255, 52],
  [0, 0, 255],
] as const;
