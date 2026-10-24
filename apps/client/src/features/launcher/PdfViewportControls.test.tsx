import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PdfViewportControls } from "./PdfViewportControls";

afterEach(cleanup);
it("limita navegação às páginas reais e aceita salto pelo teclado", () => {
  const onPageChange = vi.fn();
  const props = {
    page: 1,
    pageCount: 3,
    zoom: 1,
    onPageChange,
    onZoomChange: vi.fn(),
    onFitWidth: vi.fn(),
  };
  const view = render(<PdfViewportControls {...props} />);
  expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
  expect(onPageChange).toHaveBeenLastCalledWith(2);
  const input = screen.getByRole("spinbutton", { name: "Página da prévia" });
  fireEvent.change(input, { target: { value: "99" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onPageChange).toHaveBeenLastCalledWith(3);
  view.rerender(<PdfViewportControls {...props} page={3} />);
  expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.blur(input);
  expect(input).toHaveValue(3);
});
it("controla zoom com limites e ajuste à largura sem alterar página", () => {
  const onPageChange = vi.fn(),
    onZoomChange = vi.fn(),
    onFitWidth = vi.fn();
  const props = { page: 2, pageCount: 3, zoom: 1, onPageChange, onZoomChange, onFitWidth };
  const view = render(<PdfViewportControls {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Ampliar prévia" }));
  expect(onZoomChange).toHaveBeenLastCalledWith(1.25);
  fireEvent.click(screen.getByRole("button", { name: "Ajustar à largura" }));
  expect(onFitWidth).toHaveBeenCalledOnce();
  expect(onPageChange).not.toHaveBeenCalled();
  view.rerender(<PdfViewportControls {...props} zoom={3} />);
  expect(screen.getByRole("button", { name: "Ampliar prévia" })).toBeDisabled();
  view.rerender(<PdfViewportControls {...props} zoom={0.5} />);
  expect(screen.getByRole("button", { name: "Reduzir prévia" })).toBeDisabled();
});
