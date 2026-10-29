import {
  type BrowserTranslationOptions,
  type BrowserTranslationResult,
  TRANSLATION_MODEL,
} from "./translation-protocol";
import { isPreservedChunk, segmentTextForTranslation } from "./translation-segmentation";

type PipelineFunction = (
  text: string,
  options: { src_lang: string; tgt_lang: string; max_new_tokens: number },
) => Promise<Array<{ translation_text: string }>>;
interface ModelProgress {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
}
const languageCodes = { en: "en", pt: "pt", es: "es" };
let pipelinePromise: Promise<PipelineFunction> | null = null;
export function resetRuntimeCache(): void {
  pipelinePromise = null;
}
export function translationErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/^(TRADUCAO_|OPERACAO_CANCELADA|PAR_DE_IDIOMAS_NAO_SUPORTADO)/.test(message)) return message;
  if (
    /fetch|network|download|connection|HTTP|Unauthorized|Forbidden|not found|access.+(?:file|remote)/i.test(
      message,
    )
  )
    return "TRADUCAO_REDE_INDISPONIVEL";
  return "TRADUCAO_INICIALIZACAO_FALHOU";
}
/** O prazo mede ausência de atividade; cada bloco recebido renova a janela. */
export function createInactivityFetch(fetcher: typeof fetch, inactivityMs = 60_000): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const parentSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort(parentSignal?.reason);
    if (parentSignal?.aborted) abort();
    parentSignal?.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout>;
    let timedOut = false;
    let timeoutReject: (error: Error) => void = () => {};
    const timeout = new Promise<never>((_, reject) => {
      timeoutReject = reject;
    });
    // Uma rejeição continua observada depois de os headers vencerem a corrida.
    void timeout.catch(() => {});
    let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", abort);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        const error = new Error("TRADUCAO_DOWNLOAD_TIMEOUT");
        controller.abort(error);
        timeoutReject(error);
        bodyController?.error(error);
        cleanup();
      }, inactivityMs);
    };
    arm();
    try {
      const response = await Promise.race([
        fetcher(input, { ...init, signal: controller.signal }),
        timeout,
      ]);
      if (!response.body) {
        cleanup();
        return response;
      }
      const reader = response.body.getReader();
      const body = new ReadableStream<Uint8Array>({
        start(streamController) {
          bodyController = streamController;
        },
        async pull(streamController) {
          try {
            const { done, value } = await reader.read();
            if (timedOut) return;
            if (done) {
              cleanup();
              streamController.close();
            } else {
              arm();
              streamController.enqueue(value);
            }
          } catch (error) {
            cleanup();
            if (!timedOut) streamController.error(error);
          }
        },
        async cancel(reason) {
          cleanup();
          controller.abort(reason);
          await reader.cancel(reason);
        },
      });
      const wrapped = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      Object.defineProperty(wrapped, "url", { value: response.url });
      return wrapped;
    } catch (error) {
      cleanup();
      throw timedOut ? new Error("TRADUCAO_DOWNLOAD_TIMEOUT") : error;
    }
  };
}
export function createDownloadProgress(
  onProgress?: BrowserTranslationOptions["onProgress"],
): (event: ModelProgress) => void {
  const files = new Map<string, { loaded: number; total: number }>();
  let lastProgress = 0;
  const completedWeights = new Set<string>();
  return (event) => {
    if (event.status === "done" && event.file && /\.onnx$/.test(event.file)) {
      completedWeights.add(event.file);
      if (completedWeights.size >= 2) {
        lastProgress = Math.max(lastProgress, 70);
        onProgress?.({ status: "initializing", progress: lastProgress });
      }
      return;
    }
    if (
      !event.file ||
      event.status !== "progress" ||
      typeof event.loaded !== "number" ||
      typeof event.total !== "number"
    )
      return;
    const previous = files.get(event.file);
    files.set(event.file, {
      loaded: Math.max(previous?.loaded ?? 0, event.loaded),
      total: Math.max(previous?.total ?? 0, event.total),
    });
    const loadedBytes = [...files.values()].reduce((sum, file) => sum + file.loaded, 0);
    const totalBytes = [...files.values()].reduce((sum, file) => sum + file.total, 0);
    // O perfil M2M100 q8 carrega encoder e decoder: arquivos JSON não representam os pesos.
    // Enquanto um peso ainda não informou seu tamanho, reserva-se espaço equivalente
    // ao maior peso conhecido. Os bytes exibidos continuam sendo os totais reais observados.
    const weights = [...files]
      .filter(([name]) => /\.onnx(?:_data)?$/.test(name))
      .map(([, file]) => file);
    const weightLoaded = weights.reduce((sum, file) => sum + file.loaded, 0);
    const knownTotal = weights.reduce((sum, file) => sum + file.total, 0);
    const reservedTotal =
      Math.max(0, 2 - weights.length) * Math.max(0, ...weights.map((file) => file.total));
    lastProgress = Math.max(
      lastProgress,
      Math.min(70, Math.round((weightLoaded / Math.max(1, knownTotal + reservedTotal)) * 70)),
    );
    onProgress?.({ status: "downloading", progress: lastProgress, loadedBytes, totalBytes });
  };
}
async function getPipeline(
  onProgress?: BrowserTranslationOptions["onProgress"],
): Promise<PipelineFunction> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      onProgress?.({ status: "initializing", progress: 0 });
      const { env } = await import("@huggingface/transformers");
      const { createTranslationPipeline } = await import("./translation-model");
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      env.fetch = createInactivityFetch(globalThis.fetch.bind(globalThis));
      // WASM é o dispositivo medido neste perfil. Não selecionar WebGPU por
      // mera presença de adaptador: compilação e qualidade precisam de ensaio próprio.
      const pipe = await createTranslationPipeline(TRANSLATION_MODEL.id, {
        revision: TRANSLATION_MODEL.revision,
        dtype: "q8",
        device: "wasm",
        progress_callback: createDownloadProgress(onProgress),
      });
      onProgress?.({ status: "initializing", progress: 75 });
      return pipe as unknown as PipelineFunction;
    })().catch((error: unknown) => {
      pipelinePromise = null;
      throw new Error(translationErrorCode(error));
    });
  }
  return pipelinePromise;
}
export async function performRuntimeTranslation(
  text: string,
  options: BrowserTranslationOptions,
): Promise<BrowserTranslationResult> {
  const { sourceLang, targetLang, onProgress, signal } = options;
  if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  if (!languageCodes[sourceLang] || !languageCodes[targetLang])
    throw new Error("PAR_DE_IDIOMAS_NAO_SUPORTADO");
  const result = (
    translatedText: string,
    engine: BrowserTranslationResult["engine"] = "identity",
  ): BrowserTranslationResult => ({
    translatedText,
    sourceLang,
    targetLang,
    engine,
  });
  if (sourceLang === targetLang || !text.trim()) return result(text);
  const preservedNames = options.preservedNames?.map((name) => name.trim()).filter(Boolean);
  const chunks = segmentTextForTranslation(text, 400, preservedNames);
  const totalChunks = chunks.filter((chunk) => !isPreservedChunk(chunk, preservedNames)).length;
  if (!totalChunks) return result(text);
  const translator = await getPipeline(onProgress);
  let currentChunk = 0;
  const output: string[] = [];
  onProgress?.({ status: "translating", progress: 80, currentChunk, totalChunks });
  for (const chunk of chunks) {
    if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
    if (isPreservedChunk(chunk, preservedNames)) {
      output.push(chunk);
      continue;
    }
    const translated = await translator(chunk, {
      src_lang: languageCodes[sourceLang],
      tgt_lang: languageCodes[targetLang],
      max_new_tokens: 512,
    });
    if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
    const value = translated[0]?.translation_text;
    if (typeof value !== "string" || !value.trim()) throw new Error("TRADUCAO_SEM_RESULTADO");
    output.push(value);
    currentChunk++;
    onProgress?.({
      status: "translating",
      progress: 80 + Math.round((currentChunk / totalChunks) * 19),
      currentChunk,
      totalChunks,
    });
  }
  if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  onProgress?.({ status: "ready", progress: 100 });
  return result(output.join(""), "transformers.js-m2m100");
}
