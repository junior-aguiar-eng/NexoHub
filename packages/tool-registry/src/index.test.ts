import { describe, expect, it } from "vitest";
import { coreToolManifests, createCoreToolRegistry } from "./index";

describe("catálogo central de ferramentas", () => {
  it("registra todo manifesto nas superfícies Quick e Studio", () => {
    const registry = createCoreToolRegistry();
    expect(registry.list("quick")).toHaveLength(coreToolManifests.length);
    expect(registry.list("studio")).toHaveLength(coreToolManifests.length);
  });

  it("não inclui ferramentas planejadas sem executor no registry ativo", () => {
    const registry = createCoreToolRegistry();
    const activeIds = registry.list("quick").map((tool) => tool.id);
    expect(activeIds).toContain("pdf-to-word");
    expect(activeIds).not.toContain("word-to-pdf");
  });

  it("garante contrato real de saída para text-translate", () => {
    const registry = createCoreToolRegistry();
    const translateTool = registry.get("text-translate");
    expect(translateTool?.produces).toEqual(["text/plain"]);
  });
});
