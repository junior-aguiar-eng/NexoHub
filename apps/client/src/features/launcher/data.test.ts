import { describe, expect, it, vi } from "vitest";
import { resolveLauncherTools } from "./data";

describe("Strict Functional Tools Catalog", () => {
  it("não oferece conversões e proteção sem executor", () => {
    const tools = resolveLauncherTools();
    const ids = tools.map((t) => t.id);

    expect(ids).toContain("pdf-compress");
    expect(ids).toContain("pdf-organize");
    expect(ids).not.toContain("pdf-extract-images");
    expect(ids).toContain("text-compare");
    expect(ids).not.toContain("pdf-to-word");
    expect(ids).not.toContain("word-to-pdf");
    expect(ids).not.toContain("images-to-pdf");
    expect(ids).not.toContain("pdf-protect");
    expect(ids).not.toContain("pdf-ocr");
    expect(ids).not.toContain("text-translate");

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
