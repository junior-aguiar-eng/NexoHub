import type { ImageResizeOptions } from "./image-engine";

/** Geometria única para a previsão por item e para os pixels exportados. */
export function calculateResizeDimensions(
  original: { width: number; height: number },
  options: ImageResizeOptions,
): { width: number; height: number } {
  let targetWidth = original.width;
  let targetHeight = original.height;

  if (
    [options.percentage, options.width, options.height, options.quality].some(
      (value) => value !== undefined && (!Number.isFinite(value) || value < 0),
    )
  )
    throw new Error("OPCOES_IMAGEM_INVALIDAS");
  if (options.percentage === 0 || options.width === 0 || options.height === 0)
    throw new Error("OPCOES_IMAGEM_INVALIDAS");
  if (options.mode === "percentage") {
    const pct = (options.percentage ?? 50) / 100;
    targetWidth = Math.max(1, Math.round(original.width * pct));
    targetHeight = Math.max(1, Math.round(original.height * pct));
  } else {
    const reqW = options.width;
    const reqH = options.height;
    const maintainAspect = options.maintainAspectRatio ?? true;
    const doNotEnlarge = options.doNotEnlarge ?? false;

    if (reqW && reqH) {
      if (maintainAspect) {
        const ratio = original.width / original.height;
        const targetRatio = reqW / reqH;
        if (targetRatio > ratio) {
          targetHeight = reqH;
          targetWidth = Math.round(reqH * ratio);
        } else {
          targetWidth = reqW;
          targetHeight = Math.round(reqW / ratio);
        }
      } else {
        targetWidth = reqW;
        targetHeight = reqH;
      }
    } else if (reqW) {
      targetWidth = reqW;
      targetHeight = Math.round((reqW * original.height) / original.width);
    } else if (reqH) {
      targetHeight = reqH;
      targetWidth = Math.round((reqH * original.width) / original.height);
    }

    if (doNotEnlarge) {
      if (targetWidth > original.width) targetWidth = original.width;
      if (targetHeight > original.height) targetHeight = original.height;
    }
  }

  if (options.doNotEnlarge && (targetWidth > original.width || targetHeight > original.height)) {
    const ratio = Math.min(original.width / targetWidth, original.height / targetHeight, 1);
    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
  }
  targetWidth = Math.max(1, Math.round(targetWidth));
  targetHeight = Math.max(1, Math.round(targetHeight));
  return { width: targetWidth, height: targetHeight };
}
