import { describe, expect, it } from "vitest";
import {
  compositionReducer,
  createCompositionState,
  validateComposition,
} from "./image-composition-state";
import type { ImageCompositionObject } from "./image-composition-types";

const red: ImageCompositionObject = {
  id: "red",
  kind: "rectangle",
  x: 10,
  y: 20,
  width: 100,
  height: 60,
  opacity: 1,
  color: "#ff0000",
};
describe("composição em pixels do original", () => {
  it("desfaz e refaz adição, edição, ordem e exclusão sem alterar o original", () => {
    const original = createCompositionState();
    let s = compositionReducer(original, { type: "add", object: red });
    s = compositionReducer(s, { type: "add", object: { ...red, id: "blue", color: "#0000ff" } });
    s = compositionReducer(s, { type: "replace", object: { ...red, x: 50 } });
    s = compositionReducer(s, { type: "reorder", id: "red", index: 1 });
    expect(s.objects.map((o) => o.id)).toEqual(["blue", "red"]);
    s = compositionReducer(s, { type: "remove", id: "red" });
    s = compositionReducer(s, { type: "undo" });
    expect(s.objects[1].x).toBe(50);
    s = compositionReducer(s, { type: "undo" });
    expect(s.objects.map((o) => o.id)).toEqual(["red", "blue"]);
    s = compositionReducer(s, { type: "undo" });
    expect(s.objects[0].x).toBe(10);
    s = compositionReducer(s, { type: "redo" });
    expect(s.objects[0].x).toBe(50);
    s = compositionReducer(s, { type: "replace", object: { ...red, x: 80 } });
    expect(compositionReducer(s, { type: "redo" })).toBe(s);
    expect(original.objects).toEqual([]);
    expect(red.x).toBe(10);
  });
  it("guarda referência ao Blob no histórico e limita a quantidade de comandos", () => {
    const blob = new Blob(["asset"]);
    let s = compositionReducer(createCompositionState(), {
      type: "add",
      object: { ...red, kind: "image", blob },
    });
    for (let x = 1; x <= 130; x++)
      s = compositionReducer(s, { type: "replace", object: { ...red, kind: "image", blob, x } });
    expect(s.objects[0].kind === "image" && s.objects[0].blob).toBe(blob);
    expect(s.past).toHaveLength(100);
    expect(
      s.past[0].backward.type === "replace" &&
        s.past[0].backward.object.kind === "image" &&
        s.past[0].backward.object.blob,
    ).toBe(blob);
  });
  it("recusa coordenadas inválidas, IDs repetidos e objetos fora da imagem", () => {
    for (const object of [
      { ...red, x: -1 },
      { ...red, width: NaN },
      { ...red, width: 0 },
      { ...red, opacity: 2 },
      { ...red, x: 590 },
      { ...red, color: "url(x)" },
    ]) {
      expect(() => validateComposition({ objects: [object] }, 600, 400)).toThrow(
        "COMPOSICAO_INVALIDA",
      );
    }
    expect(() => validateComposition({ objects: [red, red] }, 600, 400)).toThrow(
      "COMPOSICAO_INVALIDA",
    );
    expect(() => validateComposition({ objects: [red] }, 4000, 3000)).toThrow("COMPOSICAO_LIMITE");
    expect(() => validateComposition({ objects: [red] }, 600, 400)).not.toThrow();
  });
  it("descarta comandos antigos antes de reter mais de 32 MiB de assets no histórico", () => {
    const assets = Array.from({ length: 4 }, () => new Blob([new Uint8Array(10 * 1024 * 1024)]));
    let s = createCompositionState();
    for (const [index, blob] of assets.entries()) {
      if (index) s = compositionReducer(s, { type: "remove", id: String(index - 1) });
      s = compositionReducer(s, {
        type: "add",
        object: { ...red, id: String(index), kind: "image", blob },
      });
    }
    expect(
      s.past.some((entry) =>
        [entry.forward, entry.backward].some(
          (command) =>
            (command.type === "add" || command.type === "replace") &&
            command.object.kind === "image" &&
            command.object.blob === assets[0],
        ),
      ),
    ).toBe(false);
    s = compositionReducer(s, { type: "undo" });
    expect(s.objects).toEqual([]);
    s = compositionReducer(s, { type: "undo" });
    expect(s.objects[0].kind === "image" && s.objects[0].blob).toBe(assets[2]);
  });
});
