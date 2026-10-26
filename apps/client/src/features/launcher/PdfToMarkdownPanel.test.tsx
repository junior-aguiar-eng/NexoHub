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
  it("mostra páginas sem texto por relatório e abre OCR somente por clique", () => {
    const requestOcr = vi.fn();
    render(
      <PdfToMarkdownPanel
        {...defaultProps}
        markdownResult="Texto curto."
        pagesWithoutText={[2]}
        onRequestOcr={requestOcr}
      />,
    );
    expect(screen.getByText(/Páginas sem texto selecionável: 2/)).toBeInTheDocument();
    expect(requestOcr).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abrir Reconhecer Texto (OCR)" }));
    expect(requestOcr).toHaveBeenCalledOnce();
  });

  it("não sinaliza documento escaneado apenas porque o texto é curto", () => {
    render(<PdfToMarkdownPanel {...defaultProps} markdownResult="Fim." pagesWithoutText={[]} />);
    expect(screen.queryByText(/Pouco texto encontrado/)).not.toBeInTheDocument();
  });

  it("mantém barras e HTML literal dentro da mesma célula na visualização segura", () => {
    const { container } = render(
      <PdfToMarkdownPanel
        {...defaultProps}
        markdownResult={"| Código | Descrição |\n| --- | --- |\n| 00123 | A \\| B &lt;teste&gt; |"}
      />,
    );
    expect(screen.getByRole("cell", { name: "A | B <teste>" })).toBeInTheDocument();
    expect(container.querySelector("teste")).toBeNull();
  });

  it("permite revisar a ordem de leitura sem alterar opções silenciosamente", () => {
    const change = vi.fn();
    render(
      <PdfToMarkdownPanel {...defaultProps} readingOrder="auto" onReadingOrderChange={change} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Ordem de leitura" }), {
      target: { value: "columns" },
    });
    expect(change).toHaveBeenCalledWith("columns");
  });
  it("decodifica traços escapados de células sem remover a linha de dados", () => {
    render(
      <PdfToMarkdownPanel
        {...defaultProps}
        markdownResult={"| A | B |\n| --- | --- |\n| \\-\\-\\- | valor |"}
      />,
    );
    expect(screen.getByRole("cell", { name: "---" })).toBeInTheDocument();
  });
  it("preserva o início da lista numerada depois de um bullet", () => {
    const { container } = render(
      <PdfToMarkdownPanel {...defaultProps} markdownResult={"- Primeiro item\n\n7. Sétimo item"} />,
    );
    expect(container.querySelector("ol")).toHaveAttribute("start", "7");
    expect(screen.getByText("Sétimo item")).toBeInTheDocument();
  });

  it("mantém barras e traços escapados como parágrafo literal", () => {
    render(
      <PdfToMarkdownPanel {...defaultProps} markdownResult={"\\| --- \\| --- \\|\n\n\\-\\-\\-"} />,
    );
    expect(screen.getByText("| --- | --- |", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("---", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
