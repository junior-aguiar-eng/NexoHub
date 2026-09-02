import type { RecipeSnapshot } from "@nexohub/domain";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserRecipeStorage } from "./recipe-storage";

describe("BrowserRecipeStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("substitui armazenamento corrompido ao salvar uma receita", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue("{json interrompido"),
      setItem,
    });
    const recipe: RecipeSnapshot = {
      id: "recipe-1",
      name: "Receita válida",
      steps: [{ id: "step-1", toolId: "pdf-ocr", parameters: {} }],
      parameters: [],
    };

    await new BrowserRecipeStorage().save(recipe);

    expect(setItem).toHaveBeenCalledWith("nexohub.recipes.v1", JSON.stringify([recipe]));
  });
});
