import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OcrScannerPanel } from "./OcrScannerPanel";

describe("OcrScannerPanel - Scanner a Laser e Reconhecimento OCR", () => {
  const defaultProps = {
    isScanning: false,
    progress: 0,
    recognizedText: "",
    fileName: "contrato.pdf",
    language: "por" as const,
    onLanguageChange: vi.fn(),
    outputMode: "searchable-pdf" as const,
    onOutputModeChange: vi.fn(),
    enhanceContrast: true,
    onEnhanceContrastChange: vi.fn(),
  };

  it("renderiza a animação de laser e barra de progresso durante o escaneamento", () => {
    const { container } = render(
      <OcrScannerPanel {...defaultProps} isScanning={true} progress={65} />,
    );

    expect(screen.getByText(/Escaneando documento... \(65%\)/i)).toBeInTheDocument();
    expect(container.querySelector(".ocr-laser-beam")).toBeInTheDocument();
    expect(container.querySelector(".ocr-progress-bar")).toHaveStyle({ width: "65%" });
  });

  it("renderiza o texto reconhecido e métricas de palavras", () => {
    render(
      <OcrScannerPanel
        {...defaultProps}
        progress={100}
        recognizedText="CLÁUSULA PRIMEIRA: Do Objeto Contratual"
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
        {...defaultProps}
        progress={100}
        recognizedText="Texto OCR para copiar"
        fileName="laudo.pdf"
      />,
    );

    const copyBtn = screen.getByRole("button", { name: /Copiar Texto/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("Texto OCR para copiar");
  });

  it("renderiza opções de idioma e formatos de saída do OCR", () => {
    const onLanguageChange = vi.fn();
    const onOutputModeChange = vi.fn();

    render(
      <OcrScannerPanel
        {...defaultProps}
        onLanguageChange={onLanguageChange}
        onOutputModeChange={onOutputModeChange}
      />,
    );

    expect(screen.getByText(/Português \(Brasil\)/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF Pesquisável/i)).toBeInTheDocument();
    expect(screen.getByText(/Texto Editável \(\.txt\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Inglês/i }));
    expect(onLanguageChange).toHaveBeenCalledWith("eng");

    fireEvent.click(screen.getByRole("button", { name: /Texto Editável \(\.txt\)/i }));
    expect(onOutputModeChange).toHaveBeenCalledWith("text");
  });
});
