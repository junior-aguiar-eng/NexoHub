import { describe, expect, it, vi } from "vitest";
import { HttpDocumentCorePort } from "@/platform/http-document-core";
import { resolveLauncherTools } from "./data";

describe("Strict Functional Tools Catalog", () => {
  it("mantém as ferramentas de navegador disponíveis no website com adapter HTTP", () => {
    const tools = resolveLauncherTools([], new HttpDocumentCorePort());
    const ids = tools.map((tool) => tool.id);
    for (const id of [
      "images-to-pdf",
      "pdf-to-jpg",
      "pdf-watermark",
      "pdf-page-numbers",
      "pdf-to-markdown",
      "pdf-crop",
      "pdf-sign",
      "pdf-extract-images",
      "pdf-form-fill",
      "pdf-unlock",
      "pdf-protect",
      "pdf-redact",
      "pdf-to-excel",
    ]) {
      expect(ids).toContain(id);
    }
    expect(ids).toHaveLength(22);
  });
  it("não oferece conversões e proteção sem executor", () => {
    const tools = resolveLauncherTools();
    const ids = tools.map((t) => t.id);

    expect(ids).toContain("pdf-compress");
    expect(ids).toContain("pdf-organize");
    expect(ids).toContain("images-to-pdf");
    expect(ids).toContain("pdf-to-jpg");
    expect(ids).toContain("pdf-watermark");
    expect(ids).toContain("pdf-page-numbers");
    expect(ids).toContain("pdf-ocr");
    expect(ids).toContain("pdf-extract-images");
    expect(ids).toContain("text-compare");
    expect(ids).not.toContain("pdf-to-word");
    expect(ids).not.toContain("word-to-pdf");
    expect(ids).toContain("pdf-protect");
    expect(ids).toContain("pdf-redact");
    expect(ids).toContain("pdf-to-excel");
    expect(ids).toContain("text-translate");

    // Ferramenta de inteligência jurídica removida do escopo do produto
    expect(ids).not.toContain("intelligence-extract");
  });

  it("todas as ferramentas do launcher possuem disponibilidade confirmada sem 'Em breve'", () => {
    const tools = resolveLauncherTools();
    for (const tool of tools) {
      expect(tool.availability.available).toBe(true);
    }
  });

  it("expande o catálogo de ferramentas no desktop quando documentCore nativo suporta superpoderes", () => {
    const desktopPort = {
      supportedToolIds: new Set([
        "pdf-compress",
        "pdf-organize",
        "pdf-ocr",
        "text-translate",
        "text-review",
        "pdf-extract-images",
      ]),
      invoke: vi.fn(),
    };
    const tools = resolveLauncherTools([], desktopPort);
    const ids = tools.map((t) => t.id);
    expect(ids).toContain("pdf-ocr");
    expect(ids).toContain("text-translate");
    expect(ids).toContain("text-review");
    expect(ids).toContain("pdf-extract-images");
  });
});
