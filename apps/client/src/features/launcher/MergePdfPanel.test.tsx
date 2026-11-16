import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImagesToPdfPanel } from "./ImagesToPdfPanel";
import { MergePdfPanel } from "./MergePdfPanel";

describe("Reordenação por arrastar e soltar sem setas", () => {
  it("MergePdfPanel reordena arquivos por drag-and-drop sem botões de seta", () => {
    const f1 = new File([new Uint8Array([1])], "doc-1.pdf", { type: "application/pdf" });
    const f2 = new File([new Uint8Array([2])], "doc-2.pdf", { type: "application/pdf" });
    const onReorderFiles = vi.fn();

    render(
      <MergePdfPanel
        files={[f1, f2]}
        thumbnails={new Map()}
        onRemoveFile={vi.fn()}
        onReorderFiles={onReorderFiles}
        onAddMoreFiles={vi.fn()}
      />,
    );

    expect(screen.queryByTitle(/Mover para esquerda/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Mover para direita/i)).not.toBeInTheDocument();

    const card1 = screen.getByText("doc-1.pdf").closest(".ilovepdf-merge-file-card");
    const card2 = screen.getByText("doc-2.pdf").closest(".ilovepdf-merge-file-card");
    expect(card1).toHaveAttribute("data-reorder-index", "0");
    expect(card2).toHaveAttribute("data-reorder-index", "1");

    if (!card1 || !card2) throw new Error("Cards não encontrados");
    fireEvent.dragStart(card1);
    fireEvent.dragOver(card2);
    fireEvent.drop(card2);

    expect(onReorderFiles).toHaveBeenCalledWith(0, 1);
  });

  it("ImagesToPdfPanel reordena imagens por drag-and-drop sem botões de seta", () => {
    const f1 = new File([new Uint8Array([1])], "img-1.png", { type: "image/png" });
    const f2 = new File([new Uint8Array([2])], "img-2.png", { type: "image/png" });
    const onReorderFiles = vi.fn();

    render(
      <ImagesToPdfPanel
        files={[f1, f2]}
        thumbnails={new Map()}
        orientation="auto"
        margin="none"
        pageSize="A4"
        onOrientationChange={vi.fn()}
        onMarginChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onRemoveFile={vi.fn()}
        onReorderFiles={onReorderFiles}
        onAddMoreFiles={vi.fn()}
      />,
    );

    expect(screen.queryByTitle(/Mover para esquerda/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Mover para direita/i)).not.toBeInTheDocument();

    const card1 = screen.getByText("img-1.png").closest(".ilovepdf-merge-file-card");
    const card2 = screen.getByText("img-2.png").closest(".ilovepdf-merge-file-card");
    expect(card1).toHaveAttribute("data-reorder-index", "0");

    if (!card1 || !card2) throw new Error("Cards não encontrados");
    fireEvent.dragStart(card1);
    fireEvent.dragOver(card2);
    fireEvent.drop(card2);

    expect(onReorderFiles).toHaveBeenCalledWith(0, 1);
  });
});
