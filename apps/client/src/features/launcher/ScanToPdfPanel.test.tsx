import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScanToPdfPanel } from "./ScanToPdfPanel";

const fakeImageBytes = new Uint8Array([1, 2, 3, 4]);

describe("ScanToPdfPanel", () => {
  it("renderiza o painel com lista de páginas digitalizadas", () => {
    const onPagesChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const onOrientationChange = vi.fn();
    const onMarginChange = vi.fn();

    render(
      <ScanToPdfPanel
        pages={[
          {
            id: "p1",
            imageBytes: fakeImageBytes,
            mimeType: "image/jpeg",
            rotation: 0,
            filter: "original",
          },
        ]}
        onPagesChange={onPagesChange}
        pageSize="A4"
        onPageSizeChange={onPageSizeChange}
        orientation="auto"
        onOrientationChange={onOrientationChange}
        margin="small"
        onMarginChange={onMarginChange}
      />,
    );

    expect(screen.getByText("Digitalizar para PDF")).toBeInTheDocument();
    expect(screen.getByTestId("scanned-item-1")).toBeInTheDocument();
  });

  it("permite girar e alterar o filtro de uma página", () => {
    const onPagesChange = vi.fn();
    render(
      <ScanToPdfPanel
        pages={[
          {
            id: "p1",
            imageBytes: fakeImageBytes,
            mimeType: "image/jpeg",
            rotation: 0,
            filter: "original",
          },
        ]}
        onPagesChange={onPagesChange}
        pageSize="A4"
        onPageSizeChange={vi.fn()}
        orientation="auto"
        onOrientationChange={vi.fn()}
        margin="small"
        onMarginChange={vi.fn()}
      />,
    );

    // Girar página
    const rotateBtn = screen.getByLabelText(/Girar 90°/i);
    fireEvent.click(rotateBtn);
    expect(onPagesChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "p1", rotation: 90 }),
    ]);

    // Alterar filtro
    const filterSelect = screen.getByLabelText(/Filtro de Imagem/i);
    fireEvent.change(filterSelect, { target: { value: "bw" } });
    expect(onPagesChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "p1", filter: "bw" }),
    ]);
  });

  it("permite remover uma página capturada", () => {
    const onPagesChange = vi.fn();
    render(
      <ScanToPdfPanel
        pages={[
          {
            id: "p1",
            imageBytes: fakeImageBytes,
            mimeType: "image/jpeg",
            rotation: 0,
            filter: "original",
          },
        ]}
        onPagesChange={onPagesChange}
        pageSize="A4"
        onPageSizeChange={vi.fn()}
        orientation="auto"
        onOrientationChange={vi.fn()}
        margin="small"
        onMarginChange={vi.fn()}
      />,
    );

    const removeBtn = screen.getByLabelText(/Remover/i);
    fireEvent.click(removeBtn);
    expect(onPagesChange).toHaveBeenCalledWith([]);
  });
});
