import { coreToolRegistry } from "@nexohub/tool-registry";
import { describe, expect, it } from "vitest";
import {
  activeToolIds,
  browserSupportedToolIds,
  httpSupportedToolIds,
  tauriSupportedToolIds,
} from "./tool-availability";

describe("Fonte única de disponibilidade de ferramentas", () => {
  it("deriva activeToolIds a partir do catálogo oficial", () => {
    const registryIds = coreToolRegistry.list("quick").map((tool) => tool.id);
    expect(activeToolIds.size).toBe(registryIds.length);
    for (const id of registryIds) {
      expect(activeToolIds.has(id)).toBe(true);
    }
  });

  it("não inclui ferramentas sem executor implementado", () => {
    expect(activeToolIds.has("pdf-to-word")).toBe(false);
    expect(activeToolIds.has("word-to-pdf")).toBe(false);
  });

  it("mantém paridade de disponibilidade entre Browser, Tauri e HTTP", () => {
    expect(browserSupportedToolIds).toBe(activeToolIds);
    expect(tauriSupportedToolIds).toBe(activeToolIds);
    expect(httpSupportedToolIds).toBe(activeToolIds);
  });

  it("contém exatamente as 35 ferramentas ativas do produto", () => {
    // 29 ferramentas PDF/Texto + 6 ferramentas de imagem
    expect(activeToolIds.has("pdf-repair")).toBe(true);
    expect(activeToolIds.size).toBe(35);
  });
});
