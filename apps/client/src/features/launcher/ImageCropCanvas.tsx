import type Cropper from "cropperjs";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { translate } from "@/i18n";

export interface CropRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Props {
  source: string;
  fileName: string;
  width: number;
  height: number;
  crop: CropRectangle;
  aspectRatio?: number;
  onChange: (rectangle: CropRectangle) => void;
}
const directions = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
const handleLabels = {
  nw: "imageCrop.handleNW",
  n: "imageCrop.handleN",
  ne: "imageCrop.handleNE",
  e: "imageCrop.handleE",
  se: "imageCrop.handleSE",
  s: "imageCrop.handleS",
  sw: "imageCrop.handleSW",
  w: "imageCrop.handleW",
} as const;
const template = `<cropper-canvas background style="width:100%;height:100%;overflow:visible">
  <div style="position:absolute;inset:0;overflow:hidden"><cropper-image></cropper-image></div>
  <cropper-shade></cropper-shade><cropper-selection movable resizable precise min-inset="0">
  <cropper-grid bordered covered aria-hidden="true"></cropper-grid>
  <cropper-handle action="move" plain></cropper-handle>
  ${directions.map((direction) => `<cropper-handle action="${direction}-resize"></cropper-handle>`).join("")}
  </cropper-selection></cropper-canvas>`;

function normalize(rectangle: CropRectangle, width: number, height: number): CropRectangle {
  const w = Math.min(width, Math.max(1, Math.round(rectangle.width)));
  const h = Math.min(height, Math.max(1, Math.round(rectangle.height)));
  return {
    x: Math.max(0, Math.min(width - w, Math.round(rectangle.x))),
    y: Math.max(0, Math.min(height - h, Math.round(rectangle.y))),
    width: w,
    height: h,
  };
}

export function ImageCropCanvas(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const host = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLElement>(null);
  const controller = useRef<{ sync: () => void; instance: Cropper } | undefined>(undefined);
  const [zoom, setZoom] = useState(100),
    [pan, setPan] = useState(false);
  const view = useRef({ zoom, pan });
  view.current = { zoom, pan };
  const [readySource, setReadySource] = useState<string>();
  const [errorSource, setErrorSource] = useState<string>();
  const zoomId = useId();
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const { source, width, height } = props;

  useEffect(() => {
    let stopped = false,
      frame = 0;
    let instance: Cropper | undefined;
    let removeChange: (() => void) | undefined;
    const container = host.current,
      area = viewport.current;
    if (!container || !area) return;
    setZoom(100);
    setPan(false);
    view.current = { zoom: 100, pan: false };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => controller.current?.sync());
    };
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    observer?.observe(area);
    window.addEventListener("resize", schedule);
    void (async () => {
      try {
        const { default: CropperClass } = await import("cropperjs");
        if (stopped) return;
        const image = new Image();
        image.src = source;
        image.alt = latest.current.fileName;
        instance = new CropperClass(image, { container, template });
        const cropperImage = instance.getCropperImage(),
          selection = instance.getCropperSelection();
        const canvas = instance.getCropperCanvas();
        if (!cropperImage || !selection || !canvas) throw new Error("RECORTE_VISUAL_INDISPONIVEL");
        await cropperImage.$ready();
        if (stopped) return;
        let syncing = false,
          projectedScale = 0;
        let gestureEcho:
          | { crop: CropRectangle; scale: number; ratio: number | undefined }
          | undefined;
        const sync = () => {
          if (stopped) return;
          const state = latest.current,
            mode = view.current;
          const scale = Math.min(Math.max(1, area.clientWidth - 48) / width, 560 / height);
          const displayScale = (scale * mode.zoom) / 100;
          projectedScale = displayScale;
          area.style.height = `${height * scale + 48}px`;
          container.style.width = `${width * displayScale}px`;
          container.style.height = `${height * displayScale}px`;
          // O motor exige estas permissões até para transformações programáticas.
          // Habilitar apenas durante a projeção impede que gestos movam a imagem original.
          cropperImage.scalable = true;
          cropperImage.translatable = true;
          try {
            cropperImage.$center("contain");
          } finally {
            cropperImage.scalable = false;
            cropperImage.translatable = false;
          }
          const valid =
            state.crop.x >= 0 &&
            state.crop.y >= 0 &&
            state.crop.width >= 1 &&
            state.crop.height >= 1 &&
            state.crop.x + state.crop.width <= width &&
            state.crop.y + state.crop.height <= height;
          syncing = true;
          selection.aspectRatio = state.aspectRatio ?? NaN;
          selection.hidden = !valid;
          // Não devolver os pixels arredondados ao motor a cada evento do mesmo gesto:
          // isso acumularia erro fracionário. Mudanças externas e de escala reprojetam.
          const isGestureEcho =
            gestureEcho?.scale === displayScale &&
            gestureEcho.ratio === state.aspectRatio &&
            (["x", "y", "width", "height"] as const).every(
              (key) => gestureEcho?.crop[key] === state.crop[key],
            );
          if (!isGestureEcho) gestureEcho = undefined;
          if (valid && !isGestureEcho)
            selection.$change(
              state.crop.x * displayScale,
              state.crop.y * displayScale,
              state.crop.width * displayScale,
              state.crop.height * displayScale,
              NaN,
              true,
            );
          syncing = false;
          for (const handle of selection.querySelectorAll<HTMLElement>("cropper-handle")) {
            const action = handle.getAttribute("action") ?? "move";
            const direction = action.replace("-resize", "") as (typeof directions)[number];
            handle.setAttribute("role", "button");
            handle.setAttribute(
              "aria-label",
              action === "move"
                ? translate("imageCrop.moveRegion")
                : translate(handleLabels[direction]),
            );
            handle.tabIndex = mode.pan || !valid ? -1 : 0;
            handle.setAttribute("aria-disabled", String(mode.pan || !valid));
          }
          selection.style.pointerEvents = mode.pan ? "none" : "";
        };
        const change = (event: Event) => {
          if (syncing || stopped) return;
          const detail = (event as CustomEvent<CropRectangle>).detail;
          const bounds = canvas.getBoundingClientRect();
          if (
            !bounds.width ||
            !bounds.height ||
            !detail ||
            !Object.values(detail).every(Number.isFinite)
          ) {
            event.preventDefault();
            return;
          }
          if (
            detail.x < 0 ||
            detail.y < 0 ||
            detail.width <= 0 ||
            detail.height <= 0 ||
            detail.x + detail.width > bounds.width + 0.01 ||
            detail.y + detail.height > bounds.height + 0.01
          ) {
            event.preventDefault();
            return;
          }
          const next = normalize(
            {
              x: (detail.x * width) / bounds.width,
              y: (detail.y * height) / bounds.height,
              width: (detail.width * width) / bounds.width,
              height: (detail.height * height) / bounds.height,
            },
            width,
            height,
          );
          gestureEcho = {
            crop: next,
            scale: projectedScale,
            ratio: latest.current.aspectRatio,
          };
          latest.current.onChange(next);
        };
        selection.addEventListener("change", change);
        removeChange = () => selection.removeEventListener("change", change);
        controller.current = { instance, sync };
        sync();
        setReadySource(source);
        setErrorSource(undefined);
      } catch {
        if (!stopped) {
          instance?.destroy();
          setErrorSource(source);
        }
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      removeChange?.();
      controller.current = undefined;
      instance?.destroy();
    };
  }, [source, width, height]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: as dependências invalidam a projeção imperativa que lê os valores atuais por ref.
  useEffect(() => {
    controller.current?.sync();
  }, [zoom, pan, props.crop, props.aspectRatio]);

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (pan && target === viewport.current) {
      event.preventDefault();
      viewport.current.scrollBy({
        left: event.key === "ArrowRight" ? 44 : event.key === "ArrowLeft" ? -44 : 0,
        top: event.key === "ArrowDown" ? 44 : event.key === "ArrowUp" ? -44 : 0,
      });
      return;
    }
    const action = target.closest("cropper-handle")?.getAttribute("action");
    if (!action || pan) return;
    event.preventDefault();
    const state = latest.current,
      current = state.crop,
      step = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const dy = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    if (action === "move") {
      state.onChange(
        normalize({ ...current, x: current.x + dx, y: current.y + dy }, width, height),
      );
      return;
    }
    const direction = action.replace("-resize", ""),
      west = direction.includes("w"),
      north = direction.includes("n");
    const horizontal = west || direction.includes("e"),
      vertical = north || direction.includes("s");
    if ((!horizontal && dx) || (!vertical && dy)) return;
    let w = current.width + (west ? -dx : dx),
      h = current.height + (north ? -dy : dy);
    const right = current.x + current.width,
      bottom = current.y + current.height;
    const centerX = current.x + current.width / 2,
      centerY = current.y + current.height / 2;
    const maxW = horizontal
      ? west
        ? right
        : width - current.x
      : 2 * Math.min(centerX, width - centerX);
    const maxH = vertical
      ? north
        ? bottom
        : height - current.y
      : 2 * Math.min(centerY, height - centerY);
    if (state.aspectRatio) {
      if (dx) {
        w = Math.max(1, Math.min(w, maxW, maxH * state.aspectRatio));
        h = w / state.aspectRatio;
      } else {
        h = Math.max(1, Math.min(h, maxH, maxW / state.aspectRatio));
        w = h * state.aspectRatio;
      }
    } else {
      w = Math.max(1, Math.min(w, maxW));
      h = Math.max(1, Math.min(h, maxH));
    }
    state.onChange(
      normalize(
        {
          x: west ? right - w : horizontal ? current.x : centerX - w / 2,
          y: north ? bottom - h : vertical ? current.y : centerY - h / 2,
          width: w,
          height: h,
        },
        width,
        height,
      ),
    );
  }

  const ready = readySource === source && errorSource !== source;
  return (
    <div className="image-crop-editor" data-ready={ready}>
      <div className="image-crop-toolbar">
        <label htmlFor={zoomId}>
          {translate("imageCrop.zoom")} <strong>{zoom}%</strong>
        </label>
        <input
          id={zoomId}
          aria-label={translate("imageCrop.zoom")}
          type="range"
          min="100"
          max="300"
          step="25"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          disabled={!ready}
        />
        <button
          type="button"
          onClick={() => {
            setZoom(100);
            setPan(false);
            viewport.current?.scrollTo(0, 0);
          }}
          disabled={!ready}
        >
          {translate("imageCrop.fitView")}
        </button>
        <button type="button" aria-pressed={pan} onClick={() => setPan(!pan)} disabled={!ready}>
          {translate("imageCrop.panView")}
        </button>
      </div>
      <section
        ref={viewport}
        className="image-crop-viewport"
        aria-label={translate("imageCrop.viewport")}
        tabIndex={pan ? 0 : -1}
        data-pan={pan}
        onKeyDown={keyboard}
        onWheelCapture={(event) => event.stopPropagation()}
        onPointerDownCapture={(event) => {
          if (!pan) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          panStart.current = {
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          };
        }}
        onPointerMove={(event) => {
          const start = panStart.current;
          if (start) {
            event.currentTarget.scrollLeft = start.left - event.clientX + start.x;
            event.currentTarget.scrollTop = start.top - event.clientY + start.y;
          }
        }}
        onPointerUp={() => {
          panStart.current = null;
        }}
        onPointerCancel={() => {
          panStart.current = null;
        }}
      >
        <div ref={host} className="image-crop-canvas" />
      </section>
      {errorSource === source && (
        <>
          <img src={source} alt={props.fileName} />
          <p role="alert">{translate("imageCrop.editorError")}</p>
        </>
      )}
      {!ready && errorSource !== source && (
        <p role="status">{translate("imageCrop.editorLoading")}</p>
      )}
      <p className="image-crop-hint">{translate("imageCrop.gestureHint")}</p>
    </div>
  );
}
