// @vitest-environment node
import { PDFDocument, PDFName } from "pdf-lib";
import { expect, it } from "vitest";
import { captureAccessSnapshot } from "./__fixtures__/q-c0-access/inspect";
import { createCompressionCorpus } from "./__fixtures__/q-c0-compress-scan/corpus";
import { compressPdfDocument, inspectPdfCompressibility, protectPdfDocument } from "./pdf-engine";

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

it("inspectPdfCompressibility relata baixa economia para PDF somente texto e alta para PDF com imagens", async () => {
  const textDoc = await PDFDocument.create();
  const p = textDoc.addPage([595, 842]);
  p.drawText("Documento puramente textual sem imagens.", { x: 50, y: 750, size: 12 });
  const textBytes = await textDoc.save({ useObjectStreams: true });

  const textReport = await inspectPdfCompressibility(textBytes);
  expect(textReport.totalPages).toBe(1);
  expect(textReport.totalImages).toBe(0);
  expect(textReport.recompressibleImages).toBe(0);
  expect(textReport.isSigned).toBe(false);
  expect(textReport.estimatedSavingsRange[0]).toBeGreaterThanOrEqual(0);
  expect(textReport.estimatedSavingsRange[1]).toBeLessThanOrEqual(10);

  // PDF com stream de imagem RGB não comprimida 128x128 (49.152 bytes só da imagem)
  const imgDoc = await PDFDocument.create();
  const imgPage = imgDoc.addPage([400, 400]);
  const rawPixels = new Uint8Array(128 * 128 * 3);
  for (let i = 0; i < rawPixels.length; i += 3) {
    rawPixels[i] = (i * 7) % 256;
    rawPixels[i + 1] = (i * 13) % 256;
    rawPixels[i + 2] = (i * 19) % 256;
  }
  const imgStream = imgDoc.context.stream(rawPixels, {
    Type: "XObject",
    Subtype: "Image",
    Width: 128,
    Height: 128,
    ColorSpace: "DeviceRGB",
    BitsPerComponent: 8,
  });
  const imgRef = imgDoc.context.register(imgStream);
  imgPage.node.set(PDFName.of("Resources"), imgDoc.context.obj({ XObject: { Im0: imgRef } }));
  const imgBytes = await imgDoc.save({ useObjectStreams: false });

  const imgReport = await inspectPdfCompressibility(imgBytes);
  expect(imgReport.totalPages).toBe(1);
  expect(imgReport.totalImages).toBe(1);
  expect(imgReport.recompressibleImages).toBe(1);
  expect(imgReport.imageBytes).toBeGreaterThan(40_000);
  expect(imgReport.estimatedSavingsRange[1]).toBeGreaterThan(20);
});

it("compressPdfDocument remove Metadata/PieceInfo/Thumb redundantes e usa object streams", async () => {
  const doc = await PDFDocument.create();
  doc.setTitle("Preservar Titulo Info");
  doc.catalog.set(
    PDFName.of("Metadata"),
    doc.context.register(doc.context.stream("<?xpacket?><x:xmpmeta/>")),
  );
  doc.catalog.set(PDFName.of("PieceInfo"), doc.context.obj({ App: "Demo" }));
  const page = doc.addPage([400, 400]);
  page.node.set(PDFName.of("Thumb"), doc.context.obj({ Type: "XObject" }));
  page.node.set(PDFName.of("PieceInfo"), doc.context.obj({}));

  const raw = await doc.save({ useObjectStreams: false });
  const result = await compressPdfDocument(raw, "recommended");
  const reloaded = await PDFDocument.load(result.bytes);

  expect(reloaded.getTitle()).toBe("Preservar Titulo Info");
  expect(reloaded.catalog.has(PDFName.of("Metadata"))).toBe(false);
  expect(reloaded.catalog.has(PDFName.of("PieceInfo"))).toBe(false);
  expect(reloaded.getPage(0).node.has(PDFName.of("Thumb"))).toBe(false);
  expect(reloaded.getPage(0).node.has(PDFName.of("PieceInfo"))).toBe(false);
  expect(new TextDecoder("latin1").decode(result.bytes)).toContain("/ObjStm");
});
