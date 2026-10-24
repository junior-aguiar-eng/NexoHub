import { calculateResizeDimensions } from "./image-resize-geometry";

/**
 * NexoHub Image Engine - Motor Local de Processamento de Imagens
 * 100% no navegador (Client-Side), local-first, alta performance via Canvas e Web APIs.
 * Suporta: Compressão inteligente, Redimensionamento, Recorte, Conversão, Rotação e Marca d'água.
 */

export interface ImageMetadata {
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export type ImageCompressionLevel = "less" | "recommended" | "extreme";

export interface ImageCompressionOptions {
  readonly level?: ImageCompressionLevel;
  readonly customQuality?: number; // 0.1 a 1.0
  readonly maxDimension?: number; // Reduz dimensões se passar do limite (ex: 4096px)
}

export interface ImageCompressionResult {
  readonly blob: Blob;
  readonly originalSizeBytes: number;
  readonly resultSizeBytes: number;
  readonly savedBytes: number;
  readonly percentReduction: number;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
}

export interface ImageResizeOptions {
  readonly mode: "percentage" | "pixels";
  readonly percentage?: number; // ex: 25, 50, 75
  readonly width?: number;
  readonly height?: number;
  readonly maintainAspectRatio?: boolean;
  readonly doNotEnlarge?: boolean;
  readonly mimeType?: string;
  readonly quality?: number;
}

export interface ImageCropOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly mimeType?: string;
  readonly quality?: number;
}

export interface ImageConvertOptions {
  readonly targetFormat: "jpeg" | "png" | "webp";
  readonly quality?: number;
  readonly backgroundColor?: string; // Padrão "#ffffff" ao converter para JPEG
}

export interface ImageRotateOptions {
  readonly angle: 0 | 90 | 180 | 270;
  readonly flipHorizontal?: boolean;
  readonly flipVertical?: boolean;
  readonly mimeType?: string;
  readonly quality?: number;
}

export type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "repeat";

export interface ImageWatermarkOptions {
  readonly type: "text" | "image";
  // Opções para texto
  readonly text?: string;
  readonly fontSize?: number;
  readonly fontFamily?: string;
  readonly color?: string; // hex ou rgba
  readonly opacity?: number; // 0.1 a 1.0
  readonly position?: WatermarkPosition;
  readonly rotation?: number; // em graus, ex: -30
  // Opções para imagem
  readonly watermarkBlob?: Blob;
  readonly watermarkScale?: number; // 0.1 a 1.0
  readonly mimeType?: string;
  readonly quality?: number;
}

export const MAX_IMAGE_PIXELS = 24_000_000;
export const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
type ImageCanvas = HTMLCanvasElement | OffscreenCanvas;
function validateDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 16384 ||
    height > 16384 ||
    width * height > MAX_IMAGE_PIXELS
  )
    throw new Error("IMAGEM_MUITO_GRANDE");
}
function validateNumbers(...values: (number | undefined)[]) {
  if (values.some((value) => value !== undefined && (!Number.isFinite(value) || value < 0)))
    throw new Error("OPCOES_IMAGEM_INVALIDAS");
}
function createCanvas(width: number, height: number): ImageCanvas {
  validateDimensions(width, height);
  if (typeof document === "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
function context2d(canvas: ImageCanvas) {
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("CANVAS_NAO_DISPONIVEL");
  return ctx;
}
function detectMimeType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw new Error("FORMATO_IMAGEM_NAO_SUPORTADO");
}
async function toBlob(
  input: File | Blob | Uint8Array,
): Promise<{ blob: Blob; mimeType: string; sizeBytes: number }> {
  if (input instanceof Blob) {
    if (!input.size || input.size > MAX_IMAGE_BYTES) throw new Error("IMAGEM_MUITO_GRANDE");
    const mimeType = detectMimeType(new Uint8Array(await input.slice(0, 32).arrayBuffer()));
    return {
      blob: input.type === mimeType ? input : input.slice(0, input.size, mimeType),
      mimeType,
      sizeBytes: input.size,
    };
  }
  const mimeType = detectMimeType(input);
  return {
    blob: new Blob([input as BlobPart], { type: mimeType }),
    mimeType,
    sizeBytes: input.byteLength,
  };
}
async function validateImage(blob: Blob) {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error("IMAGEM_MUITO_GRANDE");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = detectMimeType(bytes);
  // PNG animado e WebP animado não podem ser achatados silenciosamente.
  if (mime === "image/png") {
    const view = new DataView(bytes.buffer);
    for (let pos = 8; pos + 12 <= bytes.length; ) {
      const length = view.getUint32(pos);
      const type = String.fromCharCode(...bytes.slice(pos + 4, pos + 8));
      if (type === "acTL") throw new Error("ANIMACAO_IMAGEM_NAO_SUPORTADA");
      if (type === "IHDR" && pos + 16 <= bytes.length)
        validateDimensions(view.getUint32(pos + 8), view.getUint32(pos + 12));
      pos += length + 12;
    }
  }
  if (mime === "image/webp") {
    const view = new DataView(bytes.buffer);
    for (let pos = 12; pos + 8 <= bytes.length; ) {
      const length = view.getUint32(pos + 4, true);
      const type = String.fromCharCode(...bytes.slice(pos, pos + 4));
      if (type === "ANIM" || type === "ANMF") throw new Error("ANIMACAO_IMAGEM_NAO_SUPORTADA");
      pos += 8 + length + (length % 2);
    }
  }
}
export async function loadImageElement(blob: Blob): Promise<{
  element: HTMLImageElement | ImageBitmap;
  width: number;
  height: number;
  close: () => void;
}> {
  await validateImage(blob);
  if (typeof createImageBitmap === "function") {
    // Falha de decode não deve produzir uma imagem fictícia nem disparar nova alocação.
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    try {
      validateDimensions(bitmap.width, bitmap.height);
    } catch (error) {
      bitmap.close();
      throw error;
    }
    return {
      element: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  if (typeof Image === "undefined") throw new Error("CANVAS_NAO_DISPONIVEL");
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    const timer = setTimeout(() => {
      img.src = "";
      URL.revokeObjectURL(url);
      reject(new Error("FALHA_CARREGAR_IMAGEM"));
    }, 30000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        validateDimensions(img.naturalWidth, img.naturalHeight);
        resolve({
          element: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
          close: () => URL.revokeObjectURL(url),
        });
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("FALHA_CARREGAR_IMAGEM"));
    };
    img.src = url;
  });
}
export async function canvasToBlob(
  canvas: ImageCanvas,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  validateNumbers(quality);
  if (quality !== undefined && quality > 1) throw new Error("OPCOES_IMAGEM_INVALIDAS");
  const blob =
    "convertToBlob" in canvas
      ? await canvas.convertToBlob({ type: mimeType, quality })
      : await new Promise<Blob>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("FALHA_EXPORTAR_IMAGEM")), 30000);
          try {
            canvas.toBlob(
              (value) => {
                clearTimeout(timer);
                if (value?.size) resolve(value);
                else reject(new Error("FALHA_EXPORTAR_IMAGEM"));
              },
              mimeType,
              quality,
            );
          } catch (error) {
            clearTimeout(timer);
            reject(error);
          }
        });
  if (blob.type !== mimeType) throw new Error("FORMATO_IMAGEM_NAO_SUPORTADO");
  if (!blob.size) throw new Error("FALHA_EXPORTAR_IMAGEM");
  return blob;
}
async function encodeCanvas(canvas: ImageCanvas, mime: string, quality: number): Promise<Blob> {
  // Codecs carregados apenas no worker de Imagem, fora do bundle inicial.
  if (typeof document !== "undefined") return canvasToBlob(canvas, mime, quality);
  const image = context2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
  if (mime === "image/jpeg") {
    const { default: encode } = await import("@jsquash/jpeg/encode");
    return new Blob([await encode(image, { quality: quality * 100 })], { type: mime });
  }
  if (mime === "image/webp") {
    const { default: encode } = await import("@jsquash/webp/encode");
    return new Blob([await encode(image, { quality: quality * 100 })], { type: mime });
  }
  return canvasToBlob(canvas, mime, quality);
}
/**
 * Obtém metadados reais da imagem (largura, altura, mimeType, tamanho em bytes).
 */
export async function getImageMetadata(input: File | Blob | Uint8Array): Promise<ImageMetadata> {
  const { blob, mimeType, sizeBytes } = await toBlob(input);
  const loaded = await loadImageElement(blob);
  let canvas: ImageCanvas | undefined;
  try {
    return {
      width: loaded.width,
      height: loaded.height,
      mimeType,
      sizeBytes,
    };
  } finally {
    loaded.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * 1. COMPRIMIR IMAGEM (Padrão iLoveIMG)
 * Reduz o tamanho do arquivo balanceando qualidade visual e compactação.
 */
export async function compressImage(
  input: File | Blob | Uint8Array,
  options: ImageCompressionOptions = {},
): Promise<ImageCompressionResult> {
  const { blob, mimeType, sizeBytes: originalSizeBytes } = await toBlob(input);
  const loaded = await loadImageElement(blob);
  let canvas: ImageCanvas | undefined;

  try {
    validateNumbers(options.customQuality, options.maxDimension);
    if (
      (options.customQuality !== undefined && options.customQuality > 1) ||
      options.maxDimension === 0
    )
      throw new Error("OPCOES_IMAGEM_INVALIDAS");
    const level = options.level ?? "recommended";
    let quality = options.customQuality;
    if (quality === undefined) {
      if (level === "extreme") quality = 0.5;
      else if (level === "less") quality = 0.88;
      else quality = 0.72; // recommended
    }

    // Calcula dimensões, aplicando limite de dimensão máxima se configurado
    let targetWidth = loaded.width;
    let targetHeight = loaded.height;
    const maxDim = options.maxDimension ?? Math.max(loaded.width, loaded.height);

    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
        targetHeight = maxDim;
      }
    }

    canvas = createCanvas(targetWidth, targetHeight);
    const ctx = context2d(canvas);

    const targetMime = mimeType || detectMimeType(new Uint8Array(await blob.arrayBuffer()));

    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (targetMime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.drawImage(loaded.element, 0, 0, targetWidth, targetHeight);
    }

    let compressedBlob: Blob;
    if (targetMime === "image/png" && typeof document === "undefined") {
      const { default: optimise } = await import("@jsquash/oxipng/optimise");
      compressedBlob = new Blob(
        [
          await optimise(context2d(canvas).getImageData(0, 0, targetWidth, targetHeight), {
            level: level === "extreme" ? 4 : level === "less" ? 1 : 2,
          }),
        ],
        { type: targetMime },
      );
    } else compressedBlob = await encodeCanvas(canvas, targetMime, quality);
    if (
      targetWidth === loaded.width &&
      targetHeight === loaded.height &&
      compressedBlob.size >= blob.size
    )
      compressedBlob = blob;
    const resultSizeBytes = compressedBlob.size;
    const savedBytes = Math.max(0, originalSizeBytes - resultSizeBytes);
    const percentReduction =
      originalSizeBytes > 0
        ? Math.round(((originalSizeBytes - resultSizeBytes) / originalSizeBytes) * 100)
        : 0;

    return {
      blob: compressedBlob,
      originalSizeBytes,
      resultSizeBytes,
      savedBytes,
      percentReduction,
      width: targetWidth,
      height: targetHeight,
      mimeType: compressedBlob.type || targetMime,
    };
  } finally {
    loaded.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * 2. REDIMENSIONAR IMAGEM (Padrão iLoveIMG)
 * Redimensiona por porcentagem (25%, 50%, 75%) ou dimensões exatas em pixels mantendo aspecto.
 */
export async function resizeImage(
  input: File | Blob | Uint8Array,
  options: ImageResizeOptions,
): Promise<Blob> {
  const { blob, mimeType } = await toBlob(input);
  const loaded = await loadImageElement(blob);
  let canvas: ImageCanvas | undefined;

  try {
    const { width: targetWidth, height: targetHeight } = calculateResizeDimensions(
      { width: loaded.width, height: loaded.height },
      options,
    );

    canvas = createCanvas(targetWidth, targetHeight);
    const ctx = context2d(canvas);

    const outMime =
      options.mimeType || mimeType || detectMimeType(new Uint8Array(await blob.arrayBuffer()));

    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (outMime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      if (typeof document === "undefined") {
        const { Pica } = await import("pica");
        class WorkerResizer extends Pica {
          override createCanvas(width: number, height: number) {
            return new OffscreenCanvas(width, height);
          }
        }
        await new WorkerResizer({ features: ["js", "wasm"], concurrency: 1 }).resize(
          loaded.element,
          canvas,
        );
      } else ctx.drawImage(loaded.element, 0, 0, targetWidth, targetHeight);
    }
    return await canvasToBlob(canvas, outMime, options.quality ?? 0.92);
  } finally {
    loaded.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * 3. RECORTAR IMAGEM (Padrão iLoveIMG)
 * Extrai uma região retangular precisa da imagem.
 */
export async function cropImage(
  input: File | Blob | Uint8Array,
  options: ImageCropOptions,
): Promise<Blob> {
  const { blob, mimeType } = await toBlob(input);
  const loaded = await loadImageElement(blob);
  let canvas: ImageCanvas | undefined;

  try {
    validateNumbers(options.x, options.y, options.width, options.height, options.quality);
    if (!options.width || !options.height) throw new Error("OPCOES_IMAGEM_INVALIDAS");
    const sx = Math.round(options.x);
    const sy = Math.round(options.y);
    const sw = Math.round(options.width);
    const sh = Math.round(options.height);
    if (sw < 1 || sh < 1 || sx + sw > loaded.width || sy + sh > loaded.height)
      throw new Error("RECORTE_IMAGEM_FORA_DOS_LIMITES");

    canvas = createCanvas(sw, sh);
    const ctx = context2d(canvas);

    const outMime =
      options.mimeType || mimeType || detectMimeType(new Uint8Array(await blob.arrayBuffer()));

    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (outMime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sw, sh);
      }

      ctx.drawImage(loaded.element, sx, sy, sw, sh, 0, 0, sw, sh);
    }
    return await canvasToBlob(canvas, outMime, options.quality ?? 0.95);
  } finally {
    loaded.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * 4. CONVERTER FORMATO DE IMAGEM (Padrão iLoveIMG)
 * Converte entre JPEG, PNG e WebP com controle de opacidade e qualidade.
 */
export async function convertImage(
  input: File | Blob | Uint8Array,
  options: ImageConvertOptions,
): Promise<Blob> {
  const { blob } = await toBlob(input);
  const loaded = await loadImageElement(blob);
  let canvas: ImageCanvas | undefined;

  try {
    canvas = createCanvas(loaded.width, loaded.height);
    const ctx = context2d(canvas);

    const targetFormat = options.targetFormat;
    const outMime =
      targetFormat === "png" ? "image/png" : targetFormat === "webp" ? "image/webp" : "image/jpeg";

    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (outMime === "image/jpeg") {
        // Fundo branco sólido para evitar fundo preto em transparências
        ctx.fillStyle = options.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(loaded.element, 0, 0);
    }
    return await encodeCanvas(canvas, outMime, options.quality ?? 0.92);
  } finally {
    loaded.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * 5. GIRAR IMAGEM (Padrão iLoveIMG)
 * Rotaciona em 90°, 180°, 270° e permite espelhamento horizontal/vertical.
 */
export async function rotateImage(
  input: File | Blob | Uint8Array,
  options: ImageRotateOptions,
): Promise<Blob> {
  const { blob, mimeType } = await toBlob(input);
  const loaded = await loadImageElement(blob);
  let canvas: ImageCanvas | undefined;

  try {
    if (![0, 90, 180, 270].includes(options.angle)) throw new Error("OPCOES_IMAGEM_INVALIDAS");
    const angle = options.angle;
    const isQuarterTurn = angle === 90 || angle === 270;
    const targetWidth = isQuarterTurn ? loaded.height : loaded.width;
    const targetHeight = isQuarterTurn ? loaded.width : loaded.height;

    canvas = createCanvas(targetWidth, targetHeight);
    const ctx = context2d(canvas);

    const outMime =
      options.mimeType || mimeType || detectMimeType(new Uint8Array(await blob.arrayBuffer()));

    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (outMime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.save();
      // Translada para o centro do novo canvas
      ctx.translate(targetWidth / 2, targetHeight / 2);

      // Aplica rotação em radianos
      ctx.rotate((angle * Math.PI) / 180);

      // Aplica espelhamento horizontal / vertical
      const scaleX = options.flipHorizontal ? -1 : 1;
      const scaleY = options.flipVertical ? -1 : 1;
      ctx.scale(scaleX, scaleY);

      // Desenha centrado considerando a largura/altura originais
      ctx.drawImage(
        loaded.element,
        -loaded.width / 2,
        -loaded.height / 2,
        loaded.width,
        loaded.height,
      );
      ctx.restore();
    }

    return await canvasToBlob(canvas, outMime, options.quality ?? 0.95);
  } finally {
    loaded.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * 6. MARCA D'ÁGUA EM IMAGEM (Padrão iLoveIMG)
 * Insere texto ou imagem sobreposta com rotação, opacidade e posicionamento flexível.
 */
export async function watermarkImage(
  input: File | Blob | Uint8Array,
  options: ImageWatermarkOptions,
): Promise<Blob> {
  const { blob, mimeType } = await toBlob(input);
  const loaded = await loadImageElement(blob);
  let canvas: ImageCanvas | undefined;

  try {
    validateNumbers(options.opacity, options.watermarkScale, options.fontSize);
    if (
      (options.opacity !== undefined && options.opacity > 1) ||
      (options.type === "image" && !options.watermarkBlob)
    )
      throw new Error("OPCOES_IMAGEM_INVALIDAS");
    canvas = createCanvas(loaded.width, loaded.height);
    const ctx = context2d(canvas);

    const outMime =
      options.mimeType || mimeType || detectMimeType(new Uint8Array(await blob.arrayBuffer()));

    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (outMime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Desenha imagem base
      ctx.drawImage(loaded.element, 0, 0);

      const opacity = Math.max(0, Math.min(1.0, options.opacity ?? 0.6));
      const position = options.position || "center";

      const rotation = ((options.rotation ?? 0) * Math.PI) / 180;
      if (!Number.isFinite(rotation)) throw new Error("OPCOES_IMAGEM_INVALIDAS");
      const padding = Math.min(30, Math.min(canvas.width, canvas.height) * 0.05);
      const surface = canvas;
      const drawAt = (width: number, height: number, draw: (x: number, y: number) => void) => {
        const boundW = Math.abs(width * Math.cos(rotation)) + Math.abs(height * Math.sin(rotation));
        const boundH = Math.abs(width * Math.sin(rotation)) + Math.abs(height * Math.cos(rotation));
        const scale = Math.min(
          1,
          (surface.width - 2 * padding) / boundW,
          (surface.height - 2 * padding) / boundH,
        );
        const halfW = (boundW * scale) / 2,
          halfH = (boundH * scale) / 2;
        const paint = (x: number, y: number) => {
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.translate(x, y);
          ctx.rotate(rotation);
          ctx.scale(scale, scale);
          draw(-width / 2, -height / 2);
          ctx.restore();
        };
        if (position === "repeat") {
          const stepX = Math.max(1, boundW * scale + padding * 2),
            stepY = Math.max(1, boundH * scale + padding * 2);
          // Limite de densidade evita uma marca de poucos pixels gerar milhões de desenhos.
          if (Math.ceil(surface.width / stepX) * Math.ceil(surface.height / stepY) > 10000)
            throw new Error("OPCOES_IMAGEM_INVALIDAS");
          for (let x = halfW + padding; x < surface.width; x += stepX)
            for (let y = halfH + padding; y < surface.height; y += stepY) paint(x, y);
        } else {
          const x = position.endsWith("left")
            ? padding + halfW
            : position.endsWith("right")
              ? surface.width - padding - halfW
              : surface.width / 2;
          const y = position.startsWith("top")
            ? padding + halfH
            : position.startsWith("bottom")
              ? surface.height - padding - halfH
              : surface.height / 2;
          paint(x, y);
        }
      };
      if (options.type === "text") {
        const text = options.text?.trim() || "NexoHub";
        const fontSize = options.fontSize || Math.max(20, Math.round(canvas.width * 0.05));
        ctx.font = `bold ${fontSize}px ${options.fontFamily || "sans-serif"}`;
        ctx.fillStyle = options.color || "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const width = Math.max(1, ctx.measureText(text).width);
        drawAt(width, fontSize, (x, y) => ctx.fillText(text, x, y));
      } else if (options.watermarkBlob) {
        const logo = await loadImageElement(options.watermarkBlob);
        try {
          const width = Math.max(1, canvas.width * (options.watermarkScale ?? 0.25));
          const height = (width * logo.height) / logo.width;
          drawAt(width, height, (x, y) => ctx.drawImage(logo.element, x, y, width, height));
        } finally {
          logo.close();
        }
      }
    }

    return await canvasToBlob(canvas, outMime, options.quality ?? 0.95);
  } finally {
    loaded.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
