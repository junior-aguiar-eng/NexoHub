import { afterEach, expect, it, vi } from "vitest";
import { repairBrowserPdf } from "./pdf-repair-client";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.instances = [];
});

it("cancelar termina o worker e descarta resultado tardio sem transferir o original", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const controller = new AbortController();
  const bytes = new Uint8Array([1, 2, 3]);
  const operation = repairBrowserPdf(bytes, { signal: controller.signal });
  const worker = FakeWorker.instances[0];
  const late = worker.onmessage;
  expect(worker.postMessage.mock.calls[0][0].bytes).not.toBe(bytes);
  controller.abort();
  late?.({ data: { result: { pdfBytes: bytes } } } as MessageEvent);
  await expect(operation).rejects.toThrow("OPERACAO_CANCELADA");
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
});

it("limita o tempo de um parser parado e termina o worker", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Worker", FakeWorker);
  const operation = repairBrowserPdf(new Uint8Array([1]));
  const rejection = expect(operation).rejects.toThrow("PDF_REPAIR_TIMEOUT");
  await vi.advanceTimersByTimeAsync(30_001);
  await rejection;
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
});
