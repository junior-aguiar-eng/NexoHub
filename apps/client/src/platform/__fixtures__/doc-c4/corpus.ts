// SPDX-License-Identifier: MPL-2.0
// PDF autoral, sem dados pessoais, com campos compartilhados e geometrias distintas.
import { degrees, PDFDocument, PDFName, PDFNumber } from "pdf-lib";

export async function createPageSubsetCorpus() {
  const doc = await PDFDocument.create();
  const pages = Array.from({ length: 4 }, (_, i) => {
    const page = doc.addPage([400 + i * 20, 600 + i * 20]);
    page.setCropBox(10, 20, 360 + i * 20, 550 + i * 20);
    page.setRotation(degrees(i * 90));
    page.drawText(`PAGINA-${i + 1}`, { x: 30, y: 400 });
    return page;
  });
  const form = doc.getForm();
  const kept = form.createTextField("grupo.mantido");
  kept.setText("Valor preservado");
  kept.addToPage(pages[0], { x: 30, y: 300, width: 200, height: 24 });
  kept.addToPage(pages[2], { x: 30, y: 300, width: 200, height: 24 });
  const removed = form.createTextField("grupo.descartado");
  removed.setText("Valor descartado");
  removed.addToPage(pages[1], { x: 30, y: 300, width: 200, height: 24 });
  const radio = form.createRadioGroup("opcao");
  radio.addOptionToPage("A", pages[0], { x: 30, y: 250, width: 20, height: 20 });
  radio.addOptionToPage("B", pages[1], { x: 60, y: 250, width: 20, height: 20 });
  radio.select("B");
  const checked = form.createCheckBox("confirmado");
  checked.addToPage(pages[2], { x: 30, y: 250, width: 20, height: 20 });
  checked.check();
  form.updateFieldAppearances();
  // Geometria herdada deve sobreviver ao desligamento do Parent durante a cópia.
  const parent = pages[3].node.Parent();
  if (parent) {
    parent.set(PDFName.of("Rotate"), PDFNumber.of(270));
    pages[3].node.delete(PDFName.of("Rotate"));
  }
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}

export async function createLargePageCorpus(count = 500) {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= count; i++)
    doc.addPage([400, 600]).drawText(`PAGINA-${i}`, { x: 30, y: 400 });
  return doc.save({ useObjectStreams: true });
}
