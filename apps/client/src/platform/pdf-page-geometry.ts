import type { PDFPage } from "pdf-lib";

/** Coordenadas visuais em pontos, origem inferior esquerda, dentro da área exibida. */
export function getVisiblePageGeometry(page: PDFPage) {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const left = Math.max(media.x, crop.x);
  const bottom = Math.max(media.y, crop.y);
  const right = Math.min(media.x + media.width, crop.x + crop.width);
  const top = Math.min(media.y + media.height, crop.y + crop.height);
  const box =
    right > left && top > bottom
      ? { x: left, y: bottom, width: right - left, height: top - bottom }
      : media;
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const swapped = rotation === 90 || rotation === 270;
  const matrix: readonly [number, number, number, number, number, number] =
    rotation === 90
      ? [0, 1, -1, 0, box.x + box.width, box.y]
      : rotation === 180
        ? [-1, 0, 0, -1, box.x + box.width, box.y + box.height]
        : rotation === 270
          ? [0, -1, 1, 0, box.x, box.y + box.height]
          : [1, 0, 0, 1, box.x, box.y];
  return {
    width: swapped ? box.height : box.width,
    height: swapped ? box.width : box.height,
    rotation,
    matrix,
    toPdfPoint(x: number, y: number) {
      return {
        x: matrix[0] * x + matrix[2] * y + matrix[4],
        y: matrix[1] * x + matrix[3] * y + matrix[5],
      };
    },
  };
}
