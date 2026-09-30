import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("renderiza o Hub de ferramentas práticas estilo iLovePDF", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Olá, o que faremos hoje\?/i })).toBeInTheDocument();
    expect(screen.getByText(/ferramentas disponíveis neste dispositivo/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organizar PDF" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comprimir PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Extrair Imagens" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Revisar texto" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: /Olá, o que faremos hoje\?/i })).toBeInTheDocument();
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

  it("reinicia a tela dedicada ao navegar para outra ferramenta", async () => {
    render(<App />);
    const card = screen.getByRole("heading", { name: "Comparar textos" }).closest("article");
    if (!card) throw new Error("card de comparação não encontrado");
    fireEvent.click(card);
    fireEvent.change(screen.getByRole("textbox", { name: /Documento 1/i }), {
      target: { value: "Texto inicial" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Documento 2/i }), {
      target: { value: "Texto revisado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comparar Textos" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Pronto! Arquivo processado/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      within(screen.getByRole("navigation", { name: /Navegação Principal/i })).getByRole("button", {
        name: "Juntar PDF",
      }),
    );
    expect(
      screen.queryByRole("heading", { name: /Pronto! Arquivo processado/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Juntar PDF" })).toBeInTheDocument();
  });
});
