import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignPdfPanel } from "./SignPdfPanel";

describe("SignPdfPanel", () => {
  it("renderiza os controles de assinatura, abas de entrada e metadados", () => {
    const onPlacementChange = vi.fn();
    const onSignatureImageChange = vi.fn();
    const onSignerNameChange = vi.fn();
    const onIncludeDateChange = vi.fn();

    render(
      <SignPdfPanel
        fileName="contrato.pdf"
        fileSizeBytes={1024 * 80}
        totalPages={2}
        placement={{ page: "last", xPercent: 65, yPercent: 8, widthPercent: 28, heightPercent: 12 }}
        onPlacementChange={onPlacementChange}
        onSignatureImageChange={onSignatureImageChange}
        signerName="Dr. João da Silva"
        onSignerNameChange={onSignerNameChange}
        includeDate={true}
        onIncludeDateChange={onIncludeDateChange}
      />,
    );

    expect(screen.getByText("Opções de Assinatura")).toBeDefined();
    expect(screen.getByText("Desenhar")).toBeDefined();
    expect(screen.getByText("Digitar")).toBeDefined();
    expect(screen.getByText("Carimbo")).toBeDefined();
    expect(screen.getByText("Nome do signatário (opcional)")).toBeDefined();
    expect(screen.getByText("Incluir carimbo com data e hora local")).toBeDefined();
    expect(screen.getByText("Última página")).toBeDefined();
  });

  it("permite alternar para a aba Digitar e digitar um nome", () => {
    const onSignerNameChange = vi.fn();

    render(
      <SignPdfPanel
        fileName="contrato.pdf"
        fileSizeBytes={1024 * 80}
        totalPages={1}
        placement={{ page: "last", xPercent: 65, yPercent: 8, widthPercent: 28, heightPercent: 12 }}
        onPlacementChange={vi.fn()}
        onSignatureImageChange={vi.fn()}
        signerName=""
        onSignerNameChange={onSignerNameChange}
        includeDate={false}
        onIncludeDateChange={vi.fn()}
      />,
    );

    const typeTab = screen.getByText("Digitar");
    fireEvent.click(typeTab);

    const input = screen.getByLabelText("Digite seu nome completo...");
    expect(input).toBeDefined();
    fireEvent.change(input, { target: { value: "Ana Pereira" } });
  });

  it("chama onPlacementChange ao selecionar páginas alvo", () => {
    const onPlacementChange = vi.fn();

    render(
      <SignPdfPanel
        fileName="procuracao.pdf"
        fileSizeBytes={2048}
        totalPages={3}
        placement={{ page: "last", xPercent: 65, yPercent: 8, widthPercent: 28, heightPercent: 12 }}
        onPlacementChange={onPlacementChange}
        onSignatureImageChange={vi.fn()}
        signerName=""
        onSignerNameChange={vi.fn()}
        includeDate={true}
        onIncludeDateChange={vi.fn()}
      />,
    );

    const firstPageBtn = screen.getByText("Primeira página");
    fireEvent.click(firstPageBtn);
    expect(onPlacementChange).toHaveBeenCalledWith(expect.objectContaining({ page: "first" }));

    const allPagesBtn = screen.getByText("Todas as páginas");
    fireEvent.click(allPagesBtn);
    expect(onPlacementChange).toHaveBeenCalledWith(expect.objectContaining({ page: "all" }));
  });
});
