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
});
