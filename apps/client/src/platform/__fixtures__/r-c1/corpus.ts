/** Corpus autoral MPL-2.0; nomes, campos e conteúdo fictícios. */
import { PDFDocument, PDFName } from "pdf-lib";

export async function createRepairCorpus() {
  const doc = await PDFDocument.create();
  doc.setTitle("Relatório autoral R-C1");
  doc.setAuthor("NexoHub — corpus de teste");
  doc.setCreationDate(new Date("2026-01-01T00:00:00Z"));
  doc.setModificationDate(new Date("2026-01-01T00:00:00Z"));
  for (let i = 1; i <= 2; i++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`Conteudo original ${i}`, { x: 25, y: 340, size: 14 });
    page.setCropBox(5, 10, 280, 375);
  }
  const field = doc.getForm().createTextField("nome");
  field.setText("Maria Silva");
  field.addToPage(doc.getPage(0), { x: 25, y: 250, width: 180, height: 25 });
  await doc.attach(
    Uint8Array.from(new TextEncoder().encode("Anexo autoral preservado")),
    "nota.txt",
    { mimeType: "text/plain" },
  );
  // Delimitadores aparentes dentro de stream válido não são estrutura de objetos.
  const decoy = doc.context.stream("999999999 0 obj\n/Type /Catalog\ntrailer\nendobj\n");
  doc.catalog.set(PDFName.of("CorpusDecoy"), doc.context.register(decoy));
  const bytes = await doc.save({ useObjectStreams: false });
  const ascii = new TextDecoder("latin1").decode(bytes);
  const start = ascii.lastIndexOf("startxref");
  const xref = ascii.lastIndexOf("\nxref\n") + 1;
  const prefix = new TextEncoder().encode("PREFIXO_INVALIDO\n");
  const prefixed = new Uint8Array(prefix.length + bytes.length);
  prefixed.set(prefix);
  prefixed.set(bytes, prefix.length);
  const wrongOffset = bytes.slice();
  const pointer = ascii.slice(start).match(/startxref\s+(\d+)/);
  if (!pointer) throw new Error("CORPUS_INVALIDO");
  wrongOffset.set(
    new TextEncoder().encode("0".repeat(pointer[1].length)),
    start + pointer[0].indexOf(pointer[1]),
  );
  return [
    { id: "integro", bytes, recoverable: true },
    { id: "prefixo", bytes: prefixed, recoverable: true },
    { id: "sem-eof", bytes: bytes.slice(0, ascii.lastIndexOf("%%EOF")), recoverable: true },
    { id: "sem-startxref", bytes: bytes.slice(0, start), recoverable: true },
    { id: "xref-incorreto", bytes: wrongOffset, recoverable: true },
    { id: "sem-xref-trailer", bytes: bytes.slice(0, xref), recoverable: true },
    { id: "perda-fisica", bytes: bytes.slice(0, 70), recoverable: false },
    {
      id: "texto-objetos",
      bytes: new TextEncoder().encode("arquivo sem objetos PDF"),
      recoverable: false,
    },
  ];
}
