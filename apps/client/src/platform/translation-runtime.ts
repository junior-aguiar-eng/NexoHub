import { createInactivityFetch } from "./inactivity-fetch";
import {
  type BrowserTranslationOptions,
  type BrowserTranslationResult,
  TRANSLATION_MODEL,
} from "./translation-protocol";
import { isPreservedChunk, segmentTextForTranslation } from "./translation-segmentation";

export { createInactivityFetch };

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
      const { createTranslationPipeline, env } = await import("./translation-model");
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
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
