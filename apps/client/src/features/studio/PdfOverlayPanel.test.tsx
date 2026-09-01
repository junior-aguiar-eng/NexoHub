import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfOverlayPanel } from "./PdfOverlayPanel";

describe("PdfOverlayPanel", () => {
  it("mantém a geometria normalizada e envia o tipo selecionado", () => {
    const onCreate = vi.fn();
    render(<PdfOverlayPanel onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: "Nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar overlay" }));

    expect(onCreate).toHaveBeenCalledWith({
      kind: "NOTE",
      pageNumber: 1,
      x: 0.15,
      y: 0.2,
      width: 0.45,
      height: 0.08,
    });
  });
});
