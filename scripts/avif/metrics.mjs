/** PSNR de RGB composto sobre branco; não compara cores ocultas por alpha zero. */
export function comparePixels(source, result) {
  if (
    source.width !== result.width ||
    source.height !== result.height ||
    source.data.length !== result.data.length ||
    source.data.length !== source.width * source.height * 4
  )
    throw new Error("DIMENSIONS_MISMATCH");
  let error = 0,
    alphaMaxError = 0;
  for (let i = 0; i < source.data.length; i += 4) {
    alphaMaxError = Math.max(alphaMaxError, Math.abs(source.data[i + 3] - result.data[i + 3]));
    for (let c = 0; c < 3; c++) {
      const a = source.data[i + 3] / 255,
        b = result.data[i + 3] / 255;
      const difference =
        source.data[i + c] * a + 255 * (1 - a) - result.data[i + c] * b - 255 * (1 - b);
      error += difference * difference;
    }
  }
  const mse = error / (source.width * source.height * 3);
  return {
    mse,
    psnrDb: mse === 0 ? null : 10 * Math.log10(255 ** 2 / mse),
    exactComposite: mse === 0,
    alphaMaxError,
  };
}
