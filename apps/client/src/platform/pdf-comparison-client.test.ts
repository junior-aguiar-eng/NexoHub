import { afterEach, expect, it, vi } from "vitest";
import { performBrowserPdfComparison } from "./pdf-comparison-client";

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  TestWorker.instances = [];
});
it("cancela o worker e descarta mensagens antigas sem alterar os buffers originais", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const controller = new AbortController();
  const progress = vi.fn();
  const left = new Uint8Array([1, 2, 3]);
  const task = performBrowserPdfComparison(left, left, ["a.pdf", "b.pdf"], {
    signal: controller.signal,
    onProgress: progress,
  });
  const worker = TestWorker.instances[0];
  expect(worker.postMessage.mock.calls[0][0].left).not.toBe(left.buffer);
  expect(Array.from(left)).toEqual([1, 2, 3]);
  controller.abort();
  await expect(task).rejects.toThrow("OPERACAO_CANCELADA");
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(worker.onmessage).toBeNull();
  expect(progress).not.toHaveBeenCalled();
  const retry = performBrowserPdfComparison(left, left, ["a.pdf", "b.pdf"]);
  const next = TestWorker.instances[1];
  next.onerror?.();
  await expect(retry).rejects.toThrow("PDF_COMPARACAO_WORKER_INDISPONIVEL");
});
it("entrega o resultado e encerra recursos após sucesso", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const task = performBrowserPdfComparison(new Uint8Array([1]), new Uint8Array([2]), []);
  const worker = TestWorker.instances[0];
  const bundle = { comparison: { pairs: [] }, report: new Uint8Array([1]), json: "{}" };
  worker.onmessage?.({ data: { type: "result", bundle } } as MessageEvent);
  expect(await task).toBe(bundle);
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it("não inicia worker quando o pedido já foi cancelado", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const controller = new AbortController();
  controller.abort();
  await expect(
    performBrowserPdfComparison(new Uint8Array(), new Uint8Array(), [], {
      signal: controller.signal,
    }),
  ).rejects.toThrow("OPERACAO_CANCELADA");
  expect(TestWorker.instances).toHaveLength(0);
});
