import { afterEach, describe, expect, it, vi } from "vitest";
import { processImage } from "./image-processing";

afterEach(() => vi.unstubAllGlobals());
describe("processImage", () => {
  it("aborta sem criar worker quando o sinal já está cancelado", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      processImage({ kind: "rotate", blob: new Blob(), options: { angle: 90 } }, controller.signal),
    ).rejects.toThrow("OPERACAO_CANCELADA");
  });
  it("encerra o worker no cancelamento e ignora resultados posteriores", async () => {
    class WorkerStub {
      onmessage: ((event: { data: { blob: Blob } }) => void) | null = null;
      onerror = null;
      onmessageerror = null;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() {
        instance = this;
      }
    }
    let instance: WorkerStub | undefined;
    vi.stubGlobal("Worker", WorkerStub);
    vi.stubGlobal("OffscreenCanvas", class {});
    const controller = new AbortController();
    const result = processImage(
      { kind: "rotate", blob: new Blob(), options: { angle: 90 } },
      controller.signal,
    );
    controller.abort();
    await expect(result).rejects.toThrow("OPERACAO_CANCELADA");
    expect(instance?.terminate).toHaveBeenCalledOnce();
    instance?.onmessage?.({ data: { blob: new Blob(["late"]) } });
    await expect(result).rejects.toThrow("OPERACAO_CANCELADA");
  });
  it("despacha eventos de progresso quando o worker emite mensagens de progresso", async () => {
    class WorkerStub {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror = null;
      onmessageerror = null;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() {
        instance = this;
      }
    }
    let instance: WorkerStub | undefined;
    vi.stubGlobal("Worker", WorkerStub);
    vi.stubGlobal("OffscreenCanvas", class {});

    const onProgress = vi.fn();
    const resultPromise = processImage(
      { kind: "rotate", blob: new Blob(), options: { angle: 90 } },
      undefined,
      onProgress,
    );

    instance?.onmessage?.({ data: { type: "progress", percent: 50, stage: "processando" } });
    expect(onProgress).toHaveBeenCalledWith({ percent: 50, stage: "processando" });

    const expectedBlob = new Blob(["done"]);
    instance?.onmessage?.({ data: { type: "success", blob: expectedBlob } });

    await expect(resultPromise).resolves.toBe(expectedBlob);
  });
});
