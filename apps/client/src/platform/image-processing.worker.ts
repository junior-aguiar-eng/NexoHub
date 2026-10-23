import { executeImageJob } from "./image-job";
import type { ImageJob } from "./image-processing";

self.onmessage = async ({ data }: MessageEvent<ImageJob>) => {
  try {
    self.postMessage({ blob: await executeImageJob(data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "FALHA_EXPORTAR_IMAGEM" });
  }
};
