import { describe, expect, it } from "vitest";
import { type ImageResultItem, summarizeImageResults } from "./image-results";

function item(before: number, after: number): ImageResultItem {
  return {
    sourceName: "foto.png",
    outputName: "foto.webp",
    before: { width: 100, height: 50, sizeBytes: before, mimeType: "image/png" },
    after: { width: 100, height: 50, sizeBytes: after, mimeType: "image/webp" },
  };
}
describe("medidas reais de exportação", () => {
  it("soma as imagens, informa aumentos e não confunde bytes do ZIP com as saídas", () => {
    expect(summarizeImageResults([item(2000, 1600), item(1000, 1900)])).toEqual({
      beforeBytes: 3000,
      afterBytes: 3500,
      savedBytes: -500,
      percent: -16.7,
    });
    expect(summarizeImageResults([item(1000, 800)])).toEqual({
      beforeBytes: 1000,
      afterBytes: 800,
      savedBytes: 200,
      percent: 20,
    });
  });
  it("não produz percentuais fictícios nem divisão por zero em uma lista vazia", () => {
    expect(summarizeImageResults([])).toEqual({
      beforeBytes: 0,
      afterBytes: 0,
      savedBytes: 0,
      percent: 0,
    });
  });
});
