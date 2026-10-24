import type { Canvas, FabricObject } from "fabric";
import { useEffect, useRef, useState } from "react";
import { translate } from "@/i18n";
import type { ImageCompositionObject } from "@/platform/image-composition-types";

interface Props {
  width: number;
  height: number;
  objects: readonly ImageCompositionObject[];
  selected?: string;
  disabled: boolean;
  onSelect: (id: string | undefined) => void;
  onChange: (object: ImageCompositionObject) => void;
}
/** O Fabric controla apenas a geometria; os pixels publicados vêm do renderizador compartilhado. */
export function ImageCompositionCanvas(props: Props) {
  const root = useRef<HTMLDivElement>(null),
    element = useRef<HTMLCanvasElement>(null),
    latest = useRef(props);
  latest.current = props;
  const adapter = useRef<{ sync: () => void } | undefined>(undefined);
  const [error, setError] = useState(false);
  const { width, height } = props;
  useEffect(() => {
    let stopped = false,
      canvas: Canvas | undefined,
      observer: ResizeObserver | undefined;
    void (async () => {
      try {
        const { Canvas, Rect, controlsUtils } = await import("fabric");
        if (stopped || !root.current || !element.current) return;
        canvas = new Canvas(element.current, {
          enableRetinaScaling: false,
          selection: false,
          renderOnAddRemove: false,
        });
        let syncing = false;
        let rendered: readonly ImageCompositionObject[] | undefined;
        let renderedDisabled: boolean | undefined;
        const ids = new WeakMap<FabricObject, string>();
        const sync = () => {
          if (stopped || !canvas || !root.current) return;
          syncing = true;
          const state = latest.current,
            scale = root.current.clientWidth / width;
          canvas.setDimensions({ width: width * scale, height: height * scale });
          canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
          if (rendered !== state.objects || renderedDisabled !== state.disabled) {
            canvas.remove(...canvas.getObjects());
            for (const o of state.objects) {
              const box = new Rect({
                left: o.x,
                top: o.y,
                width: o.width,
                height: o.height,
                fill: "transparent",
                strokeWidth: 0,
                originX: "left",
                originY: "top",
                lockRotation: true,
                lockScalingFlip: true,
                cornerSize: 44,
                touchCornerSize: 44,
                transparentCorners: false,
                cornerColor: "#2563eb",
                borderColor: "#2563eb",
                selectable: !state.disabled,
                evented: !state.disabled,
              });
              box.controls = controlsUtils.createObjectDefaultControls();
              for (const control of Object.values(box.controls)) {
                control.render = (ctx, left, top) => {
                  ctx.save();
                  ctx.fillStyle = "#2563eb";
                  ctx.strokeStyle = "#ffffff";
                  ctx.lineWidth = 2;
                  ctx.fillRect(left - 5, top - 5, 10, 10);
                  ctx.strokeRect(left - 5, top - 5, 10, 10);
                  ctx.restore();
                };
              }
              box.setControlsVisibility({ mtr: false });
              ids.set(box, o.id);
              canvas.add(box);
            }
            rendered = state.objects;
            renderedDisabled = state.disabled;
          }
          const active = canvas.getObjects().find((box) => ids.get(box) === state.selected);
          if (active && canvas.getActiveObject() !== active) canvas.setActiveObject(active);
          else if (!active) canvas.discardActiveObject();
          canvas.renderAll();
          syncing = false;
        };
        canvas.on("selection:created", () => {
          if (!syncing) latest.current.onSelect(ids.get(canvas?.getActiveObject() as FabricObject));
        });
        canvas.on("selection:updated", () => {
          if (!syncing) latest.current.onSelect(ids.get(canvas?.getActiveObject() as FabricObject));
        });
        canvas.on("selection:cleared", () => {
          if (!syncing) latest.current.onSelect(undefined);
        });
        canvas.on("object:modified", ({ target }) => {
          if (!target || latest.current.disabled) return;
          const original = latest.current.objects.find((o) => o.id === ids.get(target));
          if (!original) return;
          const w = Math.max(1, Math.min(width, Math.round(target.getScaledWidth()))),
            h = Math.max(1, Math.min(height, Math.round(target.getScaledHeight())));
          latest.current.onChange({
            ...original,
            width: w,
            height: h,
            x: Math.max(0, Math.min(width - w, Math.round(target.left))),
            y: Math.max(0, Math.min(height - h, Math.round(target.top))),
          });
        });
        adapter.current = { sync };
        observer = new ResizeObserver(sync);
        observer.observe(root.current);
        sync();
      } catch {
        if (!stopped) setError(true);
      }
    })();
    return () => {
      stopped = true;
      adapter.current = undefined;
      observer?.disconnect();
      void canvas?.dispose();
    };
  }, [width, height]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: projeção imperativa lê as props atuais via ref.
  useEffect(() => {
    adapter.current?.sync();
  }, [props.objects, props.selected, props.disabled]);
  return (
    <div ref={root} className="image-composition-interaction" aria-hidden="true">
      <canvas ref={element} />
      {error && (
        <span className="image-composition-canvas-error">
          {translate("composition.canvasError")}
        </span>
      )}
    </div>
  );
}
