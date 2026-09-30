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
});
