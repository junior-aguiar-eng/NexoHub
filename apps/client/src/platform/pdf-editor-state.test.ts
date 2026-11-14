import { expect, it } from "vitest";
import {
  groupEditableParagraphs,
  groupEditableTextRuns,
  needsFallbackForText,
  pickCompatibleFallbackFont,
} from "./pdf-editor-compatibility";
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

it("agrupa caracteres e fragmentos adjacentes da mesma linha mantendo colunas separadas", () => {
  const base = {
    fontName: "Helvetica",
    fontSize: 10,
    color: "#111111",
    editable: true,
    height: 0.015,
    fontPolicy: "latin" as const,
  };
  const grouped = groupEditableTextRuns([
    { ...base, id: "0:0", text: "§", x: 0.1, y: 0.2, width: 0.01 },
    { ...base, id: "0:1", text: "2", x: 0.115, y: 0.2, width: 0.01 },
    { ...base, id: "0:2", text: "º", x: 0.125, y: 0.2, width: 0.008 },
    { ...base, id: "0:3", text: "Coluna2", x: 0.45, y: 0.2, width: 0.08 },
  ]);
  expect(grouped).toHaveLength(2);
  expect(grouped[0].text).toBe("§ 2º");
  expect(grouped[0].memberIds).toEqual(["0:0", "0:1", "0:2"]);
  expect(grouped[1].text).toBe("Coluna2");
});

it("agrupa linhas consecutivas em parágrafo editável e ativa fallback automático para acentos ausentes", () => {
  const base = {
    fontName: "Arial-BoldMT",
    fontSize: 11,
    color: "#111111",
    editable: true,
    height: 0.015,
    fontPolicy: "observed" as const,
    supportedCharacters: "Linha12",
  };
  const paragraphs = groupEditableParagraphs([
    { ...base, id: "0:0", text: "Linha 1", x: 0.1, y: 0.2, width: 0.35 },
    { ...base, id: "0:1", text: "Linha 2", x: 0.1, y: 0.22, width: 0.32 },
    { ...base, id: "0:2", text: "OutraColuna", x: 0.6, y: 0.2, width: 0.2 },
  ]);
  expect(paragraphs).toHaveLength(2);
  expect(paragraphs[0].text).toBe("Linha 1\nLinha 2");
  expect(paragraphs[0].memberIds).toEqual(["0:0", "0:1"]);
  expect(needsFallbackForText(paragraphs[0], "Ação")).toBe(true);
  expect(pickCompatibleFallbackFont("Arial-BoldMT")).toBe("Helvetica-Bold");
});
