import { asArtifactId, asDocumentId } from "@nexohub/domain";
import { describe, expect, it } from "vitest";
import { BrowserDocumentCorePort } from "./browser-document-core";
import { translateTextLocally } from "./browser-translation";

describe("BrowserDocumentCorePort Real Capabilities", () => {
  it("executa tradução offline inteligente preservando quebras de linha e termos de documentos", () => {
    const inputEnglish =
      "Contract Agreement\nThe parties agree to the following terms and conditions.";
    const translated = translateTextLocally(inputEnglish, "en", "pt");

    expect(translated).toContain("Contrato");
    expect(translated).toContain("Acordo");
    expect(translated).toContain("partes");
    expect(translated).toContain("termos e condições");
  });

  it("executa comando translate_text no port e retorna resultado estruturado", async () => {
    const port = new BrowserDocumentCorePort();
    const result = await port.invoke("translate_text", {
      text: "Confidentiality clause\nAll documents are protected under applicable law.",
      sourceLanguage: "en",
      targetLanguage: "pt",
    });

    expect(result.text).toBeDefined();
    expect(result.sourceLanguage).toBe("en");
    expect(result.targetLanguage).toBe("pt");
    expect(result.segments).toBeGreaterThan(0);
  });

  it("executa comando execute_ocr no port e produz artefato de texto com integridade", async () => {
    const port = new BrowserDocumentCorePort();
    const defaultPath = "/meus-documentos/dossie-local";
    const docId = asDocumentId("doc-ocr-test");
    const artId = asArtifactId("art-ocr-test");

    const result = await port.invoke("execute_ocr", {
      projectPath: defaultPath,
      documentId: docId,
      artifactId: artId,
    });

    expect(result.text).toBeDefined();
    expect(result.lines).toBeDefined();
    expect(result.engine).toBeDefined();
    expect(result.artifact).toBeDefined();
    expect(result.artifact.mimeType).toBe("text/plain");
    expect(port.getArtifactBlob(result.artifact.id)).not.toBeNull();
  });
});
