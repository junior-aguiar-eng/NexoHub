import {
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  type PDFField,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRawStream,
  PDFRef,
  PDFTextField,
} from "pdf-lib";

export type FormFieldType = "text" | "checkbox" | "dropdown" | "radio" | "option-list";
export type FormFieldValue = string | boolean | string[];

export interface FormFieldDescriptor {
  name: string;
  type: FormFieldType;
  currentValue: FormFieldValue;
  isReadOnly: boolean;
  pages?: readonly number[];
  options?: string[];
  multiSelect?: boolean;
  isEditable?: boolean;
}

export interface FillPdfFormOptions {
  values: Record<string, FormFieldValue>;
  flatten?: boolean;
}

async function loadFormDocument(bytes: Uint8Array) {
  if (!bytes.byteLength) throw new Error("EMPTY_DOCUMENT");
  // Never bypass encryption: doing so may produce an unreadable or unprotected artifact.
  const doc = await PDFDocument.load(bytes);
  const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (acroForm?.has(PDFName.of("XFA"))) throw new Error("PDF_XFA_NAO_SUPORTADO");
  return doc;
}

function describeField(field: PDFField): FormFieldDescriptor | undefined {
  const common = { name: field.getName(), isReadOnly: field.isReadOnly() };
  if (field instanceof PDFTextField) {
    return { ...common, type: "text", currentValue: field.getText() ?? "" };
  }
  if (field instanceof PDFCheckBox) {
    return { ...common, type: "checkbox", currentValue: field.isChecked() };
  }
  if (field instanceof PDFRadioGroup) {
    return {
      ...common,
      type: "radio",
      currentValue: field.getSelected() ?? "",
      options: field.getOptions(),
    };
  }
  if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
    const selected = field.getSelected();
    const multiSelect = field.isMultiselect();
    return {
      ...common,
      type: field instanceof PDFDropdown ? "dropdown" : "option-list",
      currentValue: multiSelect ? selected : (selected[0] ?? ""),
      options: field.getOptions(),
      multiSelect,
      isEditable: field instanceof PDFDropdown && field.isEditable(),
    };
  }
  return undefined;
}

/** Inspects actual AcroForm values without inventing an initial selection. */
export async function inspectPdfFormFields(bytes: Uint8Array): Promise<FormFieldDescriptor[]> {
  const doc = await loadFormDocument(bytes);
  const pages = doc.getPages();
  const byRef = new Map(pages.map((page, index) => [page.ref.toString(), index + 1]));
  const byWidget = new Map<PDFDict, number>();
  pages.forEach((page, index) => {
    for (const reference of page.node.Annots()?.asArray() ?? []) {
      const annotation = doc.context.lookup(reference);
      if (annotation instanceof PDFDict) byWidget.set(annotation, index + 1);
    }
  });
  return doc
    .getForm()
    .getFields()
    .flatMap((field) => {
      const descriptor = describeField(field);
      if (!descriptor) return [];
      const fieldPages = field.acroField.getWidgets().flatMap((widget) => {
        const ref = widget.dict.get(PDFName.of("P"));
        const page = byWidget.get(widget.dict) ?? (ref ? byRef.get(ref.toString()) : undefined);
        return page ? [page] : [];
      });
      return [{ ...descriptor, pages: [...new Set(fieldPages)].sort((a, b) => a - b) }];
    });
}

function sameValue(left: FormFieldValue, right: FormFieldValue) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value) => right.includes(value));
  }
  return left === right;
}

/** Produces a new artifact only when every supplied value and appearance succeeds. */
export async function fillPdfForm(
  bytes: Uint8Array,
  options: FillPdfFormOptions,
): Promise<Uint8Array> {
  const doc = await loadFormDocument(bytes);
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object;
    if (dict instanceof PDFDict && dict.has(PDFName.of("ByteRange"))) {
      throw new Error("PDF_ASSINADO_NAO_SUPORTADO");
    }
  }
  const form = doc.getForm();
  for (const [name, value] of Object.entries(options.values)) {
    const field = form.getFieldMaybe(name);
    if (!field) throw new Error("PDF_FORM_CAMPO_INEXISTENTE");
    const descriptor = describeField(field);
    if (!descriptor) throw new Error("PDF_FORM_CAMPO_NAO_SUPORTADO");
    if (field.isReadOnly()) {
      if (sameValue(descriptor.currentValue, value)) continue;
      throw new Error("PDF_FORM_CAMPO_SOMENTE_LEITURA");
    }
    if (field instanceof PDFTextField) {
      if (typeof value !== "string") throw new Error("PDF_FORM_VALOR_INVALIDO");
      field.setText(value);
    } else if (field instanceof PDFCheckBox) {
      if (typeof value !== "boolean") throw new Error("PDF_FORM_VALOR_INVALIDO");
      if (value) field.check();
      else field.uncheck();
    } else if (field instanceof PDFRadioGroup) {
      if (typeof value !== "string" || (value !== "" && !field.getOptions().includes(value))) {
        throw new Error("PDF_FORM_VALOR_INVALIDO");
      }
      if (value === "") field.clear();
      else field.select(value);
    } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
      if (typeof value !== "string" && !Array.isArray(value))
        throw new Error("PDF_FORM_VALOR_INVALIDO");
      const selected = value === "" ? [] : Array.isArray(value) ? value : [value];
      const allowsCustom = field instanceof PDFDropdown && field.isEditable();
      if (
        (!field.isMultiselect() && selected.length > 1) ||
        selected.some(
          (option) =>
            typeof option !== "string" || (!allowsCustom && !field.getOptions().includes(option)),
        )
      )
        throw new Error("PDF_FORM_VALOR_INVALIDO");
      if (selected.length === 0) field.clear();
      else field.select(selected);
    }
  }
  // Encoding, malformed widgets and flatten failures must reject the whole operation.
  // No artifact is exposed until saving finishes successfully.
  try {
    form.updateFieldAppearances();
  } catch (error) {
    if (error instanceof Error && error.message.includes("WinAnsi cannot encode")) {
      throw new Error("PDF_FORM_CARACTERE_NAO_SUPORTADO");
    }
    throw error;
  }
  if (options.flatten) {
    // pdf-lib removes field/widget objects but can leave their refs in Annots.
    // Capture only widgets, so links and other unrelated annotations are preserved.
    const widgets = new Set(
      form
        .getFields()
        .flatMap((field) => field.acroField.getWidgets().map((widget) => widget.dict)),
    );
    const widgetRefs = new Set(
      [...widgets].flatMap((widget) => {
        const ref = doc.context.getObjectRef(widget);
        return ref ? [ref.toString()] : [];
      }),
    );
    form.flatten({ updateFieldAppearances: false });
    for (const page of doc.getPages()) {
      const annotations = page.node.Annots();
      if (!annotations) continue;
      for (let index = annotations.size() - 1; index >= 0; index--) {
        const entry = annotations.get(index);
        if (
          (entry instanceof PDFRef && widgetRefs.has(entry.toString())) ||
          (entry instanceof PDFDict && widgets.has(entry))
        )
          annotations.remove(index);
      }
    }
  }
  return doc.save({ useObjectStreams: true, updateFieldAppearances: false });
}

/** Opaque handle: bytes and captured values remain private to this module. */
export interface PdfFormRevision {
  readonly source: File;
  readonly flatten: boolean;
}
const formRevisions = new WeakMap<PdfFormRevision, { bytes: Uint8Array; valuesKey: string }>();
function formValuesKey(values: Readonly<Record<string, FormFieldValue>>): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .map((key) => [key, values[key]]),
  );
}
export async function preparePdfFormRevision(
  source: File,
  options: FillPdfFormOptions,
  signal?: AbortSignal,
): Promise<PdfFormRevision> {
  const values = Object.fromEntries(
    Object.entries(options.values).map(([name, value]) => [
      name,
      Array.isArray(value) ? [...value] : value,
    ]),
  );
  const flatten = options.flatten ?? false;
  const valuesKey = formValuesKey(values);
  signal?.throwIfAborted();
  const input = new Uint8Array(await source.arrayBuffer());
  signal?.throwIfAborted();
  const bytes = await fillPdfForm(input, { values, flatten });
  signal?.throwIfAborted();
  const revision = Object.freeze({ source, flatten });
  formRevisions.set(revision, { bytes, valuesKey });
  return revision;
}
export function matchesPdfFormRevision(
  revision: PdfFormRevision,
  source: File,
  options: FillPdfFormOptions,
): boolean {
  return (
    revision.source === source &&
    revision.flatten === (options.flatten ?? false) &&
    formRevisions.get(revision)?.valuesKey === formValuesKey(options.values)
  );
}
export function getPdfFormRevisionBytes(revision: PdfFormRevision): Uint8Array {
  const entry = formRevisions.get(revision);
  if (!entry) throw new Error("PDF_FORM_REVISAO_INVALIDA");
  return entry.bytes.slice();
}
