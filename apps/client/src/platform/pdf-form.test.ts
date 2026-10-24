import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  type FormFieldValue,
  fillPdfForm,
  getPdfFormRevisionBytes,
  inspectPdfFormFields,
  matchesPdfFormRevision,
  preparePdfFormRevision,
} from "./pdf-form";

async function fixture() {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const form = doc.getForm();
  form.createTextField("nome").addToPage(page, { x: 20, y: 700, width: 150, height: 20 });
  const locked = form.createTextField("fixo");
  locked.setText("Original");
  locked.enableReadOnly();
  locked.addToPage(page, { x: 20, y: 650, width: 150, height: 20 });
  form.createCheckBox("aceite").addToPage(page, { x: 20, y: 600, width: 20, height: 20 });
  const dropdown = form.createDropdown("pais");
  dropdown.setOptions(["Brasil", "Portugal"]);
  dropdown.addToPage(page, { x: 20, y: 550, width: 150, height: 20 });
  const radio = form.createRadioGroup("plano");
  radio.addOptionToPage("A", page, { x: 20, y: 500, width: 20, height: 20 });
  radio.addOptionToPage("B", page, { x: 50, y: 500, width: 20, height: 20 });
  const list = form.createOptionList("idiomas");
  list.setOptions(["PT", "EN", "ES"]);
  list.enableMultiselect();
  list.select(["PT", "EN"]);
  list.addToPage(page, { x: 20, y: 350, width: 150, height: 100 });
  return doc.save();
}

describe("preenchimento AcroForm real", () => {
  it("inspeciona valores vazios sem escolher a primeira opção e preserva múltiplas seleções", async () => {
    const fields = await inspectPdfFormFields(await fixture());
    expect(fields.find((field) => field.name === "pais")?.currentValue).toBe("");
    expect(fields.find((field) => field.name === "plano")?.currentValue).toBe("");
    expect(fields.find((field) => field.name === "idiomas")?.currentValue).toEqual(["PT", "EN"]);
  });

  it("preenche todos os tipos, mantém readonly e não modifica os bytes originais", async () => {
    const source = await fixture();
    const snapshot = source.slice();
    const bytes = await fillPdfForm(source, {
      values: { nome: "João", aceite: true, pais: "Portugal", plano: "B", fixo: "Original" },
    });
    const form = (await PDFDocument.load(bytes)).getForm();
    expect(form.getTextField("nome").getText()).toBe("João");
    expect(form.getCheckBox("aceite").isChecked()).toBe(true);
    expect(form.getDropdown("pais").getSelected()).toEqual(["Portugal"]);
    expect(form.getRadioGroup("plano").getSelected()).toBe("B");
    expect(form.getOptionList("idiomas").getSelected()).toEqual(["PT", "EN"]);
    expect(form.getTextField("fixo").getText()).toBe("Original");
    expect(source).toEqual(snapshot);
  });

  it("limpa seleções vazias sem gravar opções inexistentes", async () => {
    const bytes = await fillPdfForm(await fixture(), {
      values: { pais: "", plano: "", idiomas: "" },
    });
    const form = (await PDFDocument.load(bytes)).getForm();
    expect(form.getDropdown("pais").getSelected()).toEqual([]);
    expect(form.getRadioGroup("plano").getSelected()).toBeUndefined();
    expect(form.getOptionList("idiomas").getSelected()).toEqual([]);
  });

  it.each<Record<string, FormFieldValue>>([
    { nome: "válido", pais: "inexistente" },
    { nome: "válido", fixo: "alterado" },
    { nome: "válido", ausente: "valor" },
    { nome: "válido", aceite: "false" },
  ])("recusa toda a operação quando algum campo é inválido (%j)", async (values) => {
    await expect(fillPdfForm(await fixture(), { values })).rejects.toThrow();
  });

  it("achata todos os campos solicitados e mantém conteúdo da página", async () => {
    const bytes = await fillPdfForm(await fixture(), { values: { nome: "Ana" }, flatten: true });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getForm().getFields()).toHaveLength(0);
    expect(doc.getPage(0).node.Contents()).toBeDefined();
    expect(doc.getPage(0).node.Resources()).toBeDefined();
  });

  it("distingue PDF sem campos de documentos inválidos", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    expect(await inspectPdfFormFields(await doc.save())).toEqual([]);
    await expect(inspectPdfFormFields(new Uint8Array([1, 2, 3]))).rejects.toThrow();
    await expect(inspectPdfFormFields(new Uint8Array())).rejects.toThrow();
  });

  it("recusa regravação de documentos assinados", async () => {
    const doc = await PDFDocument.load(await fixture());
    doc.context.register(doc.context.obj({ Type: "Sig", ByteRange: [0, 1, 2, 3] }));
    await expect(fillPdfForm(await doc.save(), { values: { nome: "Ana" } })).rejects.toThrow(
      "PDF_ASSINADO_NAO_SUPORTADO",
    );
  });

  it("edita múltiplas seleções preservando flags originais", async () => {
    const bytes = await fillPdfForm(await fixture(), { values: { idiomas: ["EN", "ES"] } });
    const form = (await PDFDocument.load(bytes)).getForm();
    expect(form.getOptionList("idiomas").getSelected()).toEqual(["EN", "ES"]);
    expect(form.getOptionList("idiomas").isMultiselect()).toBe(true);
    await expect(
      fillPdfForm(await fixture(), { values: { pais: ["Brasil", "Portugal"] } }),
    ).rejects.toThrow("PDF_FORM_VALOR_INVALIDO");
  });

  it("preserva dropdown editável e permite valor personalizado", async () => {
    const doc = await PDFDocument.load(await fixture());
    doc.getForm().getDropdown("pais").enableEditing();
    const bytes = await fillPdfForm(await doc.save(), { values: { pais: "Outro" } });
    const field = (await PDFDocument.load(bytes)).getForm().getDropdown("pais");
    expect(field.getSelected()).toEqual(["Outro"]);
    expect(field.isEditable()).toBe(true);
  });

  it("não oculta falhas de codificação da aparência", async () => {
    await expect(fillPdfForm(await fixture(), { values: { nome: "漢字" } })).rejects.toThrow();
  });

  it("não oculta falhas de achatamento de widgets malformados", async () => {
    const doc = await PDFDocument.load(await fixture());
    const widget = doc.getForm().getTextField("fixo").acroField.getWidgets()[0];
    const widgetRef = doc.context.getObjectRef(widget.dict);
    if (!widgetRef) throw new Error("Fixture sem referência de widget");
    doc.getPage(0).node.removeAnnot(widgetRef);
    widget.dict.delete(PDFName.of("P"));
    const source = await doc.save({ updateFieldAppearances: false });
    await expect(fillPdfForm(source, { values: {}, flatten: true })).rejects.toThrow();
  });

  it("recusa formulário XFA sem apresentar ausência de campos como sucesso", async () => {
    const doc = await PDFDocument.load(await fixture());
    doc.getForm().acroForm.dict.set(PDFName.of("XFA"), doc.context.obj("xfa"));
    await expect(
      inspectPdfFormFields(await doc.save({ updateFieldAppearances: false })),
    ).rejects.toThrow("PDF_XFA_NAO_SUPORTADO");
  });
});

it("localiza todos os widgets do campo em páginas reais, inclusive sem P", async () => {
  const doc = await PDFDocument.load(await fixture());
  const second = doc.addPage();
  const text = doc.getForm().getTextField("nome");
  text.addToPage(second, { x: 20, y: 700, width: 150, height: 20 });
  text.acroField.getWidgets()[1].dict.delete(PDFName.of("P"));
  doc
    .getForm()
    .getRadioGroup("plano")
    .addOptionToPage("C", second, { x: 20, y: 500, width: 20, height: 20 });
  const fields = await inspectPdfFormFields(await doc.save());
  expect(fields.find((field) => field.name === "nome")?.pages).toEqual([1, 2]);
  expect(fields.find((field) => field.name === "plano")?.pages).toEqual([1, 2]);
  expect(fields.find((field) => field.name === "aceite")?.pages).toEqual([1]);
});

it("identifica falha de codificação sem perder silenciosamente o texto", async () => {
  await expect(fillPdfForm(await fixture(), { values: { nome: "漢字" } })).rejects.toThrow(
    "PDF_FORM_CARACTERE_NAO_SUPORTADO",
  );
});

it("a revisão validada fixa os valores e entrega cópias dos mesmos bytes", async () => {
  const source = await fixture();
  const file = new File([], "formulario.pdf");
  Object.defineProperty(file, "arrayBuffer", { value: async () => source.slice().buffer });
  const values = { nome: "José da Conceição", aceite: true, plano: "B", idiomas: ["PT", "ES"] };
  const preparing = preparePdfFormRevision(file, { values, flatten: false });
  values.nome = "alterado depois";
  values.idiomas.push("EN");
  const revision = await preparing;
  const expected = { nome: "José da Conceição", aceite: true, plano: "B", idiomas: ["PT", "ES"] };
  expect(matchesPdfFormRevision(revision, file, { values: expected, flatten: false })).toBe(true);
  expect(matchesPdfFormRevision(revision, file, { values, flatten: false })).toBe(false);
  expect(
    matchesPdfFormRevision(revision, new File([], "formulario.pdf"), {
      values: expected,
      flatten: false,
    }),
  ).toBe(false);
  expect(matchesPdfFormRevision(revision, file, { values: expected, flatten: true })).toBe(false);
  const bytes = getPdfFormRevisionBytes(revision);
  const form = (await PDFDocument.load(bytes)).getForm();
  expect(form.getTextField("nome").getText()).toBe(expected.nome);
  expect(form.getOptionList("idiomas").getSelected()).toEqual(["PT", "ES"]);
  bytes.fill(0);
  expect(
    (await PDFDocument.load(getPdfFormRevisionBytes(revision)))
      .getForm()
      .getCheckBox("aceite")
      .isChecked(),
  ).toBe(true);
});

it("cancela preparação abandonada antes de validar uma revisão", async () => {
  const source = await fixture();
  const file = new File([], "cancelado.pdf");
  let release: (value: ArrayBuffer) => void = () => {};
  Object.defineProperty(file, "arrayBuffer", {
    value: () =>
      new Promise<ArrayBuffer>((resolve) => {
        release = resolve;
      }),
  });
  const controller = new AbortController();
  const pending = preparePdfFormRevision(file, { values: { nome: "Maria" } }, controller.signal);
  controller.abort();
  release(source.slice().buffer as ArrayBuffer);
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

it("achatar formulário em várias páginas remove todas as referências de widgets", async () => {
  const doc = await PDFDocument.load(await fixture());
  const second = doc.addPage();
  doc
    .getForm()
    .getRadioGroup("plano")
    .addOptionToPage("C", second, { x: 20, y: 500, width: 20, height: 20 });
  const result = await PDFDocument.load(
    await fillPdfForm(await doc.save(), { values: { nome: "José", plano: "C" }, flatten: true }),
  );
  expect(
    result
      .getPages()
      .map((page) =>
        (page.node.Annots()?.asArray() ?? []).map((ref) => result.context.lookup(ref)?.toString()),
      ),
  ).toEqual([[], []]);
});

it("achatar remove widgets sem remover anotações de link independentes", async () => {
  const doc = await PDFDocument.load(await fixture());
  const link = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [20, 20, 120, 40],
      A: { S: "URI", URI: PDFString.of("https://example.com") },
    }),
  );
  doc.getPage(0).node.addAnnot(link);
  const result = await PDFDocument.load(
    await fillPdfForm(await doc.save(), { values: { nome: "Maria" }, flatten: true }),
  );
  const annotations = result.getPage(0).node.Annots()?.asArray() ?? [];
  expect(annotations).toHaveLength(1);
  expect(result.context.lookup(annotations[0])?.toString()).toContain("/Subtype /Link");
});
