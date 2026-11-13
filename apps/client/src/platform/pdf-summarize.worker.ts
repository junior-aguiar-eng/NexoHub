/// <reference lib="webworker" />

import { env, pipeline, type TextGenerationPipeline } from "@huggingface/transformers";
import {
  SUMMARIZE_LIMITS,
  SUMMARIZE_MODEL,
  type SummarizeDevice,
  type SummarizeErrorCode,
  type SummarizeWorkerRequest,
  type SummarizeWorkerResponse,
} from "./pdf-summarize-protocol";
import {
  buildMapMessages,
  buildReduceMessages,
  type ChunkSummaryEntry,
  type SummarizeChatMessage,
} from "./pdf-summarizer";
import { createInactivityFetch } from "./translation-runtime";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

let cachedPipeline: TextGenerationPipeline | null = null;
let cachedDevice: SummarizeDevice | null = null;
let loadingPromise: Promise<{ generator: TextGenerationPipeline; device: SummarizeDevice }> | null =
  null;

function postResponse(message: SummarizeWorkerResponse): void {
  workerScope.postMessage(message);
}

function classifyWorkerError(error: unknown): { code: SummarizeErrorCode; message: string } {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/TRADUCAO_DOWNLOAD_TIMEOUT|SUMMARIZE_DOWNLOAD_TIMEOUT|timeout/i.test(raw)) {
    return {
      code: "SUMMARIZE_DOWNLOAD_TIMEOUT",
      message:
        "O download dos pesos do modelo local expirou por inatividade na rede (60s). Tente novamente.",
    };
  }
  if (/Failed to fetch|NetworkError|ERR_INTERNET|ENOTFOUND|404|502|503|fetch/i.test(raw)) {
    return {
      code: "SUMMARIZE_NETWORK_ERROR",
      message:
        "Não foi possível baixar os pesos do modelo local. Verifique sua conexão na primeira execução.",
    };
  }
  if (/webgpu|onnx|wasm|memory|Out of memory|abort/i.test(raw)) {
    return {
      code: "SUMMARIZE_MODEL_UNAVAILABLE",
      message: `Ambiente local indisponível para carregar o modelo: ${raw}`,
    };
  }
  return {
    code: "SUMMARIZE_RUNTIME_FAILED",
    message: raw || "Falha ao executar inferência documental local.",
  };
}

interface ProgressEventPayload {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
}

function createModelDownloadTracker(
  requestId: string,
  device: SummarizeDevice,
): (event: ProgressEventPayload) => void {
  const files = new Map<string, { loaded: number; total: number }>();
  let lastPercent = 6;

  return (event) => {
    if (event.status === "ready") {
      postResponse({
        type: "progress",
        requestId,
        progress: { phase: "initializing", progress: 42, device },
      });
      return;
    }

    if (
      event.status !== "progress" ||
      !event.file ||
      typeof event.loaded !== "number" ||
      typeof event.total !== "number" ||
      event.total <= 0
    ) {
      return;
    }

    const previous = files.get(event.file);
    files.set(event.file, {
      loaded: Math.max(previous?.loaded ?? 0, event.loaded),
      total: Math.max(previous?.total ?? 0, event.total),
    });

    const loadedBytes = [...files.values()].reduce((sum, item) => sum + item.loaded, 0);
    const totalBytes = [...files.values()].reduce((sum, item) => sum + item.total, 0);
    if (totalBytes <= 0) {
      return;
    }

    const ratio = Math.min(1, loadedBytes / totalBytes);
    const percent = Math.max(lastPercent, Math.round(6 + ratio * 34));
    lastPercent = percent;

    postResponse({
      type: "progress",
      requestId,
      progress: {
        phase: "downloading",
        progress: percent,
        loadedBytes,
        totalBytes,
        device,
      },
    });
  };
}

async function ensureGenerator(
  requestId: string,
  requestedDevice: SummarizeDevice,
  requestedDtype: "q4f16" | "q4",
): Promise<{ generator: TextGenerationPipeline; device: SummarizeDevice }> {
  if (cachedPipeline && cachedDevice === requestedDevice) {
    return { generator: cachedPipeline, device: cachedDevice };
  }
  if (cachedPipeline && cachedDevice !== requestedDevice) {
    try {
      await cachedPipeline.dispose();
    } catch {
      // Fallback silencioso
    }
    cachedPipeline = null;
    cachedDevice = null;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = createInactivityFetch(originalFetch, SUMMARIZE_LIMITS.inactivityTimeoutMs);

    try {
      const attemptLoad = async (device: SummarizeDevice, dtype: "q4f16" | "q4") => {
        postResponse({
          type: "progress",
          requestId,
          progress: { phase: "downloading", progress: 6, device },
        });
        const instance = await pipeline("text-generation", SUMMARIZE_MODEL.id, {
          revision: SUMMARIZE_MODEL.revision,
          device,
          dtype,
          progress_callback: createModelDownloadTracker(requestId, device),
        });
        return { generator: instance, device };
      };

      try {
        const loaded = await attemptLoad(requestedDevice, requestedDtype);
        cachedPipeline = loaded.generator;
        cachedDevice = loaded.device;
        return loaded;
      } catch (primaryErr) {
        if (requestedDevice === "webgpu") {
          const fallback = await attemptLoad("wasm", SUMMARIZE_MODEL.wasmDtype);
          cachedPipeline = fallback.generator;
          cachedDevice = fallback.device;
          return fallback;
        }
        throw primaryErr;
      }
    } finally {
      globalThis.fetch = originalFetch;
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

function extractChatReply(output: unknown): string {
  if (!Array.isArray(output) || output.length === 0) {
    return "";
  }
  const first = output[0] as { generated_text?: unknown };
  if (typeof first?.generated_text === "string") {
    return first.generated_text.trim();
  }
  if (Array.isArray(first?.generated_text)) {
    const messages = first.generated_text as Array<{ role?: string; content?: unknown }>;
    const last = messages.at(-1);
    if (last && typeof last.content === "string") {
      return last.content.trim();
    }
  }
  return "";
}

async function runGeneration(
  generator: TextGenerationPipeline,
  messages: SummarizeChatMessage[],
  maxNewTokens: number,
): Promise<string> {
  const output = await generator(messages, {
    max_new_tokens: maxNewTokens,
    do_sample: false,
    repetition_penalty: 1.08,
    return_full_text: false,
  });
  return extractChatReply(output);
}

async function handleSummarize(request: SummarizeWorkerRequest): Promise<void> {
  const { generator, device } = await ensureGenerator(
    request.requestId,
    request.device,
    request.dtype,
  );

  postResponse({
    type: "progress",
    requestId: request.requestId,
    progress: {
      phase: "mapping",
      progress: 45,
      currentChunk: 0,
      totalChunks: request.chunks.length,
      device,
    },
  });

  if (request.chunks.length === 1) {
    const onlyChunk = request.chunks[0];
    const summaryMarkdown = await runGeneration(
      generator,
      buildMapMessages(onlyChunk, request.mode),
      460,
    );
    postResponse({
      type: "result",
      requestId: request.requestId,
      summaryMarkdown,
      deviceUsed: device,
      modelId: SUMMARIZE_MODEL.id,
    });
    return;
  }

  const partials: ChunkSummaryEntry[] = [];
  for (let i = 0; i < request.chunks.length; i++) {
    const chunk = request.chunks[i];
    const mappedText = await runGeneration(generator, buildMapMessages(chunk, request.mode), 260);
    partials.push({
      citationLabel: chunk.citationLabel,
      startPage: chunk.startPage,
      endPage: chunk.endPage,
      summary: mappedText || `${chunk.citationLabel} Trecho processado.`,
    });

    const pct = Math.round(45 + ((i + 1) / request.chunks.length) * 35);
    postResponse({
      type: "progress",
      requestId: request.requestId,
      progress: {
        phase: "mapping",
        progress: pct,
        currentChunk: i + 1,
        totalChunks: request.chunks.length,
        device,
      },
    });
  }

  postResponse({
    type: "progress",
    requestId: request.requestId,
    progress: { phase: "reducing", progress: 85, device },
  });

  const finalSummary = await runGeneration(
    generator,
    buildReduceMessages(partials, request.mode, request.totalPages),
    560,
  );

  const fallbackMerged = partials
    .map((entry) => `- ${entry.citationLabel} ${entry.summary}`)
    .join("\n");

  postResponse({
    type: "result",
    requestId: request.requestId,
    summaryMarkdown: finalSummary || fallbackMerged,
    deviceUsed: device,
    modelId: SUMMARIZE_MODEL.id,
  });
}

workerScope.addEventListener("message", (event: MessageEvent<SummarizeWorkerRequest>) => {
  const payload = event.data;
  if (payload?.type !== "summarize") {
    return;
  }
  handleSummarize(payload).catch((error) => {
    const classified = classifyWorkerError(error);
    postResponse({
      type: "error",
      requestId: payload.requestId,
      code: classified.code,
      message: classified.message,
    });
  });
});
