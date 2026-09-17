import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import { DedicatedToolView } from "./DedicatedToolView";
import { launcherTools } from "./data";

describe("DedicatedToolView - Espaço 2 Colunas e Ferramentas Interativas", () => {
  const documentCore = new BrowserDocumentCorePort();

  const mockPdfOrganizeTool =
    launcherTools.find((t) => t.id === "pdf-organize") || launcherTools[0];
  const mockPdfCompressTool =
    launcherTools.find((t) => t.id === "pdf-compress") || launcherTools[0];
  const mockTextReviewTool = launcherTools.find((t) => t.id === "text-review") || launcherTools[0];

  it("renderiza o Organizador de PDF com painel visual de miniaturas quando um PDF é carregado", async () => {
    const fakeFile = new File(
      ["%PDF-1.4 1 0 obj << /Type /Pages /Count 3 >> endobj"],
      "arquivo_cliente.pdf",
      {
        type: "application/pdf",
      },
    );

    render(
      <DedicatedToolView
        tool={mockPdfOrganizeTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[fakeFile]}
      />,
    );

    expect(screen.getByText(/Organização Visual de Páginas/i)).toBeInTheDocument();
    expect(await screen.findByText("Pág. 1")).toBeInTheDocument();
  });

  it("renderiza o Compressor de PDF com painel de estatísticas de otimização", () => {
    const fakeFile = new File(["%PDF-1.4 fake content"], "documento.pdf", {
      type: "application/pdf",
    });

    render(
      <DedicatedToolView
        tool={mockPdfCompressTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[fakeFile]}
      />,
    );

    expect(screen.getByText(/Resultado da Compressão/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Nível de compressão/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Recomendada/i })).toBeInTheDocument();
  });

  it("permite digitar texto diretamente no Corretor de Texto e exibe o corretor ao lado", () => {
    render(
      <DedicatedToolView tool={mockTextReviewTool} documentCore={documentCore} onBack={vi.fn()} />,
    );

    // Clica na aba Digitar Texto
    const typeTab = screen.getByRole("button", { name: /Digitar Texto/i });
    fireEvent.click(typeTab);

    // Digita texto com erro gramatical / repetido
    const textarea = screen.getByPlaceholderText(/Digite ou cole o texto do documento aqui/i);
    fireEvent.change(textarea, {
      target: { value: "O contrato contrato foi assinado sob judice ." },
    });

    expect(screen.getByText(/Corretor de Texto e Estilo/i)).toBeInTheDocument();
    expect(screen.getByText(/sugestões encontradas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aplicar Todas as Correções/i })).toBeInTheDocument();
  });
});
