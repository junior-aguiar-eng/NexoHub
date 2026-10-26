import { degrees, PDFDocument, StandardFonts } from "pdf-lib";

/** Corpus sintético do NexoHub, MPL-2.0. Sem dados reais ou conteúdo de terceiros. */
export const xlC1Expected = [
  [
    ["Código", "Produto", "Valor"],
    ["00123", "", "1.234,56"],
    ["123", "Teclado", "15.50"],
  ],
  [
    ["Código", "Produto", "Valor"],
    ["00456", "Monitor", "2.000,00"],
    ["00789", "", "0,50"],
  ],
];
export const xlC1Region = { left: 0, top: 0.1, width: 1, height: 0.2 } as const;
export const xlC1Separators = [0.3, 0.62] as const;

export async function createXlC1Corpus(borders = false, rotation = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setCreationDate(new Date("2026-10-26T00:00:00Z"));
  doc.setModificationDate(new Date("2026-10-26T00:00:00Z"));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const rows of xlC1Expected) {
    const page = doc.addPage([600, 800]);
    page.setRotation(degrees(rotation));
    page.drawText("Inventário com cabeçalho abrangente", { x: 40, y: 770, size: 18, font });
    rows.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) page.drawText(value, { x: [40, 210, 400][c], y: 700 - r * 30, size: 11, font });
      });
    });
    page.drawText("Rodapé fora da seleção", { x: 40, y: 30, size: 11, font });
    if (borders) {
      for (const y of [790, 715, 685, 655, 625])
        page.drawLine({ start: { x: 30, y }, end: { x: 560, y }, thickness: 0.5 });
      for (const x of [30, 180, 372, 560])
        page.drawLine({
          start: { x, y: 625 },
          end: { x, y: x === 30 || x === 560 ? 790 : 715 },
          thickness: 0.5,
        });
    }
  }
  return doc.save();
}
