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
});
