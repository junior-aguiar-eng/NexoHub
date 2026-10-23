import { describe, expect, it } from "vitest";
import { withAppBase, withoutAppBase } from "./app-paths";

describe("caminhos de publicação", () => {
  it("preserva rotas e recursos na instalação raiz", () => {
    expect(withAppBase("/pdf", "/")).toBe("/pdf");
    expect(withAppBase("standard_fonts/", "/")).toBe("/standard_fonts/");
    expect(withoutAppBase("/juntar-pdf/", "/")).toBe("/juntar-pdf/");
  });
  it("mantém navegação e recursos dentro da subpasta", () => {
    expect(withAppBase("/pdf", "/hub/")).toBe("/hub/pdf");
    expect(withAppBase("/", "/hub/")).toBe("/hub/");
    expect(withAppBase("standard_fonts/", "/hub/")).toBe("/hub/standard_fonts/");
    expect(withAppBase("favicon-img.svg", "/hub/")).toBe("/hub/favicon-img.svg");
    expect(withAppBase("/img", "/hub")).toBe("/hub/img");
  });
  it("reconhece acesso direto e a raiz com ou sem barra", () => {
    expect(withoutAppBase("/hub/juntar-pdf/", "/hub/")).toBe("/juntar-pdf/");
    expect(withoutAppBase("/hub/", "/hub/")).toBe("/");
    expect(withoutAppBase("/hub", "/hub/")).toBe("/");
  });
  it("não confunde nomes que apenas começam pelo prefixo", () => {
    expect(withoutAppBase("/hub7/pdf", "/hub/")).toBe("/hub7/pdf");
    expect(withoutAppBase("/outro/pdf", "/hub/")).toBe("/outro/pdf");
  });
});
