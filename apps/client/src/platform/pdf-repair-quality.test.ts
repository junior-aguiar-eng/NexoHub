import { PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { expect, it } from "vitest";
import { createRepairCorpus } from "./__fixtures__/r-c1/corpus";
import { repairPdfDocument } from "./pdf-repair-engine";

it("preserva campos, anexos, metadados e geometria sem reinterpretar objetos dentro de streams", async () => {
  const item = (await createRepairCorpus())[0];
  const original = item.bytes.slice();
  const result = await repairPdfDocument(item.bytes);
  const doc = await PDFDocument.load(result.pdfBytes, { updateMetadata: false });
  expect(doc.getForm().getTextField("nome").getText()).toBe("Maria Silva");
  expect(doc.getTitle()).toBe("Relatório autoral R-C1");
  expect(doc.getCreationDate()?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  const names = doc.catalog.lookup(PDFName.of("Names"), PDFDict);
  expect(
    names.lookup(PDFName.of("EmbeddedFiles"), PDFDict).lookup(PDFName.of("Names"), PDFArray).size(),
  ).toBe(2);
  expect(doc.getPage(0).getCropBox()).toEqual({ x: 5, y: 10, width: 280, height: 375 });
  expect(item.bytes).toEqual(original);
});

it("classifica texto com palavra objetos como irrecuperável", async () => {
  await expect(
    repairPdfDocument(new TextEncoder().encode("arquivo sem objetos PDF")),
  ).rejects.toThrow("CORRUPTED_DOCUMENT");
});

it("recusa arquivo acima do orçamento antes de analisar objetos", async () => {
  await expect(repairPdfDocument(new Uint8Array(16 * 1024 * 1024 + 1))).rejects.toThrow(
    "PDF_REPAIR_LIMIT",
  );
});

it("recusa cancelamento anterior à análise", async () => {
  const controller = new AbortController();
  controller.abort();
  const item = (await createRepairCorpus())[0];
  await expect(repairPdfDocument(item.bytes, { signal: controller.signal })).rejects.toThrow(
    "OPERACAO_CANCELADA",
  );
});

it("recusa expansão de stream acima de 8 MiB sem produzir saída parcial", async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.catalog.set(
    PDFName.of("LargeAttachment"),
    doc.context.register(doc.context.flateStream("a".repeat(8 * 1024 * 1024 + 1))),
  );
  await expect(repairPdfDocument(await doc.save({ useObjectStreams: false }))).rejects.toThrow(
    "PDF_REPAIR_EXPANSION_LIMIT",
  );
});

it("recusa divergência entre árvore declarada e páginas recuperadas", async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.catalog.Pages().set(PDFName.of("Count"), doc.context.obj(2));
  await expect(repairPdfDocument(await doc.save({ useObjectStreams: false }))).rejects.toThrow(
    "CORRUPTED_DOCUMENT",
  );
});

it("recusa perder metadados cuja associação foi destruída junto com o trailer", async () => {
  const item = (await createRepairCorpus()).find((item) => item.id === "sem-xref-trailer");
  if (!item) throw new Error("Corpus ausente");
  await expect(repairPdfDocument(item.bytes)).rejects.toThrow("PDF_REPAIR_UNSUPPORTED");
});
