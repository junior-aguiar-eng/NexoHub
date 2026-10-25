import type {
  EditorBitmap,
  EditorRevision,
  EditorSnapshot,
  EditorWorkerRequest,
  EditorWorkerResponse,
} from "./pdf-editor-types";
export async function reviseBrowserPdf(
  bytes: Uint8Array,
  snapshot: EditorSnapshot,
  page: number,
  options: { signal?: AbortSignal; thumbnails?: boolean } = {},
): Promise<EditorRevision> {
  const response = await requestEditor(
    { kind: "revise", bytes, snapshot, page, thumbnails: options.thumbnails },
    options.signal,
  );
  if (!response.result) throw new Error("EDITOR_WORKER");
  return response.result;
}
export async function renderBrowserPdfPage(
  bytes: Uint8Array,
  page: number,
  options: { signal?: AbortSignal } = {},
): Promise<EditorBitmap> {
  const response = await requestEditor({ kind: "preview", bytes, page }, options.signal);
  if (!response.preview) throw new Error("EDITOR_WORKER");
  return response.preview;
}
async function requestEditor(
  request: EditorWorkerRequest,
  signal?: AbortSignal,
): Promise<EditorWorkerResponse> {
  if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
    };
    const abort = () => {
      cleanup();
      reject(new Error("OPERACAO_CANCELADA"));
    };
    const failed = () => {
      cleanup();
      reject(new Error("EDITOR_WORKER"));
    };
    try {
      worker = new Worker(new URL("./pdf-editor.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<EditorWorkerResponse>) => {
        cleanup();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data);
      };
      worker.onerror = worker.onmessageerror = failed;
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(failed, 60_000);
      const copy = request.bytes.slice();
      worker.postMessage({ ...request, bytes: copy }, [copy.buffer]);
    } catch {
      failed();
    }
  });
}
