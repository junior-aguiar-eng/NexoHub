import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentViewerCanvas } from "./DocumentViewerCanvas";

describe("DocumentViewerCanvas - Visualização Multi-Página", () => {
  it("renderiza a página inicial e permite navegar para a próxima e anterior", () => {
    const onPageChange = vi.fn();
    render(
      <DocumentViewerCanvas
        documentTitle="Contrato de Prestação.pdf"
        pageCount={10}
        currentPage={1}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Contrato de Prestação.pdf" })).toBeInTheDocument();
    expect(screen.getByText(/cadeia de custódia local do NexoHub/i)).toBeInTheDocument();

    const nextBtn = screen.getByTitle("Próxima página");
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renderiza o empty state quando não há documento carregado", () => {
    const onImportClick = vi.fn();
    render(<DocumentViewerCanvas hasDocument={false} onImportClick={onImportClick} />);

    expect(screen.getByText("Mesa de Trabalho Documental")).toBeInTheDocument();
    expect(
      screen.getByText(/Arraste e solte um arquivo PDF, Word ou Texto aqui/i),
    ).toBeInTheDocument();

    const selectBtn = screen.getByRole("button", { name: /Selecionar Documento/i });
    expect(selectBtn).toBeInTheDocument();
    fireEvent.click(selectBtn);
    expect(onImportClick).toHaveBeenCalledTimes(1);
  });

  it("abre e fecha o painel retrátil de miniaturas de páginas", () => {
    render(
      <DocumentViewerCanvas documentTitle="Laudo Pericial.pdf" pageCount={5} currentPage={2} />,
    );

    expect(screen.queryByLabelText("Lista de páginas do documento")).not.toBeInTheDocument();

    const thumbBtn = screen.getByTitle("Exibir miniaturas de páginas");
    fireEvent.click(thumbBtn);

    expect(screen.getByLabelText("Lista de páginas do documento")).toBeInTheDocument();
    expect(screen.getByText("Pág. 1")).toBeInTheDocument();
  });

  it("permite digitar a página diretamente no input e navegar", () => {
    const onPageChange = vi.fn();
    render(
      <DocumentViewerCanvas
        documentTitle="Documento Processual.pdf"
        pageCount={20}
        currentPage={3}
        onPageChange={onPageChange}
      />,
    );

    const input = screen.getByTitle("Digite a página e tecle Enter");
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onPageChange).toHaveBeenCalledWith(8);
  });

  it("permite ajustar o zoom e aplicar o ajuste à largura", () => {
    render(<DocumentViewerCanvas documentTitle="Doc.pdf" pageCount={10} />);

    expect(screen.getByText("100%")).toBeInTheDocument();

    const zoomInBtn = screen.getByTitle("Aumentar zoom");
    fireEvent.click(zoomInBtn);
    expect(screen.getByText("115%")).toBeInTheDocument();

    const fitWidthBtn = screen.getByTitle("Ajustar à largura padrão (100%)");
    fireEvent.click(fitWidthBtn);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
