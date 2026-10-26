import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { performBrowserOcr } from "./browser-ocr";

const mocks = vi.hoisted(() => ({
  terminate: vi.fn(async () => {}),
  recognize: vi.fn(),
  createWorker: vi.fn(),
  destroy: vi.fn(async () => {}),
  render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  text: vi.fn(),
}));
vi.mock("./ocr-recognition-session", () => ({ createOcrRecognitionSession: mocks.createWorker }));
vi.mock("./pdf-engine", () => ({
  generateSearchablePdf: async () => new Uint8Array([37, 80, 68, 70]),
}));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async (number: number) => ({
        getTextContent: () => mocks.text(number),
        getViewport: () => ({ width: 100, height: 100 }),
        render: mocks.render,
        cleanup: vi.fn(),
      }),
    }),
    destroy: mocks.destroy,
  }),
}));

beforeEach(() => {
  vi.stubGlobal("Worker", class {});
  mocks.text.mockResolvedValue({ items: [] });
  mocks.recognize.mockResolvedValue({ data: { text: "Ação 123", confidence: 95, blocks: [] } });
  mocks.createWorker.mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const source = () => new Blob(["%PDF-source"], { type: "application/pdf" });

it("aborta antes de criar o worker", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(performBrowserOcr(source(), { signal: controller.signal })).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(mocks.createWorker).not.toHaveBeenCalled();
});

it("encerra reconhecimento pendente, descarta o PDF e não inicia a próxima página", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  mocks.recognize.mockImplementation(() => {
    started();
    return new Promise(() => {});
  });
  const result = performBrowserOcr(source(), { enhanceContrast: false, signal: controller.signal });
  await ready;
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.recognize).toHaveBeenCalledTimes(1);
  expect(mocks.terminate).toHaveBeenCalledTimes(1);
  expect(mocks.destroy).toHaveBeenCalledTimes(1);
});

it("preserva páginas textuais sem duplicar a camada e só reconhece a página digitalizada", async () => {
  mocks.text.mockImplementation(async (page: number) => ({
    items: page === 1 ? [{ str: "Certidão nº 001, ação pública." }] : [],
  }));
  const result = await performBrowserOcr(source(), { enhanceContrast: false });
  expect(result.text).toContain("Certidão nº 001, ação pública.");
  expect(mocks.recognize).toHaveBeenCalledTimes(1);
  expect(result.pageResults[0].lines).toEqual([]);
  expect(result.pageReports.map((page) => page.source)).toEqual(["existing-text", "ocr"]);
  expect(result.pageReports[0].confidence).toBeNull();
  expect(mocks.destroy).toHaveBeenCalledTimes(1);
});

it("não cria motor OCR para PDF inteiramente textual", async () => {
  mocks.text.mockResolvedValue({ items: [{ str: "Texto original 123." }] });
  await performBrowserOcr(source());
  expect(mocks.createWorker).not.toHaveBeenCalled();
  expect(mocks.render).not.toHaveBeenCalled();
});

it("preserva fragmentos contíguos sem inserir espaços em códigos ou palavras", async () => {
  mocks.text.mockResolvedValue({ items: [{ str: "000" }, { str: "123 A" }, { str: "ção" }] });
  const result = await performBrowserOcr(source());
  expect(result.text).toContain("000123 Ação");
  expect(result.text).not.toContain("000 123");
});

it("libera worker inicializado depois de cancelamento sem publicar progresso tardio", async () => {
  let resolveWorker!: (worker: {
    recognize: typeof mocks.recognize;
    terminate: typeof mocks.terminate;
  }) => void;
  mocks.createWorker.mockReturnValue(
    new Promise((resolve) => {
      resolveWorker = resolve;
    }),
  );
  const controller = new AbortController();
  const progress = vi.fn();
  const result = performBrowserOcr(source(), {
    enhanceContrast: false,
    signal: controller.signal,
    onProgress: progress,
  });
  await vi.waitFor(() => expect(mocks.createWorker).toHaveBeenCalled());
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  resolveWorker({ recognize: mocks.recognize, terminate: mocks.terminate });
  await vi.waitFor(() => expect(mocks.terminate).toHaveBeenCalledTimes(1));
  expect(mocks.recognize).not.toHaveBeenCalled();
  expect(progress.mock.calls.some(([value]) => value.progress === 100)).toBe(false);
});
