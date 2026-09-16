import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import { StudioWorkspace } from "./StudioWorkspace";

describe("StudioWorkspace — Centro Adaptativo", () => {
  it("renderiza a barra de navegação WAI-ARIA com os 4 modos canônicos", () => {
    const documentCore = new BrowserDocumentCorePort();
    render(<StudioWorkspace onClose={() => {}} documentCore={documentCore} />);

    const tablist = screen.getByRole("tablist", { name: "Centro adaptativo" });
    expect(tablist).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: /Ler/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Transformar/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: /Revisar/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Automatizar/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("permite navegar entre os modos e exibe o painel correspondente", () => {
    const documentCore = new BrowserDocumentCorePort();
    render(<StudioWorkspace onClose={() => {}} documentCore={documentCore} />);

    // Alterna para Transformar
    fireEvent.click(screen.getByRole("tab", { name: /Transformar/i }));
    expect(screen.getByRole("tab", { name: /Transformar/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-transform");
    expect(screen.getAllByRole("button", { name: /Comprimir PDF/i }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByRole("button", { name: /Organizar Páginas/i })).toBeInTheDocument();

    // Alterna para Revisar
    fireEvent.click(screen.getByRole("tab", { name: /Revisar/i }));
    expect(screen.getByRole("tab", { name: /Revisar/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-review");
    expect(screen.getByRole("button", { name: /Revisar Texto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Comparar Versões/i })).toBeInTheDocument();

    // Alterna para Automatizar
    fireEvent.click(screen.getByRole("tab", { name: /Automatizar/i }));
    expect(screen.getByRole("tab", { name: /Automatizar/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-automate");
    expect(screen.getByRole("button", { name: /Salvar como Receita/i })).toBeInTheDocument();
  });

  it("permite navegar pelas abas usando as teclas de seta", () => {
    const documentCore = new BrowserDocumentCorePort();
    render(<StudioWorkspace onClose={() => {}} documentCore={documentCore} />);

    const tablist = screen.getByRole("tablist", { name: "Centro adaptativo" });
    const tabRead = screen.getByRole("tab", { name: /Ler/i });
    tabRead.focus();

    // Seta para a direita: vai para Transformar
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Transformar/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Seta para a esquerda: volta para Ler
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /Ler/i })).toHaveAttribute("aria-selected", "true");
  });
});
