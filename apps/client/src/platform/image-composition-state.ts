import type {
  CompositionAction,
  CompositionCommand,
  ImageCompositionObject,
  ImageCompositionSnapshot,
} from "./image-composition-types";

interface HistoryEntry {
  readonly forward: CompositionCommand;
  readonly backward: CompositionCommand;
}
export interface ImageCompositionState extends ImageCompositionSnapshot {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
}
export function createCompositionState(): ImageCompositionState {
  return { objects: [], past: [], future: [] };
}
function apply(
  objects: readonly ImageCompositionObject[],
  command: CompositionCommand,
): readonly ImageCompositionObject[] {
  const next = [...objects];
  if (command.type === "add") {
    next.splice(command.index ?? next.length, 0, command.object);
    return next;
  }
  const index = next.findIndex(
    (o) => o.id === (command.type === "replace" ? command.object.id : command.id),
  );
  if (index < 0) return objects;
  if (command.type === "replace") next[index] = command.object;
  else if (command.type === "remove") next.splice(index, 1);
  else
    next.splice(Math.max(0, Math.min(next.length - 1, command.index)), 0, next.splice(index, 1)[0]);
  return next;
}
function assetBytes(
  objects: readonly ImageCompositionObject[],
  entries: readonly HistoryEntry[],
): number {
  const blobs = new Set<Blob>();
  const collect = (o: ImageCompositionObject) => {
    if (o.kind === "image") blobs.add(o.blob);
  };
  objects.forEach(collect);
  for (const entry of entries)
    for (const command of [entry.forward, entry.backward]) {
      if (command.type === "add" || command.type === "replace") collect(command.object);
    }
  return [...blobs].reduce((bytes, blob) => bytes + blob.size, 0);
}
export function compositionReducer(
  state: ImageCompositionState,
  action: CompositionAction,
): ImageCompositionState {
  if (action.type === "reset") return createCompositionState();
  if (action.type === "undo" || action.type === "redo") {
    const undo = action.type === "undo";
    const list = undo ? state.past : state.future,
      entry = list.at(-1);
    if (!entry) return state;
    return {
      objects: apply(state.objects, undo ? entry.backward : entry.forward),
      past: undo ? state.past.slice(0, -1) : [...state.past, entry],
      future: undo ? [...state.future, entry] : state.future.slice(0, -1),
    };
  }
  const object = state.objects.find(
    (o) =>
      o.id === (action.type === "add" || action.type === "replace" ? action.object.id : action.id),
  );
  if (action.type === "add" && (object || state.objects.length >= 20)) return state;
  if (action.type !== "add" && !object) return state;
  const index = object ? state.objects.indexOf(object) : -1;
  const backward: CompositionCommand =
    action.type === "add"
      ? { type: "remove", id: action.object.id }
      : action.type === "remove"
        ? { type: "add", object: object as ImageCompositionObject, index }
        : action.type === "replace"
          ? { type: "replace", object: object as ImageCompositionObject }
          : { type: "reorder", id: action.id, index };
  const objects = apply(state.objects, action);
  const past = [...state.past, { forward: action, backward }].slice(-100);
  while (past.length && assetBytes(objects, past) > 32 * 1024 * 1024) past.shift();
  return { objects, past, future: [] };
}
export function validateComposition(
  snapshot: ImageCompositionSnapshot,
  width: number,
  height: number,
): void {
  if (width * height > 8_000_000 || snapshot.objects.length > 20)
    throw new Error("COMPOSICAO_LIMITE");
  const ids = new Set<string>();
  let assetBytes = 0;
  for (const o of snapshot.objects) {
    if (
      !["text", "rectangle", "ellipse", "image"].includes(o.kind) ||
      !o.id ||
      ids.has(o.id) ||
      ![o.x, o.y, o.width, o.height, o.opacity].every(Number.isFinite) ||
      o.x < 0 ||
      o.y < 0 ||
      o.width < 1 ||
      o.height < 1 ||
      o.x + o.width > width ||
      o.y + o.height > height ||
      o.opacity < 0 ||
      o.opacity > 1
    )
      throw new Error("COMPOSICAO_INVALIDA");
    ids.add(o.id);
    if (o.kind === "image") {
      if (!(o.blob instanceof Blob) || !o.blob.size) throw new Error("COMPOSICAO_INVALIDA");
      assetBytes += o.blob.size;
    } else if (
      !/^#[\da-f]{6}$/i.test(o.color) ||
      (o.kind === "text" && (!o.text.trim() || o.text.length > 200 || /[\r\n]/.test(o.text)))
    )
      throw new Error("COMPOSICAO_INVALIDA");
  }
  if (assetBytes > 16 * 1024 * 1024) throw new Error("COMPOSICAO_LIMITE");
}
