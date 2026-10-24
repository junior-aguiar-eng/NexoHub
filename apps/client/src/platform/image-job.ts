import type { ImageJob } from "./image-processing";
export async function executeImageJob(job: ImageJob, signal?: AbortSignal): Promise<Blob> {
  if (job.kind === "composition") {
    const { renderImageComposition } = await import("./image-composition-engine");
    return renderImageComposition(job.blob, job.options, signal);
  }
  const engine = await import("./image-engine");
  switch (job.kind) {
    case "compress":
      return (await engine.compressImage(job.blob, job.options)).blob;
    case "resize":
      return engine.resizeImage(job.blob, job.options);
    case "crop":
      return engine.cropImage(job.blob, job.options);
    case "convert":
      return engine.convertImage(job.blob, job.options);
    case "rotate":
      return engine.rotateImage(job.blob, job.options);
    case "watermark":
      return engine.watermarkImage(job.blob, job.options);
  }
}
