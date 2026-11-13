import { describe, expect, it, vi } from "vitest";
import { HttpDocumentCorePort } from "@/platform/http-document-core";
import { TauriDocumentCorePort } from "@/platform/tauri-document-core";
import { pdfSuites, resolveAllRegisteredTools, resolveLauncherTools } from "./data";

describe("Strict Functional Tools Catalog", () => {
  it("agrupa edição, comparação e formulários de PDF na categoria correspondente", () => {
    const tools = resolveLauncherTools();
    const category = pdfSuites.find((suite) => suite.id === "edit");
    expect(category).toBeDefined();
    for (const id of ["pdf-edit", "pdf-compare", "pdf-form-fill"]) {
      expect(tools.find((tool) => tool.id === id)?.suite).toBe("edit");
    }
  });
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
      "pdf-remove-pages",
      "pdf-extract-pages",
      "html-to-pdf",
      "scan-to-pdf",
      "pdf-repair",
      "pdf-to-word",
      "pdf-to-pdfa",
      "pdf-summarize",
      "pdf-edit",
      "pdf-compare",
      "image-compress",
      "image-resize",
      "image-crop",
      "image-convert",
      "image-rotate",
      "image-watermark",
    ]) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("word-to-pdf");
    expect(ids).toContain("excel-to-pdf");
    expect(ids).toContain("powerpoint-to-pdf");
    expect(ids).not.toContain("pdf-to-powerpoint");
    expect(ids).toHaveLength(41);
  });
  it("não oferece ferramentas Office ou exclusivas de desktop no navegador offline", () => {
    const tools = resolveLauncherTools();
    const ids = tools.map((t) => t.id);

    expect(ids).toHaveLength(38);
    expect(ids).toContain("pdf-summarize");
    expect(ids).toContain("pdf-compress");
    expect(ids).toContain("pdf-organize");
    expect(ids).toContain("images-to-pdf");
    expect(ids).toContain("pdf-to-jpg");
    expect(ids).toContain("pdf-watermark");
    expect(ids).toContain("pdf-page-numbers");
    expect(ids).toContain("pdf-ocr");
    expect(ids).toContain("pdf-extract-images");
    expect(ids).toContain("text-compare");
    expect(ids).toContain("pdf-to-word");
    expect(ids).not.toContain("word-to-pdf");
    expect(ids).not.toContain("excel-to-pdf");
    expect(ids).not.toContain("powerpoint-to-pdf");
    expect(ids).not.toContain("pdf-to-powerpoint");
    expect(ids).toContain("pdf-protect");
    expect(ids).toContain("pdf-redact");
    expect(ids).toContain("pdf-to-excel");
    expect(ids).toContain("text-translate");

    // Ferramenta de inteligência jurídica removida do escopo do produto
    expect(ids).not.toContain("intelligence-extract");

    // Rotas diretas ainda encontram o manifesto Office para exibir orientação honesta
    const allRegisteredIds = resolveAllRegisteredTools().map((t) => t.id);
    expect(allRegisteredIds).toContain("word-to-pdf");
    expect(allRegisteredIds).toContain("pdf-to-powerpoint");
  });

  it("habilita toda a suíte Office no aplicativo Desktop (Tauri)", () => {
    const desktopTools = resolveLauncherTools([], new TauriDocumentCorePort());
    const desktopIds = desktopTools.map((t) => t.id);
    expect(desktopIds).toHaveLength(42);
    expect(desktopIds).toContain("word-to-pdf");
    expect(desktopIds).toContain("excel-to-pdf");
    expect(desktopIds).toContain("powerpoint-to-pdf");
    expect(desktopIds).toContain("pdf-to-powerpoint");
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
