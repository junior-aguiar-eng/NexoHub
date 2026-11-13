// @vitest-environment node
import { readFile } from "node:fs/promises";
import { init, type WrappedPdfiumModule } from "@embedpdf/pdfium";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { repairPdfDocument } from "./pdf-repair-engine";

let pdfiumApi: WrappedPdfiumModule;

function bytesToBinaryString(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

function binaryStringToBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (ch) => ch.charCodeAt(0) & 0xff);
}

beforeAll(async () => {
  const wasmBinary = await readFile(
    new URL("../../node_modules/@embedpdf/pdfium/dist/pdfium.wasm", import.meta.url),
  );
  pdfiumApi = await init({ wasmBinary });
  pdfiumApi.PDFiumExt_Init();
});

describe("motor de reparo de PDF (repairPdfDocument)", () => {
  it("rejeita documento vazio com EMPTY_DOCUMENT", async () => {
    await expect(repairPdfDocument(new Uint8Array(0))).rejects.toThrow("EMPTY_DOCUMENT");
  });

  it("rejeita arquivo não PDF sem objetos recuperáveis com CORRUPTED_DOCUMENT", async () => {
    const junk = new TextEncoder().encode("Este é um arquivo de texto qualquer e não é PDF.");
    await expect(repairPdfDocument(junk)).rejects.toThrow("CORRUPTED_DOCUMENT");
  });

  it("repara PDF com lixo inserido antes do cabeçalho %PDF-", async () => {
    const validDoc = await PDFDocument.create();
    validDoc.addPage([300, 300]);
    validDoc.addPage([400, 400]);
    const validBytes = await validDoc.save();

    // Injeta lixo antes do %PDF-
    const prefix = new TextEncoder().encode("LIXO_INICIAL_OU_BOM_12345");
    const corruptedBytes = new Uint8Array(prefix.length + validBytes.length);
    corruptedBytes.set(prefix, 0);
    corruptedBytes.set(validBytes, prefix.length);

    const result = await repairPdfDocument(corruptedBytes);
    expect(result.report.fixedHeader).toBe(true);
    expect(result.report.recoveredPages).toBe(2);
    expect(result.report.totalDetectedPages).toBe(2);

    // Valida que o PDF resultante é válido
    const loaded = await PDFDocument.load(result.pdfBytes);
    expect(loaded.getPageCount()).toBe(2);
  });

  it("repara PDF truncado no final sem marcador %%EOF", async () => {
    const validDoc = await PDFDocument.create();
    validDoc.addPage([200, 200]);
    const validBytes = await validDoc.save();

    // Corta os últimos 6 bytes (removendo %%EOF)
    const truncatedBytes = validBytes.subarray(0, validBytes.length - 6);

    const result = await repairPdfDocument(truncatedBytes);
    expect(result.report.fixedEof).toBe(true);
    expect(result.report.recoveredPages).toBe(1);

    const loaded = await PDFDocument.load(result.pdfBytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("repara PDF com startxref e %%EOF ausentes restaurando o apontador", async () => {
    const validDoc = await PDFDocument.create();
    validDoc.addPage([200, 200]);
    const validBytes = await validDoc.save();

    // Corta os últimos 18 bytes (removendo startxref e %%EOF)
    const truncatedBytes = validBytes.subarray(0, validBytes.length - 18);

    const result = await repairPdfDocument(truncatedBytes);
    expect(result.report.fixedEof).toBe(true);
    expect(result.report.recoveredPages).toBe(1);

    const loaded = await PDFDocument.load(result.pdfBytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("repara documento íntegro gerando novo artifact sanitizado e relatório completo", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([500, 500]);
    const docBytes = await doc.save();

    const result = await repairPdfDocument(docBytes);
    expect(result.report.recoveredPages).toBe(1);
    expect(result.report.originalSize).toBe(docBytes.length);
    expect(result.report.repairedSize).toBeGreaterThan(0);
    expect(result.pdfBytes.length).toBeGreaterThan(0);
  });

  it("repara PDF com lixo inicial e tabela xref com offsets falsos marcando fixedXref", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]).drawText("Pagina 1", { x: 20, y: 350 });
    doc.addPage([300, 400]).drawText("Pagina 2", { x: 20, y: 350 });
    const validBytes = await doc.save({ useObjectStreams: false });
    const ascii = bytesToBinaryString(validBytes);
    const xrefStart = ascii.lastIndexOf("\nxref\n") + 1;
    const trailerStart = ascii.lastIndexOf("\ntrailer\n");
    expect(xrefStart).toBeGreaterThan(0);
    expect(trailerStart).toBeGreaterThan(xrefStart);

    // Substitui offsets válidos da tabela xref por offsets falsos
    const corruptedXref = ascii
      .slice(xrefStart, trailerStart)
      .replace(/\d{10} 00000 n/g, "0000099999 00000 n");
    const rebuiltAscii = `LIXO_ANTES_HEADER\n${ascii.slice(0, xrefStart)}${corruptedXref}${ascii.slice(trailerStart)}`;
    const corruptedBytes = binaryStringToBytes(rebuiltAscii);

    const result = await repairPdfDocument(corruptedBytes, {
      loadPdfium: async () => pdfiumApi,
    });
    expect(result.report.fixedHeader).toBe(true);
    expect(result.report.fixedXref).toBe(true);
    expect(result.report.recoveredPages).toBe(2);
    expect(result.report.totalDetectedPages).toBe(2);

    const reloaded = await PDFDocument.load(result.pdfBytes);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("corrige divergência de /Count 99 no dicionário /Pages em vez de falhar", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]).drawText("Pagina A", { x: 20, y: 350 });
    doc.addPage([300, 400]).drawText("Pagina B", { x: 20, y: 350 });
    doc.addPage([300, 400]).drawText("Pagina C", { x: 20, y: 350 });
    doc.catalog.Pages().set(PDFName.of("Count"), doc.context.obj(99));
    const corruptedBytes = await doc.save({ useObjectStreams: false });

    const result = await repairPdfDocument(corruptedBytes);
    expect(result.report.recoveredPages).toBe(3);
    expect(result.report.totalDetectedPages).toBe(3);
    expect(result.report.fixedXref).toBe(true);
    expect(result.report.warnings.length).toBeGreaterThan(0);

    const reloaded = await PDFDocument.load(result.pdfBytes);
    expect(reloaded.getPageCount()).toBe(3);
    expect(reloaded.catalog.Pages().lookup(PDFName.of("Count"), PDFNumber).asNumber()).toBe(3);
  });

  it("aciona recuperação profunda com PDFium quando a Camada 1 falha por corrupção grave", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]).drawText("Recuperada 1", { x: 20, y: 350 });
    doc.addPage([300, 400]).drawText("Recuperada 2", { x: 20, y: 350 });
    const validBytes = await doc.save({ useObjectStreams: false });
    const ascii = bytesToBinaryString(validBytes);
    const xrefStart = ascii.lastIndexOf("\nxref\n") + 1;
    const trailerStart = ascii.lastIndexOf("\ntrailer\n");
    // Corrompe offsets da tabela xref e adiciona objeto indireto sem endobj após %%EOF,
    // derrubando o parser sequencial do pdf-lib e exigindo recuperação profunda pelo PDFium.
    const corruptedXref = ascii
      .slice(xrefStart, trailerStart)
      .replace(/\d{10} 00000 n/g, "0000099999 00000 n");
    const severelyCorrupted = binaryStringToBytes(
      `${ascii.slice(0, xrefStart)}${corruptedXref}${ascii.slice(trailerStart)}\n999 0 obj\n<< /Corrupted [\n`,
    );

    const loadSpy = vi.spyOn(pdfiumApi, "FPDF_LoadMemDocument");
    const saveSpy = vi.spyOn(pdfiumApi, "FPDF_SaveAsCopy");
    try {
      const result = await repairPdfDocument(severelyCorrupted, {
        loadPdfium: async () => pdfiumApi,
      });
      expect(loadSpy).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalled();
      expect(result.report.fixedXref).toBe(true);
      expect(result.report.recoveredPages).toBe(2);
      expect(result.report.totalDetectedPages).toBe(2);
      expect(result.report.warnings.length).toBeGreaterThan(0);

      const reloaded = await PDFDocument.load(result.pdfBytes);
      expect(reloaded.getPageCount()).toBe(2);
    } finally {
      loadSpy.mockRestore();
      saveSpy.mockRestore();
    }
  });

  it("lança CORRUPTED_DOCUMENT quando o PDF é realmente irrecuperável mesmo com PDFium", async () => {
    const unrecoverable = new TextEncoder().encode("%PDF-1.7\nGARBAGE_SEM_OBJETOS_VALIDOS\n%%EOF");
    await expect(
      repairPdfDocument(unrecoverable, { loadPdfium: async () => pdfiumApi }),
    ).rejects.toThrow("CORRUPTED_DOCUMENT");
  });

  it("reporta perda parcial de página de forma transparente quando um nó /Kids é inválido", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]);
    doc.addPage([300, 400]);
    const pagesTree = doc.catalog.Pages();
    const kids = pagesTree.Kids();
    // Remove o objeto folha da segunda página mantendo a referência quebrada em /Kids
    const secondPageRef = kids.get(1);
    doc.context.delete(secondPageRef as Parameters<typeof doc.context.delete>[0]);
    const partialBytes = await doc.save({ useObjectStreams: false });

    const result = await repairPdfDocument(partialBytes, {
      loadPdfium: async () => pdfiumApi,
    });
    expect(result.report.recoveredPages).toBe(1);
    expect(result.report.totalDetectedPages).toBe(2);
    expect(result.report.warnings.length).toBeGreaterThan(0);

    const reloaded = await PDFDocument.load(result.pdfBytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("descarta objeto indireto malformado com endobj na Camada 1 e preserva páginas válidas", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]).drawText("Intacta", { x: 20, y: 350 });
    const validBytes = await doc.save({ useObjectStreams: false });
    const ascii = bytesToBinaryString(validBytes);
    const xrefStart = ascii.lastIndexOf("\nxref\n") + 1;
    const withInvalidObj = binaryStringToBytes(
      `${ascii.slice(0, xrefStart)}999 0 obj\n<< /Broken [ 1 2 \nendobj\n${ascii.slice(xrefStart)}`,
    );

    const result = await repairPdfDocument(withInvalidObj);
    expect(result.report.recoveredPages).toBe(1);
    expect(result.report.fixedXref).toBe(true);
    expect(result.report.warnings.some((w) => w.includes("inválido"))).toBe(true);

    const reloaded = await PDFDocument.load(result.pdfBytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("preserva erro SENHA_OBRIGATORIA para PDF criptografado sem senha", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]);
    const encryptedBytes = await encryptPDF(await doc.save(), "segredo123", {
      ownerPassword: "dono456",
    });

    await expect(
      repairPdfDocument(encryptedBytes, { loadPdfium: async () => pdfiumApi }),
    ).rejects.toThrow("SENHA_OBRIGATORIA");
  });

  it("lança CORRUPTED_DOCUMENT quando a Camada 1 falha e não há runtime PDFium disponível", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]);
    const ascii = bytesToBinaryString(await doc.save({ useObjectStreams: false }));
    const severelyCorrupted = binaryStringToBytes(`${ascii}\n999 0 obj\n<< /Corrupted [\n`);

    await expect(
      repairPdfDocument(severelyCorrupted, { loadPdfium: async () => undefined }),
    ).rejects.toThrow("CORRUPTED_DOCUMENT");
  });
});
