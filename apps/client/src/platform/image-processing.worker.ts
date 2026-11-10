import { executeImageJob } from "./image-job";
import type { ImageJob } from "./image-processing";

self.onmessage = async ({ data }: MessageEvent<ImageJob>) => {
  try {
    self.postMessage({ type: "progress", percent: 15, stage: "Carregando imagem" });
    const blob = await executeImageJob(data);
    self.postMessage({ type: "progress", percent: 90, stage: "Codificando imagem" });
    self.postMessage({ type: "success", blob });
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "FALHA_EXPORTAR_IMAGEM",
    });
  }
};
