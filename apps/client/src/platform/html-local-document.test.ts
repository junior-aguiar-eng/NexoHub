import { describe, expect, it } from "vitest";
import { localHtmlPreview, parseLocalHtml } from "./html-local-document";

describe("documento HTML local inerte", () => {
  it("conserva conteúdo e quebras de página sem atributos ativos ou URLs", () => {
    const root = parseLocalHtml(
      '<p style="break-before:page" onclick="alert(1)">Texto autoral</p><img src="https://audit.invalid/img"><script>alert(1)</script><iframe src="https://audit.invalid/frame"></iframe>',
    );
    expect(root.querySelector("p")?.style.breakBefore).toBe("page");
    expect(root.textContent).toContain("Texto autoral");
    expect(root.querySelector("[onclick],[src],script,iframe")).toBeNull();
  });

  it("mantém CSP sem rede na prévia mesmo com folhas de estilo fornecidas", () => {
    const preview = localHtmlPreview(
      '<style>@import "https://audit.invalid/css";p{background:url(https://audit.invalid/bg)}</style><p>Conteúdo</p>',
    );
    expect(preview).toContain("default-src 'none'");
    expect(preview).toContain("connect-src 'none'");
    expect(preview).toContain("script-src 'none'");
    expect(preview).toContain("Conteúdo");
  });
});
