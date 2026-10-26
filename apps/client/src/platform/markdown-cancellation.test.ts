import { beforeEach, expect, it, vi } from "vitest";
import { convertPdfToMarkdown } from "./markdown-converter";

const state = vi.hoisted(() => ({
  onCleanup: () => {},
  destroy: vi.fn(async () => {}),
  pending: undefined as Promise<never> | undefined,
}));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: {},
  Util: { transform: (_a: unknown, b: unknown) => b },
  getDocument: () => ({
    promise:
      state.pending ??
      Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getViewport: () => ({ width: 600, height: 800, transform: [1, 0, 0, -1, 0, 800] }),
          getTextContent: async () => ({
            items: [
              {
                str: "Texto integral",
                fontName: "regular",
                transform: [11, 0, 0, 11, 40, 700],
                width: 60,
                height: 11,
              },
            ],
          }),
          cleanup: () => state.onCleanup(),
        }),
        cleanup: async () => {},
      }),
    destroy: state.destroy,
  }),
}));
beforeEach(() => {
  state.pending = undefined;
  state.onCleanup = () => {};
  state.destroy.mockReset().mockResolvedValue(undefined);
});

it("descarta resultado quando cancelado no descarte da última página", async () => {
  const controller = new AbortController();
  state.onCleanup = () => controller.abort();
  await expect(
    convertPdfToMarkdown(new Uint8Array([1]), { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(state.destroy).toHaveBeenCalled();
});

it("encerra carregamento pendente ao receber cancelamento", async () => {
  let rejectLoading!: (error: Error) => void;
  state.pending = new Promise<never>((_resolve, reject) => {
    rejectLoading = reject;
  });
  state.destroy.mockImplementation(async () => {
    rejectLoading(new DOMException("Cancelado", "AbortError"));
  });
  const controller = new AbortController();
  const promise = convertPdfToMarkdown(new Uint8Array([1]), { signal: controller.signal });
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  expect(state.destroy).toHaveBeenCalled();
});
