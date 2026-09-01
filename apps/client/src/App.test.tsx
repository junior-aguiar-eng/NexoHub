import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renderiza o Launcher sem oferecer execução fictícia", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Documentos complexos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comece por uma tarefa" })).toBeInTheDocument();
    expect(screen.getAllByText("Em breve")).toHaveLength(7);
    expect(screen.getByText("Organizar PDF").closest("article")).toContainElement(
      screen.getAllByTitle("Transformações de PDF chegam na Fase 4.")[0],
    );
    expect(screen.getByRole("button", { name: /Abrir Studio/i })).toBeDisabled();
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
