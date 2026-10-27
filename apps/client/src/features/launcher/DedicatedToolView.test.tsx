import type { ReviewFinding } from "@nexohub/domain";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import * as browserReviewer from "@/platform/browser-reviewer";
import { DedicatedToolView } from "./DedicatedToolView";
import { launcherTools } from "./data";

describe("DedicatedToolView - Espaço 2 Colunas e Ferramentas Interativas", () => {
  const documentCore = new BrowserDocumentCorePort();
  it("reparo recusa arquivo grande sem lê-lo para prévia ou execução", async () => {
    const file = new File(["x"], "grande.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 16 * 1024 * 1024 + 1 });
    const read = vi.spyOn(file, "arrayBuffer");
    const tool = launcherTools.find((tool) => tool.id === "pdf-repair");
    if (!tool) throw new Error("Ferramenta ausente");
    render(
      <DedicatedToolView
        tool={tool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reparar PDF" }));
    await screen.findByText(/ultrapassa os limites de reparo/);
    expect(read).not.toHaveBeenCalled();
  });

  const mockPdfOrganizeTool =
    launcherTools.find((t) => t.id === "pdf-organize") || launcherTools[0];
  const mockPdfCompressTool =
    launcherTools.find((t) => t.id === "pdf-compress") || launcherTools[0];
  const mockTextReviewTool = {
    ...mockPdfCompressTool,
    id: "text-review",
    suite: "text" as const,
    titleKey: "tool.textReview.title" as const,
    descriptionKey: "tool.textReview.description" as const,
  };

  it("renderiza o Organizador de PDF com painel visual de miniaturas quando um PDF é carregado", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "arquivo_cliente.pdf", {
      type: "application/pdf",
    });

    render(
      <DedicatedToolView
        tool={mockPdfOrganizeTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );

    expect(screen.getByText(/Organização Visual de Páginas/i)).toBeInTheDocument();
    expect(await screen.findByText("Pág. 1")).toBeInTheDocument();
  });

  it("renderiza o Compressor de PDF com painel de estatísticas de otimização", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "documento.pdf", {
      type: "application/pdf",
    });

    render(
      <DedicatedToolView
        tool={mockPdfCompressTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );

    expect(screen.getByRole("button", { name: /Compressão recomendada/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Compressão extrema/i }));
    expect(screen.getByRole("button", { name: /Compressão extrema/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("não conclui ferramenta sem executor devolvendo o original", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "original.pdf", {
      type: "application/pdf",
    });
    const onOperationComplete = vi.fn();
    const tool = { ...mockPdfCompressTool, id: "word-to-pdf" };
    render(
      <DedicatedToolView
        tool={tool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
        onOperationComplete={onOperationComplete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Executar agora/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onOperationComplete).not.toHaveBeenCalled();
  });

  it("executa revisão textual no navegador com feedback de sucesso", async () => {
    // Contrato de UI; o dicionário real é conferido no Chromium em text-quality.spec.ts.
    const review = vi.spyOn(browserReviewer, "performBrowserReview").mockResolvedValueOnce([]);
    const onOperationComplete = vi.fn();
    render(
      <DedicatedToolView
        tool={mockTextReviewTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[new File(["Texto inicial sem erros."], "texto.txt", { type: "text/plain" })]}
        onOperationComplete={onOperationComplete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Revisar Texto/i }));
    try {
      await waitFor(() => expect(onOperationComplete).toHaveBeenCalled());
      expect(screen.getByText("Não há sugestões para exibir.")).toBeInTheDocument();
      expect(review).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Texto inicial sem erros." }),
      );
    } finally {
      review.mockRestore();
    }
  });

  it.each(["sucesso", "erro", "desmontagem"])("ignora revisão obsoleta: %s", async (outcome) => {
    let finishReview: (findings: readonly ReviewFinding[]) => void = () => {};
    let failReview: (error: Error) => void = () => {};
    const pending = new Promise<readonly ReviewFinding[]>((resolve, reject) => {
      finishReview = resolve;
      failReview = reject;
    });
    const review = vi.spyOn(browserReviewer, "performBrowserReview").mockReturnValueOnce(pending);
    const onOperationComplete = vi.fn();
    const view = render(
      <DedicatedToolView
        tool={mockTextReviewTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        onOperationComplete={onOperationComplete}
      />,
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: "Digitar Texto" }));
      const input = screen.getByLabelText("Conteúdo do Documento:");
      fireEvent.change(input, { target: { value: "Texto original para revisar." } });
      fireEvent.click(screen.getByRole("button", { name: /Revisar Texto/i }));
      await waitFor(() => expect(review).toHaveBeenCalled());
      if (outcome === "desmontagem") view.unmount();
      else fireEvent.change(input, { target: { value: "Texto atual preservado." } });
      await act(async () => {
        if (outcome === "erro") failReview(new Error("Falha obsoleta"));
        else finishReview([]);
        await pending.catch(() => {});
      });
      if (outcome !== "desmontagem") {
        expect(screen.getByPlaceholderText(/O texto corrigido será atualizado/i)).toHaveValue(
          "Texto atual preservado.",
        );
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      }
      expect(onOperationComplete).not.toHaveBeenCalled();
    } finally {
      review.mockRestore();
    }
  });

  it.each(["todas", "individual", "manual"])(
    "preserva correção %s feita enquanto a revisão está pendente",
    async (mode) => {
      let finishReview: (findings: readonly ReviewFinding[]) => void = () => {};
      const pending = new Promise<readonly ReviewFinding[]>((resolve) => {
        finishReview = resolve;
      });
      const review = vi.spyOn(browserReviewer, "performBrowserReview").mockReturnValueOnce(pending);
      const onOperationComplete = vi.fn();
      render(
        <DedicatedToolView
          tool={mockTextReviewTool}
          documentCore={documentCore}
          onBack={vi.fn()}
          onOperationComplete={onOperationComplete}
        />,
      );
      try {
        fireEvent.click(screen.getByRole("button", { name: "Digitar Texto" }));
        fireEvent.change(screen.getByLabelText("Conteúdo do Documento:"), {
          target: { value: "Texto texto." },
        });
        fireEvent.click(screen.getByRole("button", { name: /Revisar Texto/i }));
        await waitFor(() => expect(review).toHaveBeenCalled());
        const output = screen.getByPlaceholderText(/O texto corrigido será atualizado/i);
        if (mode === "manual") {
          fireEvent.change(output, { target: { value: "Correção manual." } });
        } else {
          fireEvent.click(
            screen.getByRole("button", {
              name: mode === "todas" ? "Aplicar Todas as Correções" : "Aplicar",
            }),
          );
        }
        await act(async () => {
          finishReview([]);
          await pending;
        });
        expect(output).toHaveValue(mode === "manual" ? "Correção manual." : "Texto.");
        expect(onOperationComplete).not.toHaveBeenCalled();
      } finally {
        review.mockRestore();
      }
    },
  );

  it("renderiza o conversor de Imagem para PDF com controles de orientação e margem", async () => {
    const mockImagesToPdfTool =
      launcherTools.find((t) => t.id === "images-to-pdf") ?? mockPdfCompressTool;
    const file = new File(["dummy png"], "foto.png", { type: "image/png" });
    render(
      <DedicatedToolView
        tool={mockImagesToPdfTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByText(/Reordene as fotos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retrato/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Paisagem/i })).toBeInTheDocument();
  });

  it("mantém todas as imagens selecionadas e acrescenta novos lotes", () => {
    const tool = launcherTools.find((tool) => tool.id === "images-to-pdf");
    if (!tool) throw new Error("Ferramenta ausente");
    const { container } = render(
      <DedicatedToolView tool={tool} documentCore={documentCore} onBack={vi.fn()} />,
    );
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Seletor ausente");
    const first = new File(["imagem 1"], "primeira.png", { type: "image/png" });
    const second = new File(["imagem 2"], "segunda.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [first, second] } });
    expect(screen.getByText("primeira.png")).toBeInTheDocument();
    expect(screen.getByText("segunda.png")).toBeInTheDocument();
    const nextInput = container.querySelector('input[type="file"]');
    if (!nextInput) throw new Error("Seletor ausente");
    fireEvent.change(nextInput, {
      target: { files: [new File(["imagem 3"], "terceira.png", { type: "image/png" })] },
    });
    expect(screen.getByText("primeira.png")).toBeInTheDocument();
    expect(screen.getByText("segunda.png")).toBeInTheDocument();
    expect(screen.getByText("terceira.png")).toBeInTheDocument();
  });

  it("informa erro ao carregar DOCX inválido no comparador", async () => {
    const tool = launcherTools.find((tool) => tool.id === "text-compare");
    if (!tool) throw new Error("Comparador ausente");
    render(
      <DedicatedToolView
        tool={tool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[new File(["arquivo inválido"], "invalido.docx")]}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível ler o DOCX/);
  });

  it("renderiza o conversor de PDF para JPG com informações de extração", async () => {
    const mockPdfToJpgTool =
      launcherTools.find((t) => t.id === "pdf-to-jpg") ?? mockPdfCompressTool;
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "documento.pdf", {
      type: "application/pdf",
    });
    render(
      <DedicatedToolView
        tool={mockPdfToJpgTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByText(/Cada página do seu documento será convertida/i)).toBeInTheDocument();
    expect(screen.getByText(/Alta definição \(150 DPI\)/i)).toBeInTheDocument();
  });

  it("renderiza o painel de Marca d'água com campo de texto e controles de ângulo", async () => {
    const mockWatermarkTool =
      launcherTools.find((t) => t.id === "pdf-watermark") ?? mockPdfCompressTool;
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "documento.pdf", {
      type: "application/pdf",
    });
    render(
      <DedicatedToolView
        tool={mockWatermarkTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByLabelText(/Texto da marca d'água/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Diagonal \(45°\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Horizontal \(0°\)/i })).toBeInTheDocument();
  });

  it("renderiza o painel de Números de Página com posições e formatos", async () => {
    const mockPageNumbersTool =
      launcherTools.find((t) => t.id === "pdf-page-numbers") ?? mockPdfCompressTool;
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "documento.pdf", {
      type: "application/pdf",
    });
    render(
      <DedicatedToolView
        tool={mockPageNumbersTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByRole("button", { name: /Rodapé Centro/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página {n} de {total}" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Página 2 \(Pular Capa\)/i })).toBeInTheDocument();
  });

  it("renderiza o painel de OCR com laser e configurações de idioma", async () => {
    const mockOcrTool = launcherTools.find((t) => t.id === "pdf-ocr") ?? mockPdfCompressTool;
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "documento.pdf", {
      type: "application/pdf",
    });
    render(
      <DedicatedToolView
        tool={mockOcrTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByText(/Configurações de OCR/i)).toBeInTheDocument();
    expect(screen.getByText(/Português \(Brasil\)/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF Pesquisável/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar Reconhecimento OCR/i })).toBeInTheDocument();
  });

  it("renderiza o painel de tradução com seletores de idioma e aviso de download", async () => {
    const mockTranslateTool =
      launcherTools.find((t) => t.id === "text-translate") ?? mockPdfCompressTool;
    const file = new File(["Hello world contract"], "contrato.txt", { type: "text/plain" });
    render(
      <DedicatedToolView
        tool={mockTranslateTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByText(/Tradutor Inteligente/i)).toBeInTheDocument();
    expect(screen.getByText(/é necessário fazer um download no primeiro uso/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inverter idiomas/i })).toBeInTheDocument();
  });

  it("renderiza o painel de revisão com badge de privacidade e correção direta", async () => {
    const mockReviewTool = launcherTools.find((t) => t.id === "text-review") ?? mockTextReviewTool;
    const file = new File(["Texto para analise."], "minuta.txt", { type: "text/plain" });
    render(
      <DedicatedToolView
        tool={mockReviewTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByText(/Corretor Ortográfico e Gramatical/i)).toBeInTheDocument();
    expect(screen.getByText(/Correção local/i)).toBeInTheDocument();
  });

  it("renderiza o painel de PDF para Excel com seletores de formato e tabela de prévia", async () => {
    const mockExcelTool = launcherTools.find((t) => t.id === "pdf-to-excel") ?? mockPdfCompressTool;
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "planilha.pdf", {
      type: "application/pdf",
    });
    render(
      <DedicatedToolView
        tool={mockExcelTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByTestId("pdf-to-excel-panel")).toBeInTheDocument();
    expect(screen.getByTestId("format-xlsx-btn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Converter para Excel/i })).toBeInTheDocument();
  });

  it("renderiza o painel de Remover Páginas com miniaturas e seletores de intervalo", async () => {
    const mockTool = launcherTools.find((t) => t.id === "pdf-remove-pages") ?? mockPdfCompressTool;
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "arquivo.pdf", {
      type: "application/pdf",
    });
    render(
      <DedicatedToolView
        tool={mockTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByTestId("remove-pages-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remover Páginas/i })).toBeInTheDocument();
  });

  it("renderiza o painel de Extrair Páginas com alternador de modo e miniaturas", async () => {
    const mockTool = launcherTools.find((t) => t.id === "pdf-extract-pages") ?? mockPdfCompressTool;
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    pdf.addPage([100, 100]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "arquivo.pdf", {
      type: "application/pdf",
    });
    render(
      <DedicatedToolView
        tool={mockTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[file]}
      />,
    );
    expect(screen.getByTestId("extract-pages-panel")).toBeInTheDocument();
    expect(screen.getByText(/Extrair em um único PDF/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Extrair Páginas$/i })).toBeInTheDocument();
  });

  it("renderiza o painel de HTML para PDF com editor e prévia", async () => {
    const mockTool = launcherTools.find((t) => t.id === "html-to-pdf") ?? mockPdfCompressTool;
    render(
      <DedicatedToolView
        tool={mockTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[]}
      />,
    );
    expect(screen.getByTestId("html-to-pdf-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Converter HTML para PDF/i })).toBeInTheDocument();
  });

  it("renderiza o painel de Digitalizar para PDF com opções de câmera e páginas", async () => {
    const mockTool = launcherTools.find((t) => t.id === "scan-to-pdf") ?? mockPdfCompressTool;
    render(
      <DedicatedToolView
        tool={mockTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[]}
      />,
    );
    expect(screen.getByTestId("scan-to-pdf-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar PDF Digitalizado/i })).toBeInTheDocument();
  });
});

it("formulário recebido por navegação recusa entrada incompatível sem carregamento permanente", async () => {
  const tool = launcherTools.find((item) => item.id === "pdf-form-fill");
  if (!tool) throw new Error("Ferramenta ausente");
  render(
    <DedicatedToolView
      tool={tool}
      documentCore={new BrowserDocumentCorePort()}
      onBack={vi.fn()}
      initialFiles={[new File(["texto"], "entrada.txt", { type: "text/plain" })]}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(/PDF|documento/i);
  expect(screen.queryByText("Carregando campos...", { exact: true })).not.toBeInTheDocument();
});
