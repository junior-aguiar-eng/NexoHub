import type { ImageMetadata } from "./image-engine";
export interface ImageResultItem {
  readonly sourceName: string;
  readonly outputName: string;
  readonly before: ImageMetadata;
  readonly after: ImageMetadata;
}
export function summarizeImageResults(items: readonly ImageResultItem[]) {
  const beforeBytes = items.reduce((n, item) => n + item.before.sizeBytes, 0);
  const afterBytes = items.reduce((n, item) => n + item.after.sizeBytes, 0);
  const savedBytes = beforeBytes - afterBytes;
  return {
    beforeBytes,
    afterBytes,
    savedBytes,
    percent: beforeBytes ? Math.round((savedBytes / beforeBytes) * 1000) / 10 : 0,
  };
}
/** Inspeção sequencial e descartável; dimensões vêm do arquivo codificado, não das opções. */
export async function inspectImageResult(
  source: File,
  output: Blob,
  outputName: string,
  signal?: AbortSignal,
): Promise<ImageResultItem> {
  const check = () => {
    if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  };
  check();
  const { getImageMetadata, getGeneratedImageMetadata } = await import("./image-engine");
  check();
  const before = await getImageMetadata(source);
  check();
  const after = await getGeneratedImageMetadata(output);
  check();
  return { sourceName: source.name, outputName, before, after };
}
