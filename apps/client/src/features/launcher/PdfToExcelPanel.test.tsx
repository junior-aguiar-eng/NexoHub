import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfToExcelPanel } from "./PdfToExcelPanel";

describe("PdfToExcelPanel", () => {
  it("renderiza opções de formato, modo de planilha e prévia tabular", () => {
    const onFormatChange = vi.fn();
    const onModeChange = vi.fn();
    const onDelimChange = vi.fn();
    const onDetectTablesChange = vi.fn();

    render(
      <PdfToExcelPanel
        fileName="relatorio_financeiro.pdf"
        fileSizeBytes={1024 * 50}
        totalPages={3}
        outputFormat="xlsx"
        onOutputFormatChange={onFormatChange}
        sheetMode="per-page"
        onSheetModeChange={onModeChange}
        csvDelimiter=";"
        onCsvDelimiterChange={onDelimChange}
        detectTablesOnly={false}
        onDetectTablesOnlyChange={onDetectTablesChange}
      />,
    );

    expect(screen.getByTestId("pdf-to-excel-panel")).toBeInTheDocument();
    expect(screen.getByText("relatorio_financeiro.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("format-xlsx-btn")).toBeInTheDocument();
    expect(screen.getByTestId("format-csv-btn")).toBeInTheDocument();
    expect(screen.getByTestId("mode-per-page-btn")).toBeInTheDocument();
    expect(screen.getByTestId("mode-single-btn")).toBeInTheDocument();
    expect(screen.getByTestId("detect-tables-only-checkbox")).not.toBeChecked();

    // Valida tabela de pré-visualização renderizada
    expect(screen.getByTestId("excel-preview-table")).toBeInTheDocument();
    expect(screen.getByText("Servidor Dell PowerEdge R650")).toBeInTheDocument();
  });

  it("dispara callbacks de alteração de formato, modo e opções", () => {
    const onFormatChange = vi.fn();
    const onModeChange = vi.fn();
    const onDelimChange = vi.fn();
    const onDetectTablesChange = vi.fn();

    render(
      <PdfToExcelPanel
        fileName="planilha.pdf"
        fileSizeBytes={2048}
        totalPages={1}
        outputFormat="xlsx"
        onOutputFormatChange={onFormatChange}
        sheetMode="per-page"
        onSheetModeChange={onModeChange}
        csvDelimiter=";"
        onCsvDelimiterChange={onDelimChange}
        detectTablesOnly={false}
        onDetectTablesOnlyChange={onDetectTablesChange}
      />,
    );

    fireEvent.click(screen.getByTestId("format-csv-btn"));
    expect(onFormatChange).toHaveBeenCalledWith("csv");

    fireEvent.click(screen.getByTestId("mode-single-btn"));
    expect(onModeChange).toHaveBeenCalledWith("single-sheet");

    fireEvent.click(screen.getByTestId("detect-tables-only-checkbox"));
    expect(onDetectTablesChange).toHaveBeenCalledWith(true);
  });

  it("renderiza seletores de delimitador quando formato CSV está ativo", () => {
    const onDelimChange = vi.fn();

    render(
      <PdfToExcelPanel
        fileName="dados.pdf"
        fileSizeBytes={4096}
        totalPages={2}
        outputFormat="csv"
        onOutputFormatChange={vi.fn()}
        sheetMode="per-page"
        onSheetModeChange={vi.fn()}
        csvDelimiter=";"
        onCsvDelimiterChange={onDelimChange}
        detectTablesOnly={true}
        onDetectTablesOnlyChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("delimiter-semicolon-btn")).toBeInTheDocument();
    expect(screen.getByTestId("delimiter-comma-btn")).toBeInTheDocument();
    expect(screen.getByTestId("delimiter-tab-btn")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("delimiter-comma-btn"));
    expect(onDelimChange).toHaveBeenCalledWith(",");
  });
});
