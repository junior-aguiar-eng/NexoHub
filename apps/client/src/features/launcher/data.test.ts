import type { CapabilityItem } from "@nexohub/contracts";
import { describe, expect, it } from "vitest";
import type { DocumentCorePort } from "@/platform/document-core";
import { resolveLauncherTools } from "./data";

describe("Dynamic Launcher Tools & Capabilities Synchronization", () => {
  it("mantém ferramentas indisponíveis quando nenhum superpoder ou núcleo nativo está ativo", () => {
    const tools = resolveLauncherTools([]);
    const translate = tools.find((t) => t.id === "text-translate");
    const ocr = tools.find((t) => t.id === "pdf-ocr");
    const review = tools.find((t) => t.id === "text-review");

    expect(translate?.availability.available).toBe(false);
    expect(ocr?.availability.available).toBe(false);
    expect(review?.availability.available).toBe(false);
  });

  it("sincroniza disponibilidade de tradução com o superpoder translation.neural", () => {
    const toolsBefore = resolveLauncherTools([]);
    expect(toolsBefore.find((t) => t.id === "text-translate")?.availability.available).toBe(false);

    const installedCap: CapabilityItem = {
      id: "translation.neural",
      title: "Tradutor",
      summary: "",
      benefit: "",
      category: "translation",
      diskSizeBytes: 350000000,
      status: "installed",
      isOptional: true,
    };
    const toolsAfter = resolveLauncherTools([installedCap]);
    expect(toolsAfter.find((t) => t.id === "text-translate")?.availability.available).toBe(true);
  });

  it("sincroniza disponibilidade de revisão profunda com o superpoder text.deep_review", () => {
    const toolsBefore = resolveLauncherTools([]);
    expect(toolsBefore.find((t) => t.id === "text-review")?.availability.available).toBe(false);

    const installedCap: CapabilityItem = {
      id: "text.deep_review",
      title: "Revisor",
      summary: "",
      benefit: "",
      category: "review",
      diskSizeBytes: 180000000,
      status: "installed",
      isOptional: true,
    };
    const toolsAfter = resolveLauncherTools([installedCap]);
    expect(toolsAfter.find((t) => t.id === "text-review")?.availability.available).toBe(true);
  });

  it("sincroniza disponibilidade de OCR com o superpoder ocr.vision", () => {
    const toolsBefore = resolveLauncherTools([]);
    const ocrBefore = toolsBefore.find((t) => t.id === "pdf-ocr");
    expect(ocrBefore?.availability.available).toBe(false);

    const installedCap: CapabilityItem = {
      id: "ocr.vision",
      title: "OCR",
      summary: "",
      benefit: "",
      category: "vision",
      diskSizeBytes: 150000000,
      status: "installed",
      isOptional: true,
    };
    const toolsAfter = resolveLauncherTools([installedCap]);
    const ocrAfter = toolsAfter.find((t) => t.id === "pdf-ocr");
    expect(ocrAfter?.availability.available).toBe(true);
  });

  it("habilita pdf.transform quando documentCore nativo está disponível", () => {
    const mockCore = {} as DocumentCorePort;
    const tools = resolveLauncherTools([], mockCore);
    const compress = tools.find((t) => t.id === "pdf-compress");
    const organize = tools.find((t) => t.id === "pdf-organize");

    expect(compress?.availability.available).toBe(true);
    expect(organize?.availability.available).toBe(true);
  });
});
