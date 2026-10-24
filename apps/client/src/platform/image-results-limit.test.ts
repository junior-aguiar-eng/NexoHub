import { afterEach, expect, it, vi } from "vitest";
import * as engine from "./image-engine";

afterEach(() => vi.unstubAllGlobals());
it("inspeciona saída gerada acima de 64 MiB sem ampliar o limite dos arquivos importados", async () => {
  const bytes = new Uint8Array(65 * 1024 * 1024);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, 1);
  view.setUint32(20, 1);
  view.setUint32(33, bytes.length - 45);
  bytes.set([116, 69, 88, 116], 37);
  const blob = new Blob([bytes], { type: "image/png" });
  let closed = 0;
  // jsdom não possui decoder; só essa fronteira é substituída, os limites e o parser são reais.
  vi.stubGlobal("createImageBitmap", async () => ({ width: 1, height: 1, close: () => closed++ }));
  await expect(engine.getImageMetadata(blob)).rejects.toThrow("IMAGEM_MUITO_GRANDE");
  const result = await engine.getGeneratedImageMetadata(blob);
  expect(result).toEqual({
    width: 1,
    height: 1,
    sizeBytes: 65 * 1024 * 1024,
    mimeType: "image/png",
  });
  expect(closed).toBe(1);
});
