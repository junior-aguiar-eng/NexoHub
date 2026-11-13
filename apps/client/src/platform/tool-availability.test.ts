import { coreToolRegistry } from "@nexohub/tool-registry";
import { describe, expect, it } from "vitest";
import {
  activeToolIds,
  browserSupportedToolIds,
  httpSupportedToolIds,
  tauriSupportedToolIds,
  universalBrowserToolIds,
} from "./tool-availability";

describe("Fonte única de disponibilidade de ferramentas", () => {
  it("deriva activeToolIds a partir do catálogo oficial", () => {
    const registryIds = coreToolRegistry.list("quick").map((tool) => tool.id);
    expect(activeToolIds.size).toBe(registryIds.length);
    for (const id of registryIds) {
      expect(activeToolIds.has(id)).toBe(true);
    }
  });

  it("restringe a web offline às 38 ferramentas 100% locais sem enganar sobre Office", () => {
    expect(browserSupportedToolIds).toBe(universalBrowserToolIds);
    expect(browserSupportedToolIds.size).toBe(38);
    expect(browserSupportedToolIds.has("pdf-to-pdfa")).toBe(true);
    expect(browserSupportedToolIds.has("pdf-summarize")).toBe(true);
    expect(browserSupportedToolIds.has("word-to-pdf")).toBe(false);
    expect(browserSupportedToolIds.has("excel-to-pdf")).toBe(false);
    expect(browserSupportedToolIds.has("powerpoint-to-pdf")).toBe(false);
    expect(browserSupportedToolIds.has("pdf-to-powerpoint")).toBe(false);
  });

  it("expõe Office-para-PDF na Web Híbrida e toda a suíte Office no Desktop", () => {
    expect(httpSupportedToolIds.size).toBe(41);
    expect(httpSupportedToolIds.has("word-to-pdf")).toBe(true);
    expect(httpSupportedToolIds.has("excel-to-pdf")).toBe(true);
    expect(httpSupportedToolIds.has("powerpoint-to-pdf")).toBe(true);
    expect(httpSupportedToolIds.has("pdf-to-powerpoint")).toBe(false);

    expect(tauriSupportedToolIds).toBe(activeToolIds);
    expect(tauriSupportedToolIds.size).toBe(42);
    expect(tauriSupportedToolIds.has("word-to-pdf")).toBe(true);
    expect(tauriSupportedToolIds.has("excel-to-pdf")).toBe(true);
    expect(tauriSupportedToolIds.has("powerpoint-to-pdf")).toBe(true);
    expect(tauriSupportedToolIds.has("pdf-to-powerpoint")).toBe(true);
  });
});
