import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renderiza o Launcher sem oferecer execução fictícia", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /Documentos jurídicos|Documentos complexos/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comece por uma tarefa" })).toBeInTheDocument();
    expect(screen.getAllByText("Em breve")).toHaveLength(8);
    expect(screen.getByText("Organizar PDF").closest("article")).toContainElement(
      screen.getAllByTitle("Transformações de PDF chegam na Fase 4.")[0],
    );
    expect(screen.getAllByRole("button", { name: /Abrir Studio/i })[0]).toBeEnabled();
  });

  it("abre o Studio e retorna ao Launcher sem acessar APIs nativas diretamente", () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: /Abrir Studio/i })[0]);
    expect(
      screen.getByRole("heading", { name: /Seu documento, com contexto preservado/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documentos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Auditor|Inspector/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Âncoras|Anchors/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar âncora|Criar anchor/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Voltar ao Launcher/i }));
    expect(
      screen.getByRole("heading", { name: /Documentos jurídicos|Documentos complexos/i }),
    ).toBeInTheDocument();
  });

  it("promove uma Quick Tool para um rascunho NexoFlow no Studio", () => {
    render(<App />);
    const card = screen.getByText("Comprimir PDF").closest("article");
    if (!card) throw new Error("card da ferramenta não encontrado");

    fireEvent.click(within(card).getByRole("button", { name: "Continuar no Studio" }));

    expect(screen.getByRole("heading", { name: "NexoFlow" })).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getAllByText("pdf-compress").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Nexo Layers" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Otimização e Compressão de PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Comprimir e Registrar Nova Versão" }),
    ).toBeInTheDocument();
  });

  it("abre a comparação de textos ao promover a ferramenta textual", () => {
    render(<App />);
    const card = screen.getByText("Comparar textos").closest("article");
    if (!card) throw new Error("card textual não encontrado");

    fireEvent.click(within(card).getByRole("button", { name: "Continuar no Studio" }));
    expect(screen.getByRole("heading", { name: "Comparar textos" })).toBeInTheDocument();
    const editor = screen.getByRole("textbox", { name: "Texto original" });
    fireEvent.change(editor, { target: { value: "Texto" } });

    expect(editor).toHaveValue("Texto");
    expect(screen.getByRole("button", { name: "Comparar" })).toBeInTheDocument();
  });

  it("exige o sidecar comunitário para iniciar a revisão", () => {
    render(<App />);
    const card = screen.getByText("Revisar texto").closest("article");
    if (!card) throw new Error("card de revisão não encontrado");
    fireEvent.click(within(card).getByRole("button", { name: "Continuar no Studio" }));

    expect(screen.getByText(/LanguageTool Community|revisor local/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analisar texto" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Criar revisão" })).toBeDisabled();
  });

  it("expõe o OCR local sem habilitar execução fora de um artifact", () => {
    render(<App />);
    const card = screen.getByText(/Reconhecer texto/i).closest("article");
    if (!card) throw new Error("card OCR não encontrado");

    fireEvent.click(within(card).getByRole("button", { name: "Continuar no Studio" }));

    expect(
      screen.getByRole("heading", { name: "Reconhecimento óptico de caracteres" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Processamento offline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Executar OCR" })).toBeDisabled();
  });

  it("expõe tradução local sem simular modelo instalado", () => {
    render(<App />);
    const card = screen.getByText("Traduzir texto").closest("article");
    if (!card) throw new Error("card de tradução não encontrado");

    fireEvent.click(within(card).getByRole("button", { name: "Continuar no Studio" }));

    expect(screen.getByRole("heading", { name: "Tradução documental" })).toBeInTheDocument();
    expect(screen.getByText(/Instale um modelo compatível/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Traduzir texto" })).toBeDisabled();
  });

  it("filtra as ferramentas pela suíte ativa", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", { name: "Suítes do NexoHub" });
    fireEvent.click(within(nav).getByRole("button", { name: /Processamento|PDF/i }));

    expect(screen.getByText("Organizar PDF")).toBeInTheDocument();
    expect(screen.queryByText("Comparar textos")).not.toBeInTheDocument();
  });

  it("abre e fecha a paleta por teclado", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Paleta de comandos" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog", { name: "Paleta de comandos" })).not.toBeInTheDocument();
  });
});
