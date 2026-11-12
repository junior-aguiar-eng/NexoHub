import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalDropzone } from "./GlobalDropzone";

describe("GlobalDropzone", () => {
  it("não exibe o overlay por padrão quando não há arquivos sendo arrastados", () => {
    render(<GlobalDropzone onSelectToolWithFiles={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ativa o overlay quando dragenter ocorre na janela com arquivos", () => {
    render(<GlobalDropzone onSelectToolWithFiles={vi.fn()} />);

    const dataTransfer = {
      types: ["Files"],
      items: [{ kind: "file" }],
    };

    fireEvent.dragEnter(window, { dataTransfer });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Solte seus arquivos aqui/i)).toBeInTheDocument();
  });

  it("fecha o overlay ao pressionar a tecla Escape", () => {
    render(<GlobalDropzone onSelectToolWithFiles={vi.fn()} />);

    const dataTransfer = {
      types: ["Files"],
      items: [{ kind: "file" }],
    };

    fireEvent.dragEnter(window, { dataTransfer });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("quando múltiplos PDFs são soltos, abre automaticamente a ferramenta de Juntar PDFs", () => {
    const onSelectToolWithFiles = vi.fn();
    render(<GlobalDropzone onSelectToolWithFiles={onSelectToolWithFiles} />);

    const file1 = new File(["pdf1"], "doc1.pdf", { type: "application/pdf" });
    const file2 = new File(["pdf2"], "doc2.pdf", { type: "application/pdf" });

    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [file1, file2],
        types: ["Files"],
      },
    };

    fireEvent.dragEnter(window, { dataTransfer: { types: ["Files"], items: [{ kind: "file" }] } });
    fireEvent.drop(window, dropEvent);

    expect(onSelectToolWithFiles).toHaveBeenCalledWith("pdf-merge", [file1, file2]);
  });

  it("quando múltiplas imagens são soltas, abre automaticamente Imagens para PDF", () => {
    const onSelectToolWithFiles = vi.fn();
    render(<GlobalDropzone onSelectToolWithFiles={onSelectToolWithFiles} />);

    const img1 = new File(["img1"], "foto1.jpg", { type: "image/jpeg" });
    const img2 = new File(["img2"], "foto2.png", { type: "image/png" });

    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [img1, img2],
        types: ["Files"],
      },
    };

    fireEvent.dragEnter(window, { dataTransfer: { types: ["Files"], items: [{ kind: "file" }] } });
    fireEvent.drop(window, dropEvent);

    expect(onSelectToolWithFiles).toHaveBeenCalledWith("images-to-pdf", [img1, img2]);
  });

  it("quando um único PDF é solto, exibe menu de escolha rápida e dispara a ferramenta selecionada", () => {
    const onSelectToolWithFiles = vi.fn();
    render(<GlobalDropzone onSelectToolWithFiles={onSelectToolWithFiles} />);

    const file = new File(["conteudo"], "relatorio.pdf", { type: "application/pdf" });

    fireEvent.dragEnter(window, { dataTransfer: { types: ["Files"], items: [{ kind: "file" }] } });
    fireEvent.drop(window, {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [file],
        types: ["Files"],
      },
    });

    expect(screen.getByText(/O que deseja fazer com este arquivo\?/i)).toBeInTheDocument();
    const compressBtn = screen.getByRole("button", { name: /Comprimir PDF/i });
    fireEvent.click(compressBtn);

    expect(onSelectToolWithFiles).toHaveBeenCalledWith("pdf-compress", [file]);
  });
});
