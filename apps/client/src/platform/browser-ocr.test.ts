import { describe, expect, it } from "vitest";
import { applyContrastEnhancement, performBrowserOcr } from "./browser-ocr";

describe("OCR no navegador", () => {
  it("preserva preto e branco e aumenta contraste sem inverter os tons", () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255, 255, 255, 255, 255, 96, 96, 96, 255, 160, 160, 160, 255,
    ]);
    const context = {
      getImageData: () => ({ data }),
      putImageData: () => {},
    } as unknown as CanvasRenderingContext2D;
    applyContrastEnhancement(context, 4, 1);
    expect(data[0]).toBe(0);
    expect(data[4]).toBe(255);
    expect(data[8]).toBeLessThan(96);
    expect(data[12]).toBeGreaterThan(160);
    expect([data[3], data[7], data[11], data[15]]).toEqual([255, 255, 255, 255]);
  });
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
