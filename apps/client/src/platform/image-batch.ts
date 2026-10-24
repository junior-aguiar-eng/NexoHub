import type { ImageCropOptions, ImageMetadata } from "./image-engine";

export interface ImageBatchEntry {
  readonly file: File;
  readonly metadata?: ImageMetadata;
  readonly error?: string;
}

export function imageBatchExceedsLimits(files: readonly File[]) {
  return files.length > 20 || files.reduce((sum, file) => sum + file.size, 0) > 128 * 1024 * 1024;
}

/** Inspeção sequencial: cada decode libera seu bitmap antes do próximo arquivo. */
export async function inspectImageBatch(
  files: readonly File[],
  signal?: AbortSignal,
  onEntry?: (entry: ImageBatchEntry) => void,
): Promise<readonly ImageBatchEntry[]> {
  if (imageBatchExceedsLimits(files)) throw new Error("LOTE_IMAGEM_MUITO_GRANDE");
  const entries: ImageBatchEntry[] = [];
  for (const file of files) {
    if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
    let entry: ImageBatchEntry;
    try {
      const { getImageMetadata } = await import("./image-engine");
      if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
      entry = { file, metadata: await getImageMetadata(file) };
    } catch (error) {
      entry = { file, error: error instanceof Error ? error.message : "FALHA_CARREGAR_IMAGEM" };
    }
    if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
    entries.push(entry);
    onEntry?.(entry);
  }
  return entries;
}

export function cropBatchConflicts(entries: readonly ImageBatchEntry[], crop: ImageCropOptions) {
  const x = Math.round(crop.x),
    y = Math.round(crop.y);
  const width = Math.round(crop.width),
    height = Math.round(crop.height);
  return entries.flatMap((entry, index) => {
    const dimensions = entry.metadata;
    const valid =
      dimensions &&
      [x, y, width, height].every(Number.isFinite) &&
      x >= 0 &&
      y >= 0 &&
      width >= 1 &&
      height >= 1 &&
      x + width <= dimensions.width &&
      y + height <= dimensions.height;
    return valid ? [] : [{ file: entry.file, index }];
  });
}
