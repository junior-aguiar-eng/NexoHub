import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentComparePanel } from "./DocumentComparePanel";

describe("DocumentComparePanel - Comparador de 2 a 3 Documentos", () => {
  it("calcula adições e remoções reais entre os dois documentos", () => {
    render(
      <DocumentComparePanel
        doc1Text={"Linha 1\nLinha 2 Antiga\nLinha 3"}
        doc2Text={"Linha 1\nLinha 2 Nova\nLinha 3\nLinha 4 Extra"}
      />,
    );

    expect(screen.getByText(/Quadro Comparativo de Documentos/i)).toBeInTheDocument();
    expect(screen.getByText(/Adições/i)).toBeInTheDocument();
    expect(screen.getByText(/Remoções/i)).toBeInTheDocument();

    // +2 adições ("Linha 2 Nova", "Linha 4 Extra") e -1 remoção ("Linha 2 Antiga")
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("permite alternar para modo unificado e exibe as linhas coloridas", () => {
    const { container } = render(<DocumentComparePanel doc1Text="Texto A" doc2Text="Texto B" />);

    const unifiedBtn = screen.getByRole("button", { name: /Unificado/i });
    fireEvent.click(unifiedBtn);

    expect(container.querySelector(".doc-compare-diff-line--added")).toBeInTheDocument();
    expect(container.querySelector(".doc-compare-diff-line--removed")).toBeInTheDocument();
  });

  it("permite adicionar um 3º documento ao quadro", () => {
    const onToggleDoc3 = vi.fn();
    render(
      <DocumentComparePanel
        doc1Text="Versão 1"
        doc2Text="Versão 2"
        showDoc3={false}
        onToggleDoc3={onToggleDoc3}
      />,
    );

    const add3Btn = screen.getByRole("button", { name: /Adicionar 3º Documento/i });
    fireEvent.click(add3Btn);

    expect(onToggleDoc3).toHaveBeenCalledWith(true);
  });

  it("renderiza linhas alinhadas lado a lado e destaca palavras alteradas", () => {
    const { container } = render(
      <DocumentComparePanel
        doc1Text="Contrato de prestação de serviços de advocacia"
        doc2Text="Contrato de prestação de serviços de consultoria"
      />,
    );

    // Deve estar no modo de visualização de diferenças por padrão quando há textos
    expect(container.querySelector(".doc-compare-side-diff-board")).toBeInTheDocument();
    expect(container.querySelector(".doc-compare-side-diff-row")).toBeInTheDocument();

    // Palavras alteradas devem estar marcadas
    expect(container.querySelector(".doc-word--deleted")).toHaveTextContent("advocacia");
    expect(container.querySelector(".doc-word--added")).toHaveTextContent("consultoria");

    // Badge de similaridade deve estar presente
    expect(screen.getByText(/Similaridade/i)).toBeInTheDocument();
  });

  it("permite alternar para modo de edição de texto", () => {
    const { container } = render(
      <DocumentComparePanel doc1Text="Texto inicial" doc2Text="Texto alterado" />,
    );

    const editBtn = screen.getByRole("button", { name: /Editar \/ Digitar/i });
    fireEvent.click(editBtn);

    expect(container.querySelector(".doc-compare-textarea")).toBeInTheDocument();
  });
});
