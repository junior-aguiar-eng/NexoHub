import {
  type Artifact,
  type ArtifactId,
  type Document,
  type DocumentId,
  DomainError,
  type Operation,
  type OperationInput,
  type OperationOutput,
  type Project,
} from "./model";

export interface ArtifactGraphSnapshot {
  readonly project: Project;
  readonly documents: readonly Document[];
  readonly artifacts: readonly Artifact[];
  readonly operations: readonly Operation[];
  readonly operationInputs: readonly OperationInput[];
  readonly operationOutputs: readonly OperationOutput[];
}

/**
 * Projeção imutável do núcleo do Document Artifact Graph.
 * Cada método retorna um novo grafo e nunca substitui artifacts existentes.
 */
export class ArtifactGraph {
  readonly #snapshot: ArtifactGraphSnapshot;

  constructor(project: Project, snapshot?: Omit<ArtifactGraphSnapshot, "project">) {
    this.#snapshot = Object.freeze({
      project: Object.freeze({ ...project }),
      documents: freezeItems(snapshot?.documents ?? []),
      artifacts: freezeItems(snapshot?.artifacts ?? []),
      operations: freezeItems(snapshot?.operations ?? []),
      operationInputs: freezeItems(snapshot?.operationInputs ?? []),
      operationOutputs: freezeItems(snapshot?.operationOutputs ?? []),
    });
  }

  get snapshot(): ArtifactGraphSnapshot {
    return this.#snapshot;
  }

  withDocument(document: Document): ArtifactGraph {
    if (document.projectId !== this.#snapshot.project.id) {
      throw new DomainError("BROKEN_REFERENCE", "O documento não pertence ao projeto.");
    }
    assertUnique(this.#snapshot.documents, document.id, "documento");
    return this.copy({ documents: [...this.#snapshot.documents, document] });
  }

  withArtifact(artifact: Artifact): ArtifactGraph {
    if (!this.hasDocument(artifact.documentId)) {
      throw new DomainError("BROKEN_REFERENCE", "O artifact referencia um documento inexistente.");
    }
    assertUnique(this.#snapshot.artifacts, artifact.id, "artifact");
    return this.copy({ artifacts: [...this.#snapshot.artifacts, artifact] });
  }

  withOperation(
    operation: Operation,
    inputs: readonly ArtifactId[],
    outputs: readonly ArtifactId[],
  ): ArtifactGraph {
    assertUnique(this.#snapshot.operations, operation.id, "operação");
    for (const artifactId of [...inputs, ...outputs]) {
      if (!this.hasArtifact(artifactId)) {
        throw new DomainError("BROKEN_REFERENCE", "A operação referencia um artifact inexistente.");
      }
    }
    if (outputs.some((artifactId) => inputs.includes(artifactId))) {
      throw new DomainError(
        "BROKEN_REFERENCE",
        "Uma operação não pode substituir seu artifact de entrada.",
      );
    }

    const operationInputs = inputs.map((artifactId) => ({
      operationId: operation.id,
      artifactId,
    }));
    const operationOutputs = outputs.map((artifactId) => ({
      operationId: operation.id,
      artifactId,
    }));
    return this.copy({
      operations: [...this.#snapshot.operations, operation],
      operationInputs: [...this.#snapshot.operationInputs, ...operationInputs],
      operationOutputs: [...this.#snapshot.operationOutputs, ...operationOutputs],
    });
  }

  artifactsFor(documentId: DocumentId): readonly Artifact[] {
    return this.#snapshot.artifacts.filter((artifact) => artifact.documentId === documentId);
  }

  private hasDocument(documentId: DocumentId): boolean {
    return this.#snapshot.documents.some((document) => document.id === documentId);
  }

  private hasArtifact(artifactId: ArtifactId): boolean {
    return this.#snapshot.artifacts.some((artifact) => artifact.id === artifactId);
  }

  private copy(changes: Partial<Omit<ArtifactGraphSnapshot, "project">>): ArtifactGraph {
    return new ArtifactGraph(this.#snapshot.project, {
      documents: changes.documents ?? this.#snapshot.documents,
      artifacts: changes.artifacts ?? this.#snapshot.artifacts,
      operations: changes.operations ?? this.#snapshot.operations,
      operationInputs: changes.operationInputs ?? this.#snapshot.operationInputs,
      operationOutputs: changes.operationOutputs ?? this.#snapshot.operationOutputs,
    });
  }
}

function freezeItems<Item extends object>(items: readonly Item[]): readonly Item[] {
  return Object.freeze(items.map((item) => Object.freeze({ ...item })));
}

function assertUnique<Item extends { readonly id: string }>(
  items: readonly Item[],
  id: string,
  label: string,
): void {
  if (items.some((item) => item.id === id)) {
    throw new DomainError("DUPLICATE_ENTITY", `O identificador de ${label} já existe no grafo.`);
  }
}
