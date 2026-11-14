import { describe, expect, it } from "vitest";
import { localHtmlPreview } from "./html-local-document";

describe("prévia local de HTML grande", () => {
  it("gera prévia segura para documentos HTML grandes com estilos internos", () => {
    const rows = Array.from({ length: 1500 }, (_, i) => `<tr><td>Item ${i}</td></tr>`).join("");
    const largeHtml = `<!doctype html><html><head><style>table{width:100%}</style></head><body><table>${rows}</table></body></html>`;
    const preview = localHtmlPreview(largeHtml);
    expect(preview).toContain("table{width:100%}");
    expect(preview).toContain("Item 1499");
  });
});
