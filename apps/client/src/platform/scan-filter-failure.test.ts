import { afterEach, expect, it, vi } from "vitest";
import { applyScanFilter } from "./scan-to-pdf-engine";

afterEach(() => vi.unstubAllGlobals());

it("recusa filtro solicitado quando o decodificador falha, sem devolver o original", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decoder")));
  await expect(applyScanFilter(new Uint8Array([1, 2]), "bw", "image/png")).rejects.toThrow(
    "SCAN_FILTER_FAILED",
  );
});

it("libera bitmap e recusa filtro se Canvas não estiver disponível", async () => {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 2, height: 2, close }));
  const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  try {
    await expect(applyScanFilter(new Uint8Array([1, 2]), "grayscale", "image/png")).rejects.toThrow(
      "SCAN_FILTER_FAILED",
    );
    expect(close).toHaveBeenCalledOnce();
  } finally {
    context.mockRestore();
  }
});
