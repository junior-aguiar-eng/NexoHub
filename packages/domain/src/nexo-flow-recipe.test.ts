import { describe, expect, it } from "vitest";
import { DomainError, promoteQuickTool, Recipe, saveFlowAsRecipe } from "./index";

describe("NexoFlow Recipe", () => {
  it("salva a sequência corrente e permite editar parâmetros sem mutação", () => {
    const flow = promoteQuickTool("pdf-organize").withStep({
      id: "step-2",
      toolId: "pdf-compress",
      status: "PENDING",
      parameters: { level: 5 },
      dependsOn: ["step-1"],
    });
    const recipe = saveFlowAsRecipe(flow.snapshot, { id: "digitalizacao", name: "Digitalização" });
    const edited = recipe.withStepParameters("step-2", { level: 8 });

    expect(recipe.snapshot.steps[1]?.parameters).toEqual({ level: 5 });
    expect(edited.snapshot.steps[1]?.parameters).toEqual({ level: 8 });
    expect(Object.isFrozen(edited.snapshot.steps)).toBe(true);
  });

  it("rejeita ciclos no grafo visual", () => {
    expect(
      () =>
        new Recipe({
          id: "cycle",
          name: "Ciclo",
          parameters: [],
          steps: [
            { id: "a", toolId: "pdf-ocr", parameters: {}, dependsOn: ["b"] },
            { id: "b", toolId: "pdf-compress", parameters: {}, dependsOn: ["a"] },
          ],
        }),
    ).toThrow(DomainError);
  });
});
