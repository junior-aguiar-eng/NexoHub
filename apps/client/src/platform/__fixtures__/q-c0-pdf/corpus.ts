import { degrees, PDFDocument, StandardFonts } from "pdf-lib";

// Conteúdo autoral MPL-2.0; JPEG de controle fornecido pelo teste, sem rede.
export const basicPdfPages = [
  { text: "Página A - ação 00123", width: 320, height: 460, rotation: 0 },
  { text: "Página B - valor 1.234,56", width: 340, height: 480, rotation: 90 },
  { text: "Página C - certidão", width: 360, height: 500, rotation: 180 },
  { text: "Página D - fim", width: 380, height: 520, rotation: 270 },
] as const;

export async function createBasicPdfCorpus(jpeg: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Corpus autoral Q-C0 PDF estático");
  doc.setCreationDate(new Date("2026-01-01T00:00:00.000Z"));
  doc.setModificationDate(new Date("2026-01-01T00:00:00.000Z"));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const image = await doc.embedJpg(jpeg);
  for (const item of basicPdfPages) {
    const page = doc.addPage([item.width, item.height]);
    page.setCropBox(10, 20, item.width - 30, item.height - 50);
    page.setRotation(degrees(item.rotation));
    page.drawText(item.text, { x: 40, y: 300, size: 14, font });
    page.drawImage(image, { x: 50, y: 80, width: 100, height: 50 });
  }
  return doc.save();
}
