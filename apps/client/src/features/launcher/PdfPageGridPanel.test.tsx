import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfPageGridPanel, type PdfPageItem } from "./PdfPageGridPanel";

describe("PdfPageGridPanel - Painel Visual de Páginas (iLovePDF style)", () => {
  const samplePages: PdfPageItem[] = [
    { id: "page-1", originalIndex: 1, rotation: 0 },
    { id: "page-2", originalIndex: 2, rotation: 0 },
    { id: "page-3", originalIndex: 3, rotation: 0 },
  ];

  it("renderiza a lista de miniaturas de páginas no modo organizador", () => {
    render(
      <PdfPageGridPanel
        mode="organize"
        totalPages={3}
        pages={samplePages}
        selectedIndices={[1, 2, 3]}
      />,
    );

    expect(screen.getByText(/Organização Visual de Páginas/i)).toBeInTheDocument();
    expect(screen.getByText("Pág. 1")).toBeInTheDocument();
    expect(screen.getByText("Pág. 2")).toBeInTheDocument();
    expect(screen.getByText("Pág. 3")).toBeInTheDocument();
  });

  it("permite girar uma página em 90 graus", () => {
    const onPagesChange = vi.fn();
    render(
      <PdfPageGridPanel
        mode="organize"
        totalPages={3}
        pages={samplePages}
        selectedIndices={[1, 2, 3]}
        onPagesChange={onPagesChange}
      />,
    );

    const rotateButtons = screen.getAllByTitle(/Girar 90°/i);
    fireEvent.click(rotateButtons[0]);

    expect(onPagesChange).toHaveBeenCalledWith([
      { id: "page-1", originalIndex: 1, rotation: 90 },
      { id: "page-2", originalIndex: 2, rotation: 0 },
      { id: "page-3", originalIndex: 3, rotation: 0 },
    ]);
  });

  it("permite mover uma página para a direita", () => {
    const onPagesChange = vi.fn();
    render(
      <PdfPageGridPanel
        mode="organize"
        totalPages={3}
        pages={samplePages}
        selectedIndices={[1, 2, 3]}
        onPagesChange={onPagesChange}
      />,
    );

    const moveRightButtons = screen.getAllByTitle(/Mover para direita/i);
    fireEvent.click(moveRightButtons[0]);

    expect(onPagesChange).toHaveBeenCalledWith([
      { id: "page-2", originalIndex: 2, rotation: 0 },
      { id: "page-1", originalIndex: 1, rotation: 0 },
      { id: "page-3", originalIndex: 3, rotation: 0 },
    ]);
  });

  it("permite selecionar e desmarcar páginas no modo extrator", () => {
    const onSelectedIndicesChange = vi.fn();
    render(
      <PdfPageGridPanel
        mode="extract"
        totalPages={3}
        pages={samplePages}
        selectedIndices={[1, 2]}
        onSelectedIndicesChange={onSelectedIndicesChange}
      />,
    );

    expect(screen.getByText(/páginas selecionadas/i)).toBeInTheDocument();

    // Clica no card da página 3 para adicionar à seleção
    const page3Card = screen.getByText("Pág. 3").closest(".pdf-page-card");
    if (page3Card) {
      fireEvent.click(page3Card);
      expect(onSelectedIndicesChange).toHaveBeenCalledWith([1, 2, 3]);
    }
  });

  it("interpreta intervalos digitados no extrator (ex: 1-2, 3)", () => {
    const onSelectedIndicesChange = vi.fn();
    render(
      <PdfPageGridPanel
        mode="extract"
        totalPages={3}
        pages={samplePages}
        selectedIndices={[1]}
        onSelectedIndicesChange={onSelectedIndicesChange}
      />,
    );

    const rangeInput = screen.getByPlaceholderText(/1-3, 5/i);
    fireEvent.change(rangeInput, { target: { value: "2-3" } });

    expect(onSelectedIndicesChange).toHaveBeenCalledWith([2, 3]);
  });
});
