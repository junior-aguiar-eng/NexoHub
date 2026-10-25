import {
  EDITOR_LIMITS,
  type EditorBitmap,
  type EditorElement,
  type EditorReplacement,
  type EditorSnapshot,
} from "./pdf-editor-types";
export interface EditorHistory {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
  truncated?: boolean;
}
export function editorHistory(): EditorHistory {
  return { past: [], present: { replacements: [], elements: [] }, future: [] };
}
export function commitEditorSnapshot(
  history: EditorHistory,
  snapshot: EditorSnapshot,
): EditorHistory {
  const past = [...history.past, history.present].slice(-50);
  let truncated = history.truncated || history.past.length >= 50;
  while (past.length && retainedBytes([...past, snapshot]) > EDITOR_LIMITS.historyBytes) {
    past.shift();
    truncated = true;
  }
  return { past, present: snapshot, future: [], truncated: truncated || undefined };
}
export function undoEditor(history: EditorHistory): EditorHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    truncated: history.truncated,
  };
}
export function redoEditor(history: EditorHistory): EditorHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    truncated: history.truncated,
  };
}

/** Estimativa conservadora dos payloads retidos; não representa o heap total do navegador. */
function retainedBytes(snapshots: EditorSnapshot[]): number {
  const buffers = new Set<ArrayBufferLike>();
  const commands = new Set<EditorElement | EditorReplacement>();
  let bytes = 0;
  for (const snapshot of snapshots) {
    bytes += (snapshot.elements.length + snapshot.replacements.length) * 8;
    for (const command of [...snapshot.elements, ...snapshot.replacements]) {
      if (commands.has(command)) continue;
      commands.add(command);
      bytes += 256 + command.id.length * 2 + (command.text?.length ?? 0) * 2;
      if ("kind" in command) {
        bytes += (command.points?.length ?? 0) * 16;
        const buffer = command.image?.data.buffer;
        if (buffer && !buffers.has(buffer)) {
          buffers.add(buffer);
          bytes += buffer.byteLength;
        }
      }
    }
  }
  return bytes;
}

export class EditorPreviewCache {
  private readonly entries = new Map<number, EditorBitmap>();
  private size = 0;
  constructor(private readonly budget: number = EDITOR_LIMITS.previewCacheBytes) {}
  get byteLength(): number {
    return this.size;
  }
  get(page: number): EditorBitmap | undefined {
    const bitmap = this.entries.get(page);
    if (bitmap) {
      this.entries.delete(page);
      this.entries.set(page, bitmap);
    }
    return bitmap;
  }
  set(page: number, bitmap: EditorBitmap): void {
    const previous = this.entries.get(page);
    if (previous) {
      this.entries.delete(page);
      this.size -= previous.data.byteLength;
    }
    if (bitmap.data.byteLength > this.budget) return;
    this.entries.set(page, bitmap);
    this.size += bitmap.data.byteLength;
    while (this.size > this.budget || this.entries.size > 3) {
      const oldest = this.entries.entries().next().value;
      if (!oldest) break;
      this.entries.delete(oldest[0]);
      this.size -= oldest[1].data.byteLength;
    }
  }
  clear(): void {
    this.entries.clear();
    this.size = 0;
  }
}
