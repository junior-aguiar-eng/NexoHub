import { expect, it } from "vitest";
import {
  commitEditorSnapshot,
  EditorPreviewCache,
  editorHistory,
  redoEditor,
  undoEditor,
} from "./pdf-editor-state";

it("desfaz e refaz revisões mistas e limpa o futuro após nova alteração", () => {
  const empty = editorHistory();
  const one = commitEditorSnapshot(empty, {
    replacements: [{ id: "0:0", text: "Novo" }],
    elements: [],
  });
  const two = commitEditorSnapshot(one, { replacements: [], elements: [] });
  expect(undoEditor(two).present).toEqual(one.present);
  expect(redoEditor(undoEditor(two)).present).toEqual(two.present);
  expect(commitEditorSnapshot(undoEditor(two), empty.present).future).toHaveLength(0);
  expect(undoEditor(empty)).toBe(empty);
});

it("cache de páginas respeita bytes, LRU e descarte ao trocar a revisão", () => {
  const cache = new EditorPreviewCache(8);
  const bitmap = () => ({ data: new Uint8Array(4), width: 1, height: 1 });
  const one = bitmap(),
    two = bitmap(),
    three = bitmap();
  cache.set(0, one);
  cache.set(1, two);
  expect(cache.get(0)).toBe(one);
  cache.set(2, three);
  expect(cache.get(1)).toBeUndefined();
  expect(cache.get(0)).toBe(one);
  expect(cache.byteLength).toBe(8);
  cache.clear();
  expect(cache.get(0)).toBeUndefined();
  expect(cache.byteLength).toBe(0);
});

it("histórico descarta assets antigos ao exceder o orçamento, preservando a revisão atual", () => {
  const snapshot = (id: string) => ({
    replacements: [],
    elements: [
      {
        id,
        page: 0,
        kind: "image" as const,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        color: "#000000",
        image: { data: new Uint8Array(24 * 1024 * 1024), width: 3072, height: 2048 },
      },
    ],
  });
  const first = commitEditorSnapshot(editorHistory(), snapshot("a"));
  const second = commitEditorSnapshot(first, snapshot("b"));
  const third = commitEditorSnapshot(second, snapshot("c"));
  expect(third.present.elements[0].id).toBe("c");
  expect(third.past).toHaveLength(1);
  expect(undoEditor(third).present.elements[0].id).toBe("b");
  expect(third.truncated).toBe(true);
});

it("histórico não conta o mesmo bitmap compartilhado por várias revisões repetidamente", () => {
  const element = {
    id: "a",
    page: 0,
    kind: "image" as const,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    color: "#000000",
    image: { data: new Uint8Array(24 * 1024 * 1024), width: 3072, height: 2048 },
  };
  let history = editorHistory();
  for (let i = 0; i < 10; i++)
    history = commitEditorSnapshot(history, {
      replacements: [],
      elements: [{ ...element, x: i / 100 }],
    });
  expect(history.past).toHaveLength(10);
  expect(history.truncated).not.toBe(true);
});

it("preserva o limite de 50 etapas mesmo com comandos pequenos", () => {
  let history = editorHistory();
  for (let i = 0; i < 60; i++)
    history = commitEditorSnapshot(history, {
      replacements: [{ id: "0:0", text: String(i) }],
      elements: [],
    });
  expect(history.past).toHaveLength(50);
  expect(history.present.replacements[0].text).toBe("59");
  expect(history.truncated).toBe(true);
});
