import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfToMarkdownPanel } from "./PdfToMarkdownPanel";

describe("PdfToMarkdownPanel - Painel de Conversão de PDF para Markdown", () => {
  const defaultProps = {
    fileName: "relatorio.pdf",
    fileSizeBytes: 1024 * 150,
    pageCount: 3,
    thumbnailUrl: "data:image/jpeg;base64,sample",
    detectHeadings: true,
    onDetectHeadingsChange: vi.fn(),
    detectTables: true,
    onDetectTablesChange: vi.fn(),
    includePageBreaks: true,
    onIncludePageBreaksChange: vi.fn(),
  };

  it("renderiza o estado inicial com dados do arquivo e opções de conversão", () => {
    render(<PdfToMarkdownPanel {...defaultProps} />);

    expect(screen.getByText("relatorio.pdf")).toBeInTheDocument();
    expect(screen.getByText(/3 páginas/i)).toBeInTheDocument();
    expect(screen.getByText("Detectar títulos e cabeçalhos (#, ##, ###)")).toBeInTheDocument();
    expect(screen.getByText("Formatar tabelas em Markdown")).toBeInTheDocument();
    expect(screen.getByText("Incluir separadores de página")).toBeInTheDocument();
  });

  it("dispara callbacks de alteração das opções de conversão", () => {
    const onDetectHeadingsChange = vi.fn();
    const onDetectTablesChange = vi.fn();

    render(
      <PdfToMarkdownPanel
        {...defaultProps}
        onDetectHeadingsChange={onDetectHeadingsChange}
        onDetectTablesChange={onDetectTablesChange}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(onDetectHeadingsChange).toHaveBeenCalledWith(false);

    fireEvent.click(checkboxes[1]);
    expect(onDetectTablesChange).toHaveBeenCalledWith(false);
  });

  it("renderiza o resultado convertido com abas de Visualização e Código Raw", () => {
    const sampleMarkdown =
      "# Título do Relatório\n\nEste é o conteúdo do relatório em markdown.\n\n| Item | Valor |\n| --- | --- |\n| A | 100 |";

    render(<PdfToMarkdownPanel {...defaultProps} markdownResult={sampleMarkdown} />);

    // Valida que o visor duplo e os botões de ação estão visíveis
    expect(screen.getByRole("button", { name: /Visualização/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Código Markdown/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar Markdown/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Baixar \.md/i })).toBeInTheDocument();

    // Valida exibição dos elementos formatados
    expect(screen.getByText("Título do Relatório")).toBeInTheDocument();
    expect(screen.getByText("Este é o conteúdo do relatório em markdown.")).toBeInTheDocument();

    // Alterna para o modo código
    fireEvent.click(screen.getByRole("button", { name: /Código Markdown/i }));
    expect(screen.getByRole("textbox")).toHaveValue(sampleMarkdown);
  });

  it("permite copiar o markdown para a área de transferência", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <PdfToMarkdownPanel {...defaultProps} markdownResult="# Conteúdo para teste de cópia" />,
    );

    const copyBtn = screen.getByRole("button", { name: /Copiar Markdown/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("# Conteúdo para teste de cópia");
    expect(await screen.findByText(/Copiado!/i)).toBeInTheDocument();
  });
});
