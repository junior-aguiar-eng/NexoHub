import { degrees, PDFDocument, StandardFonts } from "pdf-lib";

/** Corpus sintético autoral MPL-2.0, sem dados de terceiros. */
export const mdLeft = [
  "A leitura começa na coluna esquerda.",
  "Conteúdo contínuo, sem trocar a ordem.",
  "• Primeiro item da coluna esquerda.",
  "Conclusão do primeiro bloco integral.",
];
export const mdRight = [
  "A segunda coluna vem após a primeira.",
  "Este trecho conserva os valores 00123.",
  "1. Item numerado na coluna direita.",
  "Fecho completo do segundo bloco textual.",
];
export const mdTable = [
  ["Código", "Descrição", "Valor"],
  ["00123", "", "1.234,56"],
  ["123", "A | B <teste> & condição", "0,50"],
];

export async function createMdC1Corpus(rotation = 0): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date("2026-10-26T00:00:00Z"));
  pdf.setModificationDate(new Date("2026-10-26T00:00:00Z"));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([600, 800]);
  page.setRotation(degrees(rotation));
  page.drawText("Relatório de leitura em duas colunas", { x: 40, y: 760, size: 22, font: bold });
  // Ordem de pintura deliberadamente intercalada; leitura deve respeitar colunas.
  mdLeft.forEach((line, index) => {
    page.drawText(line, { x: 40, y: 700 - index * 22, size: 11, font });
    page.drawText(mdRight[index], { x: 330, y: 700 - index * 22, size: 11, font });
  });
  page.drawText("Notas ao final das duas colunas", { x: 40, y: 540, size: 18, font: bold });
  page.drawText("Este parágrafo abrange a página e sucede as duas colunas, sem omitir conteúdo.", {
    x: 40,
    y: 510,
    size: 11,
    font,
  });
  const table = pdf.addPage([600, 800]);
  table.drawText("Tabela de valores", { x: 40, y: 760, size: 22, font: bold });
  mdTable.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) table.drawText(value, { x: [40, 220, 440][c], y: 700 - r * 25, size: 11, font });
    });
  });
  const image = await pdf.embedPng(
    Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    ),
  );
  pdf.addPage([600, 800]).drawImage(image, { x: 40, y: 100, width: 500, height: 600 });
  pdf.addPage([600, 800]).drawText("Fim.", { x: 40, y: 700, size: 11, font });
  return pdf.save();
}
