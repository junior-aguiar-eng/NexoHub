/** Adaptador web: inferência isolada do renderer em um worker reutilizável. */
import type {
  BrowserTranslationOptions,
  BrowserTranslationResult,
  TranslationWorkerRequest,
  TranslationWorkerResponse,
} from "./translation-protocol";

export type {
  BrowserTranslationOptions,
  BrowserTranslationResult,
  TranslationLanguage,
  TranslationProgressInfo,
} from "./translation-protocol";
export { TRANSLATION_MODEL } from "./translation-protocol";
export { segmentTextForTranslation } from "./translation-segmentation";

interface PendingJob {
  request: TranslationWorkerRequest;
  options: BrowserTranslationOptions;
  resolve: (result: BrowserTranslationResult) => void;
  reject: (error: Error) => void;
  abort: () => void;
}
let worker: Worker | null = null;
let active: PendingJob | null = null;
const queue: PendingJob[] = [];
let nextId = 0;
function terminateWorker(): void {
  if (worker) {
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    worker = null;
  }
}
function settle(error?: string, result?: BrowserTranslationResult): void {
  const job = active;
  if (!job) return;
  active = null;
  job.options.signal?.removeEventListener("abort", job.abort);
  if (error) job.reject(new Error(error));
  else if (result) job.resolve(result);
  pump();
}
function pump(): void {
  if (active || !queue.length) return;
  active = queue.shift() ?? null;
  if (!active) return;
  try {
    if (!worker) {
      worker = new Worker(new URL("./translation.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<TranslationWorkerResponse>) => {
        const data = event.data;
        if (!active || data.id !== active.request.id) return;
        if (data.type === "progress") active.options.onProgress?.(data.progress);
        else if (data.type === "result") settle(undefined, data.result);
        else if (data.type === "error") {
          terminateWorker();
          settle(data.code);
        }
      };
      const fail = () => {
        terminateWorker();
        settle("TRADUCAO_WORKER_INDISPONIVEL");
      };
      worker.onerror = fail;
      worker.onmessageerror = fail;
    }
    worker.postMessage(active.request);
  } catch {
    terminateWorker();
    settle("TRADUCAO_WORKER_INDISPONIVEL");
  }
}
export function resetTranslatorCache(): void {
  terminateWorker();
  // Limpa os pedidos antes de rejeitá-los para não iniciar outro worker.
  const jobs = active ? [active, ...queue] : [...queue];
  active = null;
  queue.length = 0;
  for (const job of jobs) {
    job.options.signal?.removeEventListener("abort", job.abort);
    job.reject(new Error("OPERACAO_CANCELADA"));
  }
}
export async function performBrowserTranslation(
  text: string,
  options: BrowserTranslationOptions,
): Promise<BrowserTranslationResult> {
  if (options.signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  const languages = ["pt", "en", "es"];
  if (!languages.includes(options.sourceLang) || !languages.includes(options.targetLang)) {
    throw new Error("PAR_DE_IDIOMAS_NAO_SUPORTADO");
  }
  if (options.sourceLang === options.targetLang || !text.trim()) {
    return {
      translatedText: text,
      sourceLang: options.sourceLang,
      targetLang: options.targetLang,
      engine: "identity",
    };
  }
  return new Promise((resolve, reject) => {
    const job: PendingJob = {
      request: {
        id: ++nextId,
        text,
        sourceLang: options.sourceLang,
        targetLang: options.targetLang,
        preservedNames: options.preservedNames,
      },
      options,
      resolve,
      reject,
      abort: () => {
        if (active === job) {
          terminateWorker();
          settle("OPERACAO_CANCELADA");
        } else {
          const index = queue.indexOf(job);
          if (index >= 0) queue.splice(index, 1);
          options.signal?.removeEventListener("abort", job.abort);
          reject(new Error("OPERACAO_CANCELADA"));
        }
      },
    };
    queue.push(job);
    options.signal?.addEventListener("abort", job.abort, { once: true });
    pump();
  });
}
