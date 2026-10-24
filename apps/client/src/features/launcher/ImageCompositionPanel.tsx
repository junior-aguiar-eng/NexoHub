import { useEffect, useRef, useState } from "react";
import { translate } from "@/i18n";
import type { ImageCompositionState } from "@/platform/image-composition-state";
import { validateComposition } from "@/platform/image-composition-state";
import type { CompositionAction, ImageCompositionObject } from "@/platform/image-composition-types";
import { ImageCompositionCanvas } from "./ImageCompositionCanvas";
import { useCompositionPreview } from "./useCompositionPreview";

interface Props {
  file: File;
  source: string;
  width: number;
  height: number;
  state: ImageCompositionState;
  dispatch: (action: CompositionAction) => void;
  disabled: boolean;
  onAssetPendingChange: (pending: boolean) => void;
}
const kindKeys = {
  text: "composition.text",
  rectangle: "composition.rectangle",
  ellipse: "composition.ellipse",
  image: "composition.image",
} as const;
export function ImageCompositionPanel({
  file,
  source,
  width,
  height,
  state,
  dispatch,
  disabled,
  onAssetPendingChange,
}: Props) {
  const [selected, setSelected] = useState<string>();
  const [assetError, setAssetError] = useState(false),
    [assetPending, setAssetPending] = useState(false);
  const ticket = useRef(0);
  const currentState = useRef(state);
  currentState.current = state;
  // biome-ignore lint/correctness/useExhaustiveDependencies: trocar o arquivo invalida a importação assíncrona do asset.
  useEffect(() => {
    setAssetPending(false);
    onAssetPendingChange(false);
    setAssetError(false);
    return () => {
      ticket.current++;
      onAssetPendingChange(false);
    };
  }, [file, onAssetPendingChange]);
  const preview = useCompositionPreview(file, state, disabled);
  const object = state.objects.find((o) => o.id === selected);
  let valid = true;
  try {
    validateComposition(state, width, height);
  } catch {
    valid = false;
  }
  function add(kind: "text" | "rectangle" | "ellipse") {
    const id = crypto.randomUUID(),
      geometry = {
        id,
        x: 0,
        y: 0,
        width: Math.min(width, 200),
        height: Math.min(height, kind === "text" ? 40 : 100),
        opacity: 1,
      };
    const object: ImageCompositionObject =
      kind === "text"
        ? { ...geometry, kind, text: translate("composition.defaultText"), color: "#111827" }
        : { ...geometry, kind, color: "#2563eb" };
    dispatch({ type: "add", object });
    setSelected(id);
  }
  async function addImage(input: HTMLInputElement) {
    const asset = input.files?.[0];
    input.value = "";
    if (!asset) return;
    const current = ++ticket.current;
    setAssetError(false);
    setAssetPending(true);
    onAssetPendingChange(true);
    try {
      if (asset.size > 16 * 1024 * 1024) throw Error("COMPOSICAO_LIMITE");
      const { getImageMetadata } = await import("@/platform/image-engine");
      const metadata = await getImageMetadata(asset);
      if (ticket.current !== current) return;
      const scale = Math.min(
        1,
        width / metadata.width,
        height / metadata.height,
        200 / metadata.width,
      );
      const object: ImageCompositionObject = {
        id: crypto.randomUUID(),
        kind: "image",
        blob: asset,
        x: 0,
        y: 0,
        width: Math.max(1, Math.round(metadata.width * scale)),
        height: Math.max(1, Math.round(metadata.height * scale)),
        opacity: 1,
      };
      validateComposition({ objects: [...currentState.current.objects, object] }, width, height);
      dispatch({ type: "add", object });
      setSelected(object.id);
    } catch {
      if (ticket.current === current) setAssetError(true);
    } finally {
      if (ticket.current === current) {
        setAssetPending(false);
        onAssetPendingChange(false);
      }
    }
  }
  function geometry(key: "x" | "y" | "width" | "height", value: string) {
    if (!object) return;
    const next = { ...object, [key]: Math.round(Number(value)) };
    next.width = Math.max(1, Math.min(width, next.width));
    next.height = Math.max(1, Math.min(height, next.height));
    next.x = Math.max(0, Math.min(width - next.width, next.x));
    next.y = Math.max(0, Math.min(height - next.height, next.y));
    dispatch({ type: "replace", object: next });
  }
  return (
    <section
      className="image-composition-panel"
      aria-label={translate("composition.advanced")}
      data-ready={preview.ready && valid ? "true" : "false"}
    >
      <p className="image-composition-notice">{translate("composition.hint")}</p>
      <div className="image-composition-toolbar">
        <button
          type="button"
          disabled={disabled || state.objects.length >= 20}
          onClick={() => add("text")}
        >
          {translate("composition.addText")}
        </button>
        <button
          type="button"
          disabled={disabled || state.objects.length >= 20}
          onClick={() => add("rectangle")}
        >
          {translate("composition.addRectangle")}
        </button>
        <button
          type="button"
          disabled={disabled || state.objects.length >= 20}
          onClick={() => add("ellipse")}
        >
          {translate("composition.addEllipse")}
        </button>
        <label htmlFor="composition-image">{translate("composition.addImage")}</label>
        <input
          className="visually-hidden"
          id="composition-image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || assetPending || state.objects.length >= 20}
          onChange={(e) => void addImage(e.currentTarget)}
        />
        <button
          type="button"
          disabled={disabled || !state.past.length}
          onClick={() => dispatch({ type: "undo" })}
        >
          {translate("composition.undo")}
        </button>
        <button
          type="button"
          disabled={disabled || !state.future.length}
          onClick={() => dispatch({ type: "redo" })}
        >
          {translate("composition.redo")}
        </button>
      </div>
      {assetPending && <p role="status">{translate("composition.assetPending")}</p>}
      {assetError && <p role="alert">{translate("composition.assetError")}</p>}
      {!valid && <p role="alert">{translate("composition.invalid")}</p>}
      <div className="image-composition-workspace">
        <div className="image-composition-view">
          <div
            className="image-composition-stage"
            style={{ aspectRatio: `${width}/${height}`, maxWidth: `${(width / height) * 680}px` }}
          >
            <img
              src={preview.url ?? source}
              alt={preview.url ? translate("composition.preview") : file.name}
            />
            {valid && (
              <ImageCompositionCanvas
                key={`${width}x${height}`}
                width={width}
                height={height}
                objects={state.objects}
                selected={selected}
                onSelect={setSelected}
                onChange={(o) => dispatch({ type: "replace", object: o })}
                disabled={disabled}
              />
            )}
          </div>
          {!preview.ready && !preview.error && (
            <p role="status">{translate("composition.pending")}</p>
          )}
          {preview.error && <p role="alert">{translate("composition.previewError")}</p>}
        </div>
        <aside className="image-composition-inspector">
          <h3>{translate("composition.objects")}</h3>
          <ol aria-label={translate("composition.objects")}>
            {state.objects.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected === o.id}
                  onClick={() => setSelected(o.id)}
                >
                  {translate(kindKeys[o.kind])} {i + 1}
                </button>
              </li>
            ))}
          </ol>
          {object && (
            <fieldset disabled={disabled}>
              <legend>{translate(kindKeys[object.kind])}</legend>
              {object.kind === "text" && (
                <>
                  <label htmlFor="composition-text">{translate("composition.textContent")}</label>
                  <input
                    id="composition-text"
                    value={object.text}
                    maxLength={200}
                    onChange={(e) =>
                      dispatch({ type: "replace", object: { ...object, text: e.target.value } })
                    }
                  />
                </>
              )}
              <div className="image-composition-geometry">
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <div key={key}>
                    <label htmlFor={`composition-${key}`}>{translate(`composition.${key}`)}</label>
                    <input
                      id={`composition-${key}`}
                      type="number"
                      step={1}
                      min={key === "x" || key === "y" ? 0 : 1}
                      max={key === "x" || key === "width" ? width : height}
                      value={object[key]}
                      onChange={(e) => geometry(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              {object.kind !== "image" && (
                <>
                  <label htmlFor="composition-color">{translate("composition.color")}</label>
                  <input
                    id="composition-color"
                    type="color"
                    value={object.color}
                    onChange={(e) =>
                      dispatch({ type: "replace", object: { ...object, color: e.target.value } })
                    }
                  />
                </>
              )}
              <label htmlFor="composition-opacity">{translate("composition.opacity")}</label>
              <input
                id="composition-opacity"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={object.opacity}
                onChange={(e) =>
                  dispatch({
                    type: "replace",
                    object: { ...object, opacity: Number(e.target.value) },
                  })
                }
              />
              <button
                type="button"
                disabled={state.objects.at(-1)?.id === object.id}
                onClick={() =>
                  dispatch({ type: "reorder", id: object.id, index: state.objects.length - 1 })
                }
              >
                {translate("composition.forward")}
              </button>
              <button
                type="button"
                disabled={state.objects[0]?.id === object.id}
                onClick={() => dispatch({ type: "reorder", id: object.id, index: 0 })}
              >
                {translate("composition.backward")}
              </button>
              <button type="button" onClick={() => dispatch({ type: "remove", id: object.id })}>
                {translate("composition.remove")}
              </button>
            </fieldset>
          )}
        </aside>
      </div>
    </section>
  );
}
