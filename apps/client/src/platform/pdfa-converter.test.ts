import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { convertPdfToPdfA, inspectPdfForPdfa, verifyPdfaStructure } from "./pdfa-converter";

const ICC_BYTES = new Uint8Array(fs.readFileSync(path.resolve("public/icc/sRGB-v2-micro.icc")));
const SOURCE_SANS_BYTES = new Uint8Array(
  fs.readFileSync(path.resolve("public/fonts/pdf-comparison/SourceSans3-Regular.ttf")),
);
const LIBERATION_BYTES = new Uint8Array(
  fs.readFileSync(path.resolve("public/standard_fonts/LiberationSans-Regular.ttf")),
);

// PNG 2x2 vermelho válido gerado para testes
const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8DwHwMjIygAABfBAwX4lK7kAAAAAElFTkSuQmCC";
const SAMPLE_PNG_BYTES = Uint8Array.from(Buffer.from(SAMPLE_PNG_BASE64, "base64"));

async function createEmbeddedFontPdf(withMeta = true): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(SOURCE_SANS_BYTES);
  const page = doc.addPage([595, 842]);
  page.drawText("Petição arquivável em conformidade PDF/A-2b", {
    x: 50,
    y: 760,
    size: 16,
    font,
    color: rgb(0.1, 0.1, 0.2),
  });
  if (withMeta) {
    doc.setTitle("Contrato & Termo <NexoHub>");
    doc.setAuthor("Maria José");
    doc.setSubject("Validação ISO 19005-2b");
    doc.setCreator("NexoHub Tests");
  }
  return doc.save({ useObjectStreams: false });
}

async function createStandardFontAndJsPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText("Texto com fonte padrao nao incorporada", {
    x: 48,
    y: 780,
    size: 14,
    font: helvetica,
  });
  // Transparência leve
  page.drawRectangle({
    x: 48,
    y: 700,
    width: 120,
    height: 40,
    color: rgb(0.2, 0.4, 0.9),
    opacity: 0.5,
  });
  // Ações proibidas por PDF/A
  const jsAction = doc.context.obj({
    Type: "Action",
    S: "JavaScript",
    JS: PDFString.of("app.alert('proibido');"),
  });
  doc.catalog.set(PDFName.of("OpenAction"), doc.context.register(jsAction));
  page.node.set(PDFName.of("AA"), doc.context.obj({ O: doc.context.register(jsAction) }));
  return doc.save({ useObjectStreams: false });
}

describe("pdfa-converter (ADR-021 / ISO 19005)", () => {
  it("diagnostica corretamente PDF já com fonte incorporada vs. fonte padrão, transparência e JS", async () => {
    const embeddedBytes = await createEmbeddedFontPdf();
    const embeddedReport = await inspectPdfForPdfa(embeddedBytes);
    expect(embeddedReport.pageCount).toBe(1);
    expect(embeddedReport.isEncrypted).toBe(false);
    expect(embeddedReport.hasDigitalSignature).toBe(false);
    expect(embeddedReport.unembeddedStandardFonts).toEqual([]);
    expect(embeddedReport.unembeddedCustomFonts).toEqual([]);
    expect(embeddedReport.prohibitedActions).toEqual([]);

    const dirtyBytes = await createStandardFontAndJsPdf();
    const dirtyReport = await inspectPdfForPdfa(dirtyBytes);
    expect(dirtyReport.unembeddedStandardFonts).toContain("Helvetica");
    expect(dirtyReport.hasTransparency).toBe(true);
    expect(dirtyReport.prohibitedActions.length).toBeGreaterThanOrEqual(2);
  });

  it("recusa PDF assinado digitalmente por padrão e permite cópia explícita quando autorizado", async () => {
    const baseDoc = await PDFDocument.load(await createEmbeddedFontPdf());
    baseDoc.catalog.set(
      PDFName.of("SigMock"),
      baseDoc.context.obj({ Type: "Sig", ByteRange: [0, 10, 20, 30] }),
    );
    const signedBytes = await baseDoc.save();

    const diag = await inspectPdfForPdfa(signedBytes);
    expect(diag.hasDigitalSignature).toBe(true);

    await expect(convertPdfToPdfA(signedBytes, { iccProfileBytes: ICC_BYTES })).rejects.toThrow(
      "PDFA_SIGNED_REFUSED",
    );

    const allowed = await convertPdfToPdfA(signedBytes, {
      iccProfileBytes: ICC_BYTES,
      allowDiscardSignatures: true,
    });
    expect(allowed.report.pageCount).toBe(1);
    expect(allowed.report.embeddedIccProfile).toBe(true);
  });

  it("converte PDF com fonte incorporada mantendo 100% vetorial, OutputIntent sRGB, XMP e ID no trailer", async () => {
    const input = await createEmbeddedFontPdf(true);
    const { pdfBytes, report } = await convertPdfToPdfA(input, {
      conformance: "2b",
      iccProfileBytes: ICC_BYTES,
    });

    expect(report.conformance).toBe("2b");
    expect(report.pageCount).toBe(1);
    expect(report.vectorPages).toBe(1);
    expect(report.reconstructedPages).toBe(0);
    expect(report.embeddedIccProfile).toBe(true);
    expect(report.wroteXmpMetadata).toBe(true);

    const parsed = await PDFDocument.load(pdfBytes);
    const intents = parsed.catalog.lookup(PDFName.of("OutputIntents"), PDFArray);
    expect(intents.size()).toBeGreaterThanOrEqual(1);
    const intentDict = intents.lookup(0, PDFDict);
    expect(intentDict.get(PDFName.of("S"))?.toString()).toBe("/GTS_PDFA2");
    expect(intentDict.get(PDFName.of("OutputConditionIdentifier"))?.toString()).toContain(
      "sRGB IEC61966-2.1",
    );
    const iccObj = parsed.context.lookup(intentDict.get(PDFName.of("DestOutputProfile")));
    expect(iccObj).toBeInstanceOf(PDFRawStream);
    const iccStream = iccObj as PDFRawStream;
    expect(iccStream.dict.get(PDFName.of("N"))?.toString()).toBe("3");
    const decodedIcc = decodePDFRawStream(iccStream).decode();
    expect(decodedIcc.length).toBe(ICC_BYTES.length);

    const metadataObj = parsed.context.lookup(parsed.catalog.get(PDFName.of("Metadata")));
    expect(metadataObj).toBeInstanceOf(PDFRawStream);
    const metadataStream = metadataObj as PDFRawStream;
    const xmpXml = new TextDecoder().decode(metadataStream.contents);
    expect(xmpXml).toContain("<pdfaid:part>2</pdfaid:part>");
    expect(xmpXml).toContain("<pdfaid:conformance>B</pdfaid:conformance>");
    expect(xmpXml).toContain("Contrato &amp; Termo &lt;NexoHub&gt;");
    expect(xmpXml).toContain("Maria José");

    const trailerId = parsed.context.trailerInfo.ID;
    expect(trailerId).toBeInstanceOf(PDFArray);
    const idArr = trailerId as PDFArray;
    expect(idArr.size()).toBe(2);
    expect(idArr.get(0)).toBeInstanceOf(PDFHexString);

    const check = await verifyPdfaStructure(pdfBytes, "2b");
    expect(check.valid).toBe(true);
    expect(check.issues).toEqual([]);
  });

  it("remove ações JavaScript e reconstroi páginas com fonte não incorporada mantendo texto pesquisável embutido", async () => {
    const input = await createStandardFontAndJsPdf();
    const { pdfBytes, report } = await convertPdfToPdfA(input, {
      conformance: "2b",
      iccProfileBytes: ICC_BYTES,
      ocrFontBytes: LIBERATION_BYTES,
      pageRasterizer: async (_bytes, pages) => pages.map(() => SAMPLE_PNG_BYTES),
      pageTextExtractor: async () => [
        {
          pageNumber: 1,
          text: "Texto pesquisavel preservado",
          width: 595,
          height: 842,
          lines: [
            {
              text: "Texto pesquisavel preservado",
              bbox: { x0: 48, y0: 40, x1: 300, y1: 62 },
            },
          ],
        },
      ],
    });

    expect(report.removedActionsCount).toBeGreaterThanOrEqual(2);
    expect(report.reconstructedPages).toBe(1);
    expect(report.vectorPages).toBe(0);

    const parsed = await PDFDocument.load(pdfBytes);
    expect(parsed.catalog.has(PDFName.of("OpenAction"))).toBe(false);
    expect(parsed.getPage(0).node.has(PDFName.of("AA"))).toBe(false);

    const postDiag = await inspectPdfForPdfa(pdfBytes);
    expect(postDiag.unembeddedStandardFonts).toEqual([]);
    expect(postDiag.unembeddedCustomFonts).toEqual([]);
    expect(postDiag.prohibitedActions).toEqual([]);

    const check = await verifyPdfaStructure(pdfBytes, "2b");
    expect(check.valid).toBe(true);
  });

  it("em PDF/A-1b achata páginas com transparência e recusa ICC corrompido", async () => {
    const dirty = await createStandardFontAndJsPdf();
    await expect(
      convertPdfToPdfA(dirty, { iccProfileBytes: new Uint8Array([1, 2, 3]) }),
    ).rejects.toThrow("PDFA_INVALID_ICC_PROFILE");

    const { pdfBytes, report } = await convertPdfToPdfA(dirty, {
      conformance: "1b",
      iccProfileBytes: ICC_BYTES,
      ocrFontBytes: LIBERATION_BYTES,
      pageRasterizer: async (_bytes, pages) => pages.map(() => SAMPLE_PNG_BYTES),
      pageTextExtractor: async () => [],
    });

    expect(report.conformance).toBe("1b");
    expect(report.reconstructedPages).toBe(1);

    const check = await verifyPdfaStructure(pdfBytes, "1b");
    expect(check.valid).toBe(true);
  });

  it("respeita AbortSignal emitindo AbortError sem produzir saída parcial", async () => {
    const controller = new AbortController();
    controller.abort();
    const input = await createEmbeddedFontPdf();

    await expect(
      convertPdfToPdfA(input, {
        iccProfileBytes: ICC_BYTES,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
