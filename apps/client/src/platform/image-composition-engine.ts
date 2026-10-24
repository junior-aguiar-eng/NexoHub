import fontUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { validateComposition } from "./image-composition-state";
import type { ImageCompositionSnapshot } from "./image-composition-types";
import { canvasToBlob, loadImageElement } from "./image-engine";

let fontReady: Promise<void> | undefined;
function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
}
async function loadFont() {
  if (!fontReady)
    fontReady = (async () => {
      const font = await new FontFace("NexoComposition", `url("${fontUrl}")`, {
        weight: "400",
      }).load();
      const fonts =
        typeof document !== "undefined"
          ? document.fonts
          : (globalThis as unknown as { fonts: FontFaceSet }).fonts;
      fonts.add(font);
    })().catch((error) => {
      fontReady = undefined;
      throw error;
    });
  await fontReady;
}
/** Mesmo renderizador para prévia e exportação, sem dados persistidos nem imagens externas. */
export async function renderImageComposition(
  source: Blob,
  snapshot: ImageCompositionSnapshot,
  signal?: AbortSignal,
): Promise<Blob> {
  check(signal);
  const image = await loadImageElement(source);
  let canvas: HTMLCanvasElement | OffscreenCanvas | undefined;
  try {
    check(signal);
    validateComposition(snapshot, image.width, image.height);
    if (snapshot.objects.some((o) => o.kind === "text")) await loadFont();
    check(signal);
    canvas =
      typeof document === "undefined"
        ? new OffscreenCanvas(image.width, image.height)
        : document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error("CANVAS_NAO_DISPONIVEL");
    ctx.drawImage(image.element, 0, 0);
    for (const o of snapshot.objects) {
      check(signal);
      ctx.save();
      try {
        ctx.globalAlpha = o.opacity;
        ctx.translate(o.x, o.y);
        if (o.kind === "image") {
          const asset = await loadImageElement(o.blob);
          try {
            check(signal);
            ctx.drawImage(asset.element, 0, 0, o.width, o.height);
          } finally {
            asset.close();
          }
        } else {
          ctx.fillStyle = o.color;
          if (o.kind === "rectangle") ctx.fillRect(0, 0, o.width, o.height);
          else if (o.kind === "ellipse") {
            ctx.beginPath();
            ctx.ellipse(o.width / 2, o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.font = '400 100px "NexoComposition"';
            ctx.textBaseline = "alphabetic";
            const m = ctx.measureText(o.text);
            const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
              h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
            if (w <= 0 || h <= 0) throw new Error("COMPOSICAO_INVALIDA");
            ctx.scale(o.width / w, o.height / h);
            ctx.fillText(o.text, m.actualBoundingBoxLeft, m.actualBoundingBoxAscent);
          }
        }
      } finally {
        ctx.restore();
      }
    }
    check(signal);
    const result = await canvasToBlob(canvas, "image/png");
    check(signal);
    return result;
  } finally {
    image.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
