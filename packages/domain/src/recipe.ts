import { DomainError, type JsonValue } from "./model";
import type { NexoFlowSnapshot } from "./nexo-flow";

export interface RecipeParameter {
  readonly stepId: string;
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly defaultValue?: JsonValue;
}

export interface RecipeStep {
  readonly id: string;
  readonly toolId: string;
  readonly parameters: Readonly<Record<string, JsonValue>>;
  readonly dependsOn?: readonly string[];
  readonly position?: { readonly x: number; readonly y: number };
}

export interface RecipeSnapshot {
  readonly id: string;
  readonly name: string;
  readonly steps: readonly RecipeStep[];
  readonly parameters: readonly RecipeParameter[];
}

export type RecipeStepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface RecipeStepProgress {
  readonly stepId: string;
  readonly toolId: string;
  readonly status: RecipeStepStatus;
  readonly artifactIds: readonly string[];
  readonly error?: { readonly code: string; readonly message: string };
}

export interface RecipeRunProgress {
  readonly recipeId: string;
  readonly status: RecipeStepStatus;
  readonly currentStepIndex?: number;
  readonly steps: readonly RecipeStepProgress[];
}

export class Recipe {
  readonly #snapshot: RecipeSnapshot;

  constructor(snapshot: RecipeSnapshot) {
    if (snapshot.id.trim() === "" || snapshot.name.trim() === "") {
      throw new DomainError("INVALID_IDENTIFIER", "A receita exige ID e nome.");
    }
    validateSteps(snapshot.steps);
    validateParameters(snapshot.parameters, snapshot.steps);
    this.#snapshot = Object.freeze({
      ...snapshot,
      steps: Object.freeze(
        snapshot.steps.map((step) =>
          Object.freeze({
            ...step,
            parameters: Object.freeze({ ...step.parameters }),
            dependsOn: step.dependsOn ? Object.freeze([...step.dependsOn]) : undefined,
            position: step.position ? Object.freeze({ ...step.position }) : undefined,
          }),
        ),
      ),
      parameters: Object.freeze(snapshot.parameters.map((parameter) => Object.freeze(parameter))),
    });
  }

  get snapshot(): RecipeSnapshot {
    return this.#snapshot;
  }

  withStepParameters(stepId: string, parameters: Readonly<Record<string, JsonValue>>): Recipe {
    if (!this.#snapshot.steps.some((step) => step.id === stepId)) {
      throw new DomainError("BROKEN_REFERENCE", "A etapa informada não pertence à receita.");
    }
    return new Recipe({
      ...this.#snapshot,
      steps: this.#snapshot.steps.map((step) =>
        step.id === stepId ? { ...step, parameters } : step,
      ),
    });
  }
}

export function saveFlowAsRecipe(
  flow: NexoFlowSnapshot,
  identity: { readonly id: string; readonly name: string },
  parameters: readonly RecipeParameter[] = [],
): Recipe {
  if (flow.steps.length === 0) {
    throw new DomainError("BROKEN_REFERENCE", "Um fluxo vazio não pode ser salvo como receita.");
  }
  return new Recipe({
    ...identity,
    parameters,
    steps: flow.steps.map((step) => ({
      id: step.id,
      toolId: step.toolId,
      parameters: asParameterRecord(step.parameters),
      dependsOn: [...step.dependsOn],
      position: { x: 40, y: 40 + flow.steps.indexOf(step) * 120 },
    })),
  });
}

function asParameterRecord(value: JsonValue): Readonly<Record<string, JsonValue>> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new DomainError("BROKEN_REFERENCE", "Parâmetros de etapa devem formar um objeto.");
  }
  return value as Readonly<Record<string, JsonValue>>;
}

function validateSteps(steps: readonly RecipeStep[]): void {
  if (steps.length === 0) {
    throw new DomainError("BROKEN_REFERENCE", "A receita exige ao menos uma etapa.");
  }
  const ids = new Set<string>();
  for (const step of steps) {
    if (step.id.trim() === "" || step.toolId.trim() === "") {
      throw new DomainError("INVALID_IDENTIFIER", "Etapas da receita exigem ID e ferramenta.");
    }
    if (ids.has(step.id)) {
      throw new DomainError("DUPLICATE_ENTITY", "Uma etapa da receita possui ID duplicado.");
    }
    ids.add(step.id);
  }
  for (const [index, step] of steps.entries()) {
    const dependencies = step.dependsOn ?? (index === 0 ? [] : [steps[index - 1]?.id ?? ""]);
    for (const dependency of dependencies) {
      if (!ids.has(dependency)) {
        throw new DomainError("BROKEN_REFERENCE", "A receita referencia uma etapa inexistente.");
      }
      if (dependency === step.id) {
        throw new DomainError("BROKEN_REFERENCE", "Uma etapa não pode depender de si mesma.");
      }
    }
  }
  assertAcyclic(steps);
}

function assertAcyclic(steps: readonly RecipeStep[]): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(steps.map((step) => [step.id, step]));
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new DomainError("BROKEN_REFERENCE", "A receita contém um ciclo.");
    if (visited.has(id)) return;
    visiting.add(id);
    const step = byId.get(id);
    for (const dependency of step?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const step of steps) visit(step.id);
}

function validateParameters(
  parameters: readonly RecipeParameter[],
  steps: readonly RecipeStep[],
): void {
  const identities = new Set<string>();
  const stepIds = new Set(steps.map((step) => step.id));
  for (const parameter of parameters) {
    if (
      parameter.stepId.trim() === "" ||
      parameter.name.trim() === "" ||
      parameter.label.trim() === ""
    ) {
      throw new DomainError("INVALID_IDENTIFIER", "Parâmetros da receita exigem nome e rótulo.");
    }
    if (!stepIds.has(parameter.stepId)) {
      throw new DomainError("BROKEN_REFERENCE", "O parâmetro referencia uma etapa inexistente.");
    }
    const identity = `${parameter.stepId}:${parameter.name}`;
    if (identities.has(identity)) {
      throw new DomainError("DUPLICATE_ENTITY", "A receita possui parâmetro duplicado.");
    }
    identities.add(identity);
  }
}
