import { expect, it, vi } from "vitest";
import { extractPdfSpreadsheetData } from "./excel-converter";

const state = vi.hoisted(() => ({
  onCleanup: () => {},
  destroy: vi.fn(async () => {}),
  pending: undefined as Promise<never> | undefined,
}));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  Util: { transform: (_a: unknown, b: unknown) => b },
  getDocument: () => ({
    promise:
      state.pending ??
      Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getViewport: () => ({ width: 600, height: 800, transform: [1, 0, 0, 1, 0, 0] }),
          getTextContent: async () => ({
            items: [{ str: "00123", transform: [11, 0, 0, 11, 40, 700], width: 30, height: 11 }],
          }),
          cleanup: () => state.onCleanup(),
        }),
        cleanup: async () => {},
      }),
    destroy: state.destroy,
  }),
}));

it("não retorna a matriz quando o cancelamento chega no descarte da última página", async () => {
  const controller = new AbortController();
  state.onCleanup = () => controller.abort();
  await expect(
    extractPdfSpreadsheetData(new Uint8Array([1]), { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(state.destroy).toHaveBeenCalled();
});

it("destrói a tarefa PDF.js quando cancelado durante o carregamento", async () => {
  const controller = new AbortController();
  let rejectLoading!: (error: Error) => void;
  state.pending = new Promise<never>((_resolve, reject) => {
    rejectLoading = reject;
  });
  state.destroy.mockImplementation(async () => {
    rejectLoading(new DOMException("Cancelado", "AbortError"));
  });
  try {
    const extraction = extractPdfSpreadsheetData(new Uint8Array([1]), {
      signal: controller.signal,
    });
    controller.abort();
    await expect(extraction).rejects.toMatchObject({ name: "AbortError" });
    expect(state.destroy).toHaveBeenCalled();
  } finally {
    state.pending = undefined;
    state.destroy.mockReset().mockResolvedValue(undefined);
  }
});
