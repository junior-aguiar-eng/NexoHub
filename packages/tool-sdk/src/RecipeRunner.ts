import type { RecipeRunProgress, RecipeSnapshot, RecipeStepProgress } from "@nexohub/domain";
import { ToolRunError, type ToolRunner, type ToolRunResult } from "./index";

export interface RecipeRunOptions {
  readonly toolRunner: ToolRunner;
  readonly cancellationToken?: AbortSignal;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly onProgress?: (progress: RecipeRunProgress) => void;
}

export class RecipeRunError extends Error {
  constructor(
    readonly cause: ToolRunError,
    readonly run: RecipeRunProgress,
  ) {
    super(cause.message);
    this.name = "RecipeRunError";
  }
}

export function validateRecipe(recipe: RecipeSnapshot, capabilityLayer: ToolRunner): void {
  const unavailable = recipe.steps.flatMap((step, index) => {
    const availability = capabilityLayer.availability(step.toolId);
    return availability.available
      ? []
      : [{ stepId: step.id, stepIndex: index, toolId: step.toolId, ...availability }];
  });
  if (unavailable.length > 0) {
    throw new ToolRunError(
      "TOOL_UNAVAILABLE",
      "A receita contém ferramentas indisponíveis nesta plataforma.",
      { steps: unavailable },
    );
  }
}

export async function runRecipe(
  recipe: RecipeSnapshot,
  initialArtifactId: string,
  options: RecipeRunOptions,
): Promise<RecipeRunProgress> {
  validateRecipe(recipe, options.toolRunner);
  let steps: RecipeStepProgress[] = recipe.steps.map((step) => ({
    stepId: step.id,
    toolId: step.toolId,
    status: "PENDING",
    artifactIds: [],
  }));
  const outputs = new Map<string, readonly string[]>();
  const orderedSteps = topologicalSteps(recipe);
  emit(options, { recipeId: recipe.id, status: "PENDING", steps });

  for (const recipeStep of orderedSteps) {
    const index = recipe.steps.findIndex((step) => step.id === recipeStep.id);
    if (options.cancellationToken?.aborted) {
      throw cancelled(recipe, options, steps, index);
    }
    steps = replace(steps, index, { ...stepAt(steps, index), status: "RUNNING" });
    emit(options, { recipeId: recipe.id, status: "RUNNING", currentStepIndex: index, steps });
    try {
      const result = await options.toolRunner.run({
        toolId: recipeStep.toolId,
        input: resolveInput(recipe, recipeStep.id, initialArtifactId, outputs),
        parameters: resolveParameters(recipe, recipeStep.id, recipeStep.parameters, options),
        signal: options.cancellationToken,
      });
      const artifactIds = extractArtifactIds(result);
      outputs.set(recipeStep.id, artifactIds);
      steps = replace(steps, index, {
        ...stepAt(steps, index),
        status: "SUCCEEDED",
        artifactIds,
      });
      emit(options, { recipeId: recipe.id, status: "RUNNING", currentStepIndex: index, steps });
    } catch (error) {
      const cause = normalizeError(error);
      const isCancelled = cause.code === "CANCELLED";
      steps = replace(steps, index, {
        ...stepAt(steps, index),
        status: isCancelled ? "CANCELLED" : "FAILED",
        error: { code: cause.code, message: cause.message },
      });
      const run: RecipeRunProgress = {
        recipeId: recipe.id,
        status: isCancelled ? "CANCELLED" : "FAILED",
        currentStepIndex: index,
        steps,
      };
      emit(options, run);
      throw new RecipeRunError(cause, run);
    }
  }

  const completed: RecipeRunProgress = {
    recipeId: recipe.id,
    status: "SUCCEEDED",
    currentStepIndex: steps.length - 1,
    steps,
  };
  emit(options, completed);
  return completed;
}

function topologicalSteps(recipe: RecipeSnapshot): RecipeSnapshot["steps"][number][] {
  const pending = [...recipe.steps];
  const completed = new Set<string>();
  const ordered: RecipeSnapshot["steps"][number][] = [];
  while (pending.length > 0) {
    const index = pending.findIndex((step) =>
      dependenciesOf(recipe, step.id).every((dependency) => completed.has(dependency)),
    );
    if (index < 0)
      throw new ToolRunError("INVALID_INPUT", "A receita contém dependências cíclicas.");
    const [step] = pending.splice(index, 1);
    if (!step) throw new ToolRunError("INVALID_INPUT", "Etapa inválida na receita.");
    ordered.push(step);
    completed.add(step.id);
  }
  return ordered;
}

function dependenciesOf(recipe: RecipeSnapshot, stepId: string): readonly string[] {
  const index = recipe.steps.findIndex((step) => step.id === stepId);
  const step = recipe.steps[index];
  if (!step) return [];
  if (step.dependsOn !== undefined) return step.dependsOn;
  const previous = recipe.steps[index - 1];
  return previous ? [previous.id] : [];
}

function resolveInput(
  recipe: RecipeSnapshot,
  stepId: string,
  initialArtifactId: string,
  outputs: ReadonlyMap<string, readonly string[]>,
): string | readonly string[] {
  const dependencies = dependenciesOf(recipe, stepId);
  if (dependencies.length === 0) return initialArtifactId;
  const artifactIds = dependencies.flatMap((dependency) => outputs.get(dependency) ?? []);
  return artifactIds.length === 1 ? (artifactIds[0] ?? initialArtifactId) : artifactIds;
}

export class RecipeRunner {
  constructor(readonly tools: ToolRunner) {}

  preflight(recipe: RecipeSnapshot): void {
    validateRecipe(recipe, this.tools);
  }

  run(
    request: Omit<RecipeRunOptions, "toolRunner"> & {
      readonly recipe: RecipeSnapshot;
      readonly input: string;
      readonly signal?: AbortSignal;
    },
  ): Promise<RecipeRunProgress> {
    return runRecipe(request.recipe, request.input, {
      ...request,
      toolRunner: this.tools,
      cancellationToken: request.cancellationToken ?? request.signal,
    });
  }
}

function extractArtifactIds(result: ToolRunResult): string[] {
  return result.artifacts.map((artifact) => {
    if (typeof artifact === "string") return artifact;
    if (artifact && typeof artifact === "object" && "id" in artifact) {
      const id = (artifact as { readonly id: unknown }).id;
      if (typeof id === "string" && id.trim() !== "") return id;
    }
    throw new ToolRunError("EXECUTION_FAILED", "A etapa não retornou um artifact identificável.");
  });
}

function resolveParameters(
  recipe: RecipeSnapshot,
  stepId: string,
  stepParameters: RecipeSnapshot["steps"][number]["parameters"],
  options: RecipeRunOptions,
): Readonly<Record<string, unknown>> {
  const editable = Object.fromEntries(
    recipe.parameters
      .filter((parameter) => parameter.stepId === stepId)
      .map((parameter) => {
        const key = `${stepId}.${parameter.name}`;
        const value = options.parameters?.[key] ?? parameter.defaultValue;
        if (parameter.required && value === undefined) {
          throw new ToolRunError(
            "INVALID_INPUT",
            `Parâmetro obrigatório ausente: ${parameter.label}`,
          );
        }
        return [parameter.name, value];
      }),
  );
  return { ...stepParameters, ...editable };
}

function cancelled(
  recipe: RecipeSnapshot,
  options: RecipeRunOptions,
  steps: readonly RecipeStepProgress[],
  index: number,
): RecipeRunError {
  const cause = new ToolRunError("CANCELLED", "Execução cancelada.");
  const run: RecipeRunProgress = {
    recipeId: recipe.id,
    status: "CANCELLED",
    currentStepIndex: index,
    steps: replace(steps, index, { ...stepAt(steps, index), status: "CANCELLED" }),
  };
  emit(options, run);
  return new RecipeRunError(cause, run);
}

function normalizeError(error: unknown): ToolRunError {
  return error instanceof ToolRunError
    ? error
    : new ToolRunError("EXECUTION_FAILED", "Falha ao executar a etapa da receita.");
}

function replace(
  steps: readonly RecipeStepProgress[],
  index: number,
  step: RecipeStepProgress,
): RecipeStepProgress[] {
  return steps.map((current, position) => (position === index ? step : current));
}

function stepAt(steps: readonly RecipeStepProgress[], index: number): RecipeStepProgress {
  const step = steps[index];
  if (!step) throw new ToolRunError("INVALID_INPUT", "Índice de etapa inválido.");
  return step;
}

function emit(options: RecipeRunOptions, progress: RecipeRunProgress): void {
  options.onProgress?.(progress);
}
