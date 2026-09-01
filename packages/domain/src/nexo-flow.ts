import { DomainError, type JsonValue } from "./model";

export type NexoFlowStatus = "DRAFT" | "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type NexoFlowStepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface NexoFlowStep {
  readonly id: string;
  readonly toolId: string;
  readonly status: NexoFlowStepStatus;
  readonly parameters: JsonValue;
  readonly dependsOn: readonly string[];
}

export interface NexoFlowSnapshot {
  readonly id: string;
  readonly status: NexoFlowStatus;
  readonly source: "QUICK" | "STUDIO";
  readonly steps: readonly NexoFlowStep[];
}

export class NexoFlow {
  readonly #snapshot: NexoFlowSnapshot;

  constructor(snapshot: NexoFlowSnapshot) {
    if (snapshot.id.trim() === "") throw new DomainError("INVALID_IDENTIFIER", "O fluxo exige ID.");
    validateSteps(snapshot.steps);
    this.#snapshot = Object.freeze({
      ...snapshot,
      steps: Object.freeze(
        snapshot.steps.map((step) =>
          Object.freeze({ ...step, dependsOn: Object.freeze([...step.dependsOn]) }),
        ),
      ),
    });
  }

  get snapshot(): NexoFlowSnapshot {
    return this.#snapshot;
  }

  withStep(step: NexoFlowStep): NexoFlow {
    return new NexoFlow({ ...this.#snapshot, steps: [...this.#snapshot.steps, step] });
  }

  withStatus(status: NexoFlowStatus): NexoFlow {
    return new NexoFlow({ ...this.#snapshot, status });
  }
}

export function promoteQuickTool(toolId: string): NexoFlow {
  if (toolId.trim() === "") {
    throw new DomainError("INVALID_IDENTIFIER", "A promoção exige uma ferramenta.");
  }
  return new NexoFlow({
    id: `quick:${toolId}`,
    source: "QUICK",
    status: "DRAFT",
    steps: [
      {
        id: "step-1",
        toolId,
        status: "PENDING",
        parameters: {},
        dependsOn: [],
      },
    ],
  });
}

function validateSteps(steps: readonly NexoFlowStep[]): void {
  const seen = new Set<string>();
  for (const step of steps) {
    if (step.id.trim() === "" || step.toolId.trim() === "") {
      throw new DomainError("INVALID_IDENTIFIER", "Etapas exigem ID e ferramenta.");
    }
    if (seen.has(step.id)) {
      throw new DomainError("DUPLICATE_ENTITY", "Uma etapa do fluxo possui ID duplicado.");
    }
    for (const dependency of step.dependsOn) {
      if (!seen.has(dependency)) {
        throw new DomainError(
          "BROKEN_REFERENCE",
          "A etapa depende de uma etapa anterior inexistente.",
        );
      }
    }
    seen.add(step.id);
  }
}
