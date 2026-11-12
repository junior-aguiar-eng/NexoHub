import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageNumbersPdfPanel } from "./PageNumbersPdfPanel";

describe("PageNumbersPdfPanel", () => {
  it("pular capa mostra a página realmente numerada em vez da capa", () => {
    const requestPage = vi.fn();
    render(
      <PageNumbersPdfPanel
        fileName="exemplo.pdf"
        fileSizeBytes={100}
        totalPages={3}
        thumbnailUrl="capa.png"
        pageThumbnails={["capa.png", "corpo.png"]}
        onPreviewPageChange={requestPage}
        position="bottom-center"
        format="pageXofY"
        startPage={2}
        onPositionChange={vi.fn()}
        onFormatChange={vi.fn()}
        onStartPageChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "corpo.png");
    expect(requestPage).toHaveBeenCalledWith(2);
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("exibe formato forense Fls. X de Y na estampa de pré-visualização", () => {
    render(
      <PageNumbersPdfPanel
        fileName="autos_processo.pdf"
        fileSizeBytes={2048}
        totalPages={5}
        thumbnailUrl="capa.png"
        position="top-right"
        format="flsXofY"
        startPage={1}
        onPositionChange={vi.fn()}
        onFormatChange={vi.fn()}
        onStartPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Fls. 1 de 5")).toBeInTheDocument();
  });

  it("exibe formato forense Fls. X com prefixo de processo judicial", () => {
    const onCustomPrefixChange = vi.fn();
    render(
      <PageNumbersPdfPanel
        fileName="peticao.pdf"
        fileSizeBytes={4096}
        totalPages={10}
        thumbnailUrl="capa.png"
        position="top-right"
        format="flsX"
        startPage={1}
        customPrefix="Proc. 0001234-56.2026"
        onPositionChange={vi.fn()}
        onFormatChange={vi.fn()}
        onStartPageChange={vi.fn()}
        onCustomPrefixChange={onCustomPrefixChange}
      />,
    );

    expect(screen.getByText("Proc. 0001234-56.2026 - Fls. 1")).toBeInTheDocument();

    const prefixInput = screen.getByPlaceholderText(/Processo/i);
    fireEvent.change(prefixInput, { target: { value: "TJSP 9999" } });
    expect(onCustomPrefixChange).toHaveBeenCalledWith("TJSP 9999");
  });
});
