import { describe, expect, it } from "vitest";
import { performBrowserOcr } from "./browser-ocr";

describe("OCR no navegador", () => {
  it("falha quando o Worker não está disponível, sem inventar texto", async () => {
    const originalWorker = globalThis.Worker;
    try {
      Object.defineProperty(globalThis, "Worker", { value: undefined, configurable: true });
      await expect(performBrowserOcr(new Blob(["entrada"]))).rejects.toThrow();
    } finally {
      Object.defineProperty(globalThis, "Worker", { value: originalWorker, configurable: true });
    }
  });

  it("aplica realce de contraste adaptativo em dados de pixel de canvas", async () => {
    const { applyContrastEnhancement } = await import("./browser-ocr");
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#888888";
      ctx.fillRect(0, 0, 10, 10);
      applyContrastEnhancement(ctx, 10, 10);
      const imgData = ctx.getImageData(0, 0, 10, 10);
      expect(imgData.data.length).toBe(400);
      expect(imgData.data[3]).toBe(255); // Alpha preservado
    }
  });
});
