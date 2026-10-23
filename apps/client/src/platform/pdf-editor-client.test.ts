import { afterEach, expect, it, vi } from "vitest";
import { reviseBrowserPdf } from "./pdf-editor-client";

afterEach(() => vi.unstubAllGlobals());
it("cancelar termina worker e não transfere nem modifica bytes originais", async () => {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
    onmessageerror: null,
  };
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        Object.assign(this, worker);
      }
    },
  );
  const abort = new AbortController(),
    bytes = new Uint8Array([1, 2]);
  const promise = reviseBrowserPdf(bytes, { replacements: [], elements: [] }, 0, {
    signal: abort.signal,
  });
  abort.abort();
  await expect(promise).rejects.toThrow("OPERACAO_CANCELADA");
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(bytes).toEqual(new Uint8Array([1, 2]));
});
it("falha de inicialização é recuperável e tem código estruturado", async () => {
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        throw new Error("Unavailable");
      }
    },
  );
  await expect(
    reviseBrowserPdf(new Uint8Array([1]), { replacements: [], elements: [] }, 0),
  ).rejects.toThrow("EDITOR_WORKER");
});
