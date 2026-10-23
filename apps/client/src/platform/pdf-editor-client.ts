import type { EditorRevision, EditorSnapshot } from "./pdf-editor-types";
export async function reviseBrowserPdf(
  bytes: Uint8Array,
  snapshot: EditorSnapshot,
  page: number,
  options: { signal?: AbortSignal; thumbnails?: boolean } = {},
): Promise<EditorRevision> {
  if (options.signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
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
      worker.onmessage = (event: MessageEvent<{ result?: EditorRevision; error?: string }>) => {
        cleanup();
        if (event.data.result) resolve(event.data.result);
        else reject(new Error(event.data.error ?? "EDITOR_WORKER"));
      };
      worker.onerror = worker.onmessageerror = failed;
      options.signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(failed, 60_000);
      const copy = bytes.slice();
      worker.postMessage({ bytes: copy, snapshot, page, thumbnails: options.thumbnails }, [
        copy.buffer,
      ]);
    } catch {
      failed();
    }
  });
}
