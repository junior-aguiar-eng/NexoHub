import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("renderiza o Hub de ferramentas práticas estilo iLovePDF", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /Olá, Boni, o que faremos hoje\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Use todas as ferramentas de forma gratuita e ilimitada/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organizar PDF" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comprimir PDF" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Extrair Imagens" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revisar texto" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comparar textos" })).toBeInTheDocument();
  });

  it("abre a tela dedicada ao clicar em uma ferramenta e retorna ao hub", () => {
    render(<App />);

    const card = screen.getByRole("heading", { name: "Comprimir PDF" }).closest("article");
    if (!card) throw new Error("card da ferramenta não encontrado");

    fireEvent.click(card);

    // Deve estar na tela dedicada da ferramenta
    const main = screen.getByRole("main");
    expect(within(main).getByRole("button", { name: /Todas as ferramentas/i })).toBeInTheDocument();
    expect(within(main).getByText(/Selecionar arquivo PDF/i)).toBeInTheDocument();

    // Retorna ao Hub
    fireEvent.click(within(main).getByRole("button", { name: /Todas as ferramentas/i }));
    expect(
      screen.getByRole("heading", { name: /Olá, Boni, o que faremos hoje\?/i }),
    ).toBeInTheDocument();
  });

  it("filtra as ferramentas pelas categorias do topo", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", { name: /Categorias de ferramentas/i });
    fireEvent.click(within(nav).getByRole("button", { name: "Organizar PDF" }));

    expect(screen.getByRole("heading", { name: "Organizar PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Comparar textos" })).not.toBeInTheDocument();
  });

  it("abre e fecha a paleta por teclado (Ctrl+K)", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Paleta de comandos" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog", { name: "Paleta de comandos" })).not.toBeInTheDocument();
  });
});
