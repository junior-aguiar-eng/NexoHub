import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extractPdfPagesToZipOrCombined, removePdfPages } from "./pdf-engine";

async function source() {
  const doc = await PDFDocument.create();
  const a = doc.addPage(),
    b = doc.addPage();
  const shared = doc.getForm().createTextField("compartilhado");
  shared.setText("Valor preservado");
  shared.addToPage(a);
  shared.addToPage(b);
  const discarded = doc.getForm().createTextField("descartado");
  discarded.setText("Nao exportar");
  discarded.addToPage(b);
  return doc.save();
}
async function verify(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(1);
  expect(
    doc
      .getForm()
      .getFields()
      .map((f) => f.getName()),
  ).toEqual(["compartilhado"]);
  expect(doc.getForm().getTextField("compartilhado").getText()).toBe("Valor preservado");
  expect(doc.getForm().getTextField("compartilhado").acroField.getWidgets()).toHaveLength(1);
  doc.getForm().getTextField("compartilhado").setText("Editavel");
  expect(
    (await PDFDocument.load(await doc.save())).getForm().getTextField("compartilhado").getText(),
  ).toBe("Editavel");
}
describe("preservação de formulários nas páginas restantes", () => {
  it("mantém apenas widgets e campos das páginas que permanecem", async () =>
    verify(await removePdfPages(await source(), [2])));
  it("preserva campos no PDF extraído", async () =>
    verify(
      (await extractPdfPagesToZipOrCombined(await source(), { pages: [1], mode: "single-pdf" }))
        .bytes,
    ));
  it("preserva campos em cada PDF do ZIP", async () => {
    const result = await extractPdfPagesToZipOrCombined(await source(), {
      pages: [1],
      mode: "zip-split",
    });
    await verify(Object.values(unzipSync(result.bytes))[0]);
  });
});
