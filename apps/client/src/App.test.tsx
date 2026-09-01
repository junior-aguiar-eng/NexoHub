import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renderiza o Launcher sem oferecer execução fictícia", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Documentos complexos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comece por uma tarefa" })).toBeInTheDocument();
    expect(screen.getAllByText("Em breve")).toHaveLength(6);
    expect(screen.getByText("Organizar PDF").closest("article")).toContainElement(
      screen.getAllByTitle("Transformações de PDF chegam na Fase 4.")[0],
    );
    expect(screen.getByRole("button", { name: /Abrir Studio/i })).toBeEnabled();
  });

  it("abre o Studio e retorna ao Launcher sem acessar APIs nativas diretamente", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Abrir Studio/i }));
    expect(
      screen.getByRole("heading", { name: /Seu documento, com contexto preservado/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documentos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inspector" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Voltar ao Launcher/i }));
    expect(screen.getByRole("heading", { name: /Documentos complexos/i })).toBeInTheDocument();
  });

  it("promove uma Quick Tool para um rascunho NexoFlow no Studio", () => {
    render(<App />);
    const card = screen.getByText("Comprimir PDF").closest("article");
    if (!card) throw new Error("card da ferramenta não encontrado");

    fireEvent.click(within(card).getByRole("button", { name: "Continuar no Studio" }));

    expect(screen.getByRole("heading", { name: "NexoFlow" })).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("pdf-compress")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nexo Layers" })).toBeInTheDocument();
  });

  it("abre o editor de texto ao promover uma ferramenta textual", () => {
    render(<App />);
    const card = screen.getByText("Revisar texto").closest("article");
    if (!card) throw new Error("card textual não encontrado");

    fireEvent.click(within(card).getByRole("button", { name: "Continuar no Studio" }));
    const editor = screen.getByRole("textbox", { name: "Conteúdo textual" });
    fireEvent.change(editor, { target: { value: "Texto" } });

    expect(editor).toHaveValue("Texto");
    expect(screen.getByText("5 caracteres")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar revisão" })).toBeDisabled();
  });

  it("filtra as ferramentas pela suíte ativa", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));

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
