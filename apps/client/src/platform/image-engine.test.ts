import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canvasToBlob,
  compressImage,
  convertImage,
  cropImage,
  getImageMetadata,
  loadImageElement,
  resizeImage,
  rotateImage,
  watermarkImage,
} from "./image-engine";

// 1x1 PNG sintético válido
const testPngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("image-engine", () => {
  beforeEach(() => {
    // Mock do createImageBitmap para simular imagem de 800x600 em ambiente jsdom
    vi.stubGlobal("createImageBitmap", async () => {
      return {
        width: 800,
        height: 600,
        close: vi.fn(),
      };
    });

    // Mock seguro de Canvas 2D context e toBlob no jsdom
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      fillStyle: "#ffffff",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 100 }),
    });

    HTMLCanvasElement.prototype.toBlob = vi.fn(function (
      this: HTMLCanvasElement,
      callback: (blob: Blob | null) => void,
      type?: string,
    ) {
      // Retorna blob sintético proporcional às dimensões
      const blob = new Blob([new Uint8Array(Math.max(10, this.width * this.height * 0.05))], {
        type: type || "image/jpeg",
      });
      callback(blob);
    });
  });

  it("extrai metadados reais da imagem", async () => {
    const meta = await getImageMetadata(testPngBytes);
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
    expect(meta.sizeBytes).toBe(testPngBytes.byteLength);
  });

  it("comprime imagem calculando redução percentual e tamanho economizado", async () => {
    const res = await compressImage(testPngBytes, { level: "recommended" });
    expect(res.blob).toBeInstanceOf(Blob);
    expect(res.width).toBe(800);
    expect(res.height).toBe(600);
    expect(res.originalSizeBytes).toBe(testPngBytes.byteLength);
    expect(res.resultSizeBytes).toBeGreaterThan(0);
    expect(res.mimeType).toBe("image/png");
    expect(res.percentReduction).toBe(0);
    expect(res.resultSizeBytes).toBe(testPngBytes.byteLength);
  });

  it("redimensiona imagem por porcentagem e por pixels", async () => {
    const pctBlob = await resizeImage(testPngBytes, {
      mode: "percentage",
      percentage: 50,
    });
    expect(pctBlob).toBeInstanceOf(Blob);

    const pxBlob = await resizeImage(testPngBytes, {
      mode: "pixels",
      width: 400,
      height: 300,
      maintainAspectRatio: true,
    });
    expect(pxBlob).toBeInstanceOf(Blob);
  });

  it("recorta imagem com coordenadas e dimensões especificadas", async () => {
    const cropped = await cropImage(testPngBytes, {
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    });
    expect(cropped).toBeInstanceOf(Blob);
  });

  it("converte imagem para formatos JPEG, PNG e WebP", async () => {
    const jpeg = await convertImage(testPngBytes, { targetFormat: "jpeg" });
    expect(jpeg.type).toBe("image/jpeg");

    const png = await convertImage(testPngBytes, { targetFormat: "png" });
    expect(png.type).toBe("image/png");

    const webp = await convertImage(testPngBytes, { targetFormat: "webp" });
    expect(webp.type).toBe("image/webp");
  });

  it("gira imagem e aplica espelhamento horizontal", async () => {
    const rotated = await rotateImage(testPngBytes, {
      angle: 90,
      flipHorizontal: true,
    });
    expect(rotated).toBeInstanceOf(Blob);
  });

  it("aplica marca d'água de texto sobre a imagem", async () => {
    const watermarked = await watermarkImage(testPngBytes, {
      type: "text",
      text: "CONFIDENCIAL",
      position: "repeat",
      opacity: 0.5,
    });
    expect(watermarked).toBeInstanceOf(Blob);
  });
  it("rejeita falha real de exportação em vez de inventar bytes", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(null));
    await expect(canvasToBlob(document.createElement("canvas"), "image/png")).rejects.toThrow(
      "FALHA_EXPORTAR_IMAGEM",
    );
  });
  it("rejeita fallback para MIME diferente do solicitado", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) =>
      cb(new Blob(["png"], { type: "image/png" })),
    );
    await expect(canvasToBlob(document.createElement("canvas"), "image/webp")).rejects.toThrow(
      "FORMATO_IMAGEM_NAO_SUPORTADO",
    );
  });
  it("rejeita imagens que excedem o limite antes de criar canvas", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => ({ width: 20000, height: 20000, close }));
    await expect(loadImageElement(new Blob([testPngBytes], { type: "image/png" }))).rejects.toThrow(
      "IMAGEM_MUITO_GRANDE",
    );
    expect(close).toHaveBeenCalledOnce();
  });
  it("rejeita porcentagens inválidas sem executar redimensionamento", async () => {
    await expect(
      resizeImage(testPngBytes, { mode: "percentage", percentage: Number.NaN }),
    ).rejects.toThrow("OPCOES_IMAGEM_INVALIDAS");
  });
});
