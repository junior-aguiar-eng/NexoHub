// @vitest-environment node
import { readFile } from "node:fs/promises";
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { checkPdfProtection, unlockPdfDocument } from "./pdf-unlock";

const password = " senha com espacos ";
const algorithms = [
  "RC4-40",
  "RC4-128",
  "AES-128",
  "AES-256-R5",
  "AES-256",
  "AES-256-object-streams",
  "AES-256-incremental",
  "AES-128-plain-metadata",
  "AES-256-pdf2",
];
async function fixture(name: string) {
  return new Uint8Array(
    await readFile(new URL(`./__fixtures__/pdf-unlock/${name}.pdf`, import.meta.url)),
  );
}

describe("desbloqueio PDF sem perda estrutural", () => {
  it.each(algorithms)("decripta strings e streams %s preservando o grafo", async (algorithm) => {
    const source = await fixture(algorithm);
    const original = source.slice();
    const result = await unlockPdfDocument(source, { password });
    expect(source).toEqual(original);
    expect(result).not.toBe(source);
    const pdf = await PDFDocument.load(result);
    expect(pdf.context.trailerInfo.Encrypt).toBeUndefined();
    expect(pdf.getTitle()).toBe("Titulo preservado");
    expect(pdf.getAuthor()).toBe("Auditoria NexoHub");
    const contents = pdf.getPage(0).node.Contents();
    expect(contents).toBeInstanceOf(PDFRawStream);
    expect(
      new TextDecoder().decode(decodePDFRawStream(contents as PDFRawStream).decode()),
    ).toContain("NexoHub unlocked text");
    expect(pdf.getForm().getTextField("nome").getText()).toBe("Valor editavel");
    const links = pdf.getPage(0).node.Annots();
    const action = links?.lookup(0, PDFDict).lookup(PDFName.of("A"), PDFDict);
    expect(action?.lookup(PDFName.of("URI"))?.toString()).toContain(
      "https://example.com/documento",
    );
    expect(pdf.catalog.has(PDFName.of("Outlines"))).toBe(true);
    const names = pdf.catalog.lookup(PDFName.of("Names"), PDFDict);
    expect(names.has(PDFName.of("EmbeddedFiles"))).toBe(true);
    const metadata = pdf.context.lookup(pdf.catalog.get(PDFName.of("Metadata"))) as PDFRawStream;
    expect(new TextDecoder().decode(decodePDFRawStream(metadata).decode())).toContain(
      "XMP preservado",
    );
    expect(await checkPdfProtection(result)).toEqual({
      isProtected: false,
      needsPassword: false,
      hasPermissionsRestriction: false,
    });
  });

  it("preserva a versão PDF 2.0 e a atualização incremental", async () => {
    const pdf2 = await unlockPdfDocument(await fixture("AES-256-pdf2"), { password });
    expect(new TextDecoder().decode(pdf2.subarray(0, 8))).toBe("%PDF-2.0");
    const incremental = await PDFDocument.load(
      await unlockPdfDocument(await fixture("AES-256-incremental"), { password }),
    );
    expect(incremental.getSubject()).toBe("Atualizacao incremental");
  });

  it("recusa regravar ByteRange que perderia a validade", async () => {
    const source = await fixture("signed-placeholder");
    const original = source.slice();
    await expect(unlockPdfDocument(source, { password })).rejects.toThrow(
      "PDF_ASSINADO_NAO_SUPORTADO",
    );
    expect(source).toEqual(original);
  });

  it("detecta senha de abertura sem destacar ou modificar o original", async () => {
    const source = await fixture("AES-256");
    const original = source.slice();
    expect(await checkPdfProtection(source)).toMatchObject({
      isProtected: true,
      needsPassword: true,
    });
    expect(source).toEqual(original);
  });

  it("valida senha sem aparar espaços e recusa senha incorreta", async () => {
    const source = await fixture("AES-128");
    await expect(unlockPdfDocument(source, { password: password.trim() })).rejects.toThrow(
      "SENHA_INCORRETA",
    );
    await expect(unlockPdfDocument(source)).rejects.toThrow("SENHA_OBRIGATORIA");
  });

  it("remove restrições sem senha de abertura", async () => {
    const source = await fixture("permissions-only");
    expect(await checkPdfProtection(source)).toEqual({
      isProtected: true,
      needsPassword: false,
      hasPermissionsRestriction: true,
    });
    const pdf = await PDFDocument.load(await unlockPdfDocument(source));
    expect(pdf.getTitle()).toBe("Titulo preservado");
    expect(pdf.context.trailerInfo.Encrypt).toBeUndefined();
  });

  it("recusa entrada vazia e PDF inválido em vez de declarar sucesso", async () => {
    await expect(unlockPdfDocument(new Uint8Array())).rejects.toThrow("EMPTY_DOCUMENT");
    await expect(
      checkPdfProtection(new TextEncoder().encode("documento inválido")),
    ).rejects.toThrow();
  });

  it("devolve cópia de PDF já livre preservando seus bytes", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const source = await pdf.save();
    expect(await unlockPdfDocument(source)).toEqual(source);
    expect(await unlockPdfDocument(source)).not.toBe(source);
  });
});
