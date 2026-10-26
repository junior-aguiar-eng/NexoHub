import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfToExcelPanel } from "./PdfToExcelPanel";

it("navega entre páginas selecionadas não contíguas sem parar na página excluída", () => {
  const onPage = vi.fn();
  render(
    <PdfToExcelPanel
      fileName="dados.pdf"
      fileSizeBytes={100}
      totalPages={3}
      outputFormat="xlsx"
      onOutputFormatChange={vi.fn()}
      sheetMode="per-page"
      onSheetModeChange={vi.fn()}
      csvDelimiter=";"
      onCsvDelimiterChange={vi.fn()}
      detectTablesOnly={false}
      onDetectTablesOnlyChange={vi.fn()}
      selectedPages={[1, 3]}
      onPreviewPageChange={onPage}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
  expect(onPage).toHaveBeenLastCalledWith(3);
});

it("expõe seleção de páginas, região e separadores sem inventar valores na prévia", () => {
  const change = vi.fn();
  render(
    <PdfToExcelPanel
      fileName="dados.pdf"
      fileSizeBytes={100}
      totalPages={2}
      outputFormat="xlsx"
      onOutputFormatChange={vi.fn()}
      sheetMode="per-page"
      onSheetModeChange={vi.fn()}
      csvDelimiter=";"
      onCsvDelimiterChange={vi.fn()}
      detectTablesOnly={false}
      onDetectTablesOnlyChange={vi.fn()}
      pagesText="2"
      onPagesTextChange={change}
      separatorsText="30;62"
      onSeparatorsTextChange={change}
      region={{ left: 0, top: 0.1, width: 1, height: 0.2 }}
      onRegionChange={change}
      preserveText
      onPreserveTextChange={change}
    />,
  );
  expect(screen.getByLabelText("Páginas para exportar")).toHaveValue("2");
  expect(screen.getByLabelText("Separadores de colunas (%)")).toHaveValue("30;62");
  fireEvent.change(screen.getByLabelText("Topo da região (%)"), { target: { value: "15" } });
  expect(change).toHaveBeenCalledWith({ left: 0, top: 0.15, width: 1, height: 0.2 });
  expect(screen.getByLabelText("Preservar valores como texto no XLSX")).toBeChecked();
});

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

    // Uma prévia vazia nunca inventa conteúdo do documento.
    expect(screen.queryByTestId("excel-preview-table")).not.toBeInTheDocument();
    expect(screen.queryByText("Servidor Dell PowerEdge R650")).not.toBeInTheDocument();
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

it("exibe apenas as linhas reais fornecidas", () => {
  render(
    <PdfToExcelPanel
      fileName="real.pdf"
      fileSizeBytes={100}
      totalPages={1}
      outputFormat="xlsx"
      onOutputFormatChange={vi.fn()}
      sheetMode="per-page"
      onSheetModeChange={vi.fn()}
      csvDelimiter=";"
      onCsvDelimiterChange={vi.fn()}
      detectTablesOnly={false}
      onDetectTablesOnlyChange={vi.fn()}
      previewRows={[
        ["Nome", "Valor"],
        ["Dado real", "42"],
      ]}
    />,
  );
  expect(screen.getByText("Dado real")).toBeInTheDocument();
  expect(screen.queryByText("Servidor Dell PowerEdge R650")).not.toBeInTheDocument();
});

it("oculta linhas antigas durante a análise de novas opções", () => {
  render(
    <PdfToExcelPanel
      fileName="real.pdf"
      fileSizeBytes={100}
      totalPages={1}
      outputFormat="xlsx"
      onOutputFormatChange={vi.fn()}
      sheetMode="per-page"
      onSheetModeChange={vi.fn()}
      csvDelimiter=";"
      onCsvDelimiterChange={vi.fn()}
      detectTablesOnly={false}
      onDetectTablesOnlyChange={vi.fn()}
      isConverting
      previewRows={[["Antigo"], ["Dado antigo"]]}
    />,
  );
  expect(screen.queryByText("Dado antigo")).not.toBeInTheDocument();
  expect(
    screen.getAllByText("Analisando estrutura tabular do documento...").length,
  ).toBeGreaterThan(0);
});
