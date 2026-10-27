import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import { renderPdfPageToDataUrl } from "@/platform/pdf-engine";
import { DedicatedToolView } from "./DedicatedToolView";
import { launcherTools } from "./data";

vi.mock("@/platform/pdf-engine", async (original) => ({
  ...(await original<typeof import("@/platform/pdf-engine")>()),
  getPdfPageCount: vi.fn(async () => 50),
  renderPdfPagesThumbnails: vi.fn(async () => Array(48).fill("data:image/png;base64,AAAA")),
  renderPdfPageToDataUrl: vi.fn(),
}));
vi.mock("./PdfPageGridPanel", () => ({
  PdfPageGridPanel: ({ onPreviewPageChange }: { onPreviewPageChange: (page: number) => void }) => (
    <>
      <button type="button" onClick={() => onPreviewPageChange(49)}>
        Página 49
      </button>
      <button type="button" onClick={() => onPreviewPageChange(50)}>
        Página 50
      </button>
    </>
  ),
}));

it("descarta miniaturas enfileiradas quando a ferramenta é desmontada", async () => {
  let finish: (value: string) => void = () => {};
  let renderSignal: AbortSignal | undefined;
  vi.mocked(renderPdfPageToDataUrl).mockImplementationOnce((_bytes, _page, _scale, signal) => {
    renderSignal = signal;
    return new Promise<string>((resolve) => {
      finish = resolve;
    });
  });
  const file = new File(["PDF sintético"], "documento.pdf", { type: "application/pdf" });
  const readSource = vi.fn(async () => new ArrayBuffer(0));
  Object.defineProperty(file, "arrayBuffer", { value: readSource });
  const tool = launcherTools.find((item) => item.id === "pdf-organize");
  if (!tool) throw new Error("Ferramenta ausente");
  const view = render(
    <DedicatedToolView
      tool={tool}
      documentCore={new BrowserDocumentCorePort()}
      onBack={vi.fn()}
      initialFiles={[file]}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Página 49" }));
  fireEvent.click(screen.getByRole("button", { name: "Página 50" }));
  await waitFor(() => expect(renderPdfPageToDataUrl).toHaveBeenCalledTimes(1));
  expect(renderSignal).toBeInstanceOf(AbortSignal);
  const readsBeforeUnmount = readSource.mock.calls.length;
  view.unmount();
  expect(renderSignal?.aborted).toBe(true);
  await act(async () => {
    finish("data:image/png;base64,BBBB");
  });
  expect(renderPdfPageToDataUrl).toHaveBeenCalledTimes(1);
  expect(readSource).toHaveBeenCalledTimes(readsBeforeUnmount);
});
