import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemovePagesPanel } from "./RemovePagesPanel";

describe("RemovePagesPanel", () => {
  it("renderiza o painel com total de páginas e botões de ação", () => {
    const onPagesChange = vi.fn();
    render(
      <RemovePagesPanel
        fileName="relatorio.pdf"
        fileSizeBytes={1024 * 1024}
        totalPages={4}
        pagesToRemove={[2]}
        onPagesToRemoveChange={onPagesChange}
      />,
    );

    expect(screen.getByText("relatorio.pdf")).toBeInTheDocument();
    expect(screen.getByText(/4 páginas/)).toBeInTheDocument();
    expect(screen.getByTestId("page-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("page-card-2")).toBeInTheDocument();
    expect(screen.getByTestId("page-card-3")).toBeInTheDocument();
    expect(screen.getByTestId("page-card-4")).toBeInTheDocument();
  });

  it("permite alternar remoção ao clicar no card da página", () => {
    const onPagesChange = vi.fn();
    render(
      <RemovePagesPanel
        fileName="relatorio.pdf"
        fileSizeBytes={500000}
        totalPages={3}
        pagesToRemove={[1]}
        onPagesToRemoveChange={onPagesChange}
      />,
    );

    // Clica na página 2 para marcar
    fireEvent.click(screen.getByTestId("page-card-2"));
    expect(onPagesChange).toHaveBeenCalledWith([1, 2]);

    // Clica na página 1 para desmarcar
    fireEvent.click(screen.getByTestId("page-card-1"));
    expect(onPagesChange).toHaveBeenCalledWith([]);
  });

  it("aciona atalhos de seleção rápida para pares e ímpares", () => {
    const onPagesChange = vi.fn();
    render(
      <RemovePagesPanel
        fileName="apostila.pdf"
        fileSizeBytes={2000000}
        totalPages={5}
        pagesToRemove={[]}
        onPagesToRemoveChange={onPagesChange}
      />,
    );

    // Páginas pares (2, 4)
    fireEvent.click(screen.getByRole("button", { name: /páginas pares/i }));
    expect(onPagesChange).toHaveBeenCalledWith([2, 4]);

    // Páginas ímpares (1, 3, 5)
    fireEvent.click(screen.getByRole("button", { name: /páginas ímpares/i }));
    expect(onPagesChange).toHaveBeenCalledWith([1, 3, 5]);
  });
});
