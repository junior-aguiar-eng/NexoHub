import type { EditorSnapshot } from "./pdf-editor-types";
export interface EditorHistory {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
}
export function editorHistory(): EditorHistory {
  return { past: [], present: { replacements: [], elements: [] }, future: [] };
}
export function commitEditorSnapshot(
  history: EditorHistory,
  snapshot: EditorSnapshot,
): EditorHistory {
  return { past: [...history.past, history.present].slice(-50), present: snapshot, future: [] };
}
export function undoEditor(history: EditorHistory): EditorHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}
export function redoEditor(history: EditorHistory): EditorHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
