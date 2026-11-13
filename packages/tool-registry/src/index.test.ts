import { describe, expect, it } from "vitest";
import { coreToolManifests, createCoreToolRegistry } from "./index";

describe("catálogo central de ferramentas", () => {
  it("registra todo manifesto nas superfícies Quick e Studio", () => {
    const registry = createCoreToolRegistry();
    expect(registry.list("quick")).toHaveLength(coreToolManifests.length);
    expect(registry.list("studio")).toHaveLength(coreToolManifests.length);
  });

  it("declara disponibilidade honesta por plataforma na suíte Office", () => {
    const registry = createCoreToolRegistry();
    expect(registry.get("pdf-to-word")?.availability).toBeUndefined();
    expect(registry.get("word-to-pdf")?.availability).toBe("hybrid-cloud");
    expect(registry.get("excel-to-pdf")?.availability).toBe("hybrid-cloud");
    expect(registry.get("powerpoint-to-pdf")?.availability).toBe("hybrid-cloud");
    expect(registry.get("pdf-to-powerpoint")?.availability).toBe("desktop-superpower");
    expect(registry.get("word-to-pdf")?.requiredCapability).toBe("office.suite");
    expect(registry.get("word-to-pdf")?.optionalCloudTool).toBe("office-to-pdf");
  });

  it("garante contrato real de saída para text-translate", () => {
    const registry = createCoreToolRegistry();
    const translateTool = registry.get("text-translate");
    expect(translateTool?.produces).toEqual(["text/plain"]);
  });

  it("registra pdf-summarize como ferramenta universal local no navegador", () => {
    const registry = createCoreToolRegistry();
    const summarizeTool = registry.get("pdf-summarize");
    expect(summarizeTool).toBeDefined();
    expect(summarizeTool?.executor).toBe("browser");
    expect(summarizeTool?.availability).toBeUndefined();
    expect(summarizeTool?.produces).toEqual(["text/markdown", "text/plain", "application/pdf"]);
  });
});
