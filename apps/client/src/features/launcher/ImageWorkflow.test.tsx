import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import type { ImageJob } from "@/platform/image-processing";
import { DedicatedToolView } from "./DedicatedToolView";
import { launcherTools } from "./data";

const engine = vi.hoisted(() => vi.fn<(job: ImageJob, signal?: AbortSignal) => Promise<Blob>>());
vi.mock("@/platform/image-processing", () => ({ processImage: engine }));
vi.mock("@/platform/image-engine", async () => ({
  ...(await vi.importActual<typeof import("@/platform/image-engine")>("@/platform/image-engine")),
  getImageMetadata: async (blob: Blob) => ({
    width: 96,
    height: 48,
    mimeType: "image/png",
    sizeBytes: blob.size,
  }),
  getGeneratedImageMetadata: async (blob: Blob) => ({
    width: 48,
    height: 96,
    mimeType: "image/png",
    sizeBytes: blob.size,
  }),
}));
// O teste mede cancelar/reiniciar; a transformação do mock pelo Vitest pertence à preparação.
beforeAll(async () => {
  await import("@/platform/image-engine");
});
afterEach(() => {
  engine.mockReset();
  vi.restoreAllMocks();
});
it("cancelar e reiniciar não deixa erro da execução anterior interromper a nova", async () => {
  const tool = launcherTools.find((t) => t.id === "image-rotate");
  if (!tool) throw new Error("Ferramenta ausente");
  let finish: (blob: Blob) => void = () => {};
  engine
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  render(
    <DedicatedToolView
      tool={tool}
      documentCore={new BrowserDocumentCorePort()}
      onBack={vi.fn()}
      initialFiles={[new File(["fixture"], "foto.png", { type: "image/png" })]}
    />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Girar imagem" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Girar imagem" }));
  await waitFor(() => expect(engine).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Cancelar processamento" }));
  fireEvent.click(screen.getByRole("button", { name: "Girar imagem" }));
  await waitFor(() => expect(engine).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancelar processamento" })).toBeInTheDocument();
  await act(async () => {
    finish(new Blob(["output"], { type: "image/png" }));
  });
  expect(screen.getByRole("heading", { name: /Pronto! Arquivo processado/ })).toBeInTheDocument();
});
