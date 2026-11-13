import { afterEach, describe, expect, it, vi } from "vitest";
import { convertBrowserPdfToPdfA, inspectBrowserPdfForPdfa } from "./pdfa-client";
import { PDFA_LIMITS } from "./pdfa-converter";

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

describe("pdfa-client", () => {
  it("cancelar termina o worker e descarta resultado tardio sem mutar o original", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const controller = new AbortController();
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const operation = convertBrowserPdfToPdfA(bytes, {
      conformance: "2b",
      signal: controller.signal,
    });
    const worker = FakeWorker.instances[0];
    const late = worker.onmessage;
    expect(worker.postMessage.mock.calls[0][0].bytes).not.toBe(bytes);
    expect(worker.postMessage.mock.calls[0][0].kind).toBe("convert");

    controller.abort();
    late?.({ data: { result: { pdfBytes: bytes } } } as MessageEvent);

    await expect(operation).rejects.toThrow("OPERACAO_CANCELADA");
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(bytes).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  });

  it("limita o tempo de processamento parado e termina o worker", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const operation = inspectBrowserPdfForPdfa(new Uint8Array([1, 2, 3]));
    const rejection = expect(operation).rejects.toThrow("PDFA_TIMEOUT");
    await vi.advanceTimersByTimeAsync(PDFA_LIMITS.timeoutMs + 1);
    await rejection;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it("rejeita arquivos vazios ou acima do limite antes de abrir worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    await expect(convertBrowserPdfToPdfA(new Uint8Array())).rejects.toThrow("PDFA_INVALID_INPUT");
    const oversized = new Uint8Array(PDFA_LIMITS.inputBytes + 1);
    await expect(inspectBrowserPdfForPdfa(oversized)).rejects.toThrow("PDFA_INPUT_LIMIT");
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
