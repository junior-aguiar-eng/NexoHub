import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignPdfPanel } from "./SignPdfPanel";

const drawing = {
  lineCap: "",
  lineJoin: "",
  strokeStyle: "",
  lineWidth: 1,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
  fillText: vi.fn(),
};
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    drawing as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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
    expect(screen.getByText("Imagem / Carimbo")).toBeDefined();
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

it("não insere nome de terceiros ao abrir a aba Digitar", () => {
  render(
    <SignPdfPanel
      fileName="a.pdf"
      fileSizeBytes={1}
      totalPages={1}
      placement={{ xPercent: 0, yPercent: 0, widthPercent: 30, heightPercent: 15 }}
      onPlacementChange={vi.fn()}
      onSignatureImageChange={vi.fn()}
      signerName=""
      onSignerNameChange={vi.fn()}
      includeDate={false}
      onIncludeDateChange={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText("Digitar"));
  expect(screen.getByLabelText("Digite seu nome completo...")).toHaveValue("");
});

it("transforma coordenadas CSS do desenho em pixels do canvas", () => {
  const { container } = render(
    <SignPdfPanel
      fileName="a.pdf"
      fileSizeBytes={1}
      totalPages={1}
      placement={{ xPercent: 0, yPercent: 0, widthPercent: 30, heightPercent: 15 }}
      onPlacementChange={vi.fn()}
      onSignatureImageChange={vi.fn()}
      signerName=""
      onSignerNameChange={vi.fn()}
      includeDate={false}
      onIncludeDateChange={vi.fn()}
    />,
  );
  const canvas = container.querySelector("canvas");
  if (!canvas) throw new Error("Canvas ausente");
  canvas.setPointerCapture = vi.fn();
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 10,
    top: 20,
    width: 160,
    height: 60,
  } as DOMRect);
  fireEvent.pointerDown(canvas, { clientX: 50, clientY: 35 });
  fireEvent.pointerMove(canvas, { clientX: 90, clientY: 50 });
  expect(drawing.moveTo).toHaveBeenCalledWith(80, 30);
  expect(drawing.lineTo).toHaveBeenCalledWith(160, 60);
});

it("apaga a assinatura anterior quando o texto digitado é apagado", () => {
  const onSignatureImageChange = vi.fn();
  render(
    <SignPdfPanel
      fileName="a.pdf"
      fileSizeBytes={1}
      totalPages={1}
      placement={{ xPercent: 0, yPercent: 0, widthPercent: 30, heightPercent: 15 }}
      onPlacementChange={vi.fn()}
      onSignatureImageChange={onSignatureImageChange}
      signerName=""
      onSignerNameChange={vi.fn()}
      includeDate={false}
      onIncludeDateChange={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText("Digitar"));
  const input = screen.getByLabelText("Digite seu nome completo...");
  fireEvent.change(input, { target: { value: "Ana" } });
  onSignatureImageChange.mockClear();
  fireEvent.change(input, { target: { value: "" } });
  expect(onSignatureImageChange).toHaveBeenCalledWith(undefined, undefined);
});
