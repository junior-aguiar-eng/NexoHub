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
    expect(screen.getByRole("button", { name: "Preto clássico" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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

it("permite ajustar a posição e tamanho de uma tarja pelo teclado", () => {
  const onChange = vi.fn();
  render(
    <RedactPdfPanel
      fileName="real.pdf"
      fileSizeBytes={100}
      totalPages={1}
      redactions={[
        {
          id: "r1",
          pageIndex: 0,
          xPercent: 10,
          yPercent: 20,
          widthPercent: 30,
          heightPercent: 10,
          color: "black",
        },
      ]}
      onRedactionsChange={onChange}
    />,
  );
  fireEvent.change(screen.getByLabelText("Posição horizontal (%)"), { target: { value: "50" } });
  expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ xPercent: 50 })]);
  fireEvent.change(screen.getByLabelText("Largura (%)"), { target: { value: "100" } });
  expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ widthPercent: 90 })]);
});
it("não desenha tarjas sobre uma página sem prévia", () => {
  const onChange = vi.fn();
  render(
    <RedactPdfPanel
      fileName="real.pdf"
      fileSizeBytes={100}
      totalPages={1}
      redactions={[]}
      onRedactionsChange={onChange}
    />,
  );
  const canvas = screen.getByTestId("redact-preview-canvas");
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas, { clientX: 50, clientY: 50 });
  fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50 });
  expect(onChange).not.toHaveBeenCalled();
});

it("desenha com ponteiro e usa o ponto final ao soltar", () => {
  const onChange = vi.fn();
  render(
    <RedactPdfPanel
      fileName="real.pdf"
      fileSizeBytes={100}
      totalPages={1}
      thumbnailUrl="data:image/png;base64,real"
      redactions={[]}
      onRedactionsChange={onChange}
    />,
  );
  const canvas = screen.getByTestId("redact-preview-canvas");
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 20, button: 0 });
  fireEvent.pointerUp(canvas, { clientX: 60, clientY: 80, button: 0 });
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({ xPercent: 10, yPercent: 20, widthPercent: 50, heightPercent: 60 }),
  ]);
  vi.unstubAllGlobals();
});

it("cancela desenho ao interromper o ponteiro", () => {
  const onChange = vi.fn();
  render(
    <RedactPdfPanel
      fileName="real.pdf"
      fileSizeBytes={100}
      totalPages={1}
      thumbnailUrl="data:image/png;base64,real"
      redactions={[]}
      onRedactionsChange={onChange}
    />,
  );
  const canvas = screen.getByTestId("redact-preview-canvas");
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 20, button: 0 });
  fireEvent.pointerCancel(canvas);
  fireEvent.pointerUp(canvas, { clientX: 60, clientY: 80, button: 0 });
  expect(onChange).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("solicita a miniatura da página navegada sem reutilizar a primeira", () => {
  const onPreviewPageChange = vi.fn();
  const { container } = render(
    <RedactPdfPanel
      fileName="real.pdf"
      fileSizeBytes={100}
      totalPages={2}
      thumbnailUrl="/first.png"
      redactions={[]}
      onRedactionsChange={vi.fn()}
      onPreviewPageChange={onPreviewPageChange}
    />,
  );
  fireEvent.click(screen.getByLabelText("Próxima página"));
  expect(onPreviewPageChange).toHaveBeenLastCalledWith(2);
  expect(container.querySelector('img[src="/first.png"]')).toBeNull();
});

it("abre a página da tarja selecionada na lista", () => {
  const onPreviewPageChange = vi.fn();
  render(
    <RedactPdfPanel
      fileName="real.pdf"
      fileSizeBytes={100}
      totalPages={2}
      redactions={[
        {
          id: "r1",
          pageIndex: 1,
          xPercent: 10,
          yPercent: 20,
          widthPercent: 30,
          heightPercent: 10,
          color: "black",
        },
      ]}
      onRedactionsChange={vi.fn()}
      onPreviewPageChange={onPreviewPageChange}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Pág. 2.*#1/ }));
  expect(onPreviewPageChange).toHaveBeenLastCalledWith(2);
});
it("identifica a prévia como marcações e exige escolha explícita de preservação", () => {
  const onPreserveChange = vi.fn();
  render(
    <RedactPdfPanel
      fileName="a.pdf"
      fileSizeBytes={100}
      totalPages={1}
      redactions={[]}
      onRedactionsChange={vi.fn()}
      preserve={false}
      onPreserveChange={onPreserveChange}
    />,
  );
  expect(screen.getByLabelText("Modo de ocultação")).toHaveValue("raster");
  expect(screen.getByText(/Marcações sobre o original/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Modo de ocultação"), { target: { value: "preserve" } });
  expect(onPreserveChange).toHaveBeenCalledWith(true);
});
