import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HtmlToPdfPanel } from "./HtmlToPdfPanel";

describe("HtmlToPdfPanel", () => {
  it("renderiza o editor de código e prévia do HTML", () => {
    const onContentChange = vi.fn();
    const onFileUpload = vi.fn();
    const onPageSizeChange = vi.fn();
    const onOrientationChange = vi.fn();
    const onMarginChange = vi.fn();

    render(
      <HtmlToPdfPanel
        fileName="pagina.html"
        htmlContent="<h1>Teste NexoHub</h1>"
        onHtmlContentChange={onContentChange}
        onFileUpload={onFileUpload}
        pageSize="A4"
        onPageSizeChange={onPageSizeChange}
        orientation="portrait"
        onOrientationChange={onOrientationChange}
        margin="normal"
        onMarginChange={onMarginChange}
      />,
    );

    expect(screen.getByText("pagina.html")).toBeInTheDocument();
    expect(screen.getByTestId("html-code-input")).toBeInTheDocument();
    expect(screen.getByText(/Pré-visualização do Documento/i)).toBeInTheDocument();
    expect(screen.getByText(/Imagens não são incluídas/)).toBeInTheDocument();
    expect(screen.getByTitle("Pré-visualização HTML")).toHaveAttribute("sandbox", "");
  });

  it("dispara callback ao editar código HTML", () => {
    const onContentChange = vi.fn();
    render(
      <HtmlToPdfPanel
        htmlContent="<p>Antigo</p>"
        onHtmlContentChange={onContentChange}
        onFileUpload={vi.fn()}
        pageSize="A4"
        onPageSizeChange={vi.fn()}
        orientation="portrait"
        onOrientationChange={vi.fn()}
        margin="normal"
        onMarginChange={vi.fn()}
      />,
    );

    const textarea = screen.getByTestId("html-code-input");
    fireEvent.change(textarea, { target: { value: "<p>Novo Conteúdo</p>" } });
    expect(onContentChange).toHaveBeenCalledWith("<p>Novo Conteúdo</p>");
  });

  it("permite alterar configurações de página e orientação", () => {
    const onPageSizeChange = vi.fn();
    const onOrientationChange = vi.fn();
    const onMarginChange = vi.fn();

    render(
      <HtmlToPdfPanel
        htmlContent="<p>Conteúdo</p>"
        onHtmlContentChange={vi.fn()}
        onFileUpload={vi.fn()}
        pageSize="A4"
        onPageSizeChange={onPageSizeChange}
        orientation="portrait"
        onOrientationChange={onOrientationChange}
        margin="normal"
        onMarginChange={onMarginChange}
      />,
    );

    const sizeSelect = screen.getByLabelText(/Tamanho da Página/i);
    fireEvent.change(sizeSelect, { target: { value: "Letter" } });
    expect(onPageSizeChange).toHaveBeenCalledWith("Letter");

    const orientSelect = screen.getByLabelText(/Orientação/i);
    fireEvent.change(orientSelect, { target: { value: "landscape" } });
    expect(onOrientationChange).toHaveBeenCalledWith("landscape");
  });
});
