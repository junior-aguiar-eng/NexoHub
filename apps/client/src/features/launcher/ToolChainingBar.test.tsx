import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolChainingBar } from "./ToolChainingBar";

describe("ToolChainingBar", () => {
  it("exibe sugestões contextuais para arquivos PDF gerados e dispara transição para a próxima ferramenta", () => {
    const onChainToTool = vi.fn();
    const pdfBlob = new Blob(["%PDF-1.4..."], { type: "application/pdf" });

    render(
      <ToolChainingBar
        currentToolId="pdf-merge"
        outputBlob={pdfBlob}
        outputFileName="documento_mesclado.pdf"
        onChainToTool={onChainToTool}
      />,
    );

    expect(screen.getByText(/Continuar trabalhando neste arquivo:/i)).toBeInTheDocument();
    const compressBtn = screen.getByRole("button", { name: /Comprimir PDF/i });
    expect(compressBtn).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Proteger com Senha/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Numerar Páginas/i })).toBeInTheDocument();

    fireEvent.click(compressBtn);

    expect(onChainToTool).toHaveBeenCalledWith("pdf-compress", expect.any(File));
    const passedFile = onChainToTool.mock.calls[0][1] as File;
    expect(passedFile.name).toBe("documento_mesclado.pdf");
    expect(passedFile.type).toBe("application/pdf");
  });

  it("exibe sugestões para converter em PDF quando a saída for uma imagem", () => {
    const onChainToTool = vi.fn();
    const imgBlob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });

    render(
      <ToolChainingBar
        currentToolId="image-compress"
        outputBlob={imgBlob}
        outputFileName="foto_otimizada.jpg"
        onChainToTool={onChainToTool}
      />,
    );

    const toPdfBtn = screen.getByRole("button", { name: /Converter para PDF/i });
    expect(toPdfBtn).toBeInTheDocument();

    fireEvent.click(toPdfBtn);
    expect(onChainToTool).toHaveBeenCalledWith("images-to-pdf", expect.any(File));
  });

  it("não renderiza botões repetidos da ferramenta atual", () => {
    const onChainToTool = vi.fn();
    const pdfBlob = new Blob(["%PDF-1.4..."], { type: "application/pdf" });

    render(
      <ToolChainingBar
        currentToolId="pdf-compress"
        outputBlob={pdfBlob}
        outputFileName="comprimido.pdf"
        onChainToTool={onChainToTool}
      />,
    );

    // Não deve sugerir "Comprimir PDF" se a ferramenta atual já é compressão
    expect(screen.queryByRole("button", { name: /Comprimir PDF/i })).not.toBeInTheDocument();
  });
});
