import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecipePanel } from "./RecipePanel";

describe("RecipePanel", () => {
  it("encerra como falha quando a execução rejeita antes do primeiro progresso", async () => {
    const onRun = vi.fn().mockRejectedValue(new Error("Falha de preflight"));

    render(<RecipePanel onRun={onRun} />);

    fireEvent.click(screen.getByRole("button", { name: "Digitalização Limpa" }));

    expect(await screen.findByText("Falhou")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Fechar" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cancelar execução" })).not.toBeInTheDocument();
  });

  it("atualiza o grafo ao selecionar outro preset e renderiza as ferramentas em português", () => {
    render(<RecipePanel />);

    // Inicialmente com Digitalização Limpa (Reconhecer texto, Organizar PDF, Comprimir PDF)
    expect(screen.getByText(/Reconhecer texto/i)).toBeInTheDocument();
    expect(screen.getByText("Organizar PDF")).toBeInTheDocument();
    expect(screen.getByText("Comprimir PDF")).toBeInTheDocument();

    // Clica em Higienização Rápida (não tem OCR, apenas Organizar e Comprimir)
    fireEvent.click(screen.getByRole("button", { name: "Higienização Rápida" }));

    expect(screen.queryByText(/Reconhecer texto/i)).not.toBeInTheDocument();
    expect(screen.getByText("Organizar PDF")).toBeInTheDocument();
    expect(screen.getByText("Comprimir PDF")).toBeInTheDocument();
  });

  it("permite executar a receita selecionada", async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    render(<RecipePanel onRun={onRun} />);

    fireEvent.click(screen.getByRole("button", { name: "Executar receita selecionada" }));

    expect(onRun).toHaveBeenCalled();
  });
});
