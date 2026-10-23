import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RedactPdfPanel } from "./RedactPdfPanel";

describe("RedactPdfPanel", () => {
  it("renderiza opções de cor, label e botão de adicionar tarja manual", () => {
    const onRedactionsChange = vi.fn();

    render(
      <RedactPdfPanel
        fileName="relatorio_lgpd.pdf"
        fileSizeBytes={1024 * 90}
        totalPages={2}
        redactions={[]}
        onRedactionsChange={onRedactionsChange}
      />,
    );

    expect(screen.getByText("relatorio_lgpd.pdf")).toBeDefined();
    expect(screen.getByText("Configurações de Tarja")).toBeDefined();
    expect(screen.getByText("Preto clássico")).toBeDefined();
    expect(screen.getByText("Branco (limpar fundo)")).toBeDefined();
    expect(screen.getByText("Cinza neutro")).toBeDefined();
    expect(screen.getByTestId("redact-add-manual")).toBeDefined();
  });

  it("adiciona tarja ao clicar em Adicionar Tarja Manual", () => {
    const onRedactionsChange = vi.fn();

    render(
      <RedactPdfPanel
        fileName="relatorio_lgpd.pdf"
        fileSizeBytes={1024 * 90}
        totalPages={1}
        redactions={[]}
        onRedactionsChange={onRedactionsChange}
      />,
    );

    const addBtn = screen.getByTestId("redact-add-manual");
    fireEvent.click(addBtn);

    expect(onRedactionsChange).toHaveBeenCalledOnce();
    const calledWith = onRedactionsChange.mock.calls[0][0];
    expect(calledWith.length).toBe(1);
    expect(calledWith[0].color).toBe("black");
    expect(calledWith[0].label).toBe("[CONFIDENCIAL]");
  });

  it("remove tarja e permite limpar todas", () => {
    const onRedactionsChange = vi.fn();
    const existing = [
      {
        id: "r1",
        pageIndex: 0,
        xPercent: 10,
        yPercent: 10,
        widthPercent: 50,
        heightPercent: 10,
        color: "black",
        label: "[DADOS SENSÍVEIS]",
      },
      {
        id: "r2",
        pageIndex: 0,
        xPercent: 20,
        yPercent: 30,
        widthPercent: 30,
        heightPercent: 10,
        color: "white",
      },
    ];

    render(
      <RedactPdfPanel
        fileName="relatorio_lgpd.pdf"
        fileSizeBytes={1024 * 90}
        totalPages={1}
        redactions={existing}
        onRedactionsChange={onRedactionsChange}
      />,
    );

    expect(screen.getAllByTestId("redact-area-item").length).toBe(2);

    const clearBtn = screen.getByText("Limpar Todas");
    fireEvent.click(clearBtn);
    expect(onRedactionsChange).toHaveBeenCalledWith([]);
  });
});
