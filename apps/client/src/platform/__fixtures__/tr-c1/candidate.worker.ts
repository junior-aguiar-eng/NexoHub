/** Somente ensaio local: nÃ£o importado pelo runtime do aplicativo. */
import { env, pipeline } from "@huggingface/transformers";
import { createTranslationPipeline } from "../../translation-model";
import { isPreservedChunk, segmentTextForTranslation } from "../../translation-segmentation";
import { segmentTextForTranslation as baselineSegment } from "./baseline-segmentation";
import { longText, translationCases } from "./corpus";

const scope = globalThis as unknown as {
  onmessage: (
    event: MessageEvent<{
      id: string;
      revision: string;
      family: "m2m100" | "opus-en" | "opus-romance";
      warm?: boolean;
      longOnly?: boolean;
      baseline?: boolean;
    }>,
  ) => void;
  postMessage: (value: unknown) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
    const begun = performance.now();
    const load =
      data.family === "m2m100"
        ? createTranslationPipeline
        : (id: string, options: Parameters<typeof createTranslationPipeline>[1]) =>
            pipeline("translation", id, options);
    const pipe = await load(data.id, {
      revision: data.revision,
      dtype: "q8",
      device: "wasm",
      progress_callback: (event) => scope.postMessage({ type: "progress", event }),
    });
    const initializationMs = performance.now() - begun;
    scope.postMessage({ type: "initialized", initializationMs });
    const languages = ["pt", "en", "es"] as const;
    for (const source of languages)
      for (const target of languages) {
        if (source === target) continue;
        if (data.family === "opus-en" && source !== "en") continue;
        if (data.family === "opus-romance" && target !== "en") continue;
        if (data.warm && `${source}-${target}` !== (data.family === "opus-en" ? "en-pt" : "pt-en"))
          continue;
        const texts = translationCases.map((item) => ({
          ...item,
          text: item[source],
          kind: "short",
        }));
        const samples = [
          ...texts,
          {
            id: "longo",
            text: `${longText[source]}\n\n${longText[source]}`,
            kind: "long",
            names: ["Maria Silva"],
            numbers: ["12", "125", "5", "20", "2026", "30"],
            negation: true,
          },
        ];
        for (const sample of data.longOnly
          ? samples.slice(-1)
          : data.warm
            ? samples.slice(0, 1)
            : samples) {
          const start = performance.now();
          const chunks = (data.baseline ? baselineSegment : segmentTextForTranslation)(sample.text);
          const translated = [];
          for (const chunk of chunks) {
            if (isPreservedChunk(chunk)) {
              translated.push(chunk);
              continue;
            }
            const text = data.family === "opus-en" ? `>>${target}<< ${chunk}` : chunk;
            const output = await pipe(text, {
              src_lang: source,
              tgt_lang: target,
              max_new_tokens: 512,
              do_sample: false,
            });
            translated.push(output[0].translation_text);
          }
          scope.postMessage({
            type: "sample",
            sample: {
              id: sample.id,
              kind: sample.kind,
              source,
              target,
              input: sample.text,
              output: translated.join(""),
              ms: performance.now() - start,
              names: sample.names,
              numbers: sample.numbers,
              negation: sample.negation,
              chunks: chunks.length,
            },
          });
        }
      }
    await pipe.dispose();
    scope.postMessage({ type: "done" });
  } catch (error) {
    scope.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
