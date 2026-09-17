import { describe, expect, it } from "vitest";
import { resolveLauncherTools } from "./data";

describe("Strict Functional Tools Catalog", () => {
  it("expõe apenas ferramentas 100% implementadas e prontas para execução", () => {
    const tools = resolveLauncherTools();
    const ids = tools.map((t) => t.id);

    expect(ids).toContain("pdf-compress");
    expect(ids).toContain("pdf-organize");
    expect(ids).toContain("pdf-extract-images");
    expect(ids).toContain("pdf-ocr");
    expect(ids).toContain("text-review");
    expect(ids).toContain("text-compare");
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
});
