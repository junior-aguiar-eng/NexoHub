import { expect, it } from "vitest";
import { commitEditorSnapshot, editorHistory, redoEditor, undoEditor } from "./pdf-editor-state";

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
