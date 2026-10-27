import { afterEach, expect, it, vi } from "vitest";
import {
  createDownloadProgress,
  createInactivityFetch,
  performRuntimeTranslation,
  resetRuntimeCache,
} from "./translation-runtime";

const mocks = vi.hoisted(() => ({ pipeline: vi.fn(), env: {} }));
vi.mock("@huggingface/transformers", () => ({ env: mocks.env }));
vi.mock("./translation-model", () => ({
  createTranslationPipeline: (id: string, options: unknown) =>
    mocks.pipeline("translation", id, options),
}));
afterEach(() => {
  resetRuntimeCache();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  mocks.pipeline.mockReset();
});
it("agrega arquivos e mantém progresso monotônico quando surge outro peso", () => {
  const events: { progress: number; loadedBytes?: number; totalBytes?: number }[] = [];
  const callback = createDownloadProgress((event) => events.push(event));
  callback({ status: "progress", file: "encoder.onnx", loaded: 90, total: 100 });
  callback({ status: "progress", file: "decoder.onnx", loaded: 5, total: 100 });
  expect(events[1].progress).toBeGreaterThanOrEqual(events[0].progress);
  expect(events[1].loadedBytes).toBe(95);
  expect(events[1].totalBytes).toBe(200);
});
it("expira download parado antes dos headers", async () => {
  vi.useFakeTimers();
  const request = createInactivityFetch(() => new Promise(() => {}), 100)("https://example.com");
  const rejection = expect(request).rejects.toThrow("TRADUCAO_DOWNLOAD_TIMEOUT");
  await vi.advanceTimersByTimeAsync(101);
  await rejection;
});
it("expira corpo parado, permitindo download lento enquanto chegam bytes", async () => {
  vi.useFakeTimers();
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const fetcher = createInactivityFetch(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            source = controller;
          },
        }),
      ),
    100,
  );
  const response = await fetcher("https://example.com");
  const body = response.arrayBuffer();
  const rejection = expect(body).rejects.toThrow("TRADUCAO_DOWNLOAD_TIMEOUT");
  await vi.advanceTimersByTimeAsync(80);
  source.enqueue(new Uint8Array([1]));
  await vi.advanceTimersByTimeAsync(80);
  source.enqueue(new Uint8Array([2]));
  await vi.advanceTimersByTimeAsync(101);
  await rejection;
});
it("usa WASM diretamente quando não existe GPU e não repete falhas de rede", async () => {
  mocks.pipeline.mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(
    performRuntimeTranslation("Olá", { sourceLang: "pt", targetLang: "en" }),
  ).rejects.toThrow("TRADUCAO_REDE_INDISPONIVEL");
  expect(mocks.pipeline).toHaveBeenCalledTimes(1);
  expect(mocks.pipeline.mock.calls[0][2].device).toBe("wasm");
  mocks.pipeline.mockResolvedValue(async () => [{ translation_text: "Hello" }]);
  expect(
    (await performRuntimeTranslation("Olá", { sourceLang: "pt", targetLang: "en" })).translatedText,
  ).toBe("Hello");
});
it("não corta pares UTF-16 nem altera literais e separadores", async () => {
  mocks.pipeline.mockResolvedValue(async (text: string) => [{ translation_text: text }]);
  const text = `  ${"a".repeat(399)}😀fim\r\n\t{{nome}} pessoa@example.com https://example.com  `;
  expect(
    (await performRuntimeTranslation(text, { sourceLang: "pt", targetLang: "en" })).translatedText,
  ).toBe(text);
});
it("não anuncia conclusão dos pesos ao terminar apenas o tokenizer", () => {
  const events: { progress: number }[] = [];
  const progress = createDownloadProgress((event) => events.push(event));
  progress({ status: "progress", file: "tokenizer.json", loaded: 100, total: 100 });
  expect(events[0].progress).toBe(0);
});
it("mantém o dispositivo WASM medido mesmo quando há adaptador GPU", async () => {
  const requestAdapter = vi.fn(async () => ({}));
  vi.stubGlobal("navigator", { gpu: { requestAdapter } });
  mocks.pipeline.mockResolvedValue(async () => [{ translation_text: "Hello" }]);
  await performRuntimeTranslation("Olá", { sourceLang: "pt", targetLang: "en" });
  expect(mocks.pipeline.mock.calls.map((call) => call[2].device)).toEqual(["wasm"]);
  expect(requestAdapter).not.toHaveBeenCalled();
});
it("não repete o download em WASM se a rede falha com GPU disponível", async () => {
  vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => ({}) } });
  mocks.pipeline.mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(
    performRuntimeTranslation("Olá", { sourceLang: "pt", targetLang: "en" }),
  ).rejects.toThrow("TRADUCAO_REDE_INDISPONIVEL");
  expect(mocks.pipeline).toHaveBeenCalledOnce();
});
it("distingue compilação depois de receber encoder e decoder", () => {
  const events: { status: string; progress: number }[] = [];
  const progress = createDownloadProgress((event) => events.push(event));
  progress({ status: "progress", file: "encoder.onnx", loaded: 100, total: 100 });
  progress({ status: "done", file: "encoder.onnx" });
  progress({ status: "progress", file: "decoder.onnx", loaded: 100, total: 100 });
  progress({ status: "done", file: "decoder.onnx" });
  expect(events.at(-1)?.status).toBe("initializing");
});

it("não carrega NLLB restrito e fixa a revisão do perfil auditado", async () => {
  mocks.pipeline.mockResolvedValue(async () => [{ translation_text: "Hello" }]);
  await performRuntimeTranslation("Olá", { sourceLang: "pt", targetLang: "en" });
  expect(mocks.pipeline.mock.calls[0][1]).not.toBe("Xenova/nllb-200-distilled-600M");
  expect(mocks.pipeline.mock.calls[0][2].revision).toMatch(/^[a-f0-9]{40}$/);
});

it("não aceita conclusão tardia após cancelamento da última inferência", async () => {
  const controller = new AbortController();
  mocks.pipeline.mockResolvedValue(async () => {
    controller.abort();
    return [{ translation_text: "Hello" }];
  });
  await expect(
    performRuntimeTranslation("Olá", {
      sourceLang: "pt",
      targetLang: "en",
      signal: controller.signal,
    }),
  ).rejects.toThrow("OPERACAO_CANCELADA");
});

it("identifica operação sem inferência sem atribuir tradução ao modelo", async () => {
  const result = await performRuntimeTranslation("Olá", { sourceLang: "pt", targetLang: "pt" });
  expect(result.engine).toBe("identity");
  expect(mocks.pipeline).not.toHaveBeenCalled();
});
