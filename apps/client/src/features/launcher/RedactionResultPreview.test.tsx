import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RedactionResultPreview } from "./RedactionResultPreview";

const renderPage = vi.hoisted(() => vi.fn());
vi.mock("@/platform/pdf-engine", () => ({ renderPdfPageToDataUrl: renderPage }));
it("renderiza os bytes do resultado, navega e cancela renderização obsoleta", async () => {
  const bytes = new Uint8Array([3, 4]);
  const blob = new Blob([bytes]);
  Object.defineProperty(blob, "arrayBuffer", { value: async () => bytes.buffer });
  renderPage.mockResolvedValue("data:image/png;base64,AA==");
  const view = render(<RedactionResultPreview blob={blob} pageCount={2} />);
  await screen.findByRole("img", { name: "Página do PDF com as tarjas aplicadas" });
  expect(renderPage.mock.calls[0][0]).toEqual(bytes);
  fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
  await waitFor(() =>
    expect(renderPage).toHaveBeenCalledWith(bytes, 2, 1.8, expect.any(AbortSignal)),
  );
  expect(renderPage.mock.calls[0][3].aborted).toBe(true);
  view.unmount();
  expect(renderPage.mock.lastCall?.[3].aborted).toBe(true);
});
it("mostra falha e permite tentar renderizar novamente sem usar o original", async () => {
  const blob = new Blob();
  Object.defineProperty(blob, "arrayBuffer", { value: async () => new ArrayBuffer(1) });
  renderPage
    .mockRejectedValueOnce(new Error("fail"))
    .mockResolvedValue("data:image/png;base64,AA==");
  render(<RedactionResultPreview blob={blob} pageCount={1} />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar prévia novamente" }));
  await screen.findByRole("img", { name: "Página do PDF com as tarjas aplicadas" });
});
