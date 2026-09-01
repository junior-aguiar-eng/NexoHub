import type { RecipeSnapshot } from "@nexohub/domain";
import { describe, expect, it, vi } from "vitest";
import {
  RecipeRunError,
  RecipeRunner,
  StaticCapabilityProvider,
  type ToolExecutor,
  ToolRegistry,
  ToolRunError,
  ToolRunner,
} from "./index";

const recipe: RecipeSnapshot = {
  id: "scan-clean",
  name: "Digitalização limpa",
  parameters: [],
  steps: [
    { id: "ocr", toolId: "pdf-ocr", parameters: {} },
    { id: "compress", toolId: "pdf-compress", parameters: { level: 6 } },
    { id: "publish", toolId: "pdf-publish", parameters: {} },
  ],
};

function createRunner(execute: ToolExecutor["execute"]): RecipeRunner {
  const registry = new ToolRegistry();
  for (const id of ["pdf-ocr", "pdf-compress", "pdf-publish"]) {
    registry.register({
      id,
      version: "1.0.0",
      name: id,
      category: "pdf",
      surfaces: ["studio"],
      accepts: ["application/pdf"],
      produces: ["application/pdf"],
      capabilities: ["documents.write"],
      executor: "native",
    });
  }
  return new RecipeRunner(
    new ToolRunner(
      registry,
      new StaticCapabilityProvider({ "documents.write": { available: true } }),
      [{ kind: "native", execute }],
    ),
  );
}

describe("Recipe Runner", () => {
  it("executa em ordem e expõe artifacts intermediários", async () => {
    const execute = vi.fn(async (request) => ({ artifacts: [`${request.toolId}-artifact`] }));
    const progress = vi.fn();
    const result = await createRunner(execute).run({
      recipe,
      input: "original",
      onProgress: progress,
    });

    expect(execute.mock.calls.map(([request]) => request.toolId)).toEqual([
      "pdf-ocr",
      "pdf-compress",
      "pdf-publish",
    ]);
    expect(execute.mock.calls[1]?.[0].input).toBe("pdf-ocr-artifact");
    expect(result.steps.map((step) => step.artifactIds)).toEqual([
      ["pdf-ocr-artifact"],
      ["pdf-compress-artifact"],
      ["pdf-publish-artifact"],
    ]);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ status: "SUCCEEDED" }));
  });

  it("interrompe na falha intermediária e preserva artifacts concluídos", async () => {
    const runner = createRunner(async (request) => {
      if (request.toolId === "pdf-compress") throw new Error("engine");
      return { artifacts: ["ocr-artifact"] };
    });

    try {
      await runner.run({ recipe, input: "original" });
      throw new Error("A execução deveria falhar.");
    } catch (error) {
      expect(error).toBeInstanceOf(RecipeRunError);
      expect((error as RecipeRunError).run).toMatchObject({
        status: "FAILED",
        steps: [
          { status: "SUCCEEDED", artifactIds: ["ocr-artifact"] },
          { status: "FAILED" },
          { status: "PENDING" },
        ],
      });
    }
  });

  it("cancela a etapa corrente e não inicia etapas seguintes", async () => {
    const execute = vi.fn(async (request) => {
      if (request.toolId === "pdf-ocr") return { artifacts: ["ocr-artifact"] };
      await new Promise<void>((_, reject) => {
        request.signal?.addEventListener("abort", () => reject(new ToolRunError("CANCELLED", "x")));
      });
      return { artifacts: [] };
    });
    const controller = new AbortController();
    const running = createRunner(execute).run({
      recipe,
      input: "original",
      signal: controller.signal,
      onProgress(progress) {
        if (progress.currentStepIndex === 1 && progress.steps[1]?.status === "RUNNING") {
          queueMicrotask(() => controller.abort());
        }
      },
    });

    await expect(running).rejects.toMatchObject({
      run: {
        status: "CANCELLED",
        steps: [
          { status: "SUCCEEDED", artifactIds: ["ocr-artifact"] },
          { status: "CANCELLED" },
          { status: "PENDING" },
        ],
      },
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("bloqueia toda a receita no preflight quando uma etapa está indisponível", async () => {
    const registry = new ToolRegistry();
    registry.register({
      id: "pdf-ocr",
      version: "1.0.0",
      name: "OCR",
      category: "pdf",
      surfaces: ["studio"],
      accepts: ["application/pdf"],
      produces: ["text/plain"],
      capabilities: ["ocr.execute"],
      executor: "native",
    });
    const execute = vi.fn(async () => ({ artifacts: [] }));
    const runner = new RecipeRunner(
      new ToolRunner(registry, new StaticCapabilityProvider({}), [{ kind: "native", execute }]),
    );
    const unavailable = { ...recipe, steps: recipe.steps.slice(0, 1) };

    await expect(runner.run({ recipe: unavailable, input: "original" })).rejects.toMatchObject({
      code: "TOOL_UNAVAILABLE",
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
