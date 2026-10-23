import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExtractPagesPanel } from "./ExtractPagesPanel";

describe("ExtractPagesPanel", () => {
  it("renderiza o painel de extração com modos e cards de página", () => {
    const onSelectedChange = vi.fn();
    const onModeChange = vi.fn();
    render(
      <ExtractPagesPanel
        fileName="documento.pdf"
        fileSizeBytes={1500000}
        totalPages={4}
        selectedPages={[1, 3]}
        onSelectedPagesChange={onSelectedChange}
        mode="single-pdf"
        onModeChange={onModeChange}
      />,
    );

    expect(screen.getByText("documento.pdf")).toBeInTheDocument();
    expect(screen.getByText("Extrair em um único PDF")).toBeInTheDocument();
    expect(screen.getByText("Extrair páginas em PDFs separados (ZIP)")).toBeInTheDocument();
    expect(screen.getByTestId("extract-page-1")).toBeInTheDocument();
    expect(screen.getByTestId("extract-page-4")).toBeInTheDocument();
  });

  it("permite alternar entre os modos single-pdf e zip-split", () => {
    const onSelectedChange = vi.fn();
    const onModeChange = vi.fn();
    render(
      <ExtractPagesPanel
        fileName="documento.pdf"
        fileSizeBytes={1500000}
        totalPages={3}
        selectedPages={[1]}
        onSelectedPagesChange={onSelectedChange}
        mode="single-pdf"
        onModeChange={onModeChange}
      />,
    );

    fireEvent.click(screen.getByText("Extrair páginas em PDFs separados (ZIP)"));
    expect(onModeChange).toHaveBeenCalledWith("zip-split");
  });

  it("seleciona todas e desmarca todas as páginas", () => {
    const onSelectedChange = vi.fn();
    const onModeChange = vi.fn();
    render(
      <ExtractPagesPanel
        fileName="documento.pdf"
        fileSizeBytes={1500000}
        totalPages={3}
        selectedPages={[1]}
        onSelectedPagesChange={onSelectedChange}
        mode="single-pdf"
        onModeChange={onModeChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /selecionar todas/i }));
    expect(onSelectedChange).toHaveBeenCalledWith([1, 2, 3]);

    fireEvent.click(screen.getByRole("button", { name: /desmarcar todas/i }));
    expect(onSelectedChange).toHaveBeenCalledWith([]);
  });
});
