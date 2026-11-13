import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfToJpgPanel } from "./PdfToJpgPanel";

describe("PdfToJpgPanel", () => {
  it("permite alternar DPI (72, 150, 300) e validar intervalo de páginas", () => {
    const onDpiChange = vi.fn();
    const onPageModeChange = vi.fn();
    const onPageRangeTextChange = vi.fn();
    const onRangeValidityChange = vi.fn();

    render(
      <PdfToJpgPanel
        fileName="apostila.pdf"
        fileSizeBytes={512_000}
        totalPages={5}
        onDpiChange={onDpiChange}
        onPageModeChange={onPageModeChange}
        onPageRangeTextChange={onPageRangeTextChange}
        onRangeValidityChange={onRangeValidityChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Impressão \(300 DPI\)/i }));
    expect(onDpiChange).toHaveBeenCalledWith(300);

    fireEvent.click(screen.getByRole("button", { name: /Web \/ Leve \(72 DPI\)/i }));
    expect(onDpiChange).toHaveBeenCalledWith(72);

    fireEvent.click(screen.getByRole("button", { name: /Intervalo específico/i }));
    expect(onPageModeChange).toHaveBeenCalledWith("range");
    expect(onRangeValidityChange).toHaveBeenLastCalledWith(false);

    const input = screen.getByPlaceholderText(/Ex: 1-3, 5/i);
    fireEvent.change(input, { target: { value: "2-4" } });
    expect(onPageRangeTextChange).toHaveBeenCalledWith("2-4");
    expect(onRangeValidityChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.change(input, { target: { value: "2-9" } });
    expect(onRangeValidityChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("alert")).toHaveTextContent(/1 a 5/);
  });
});
