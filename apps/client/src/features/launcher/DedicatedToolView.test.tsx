import { fireEvent, render, screen } from "@testing-library/react";
import { PDFDocument } from "pdf-lib";
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
    const tool = { ...mockPdfCompressTool, id: "pdf-protect" };
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

  it("não executa revisão indisponível no navegador", async () => {
    render(
      <DedicatedToolView
        tool={mockTextReviewTool}
        documentCore={documentCore}
        onBack={vi.fn()}
        initialFiles={[new File(["Texto inicial"], "texto.txt", { type: "text/plain" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Revisar Texto/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/indisponível/i);
  });
});
