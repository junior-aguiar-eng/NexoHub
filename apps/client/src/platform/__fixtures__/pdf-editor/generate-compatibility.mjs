// Fixtures sintéticas: executa somente no desenvolvimento, com dependências já adotadas.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { init } from "@embedpdf/pdfium";
import { PDFDocument } from "pdf-lib";

const root = new URL("../../../../", import.meta.url);
const fontBytes = await readFile(new URL("public/standard_fonts/LiberationSans-Regular.ttf", root));
const a = await init({
  wasmBinary: await readFile(new URL("node_modules/@embedpdf/pdfium/dist/pdfium.wasm", root)),
});
a.PDFiumExt_Init();
const m = a.pdfium;
const allocations = [];
const ptr = (size) => {
  const p = m.wasmExports.malloc(size);
  allocations.push(p);
  return p;
};
const doc = a.FPDF_CreateNewDocument();
let font = 0;
try {
  const fontPtr = ptr(fontBytes.length);
  m.HEAPU8.set(fontBytes, fontPtr);
  // FPDF_FONT_TRUETYPE = 2; CID conserva o mapeamento Unicode da fonte completa.
  font = a.FPDFText_LoadFont(doc, fontPtr, fontBytes.length, 2, true);
  if (!font) throw new Error("Falha ao incorporar fonte completa");
  const page = a.FPDFPage_New(doc, 0, 600, 750);
  try {
    for (const item of [
      { text: "Ação útil original", x: 50, y: 650 },
      { text: "Coluna preservada", x: 340, y: 650 },
      { text: "ofﬁce", x: 50, y: 570 },
      { text: "Transparência original", x: 50, y: 490, alpha: 120 },
      { text: "Texto inclinado", x: 50, y: 400, angle: 0.2 },
    ]) {
      const object = a.FPDFPageObj_CreateTextObj(doc, font, 16);
      const textPtr = ptr((item.text.length + 1) * 2);
      m.stringToUTF16(item.text, textPtr, (item.text.length + 1) * 2);
      if (!a.FPDFText_SetText(object, textPtr)) throw new Error("Texto da fixture inválido");
      const angle = item.angle ?? 0;
      a.FPDFPageObj_Transform(
        object,
        Math.cos(angle),
        Math.sin(angle),
        -Math.sin(angle),
        Math.cos(angle),
        item.x,
        item.y,
      );
      a.FPDFPageObj_SetFillColor(object, 0, 0, 0, item.alpha ?? 255);
      a.FPDFPage_InsertObject(page, object);
    }
    if (!a.FPDFPage_GenerateContent(page)) throw new Error("Conteúdo da fixture inválido");
    const writer = a.PDFiumExt_OpenFileWriter();
    try {
      if (!a.FPDF_SaveAsCopy(doc, writer, 2)) throw new Error("Falha ao salvar fixture");
      const size = a.PDFiumExt_GetFileWriterSize(writer),
        buffer = ptr(size);
      a.PDFiumExt_GetFileWriterData(writer, buffer, size);
      const pdf = await PDFDocument.load(m.HEAPU8.slice(buffer, buffer + size));
      const field = pdf.getForm().createTextField("campo-preservado");
      field.setText("Valor mantido");
      field.addToPage(pdf.getPage(0), { x: 50, y: 150, width: 240, height: 30 });
      pdf.setCreationDate(new Date("2026-10-24T00:00:00Z"));
      pdf.setModificationDate(new Date("2026-10-24T00:00:00Z"));
      await writeFile(new URL("embedded-full.pdf", import.meta.url), await pdf.save());
    } finally {
      a.PDFiumExt_CloseFileWriter(writer);
    }
  } finally {
    a.FPDF_ClosePage(page);
  }
} finally {
  if (font) a.FPDFFont_Close(font);
  a.FPDF_CloseDocument(doc);
  for (const p of allocations) m.wasmExports.free(p);
}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixtures = [];
for (const file of ["embedded-subset.pdf", "embedded-full.pdf"])
  fixtures.push({ file, sha256: hash(await readFile(new URL(file, import.meta.url))) });
await writeFile(
  new URL("corpus.json", import.meta.url),
  `${JSON.stringify(
    {
      origin: "Documentos sintéticos gerados pelos scripts deste diretório; sem dados pessoais.",
      font: {
        file: "public/standard_fonts/LiberationSans-Regular.ttf",
        sha256: hash(fontBytes),
        license: "public/standard_fonts/LICENSE_LIBERATION",
      },
      fixtures,
    },
    null,
    2,
  )}\n`,
);
