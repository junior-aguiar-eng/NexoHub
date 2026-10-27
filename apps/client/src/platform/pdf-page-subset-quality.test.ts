import { unzipSync } from "fflate";
import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createPageSubsetCorpus } from "./__fixtures__/doc-c4/corpus";
import { extractPdfPagesToZipOrCombined, removePdfPages } from "./pdf-engine";

async function inspect(bytes: Uint8Array, originalPages: number[]) {
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(originalPages.length);
  for (const [index, original] of originalPages.entries()) {
    const page = doc.getPage(index);
    expect(page.getCropBox()).toEqual({
      x: 10,
      y: 20,
      width: 360 + (original - 1) * 20,
      height: 550 + (original - 1) * 20,
    });
    expect(page.getRotation().angle).toBe((original - 1) * 90);
  }
  const pageRefs = new Set(doc.getPages().map((page) => page.ref.toString()));
  for (const field of doc.getForm().getFields()) {
    expect(field.acroField.getWidgets().length).toBeGreaterThan(0);
    for (const widget of field.acroField.getWidgets()) {
      const pageRef = widget.dict.get(PDFName.of("P"));
      expect(pageRef).toBeInstanceOf(PDFRef);
      expect(pageRefs.has(String(pageRef))).toBe(true);
    }
  }
  return doc;
}

describe("DOC-C4: subconjuntos com campos e geometria", () => {
  it.each(["signed", "xfa"])(
    "recusa %s antes de produzir subconjunto incompatível",
    async (kind) => {
      const doc = await PDFDocument.create();
      doc.addPage();
      doc.addPage();
      const code = kind === "signed" ? "PDF_ASSINADO_NAO_SUPORTADO" : "PDF_XFA_NAO_SUPORTADO";
      if (kind === "signed") doc.context.register(doc.context.obj({ ByteRange: [0, 1, 2, 3] }));
      else doc.getForm().acroForm.dict.set(PDFName.of("XFA"), doc.context.obj("controle"));
      const bytes = await doc.save({ updateFieldAppearances: false });
      await expect(removePdfPages(bytes, [2])).rejects.toThrow(code);
      for (const mode of ["single-pdf", "zip-split"] as const)
        await expect(extractPdfPagesToZipOrCombined(bytes, { pages: [1], mode })).rejects.toThrow(
          code,
        );
    },
  );
  it("remove páginas sem perder valores e remove campos exclusivos das descartadas", async () => {
    const bytes = await createPageSubsetCorpus(),
      original = bytes.slice();
    const doc = await inspect(await removePdfPages(bytes, [2, 4]), [1, 3]);
    expect(doc.getForm().getTextField("grupo.mantido").getText()).toBe("Valor preservado");
    expect(doc.getForm().getCheckBox("confirmado").isChecked()).toBe(true);
    expect(doc.getForm().getFieldMaybe("grupo.descartado")).toBeUndefined();
    expect(doc.getForm().getRadioGroup("opcao").getOptions()).toEqual(["A"]);
    expect(doc.getForm().getRadioGroup("opcao").getSelected()).toBeUndefined();
    expect(bytes).toEqual(original);
  });

  it("extrai seleção descontínua na ordem solicitada e mantém campos compartilhados", async () => {
    const bytes = await createPageSubsetCorpus();
    const result = await extractPdfPagesToZipOrCombined(bytes, {
      pages: [3, 1, 4],
      mode: "single-pdf",
    });
    const doc = await inspect(result.bytes, [3, 1, 4]);
    expect(doc.getForm().getTextField("grupo.mantido").getText()).toBe("Valor preservado");
    expect(doc.getForm().getTextField("grupo.mantido").acroField.getWidgets()).toHaveLength(2);
  });

  it("mantém a opção selecionada quando seu widget sobrevive e os anteriores são removidos", async () => {
    const source = await createPageSubsetCorpus();
    const result = await extractPdfPagesToZipOrCombined(source, { pages: [2], mode: "single-pdf" });
    const doc = await inspect(result.bytes, [2]);
    expect(doc.getForm().getRadioGroup("opcao").getOptions()).toEqual(["B"]);
    expect(doc.getForm().getRadioGroup("opcao").getSelected()).toBe("B");
  });

  it("cada PDF do ZIP mantém somente seus campos e a geometria original", async () => {
    const bytes = await createPageSubsetCorpus();
    const result = await extractPdfPagesToZipOrCombined(bytes, {
      pages: [3, 1, 4],
      mode: "zip-split",
      baseName: "autoral",
    });
    const files = unzipSync(result.bytes);
    expect(Object.keys(files)).toEqual([
      "autoral_pagina_3.pdf",
      "autoral_pagina_1.pdf",
      "autoral_pagina_4.pdf",
    ]);
    for (const original of [3, 1, 4]) {
      const doc = await inspect(files[`autoral_pagina_${original}.pdf`], [original]);
      expect(doc.getForm().getFieldMaybe("grupo.descartado")).toBeUndefined();
      if (original === 4) expect(doc.getForm().getFields()).toHaveLength(0);
    }
  });
});
