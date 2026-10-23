import { afterEach, expect, it, vi } from "vitest";
import { performBrowserTranslation, resetTranslatorCache } from "./browser-translator";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  complete(text = "Hello") {
    const request = this.postMessage.mock.calls.at(-1)?.[0];
    this.onmessage?.({
      data: {
        id: request.id,
        type: "result",
        result: {
          translatedText: text,
          sourceLang: "pt",
          targetLang: "en",
          engine: "transformers.js-nllb-200",
        },
      },
    } as MessageEvent);
  }
}
afterEach(() => {
  resetTranslatorCache();
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
});
it("executa em worker e reutiliza o modelo sem tradução simulada", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const first = performBrowserTranslation("Olá", { sourceLang: "pt", targetLang: "en" });
  await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  FakeWorker.instances[0].complete();
  expect((await first).translatedText).toBe("Hello");
  const second = performBrowserTranslation("Oi", { sourceLang: "pt", targetLang: "en" });
  await vi.waitFor(() => expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledTimes(2));
  FakeWorker.instances[0].complete("Hi");
  expect((await second).translatedText).toBe("Hi");
  expect(FakeWorker.instances).toHaveLength(1);
});
it("cancela inferência terminando worker e permite nova execução", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const controller = new AbortController();
  const job = performBrowserTranslation("Olá", {
    sourceLang: "pt",
    targetLang: "en",
    signal: controller.signal,
  });
  const rejection = expect(job).rejects.toThrow("OPERACAO_CANCELADA");
  await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  controller.abort();
  await rejection;
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  const retry = performBrowserTranslation("Olá", { sourceLang: "pt", targetLang: "en" });
  await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
  FakeWorker.instances[1].complete();
  await retry;
});
it("serializa pedidos para impedir inferências concorrentes", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const first = performBrowserTranslation("Olá", { sourceLang: "pt", targetLang: "en" });
  const second = performBrowserTranslation("Oi", { sourceLang: "pt", targetLang: "en" });
  await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledOnce();
  FakeWorker.instances[0].complete();
  await first;
  await vi.waitFor(() => expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledTimes(2));
  FakeWorker.instances[0].complete();
  await second;
});
it.each(["onerror", "onmessageerror"] as const)(
  "limpa worker após %s e permite tentar novamente",
  async (event) => {
    vi.stubGlobal("Worker", FakeWorker);
    const first = performBrowserTranslation("Olá", { sourceLang: "pt", targetLang: "en" });
    const failure = expect(first).rejects.toThrow("TRADUCAO_WORKER_INDISPONIVEL");
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    FakeWorker.instances[0][event]?.();
    await failure;
    const retry = performBrowserTranslation("Oi", { sourceLang: "pt", targetLang: "en" });
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    FakeWorker.instances[1].complete();
    await retry;
  },
);
it("cancela pedido enfileirado sem interromper a tradução ativa", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const first = performBrowserTranslation("Olá", { sourceLang: "pt", targetLang: "en" });
  const controller = new AbortController();
  const second = performBrowserTranslation("Oi", {
    sourceLang: "pt",
    targetLang: "en",
    signal: controller.signal,
  });
  const failure = expect(second).rejects.toThrow("OPERACAO_CANCELADA");
  controller.abort();
  await failure;
  expect(FakeWorker.instances[0].terminate).not.toHaveBeenCalled();
  FakeWorker.instances[0].complete();
  await first;
  expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledOnce();
});
