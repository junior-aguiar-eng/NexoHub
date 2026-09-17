import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OcrScannerPanel } from "./OcrScannerPanel";

describe("OcrScannerPanel - Scanner a Laser e Reconhecimento OCR", () => {
  it("renderiza a animação de laser e barra de progresso durante o escaneamento", () => {
    const { container } = render(
      <OcrScannerPanel isScanning={true} progress={65} recognizedText="" fileName="contrato.pdf" />,
    );

    expect(screen.getByText(/Escaneando documento... \(65%\)/i)).toBeInTheDocument();
    expect(container.querySelector(".ocr-laser-beam")).toBeInTheDocument();
    expect(container.querySelector(".ocr-progress-bar")).toHaveStyle({ width: "65%" });
  });

  it("renderiza o texto reconhecido e métricas de palavras", () => {
    render(
      <OcrScannerPanel
        isScanning={false}
        progress={100}
        recognizedText="CLÁUSULA PRIMEIRA: Do Objeto Contratual"
        fileName="contrato.pdf"
      />,
    );

    expect(screen.getByText(/Reconhecimento Concluído com Sucesso/i)).toBeInTheDocument();
    expect(screen.getByText(/5 palavras/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/CLÁUSULA PRIMEIRA/i)).toBeInTheDocument();
  });

  it("permite copiar o texto reconhecido para a área de transferência", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <OcrScannerPanel
        isScanning={false}
        progress={100}
        recognizedText="Texto OCR para copiar"
        fileName="laudo.pdf"
      />,
    );

    const copyBtn = screen.getByRole("button", { name: /Copiar Texto/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("Texto OCR para copiar");
  });
});
