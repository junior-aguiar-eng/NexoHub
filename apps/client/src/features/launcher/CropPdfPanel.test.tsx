import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CropPdfPanel } from "./CropPdfPanel";

describe("CropPdfPanel", () => {
  it("renderiza os controles de margem, presets e escopo", () => {
    const onMarginsChange = vi.fn();
    const onScopeChange = vi.fn();
    const onSelectedPagesChange = vi.fn();

    render(
      <CropPdfPanel
        fileName="relatorio.pdf"
        fileSizeBytes={1024 * 50}
        totalPages={3}
        margins={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onMarginsChange={onMarginsChange}
        scope="all"
        onScopeChange={onScopeChange}
        selectedPagesText=""
        onSelectedPagesTextChange={onSelectedPagesChange}
      />,
    );

    expect(screen.getByText("Opções de Recorte")).toBeDefined();
    expect(screen.getByText("Todas as páginas")).toBeDefined();
    expect(screen.getByText("Páginas selecionadas")).toBeDefined();
    expect(screen.getByText("Superior")).toBeDefined();
    expect(screen.getByText("Inferior")).toBeDefined();
    expect(screen.getByText("Esquerda")).toBeDefined();
    expect(screen.getByText("Direita")).toBeDefined();
    expect(screen.getByText("80% larg. × 80% alt.")).toBeDefined();
  });

  it("chama onScopeChange ao alternar entre todas e páginas selecionadas", () => {
    const onScopeChange = vi.fn();

    render(
      <CropPdfPanel
        fileName="documento.pdf"
        fileSizeBytes={2048}
        totalPages={2}
        margins={{ top: 5, bottom: 5, left: 5, right: 5 }}
        onMarginsChange={vi.fn()}
        scope="all"
        onScopeChange={onScopeChange}
        selectedPagesText=""
        onSelectedPagesTextChange={vi.fn()}
      />,
    );

    const selectedBtn = screen.getByText("Páginas selecionadas");
    fireEvent.click(selectedBtn);
    expect(onScopeChange).toHaveBeenCalledWith("selected");
  });

  it("chama onMarginsChange ao clicar em presets de recorte", () => {
    const onMarginsChange = vi.fn();

    render(
      <CropPdfPanel
        fileName="documento.pdf"
        fileSizeBytes={2048}
        totalPages={1}
        margins={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onMarginsChange={onMarginsChange}
        scope="all"
        onScopeChange={vi.fn()}
        selectedPagesText=""
        onSelectedPagesTextChange={vi.fn()}
      />,
    );

    const preset15 = screen.getByText("15%");
    fireEvent.click(preset15);
    expect(onMarginsChange).toHaveBeenCalledWith({ top: 15, bottom: 15, left: 15, right: 15 });

    const presetNone = screen.getByText("Zerar");
    fireEvent.click(presetNone);
    expect(onMarginsChange).toHaveBeenCalledWith({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("permite navegação entre páginas quando totalPages > 1", () => {
    render(
      <CropPdfPanel
        fileName="relatorio.pdf"
        fileSizeBytes={1024}
        totalPages={4}
        margins={{ top: 0, bottom: 0, left: 0, right: 0 }}
        onMarginsChange={vi.fn()}
        scope="all"
        onScopeChange={vi.fn()}
        selectedPagesText=""
        onSelectedPagesTextChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Página 1 de 4")).toBeDefined();
    const nextBtn = screen.getByLabelText("Próxima página");
    fireEvent.click(nextBtn);
    expect(screen.getByText("Página 2 de 4")).toBeDefined();
    const prevBtn = screen.getByLabelText("Página anterior");
    fireEvent.click(prevBtn);
    expect(screen.getByText("Página 1 de 4")).toBeDefined();
  });
});
