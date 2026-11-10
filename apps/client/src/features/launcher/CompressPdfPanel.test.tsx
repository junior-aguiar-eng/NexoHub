import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompressPdfPanel } from "./CompressPdfPanel";

describe("CompressPdfPanel", () => {
  it("renderiza o painel com as opções de nível e estimativa dinâmica de tamanho", () => {
    const onCompressionLevelChange = vi.fn();
    render(
      <CompressPdfPanel
        fileName="contrato.pdf"
        fileSizeBytes={2_000_000}
        compressionLevel="recommended"
        onCompressionLevelChange={onCompressionLevelChange}
      />,
    );

    expect(screen.getByText("contrato.pdf")).toBeTruthy();
    expect(screen.getByText(/Tamanho estimado:/)).toBeTruthy();
    expect(screen.getAllByText(/40%/).length).toBeGreaterThanOrEqual(1);
  });

  it("permite selecionar nível extreme e less", () => {
    const onCompressionLevelChange = vi.fn();
    render(
      <CompressPdfPanel
        fileName="contrato.pdf"
        fileSizeBytes={2_000_000}
        compressionLevel="recommended"
        onCompressionLevelChange={onCompressionLevelChange}
      />,
    );

    const extremeBtn = screen.getByRole("button", { name: /Extrema/i });
    fireEvent.click(extremeBtn);
    expect(onCompressionLevelChange).toHaveBeenCalledWith("extreme");
  });
});
