import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PDFDocument } from "pdf-lib";
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

  it("inspeciona composição do PDF e exibe estimativa honesta para documento somente texto", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    page.drawText("Apenas texto sem imagens", { x: 50, y: 700, size: 12 });
    const pdfBytes = await doc.save({ useObjectStreams: true });
    const file = new File([pdfBytes as unknown as BlobPart], "texto.pdf", {
      type: "application/pdf",
    });

    render(
      <CompressPdfPanel
        fileName="texto.pdf"
        fileSizeBytes={pdfBytes.byteLength}
        compressionLevel="recommended"
        onCompressionLevelChange={vi.fn()}
        file={file}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("compress-composition-card")).toBeInTheDocument();
      expect(screen.getByText(/Documento sem imagens recomprimíveis/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/0 imagem\(ns\) otimizável\(is\) de 0 \(1 pág\.\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Economia estimada para este arquivo:/i)).toBeInTheDocument();
  });
});
