import { afterEach, expect, it, vi } from "vitest";
import { renderBrowserPdfPage, reviseBrowserPdf } from "./pdf-editor-client";

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

it("prévia isolada transfere uma cópia e termina seu worker sem reconstruir comandos", async () => {
  const requests: unknown[] = [];
  const terminate = vi.fn();
  const preview = { data: new Uint8Array([1, 2, 3, 255]), width: 1, height: 1 };
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: ((event: MessageEvent<{ preview: typeof preview }>) => void) | null = null;
      onerror = null;
      onmessageerror = null;
      terminate = terminate;
      postMessage(request: unknown) {
        requests.push(request);
        queueMicrotask(() => this.onmessage?.(new MessageEvent("message", { data: { preview } })));
      }
    },
  );
  const bytes = new Uint8Array([1, 2]);
  expect(await renderBrowserPdfPage(bytes, 2)).toBe(preview);
  expect(requests[0]).toMatchObject({ kind: "preview", page: 2, bytes });
  expect((requests[0] as { bytes: Uint8Array }).bytes).not.toBe(bytes);
  expect(bytes).toEqual(new Uint8Array([1, 2]));
  expect(terminate).toHaveBeenCalledOnce();
});

it("cancelar prévia termina o worker e ignora resposta atrasada", async () => {
  const terminate = vi.fn();
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = vi.fn();
      terminate = terminate;
    },
  );
  const abort = new AbortController();
  const pending = renderBrowserPdfPage(new Uint8Array([1]), 0, { signal: abort.signal });
  abort.abort();
  await expect(pending).rejects.toThrow("OPERACAO_CANCELADA");
  expect(terminate).toHaveBeenCalledOnce();
});
