import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfToWordPanel } from "./PdfToWordPanel";

describe("PdfToWordPanel", () => {
  const defaultProps = {
    fileName: "contrato.pdf",
    fileSizeBytes: 1024 * 50,
    isRunning: false,
    progressPercent: 0,
    report: null,
    errorMessage: null,
    downloadUrl: null,
    outputFileName: "contrato.docx",
    onRunConversion: vi.fn(),
    onReset: vi.fn(),
  };

  it("renderiza o estado inicial idle com informações do arquivo", () => {
    render(<PdfToWordPanel {...defaultProps} />);

    expect(screen.getByTestId("pdf-word-idle")).toBeInTheDocument();
    expect(screen.getByText("contrato.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /converter para word/i })).toBeInTheDocument();
  });

  it("aciona onRunConversion ao clicar no botão de conversão", () => {
    const onRunConversion = vi.fn();
    render(<PdfToWordPanel {...defaultProps} onRunConversion={onRunConversion} />);

    const button = screen.getByRole("button", { name: /converter para word/i });
    fireEvent.click(button);

    expect(onRunConversion).toHaveBeenCalledTimes(1);
  });

  it("exibe a barra de progresso durante o processamento", () => {
    render(<PdfToWordPanel {...defaultProps} isRunning={true} progressPercent={45} />);

    expect(screen.getByTestId("pdf-word-running")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("exibe as estatísticas e prévia no estado de sucesso", () => {
    const mockReport = {
      pageCount: 3,
      wordCount: 120,
      paragraphCount: 8,
      originalBytes: 51200,
      convertedBytes: 15360,
      isScannedWarning: false,
      sampleText: [
        "Primeiro parágrafo do relatório financeiro.",
        "Segundo parágrafo detalhando despesas.",
      ],
    };

    render(
      <PdfToWordPanel
        {...defaultProps}
        report={mockReport}
        downloadUrl="blob:http://localhost/mock-word"
      />,
    );

    expect(screen.getByTestId("pdf-word-success")).toBeInTheDocument();
    expect(screen.getByText("Estatísticas da Conversão")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Primeiro parágrafo do relatório financeiro.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /baixar documento word/i })).toBeInTheDocument();
  });

  it("exibe o banner preventivo e link de OCR para PDFs escaneados", () => {
    const mockReport = {
      pageCount: 1,
      wordCount: 0,
      paragraphCount: 1,
      originalBytes: 51200,
      convertedBytes: 9000,
      isScannedWarning: true,
      sampleText: [],
    };

    const onNavigateToOcr = vi.fn();

    render(
      <PdfToWordPanel
        {...defaultProps}
        report={mockReport}
        downloadUrl="blob:http://localhost/mock-word"
        onNavigateToOcr={onNavigateToOcr}
      />,
    );

    expect(screen.getByTestId("pdf-word-scanned-alert")).toBeInTheDocument();
    const ocrButton = screen.getByRole("button", { name: /reconhecer texto/i });
    expect(ocrButton).toBeInTheDocument();

    fireEvent.click(ocrButton);
    expect(onNavigateToOcr).toHaveBeenCalledTimes(1);
  });

  it("exibe o estado de erro com botão de redefinir", () => {
    const onReset = vi.fn();
    render(
      <PdfToWordPanel
        {...defaultProps}
        errorMessage="O arquivo não possui objetos ou cabeçalho PDF legível."
        onReset={onReset}
      />,
    );

    expect(screen.getByTestId("pdf-word-error")).toBeInTheDocument();
    expect(screen.getByText("Falha na Conversão")).toBeInTheDocument();

    const resetButton = screen.getByRole("button", { name: /converter outro arquivo/i });
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
