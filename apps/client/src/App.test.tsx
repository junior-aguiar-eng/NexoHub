import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { registerToolNavigationGuard } from "./platform/tool-navigation-guard";

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    localStorage.clear();
  });

  it("renderiza o Hub de ferramentas práticas estilo iLovePDF", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Seus PDFs, prontos/ })).toBeInTheDocument();
    expect(screen.getByText(/Seus arquivos nunca saem deste dispositivo/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organizar PDF" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comprimir PDF" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Extrair Imagens" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "PDF para Word" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revisar texto" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comparar textos" })).toBeInTheDocument();
  });

  it("busca apenas pelo cabeçalho, encontra ações e respeita o modo ativo", () => {
    render(<App />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buscar no NexoHub" }));
    const dialog = screen.getByRole("dialog");
    const search = within(dialog).getByRole("searchbox");
    fireEvent.change(search, { target: { value: "rotacionar" } });
    expect(within(dialog).getByRole("button", { name: /Rotacionar PDF/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Juntar PDF/ })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "inexistente123" } });
    expect(within(dialog).getByRole("status")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Fechar/ }));
    fireEvent.click(screen.getByRole("button", { name: /alternar para modo imagem/i }));
    fireEvent.click(screen.getByRole("button", { name: "Buscar no NexoHub" }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", { name: /Juntar PDF/ }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Redimensionar imagem/ }),
    ).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: /Seus PDFs, prontos/ })).toBeInTheDocument();
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

  it("mantém o fundo limpo e o rodapé uniformizado", () => {
    const { container } = render(<App />);

    const backdrop = container.querySelector(".parallax-backdrop");
    expect(backdrop).not.toBeInTheDocument();

    // Rodapé está uniformizado com a logo oficial e o novo layout
    const footer = container.querySelector(".app-footer");
    expect(footer).toBeInTheDocument();
    expect(within(footer as HTMLElement).getByText("HUB")).toBeInTheDocument();
    expect(within(footer as HTMLElement).getByText("NEXO")).toBeInTheDocument();
  });

  it("executa reset de rolagem da janela ao selecionar uma ferramenta", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<App />);

    const card = screen.getByRole("heading", { name: "Comprimir PDF" }).closest("article");
    if (!card) throw new Error("card da ferramenta não encontrado");

    fireEvent.click(card);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });

    scrollToSpy.mockRestore();
  });

  it("suporta alternância entre Modo PDF e Modo Imagem via SegmentedZoneToggle com atualização de data-zone e rota", () => {
    const { container } = render(<App />);

    const appShell = container.querySelector(".app-shell");
    expect(appShell).toHaveAttribute("data-zone", "pdf");

    // Alterna para o Modo Imagem
    const imgTabs = screen.getAllByRole("button", { name: /alternar para modo imagem/i });
    fireEvent.click(imgTabs[0]);

    expect(appShell).toHaveAttribute("data-zone", "img");
    expect(
      screen.getByRole("heading", { name: "Suas imagens, do jeito que você precisa." }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("panel-zone-img") || screen.getByRole("tabpanel"),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/img");

    // Retorna para o Modo PDF
    const pdfTabs = screen.getAllByRole("button", { name: /alternar para modo pdf/i });
    fireEvent.click(pdfTabs[0]);

    expect(appShell).toHaveAttribute("data-zone", "pdf");
    expect(screen.getByRole("heading", { name: /Seus PDFs, prontos/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/pdf");
  });

  it("protege edições ao alternar o modo e mantém a rota se a navegação for recusada", () => {
    render(<App />);
    const release = registerToolNavigationGuard(() => false);
    try {
      fireEvent.click(screen.getAllByRole("button", { name: /alternar para modo imagem/i })[0]);
      expect(window.location.pathname).toBe("/pdf");
      expect(screen.getByTestId("panel-zone-pdf")).toBeInTheDocument();
    } finally {
      release();
    }
  });

  it("inicializa no Modo Imagem diretamente quando a rota inicial é /img", () => {
    window.history.pushState({}, "", "/img");
    const { container } = render(<App />);

    const appShell = container.querySelector(".app-shell");
    expect(appShell).toHaveAttribute("data-zone", "img");
    expect(
      screen.getByRole("heading", { name: "Suas imagens, do jeito que você precisa." }),
    ).toBeInTheDocument();
  });
});
