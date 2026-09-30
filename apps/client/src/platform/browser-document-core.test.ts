import { asArtifactId, asDocumentId } from "@nexohub/domain";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { BrowserDocumentCorePort } from "./browser-document-core";
import { translateTextLocally } from "./browser-translation";

describe("BrowserDocumentCorePort Real Capabilities", () => {
  it("dicionário simples preserva quebras de linha", () => {
    const inputEnglish =
      "Contract Agreement\nThe parties agree to the following terms and conditions.";
    const translated = translateTextLocally(inputEnglish, "en", "pt");

    expect(translated).toContain("Contrato");
    expect(translated).toContain("Acordo");
    expect(translated).toContain("partes");
    expect(translated).toContain("termos e condições");
  });

  it("não apresenta o dicionário como tradução neural", async () => {
    const port = new BrowserDocumentCorePort();
    await expect(
      port.invoke("translate_text", {
        text: "Confidentiality clause\nAll documents are protected under applicable law.",
        sourceLanguage: "en",
        targetLanguage: "pt",
      }),
    ).rejects.toThrow();
  });

  it("não fabrica OCR quando o artifact de entrada não existe", async () => {
    const port = new BrowserDocumentCorePort();
    const defaultPath = "/meus-documentos/dossie-local";
    const docId = asDocumentId("doc-ocr-test");
    const artId = asArtifactId("art-ocr-test");

    await expect(
      port.invoke("execute_ocr", {
        projectPath: defaultPath,
        documentId: docId,
        artifactId: artId,
      }),
    ).rejects.toThrow();
  });

  it("não informa instalação de capacidade sem instalar arquivos", async () => {
    const port = new BrowserDocumentCorePort();
    await expect(
      port.invoke("install_capability", { capabilityId: "translation.neural" }),
    ).rejects.toThrow();
  });

  it("rejeita importação sem arquivo selecionado", async () => {
    const port = new BrowserDocumentCorePort();
    await expect(
      port.invoke("import_document", {
        projectPath: "/meus-documentos/pasta-local",
        sourcePath: "ausente.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow();
  });

  it("registra PDF comprimido válido e preserva o original", async () => {
    const source = await PDFDocument.create();
    source.addPage([200, 200]);
    const bytes = await source.save();
    const file = new File([bytes as unknown as BlobPart], "contrato.pdf", {
      type: "application/pdf",
    });
    const port = new BrowserDocumentCorePort();
    const path = "/meus-documentos/pasta-local";
    port.registerUploadedFile(file);
    const imported = await port.invoke("import_document", {
      projectPath: path,
      sourcePath: file.name,
      mimeType: file.type,
    });
    const result = await port.invoke("compress_pdf", {
      projectPath: path,
      documentId: imported.document.id,
      artifactId: imported.artifact.id,
      compressionLevel: 2,
    });
    const derived = port.getArtifactBlob(result.artifact.id);
    if (!derived) throw new Error("Artifact derivado ausente");
    expect((await PDFDocument.load(await derived.arrayBuffer())).getPageCount()).toBe(1);
    const original = port.getArtifactBlob(imported.artifact.id);
    if (!original) throw new Error("Artifact original ausente");
    expect(new Uint8Array(await original.arrayBuffer())).toEqual(bytes);
    const lineage = await port.invoke("get_document_lineage", {
      projectPath: path,
      documentId: imported.document.id,
    });
    expect(lineage.edges).toHaveLength(1);
  });
});
