// @vitest-environment node
import { PDFDocument, PDFName } from "pdf-lib";
import { expect, it } from "vitest";
import { captureAccessSnapshot } from "./__fixtures__/q-c0-access/inspect";
import { createCompressionCorpus } from "./__fixtures__/q-c0-compress-scan/corpus";
import { compressPdfDocument, protectPdfDocument } from "./pdf-engine";

it.each(["less", "recommended", "extreme"] as const)(
  "compressão %s preserva texto, campos, caixas, rotação e anexos",
  async (level) => {
    const source = await createCompressionCorpus(),
      original = source.slice();
    const baseline = await captureAccessSnapshot(source);
    const output = await compressPdfDocument(source, level);
    expect(await captureAccessSnapshot(output.bytes)).toEqual(baseline);
    expect(output.bytes.length).toBeLessThanOrEqual(source.length);
    expect(output.savedBytes).toBe(source.length - output.bytes.length);
    expect(output.savedPercent).toBe(Math.round((output.savedBytes * 100) / source.length));
    expect(source).toEqual(original);
  },
);

it("recusa PDF inválido, cifrado e ByteRange, sem sucesso fictício", async () => {
  await expect(compressPdfDocument(new Uint8Array([1, 2]))).rejects.toThrow();
  const source = await createCompressionCorpus();
  await expect(
    compressPdfDocument(await protectPdfDocument(source, { password: "controle" })),
  ).rejects.toThrow();
  const doc = await PDFDocument.load(source);
  doc.catalog.set(
    PDFName.of("ControleAssinatura"),
    doc.context.register(doc.context.obj({ ByteRange: [0, 1, 2, 3] })),
  );
  await expect(compressPdfDocument(await doc.save())).rejects.toThrow("PDF_ASSINADO_NAO_SUPORTADO");
});

it("mantém o original se a regravação não reduz bytes", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([100, 100]);
  const source = await doc.save();
  const first = await compressPdfDocument(source);
  const second = await compressPdfDocument(first.bytes);
  expect(second.bytes).toEqual(first.bytes);
  expect(second.savedBytes).toBe(0);
});
