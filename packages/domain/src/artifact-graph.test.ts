import { describe, expect, it } from "vitest";
import {
  type Artifact,
  ArtifactGraph,
  asArtifactId,
  asDocumentId,
  asOperationId,
  asProjectId,
  type Document,
  DomainError,
  type Operation,
  type Project,
} from "./index";

const project: Project = {
  id: asProjectId("project-1"),
  name: "Projeto",
  createdAt: 1,
  updatedAt: 1,
};

const document: Document = {
  id: asDocumentId("document-1"),
  projectId: project.id,
  title: "Documento",
  createdAt: 2,
  updatedAt: 2,
};

const original: Artifact = {
  id: asArtifactId("artifact-original"),
  documentId: document.id,
  kind: "ORIGINAL",
  mimeType: "text/plain",
  hash: "a".repeat(64),
  size: 8,
  storagePath: `blobs/aa/${"a".repeat(64)}`,
  createdAt: 3,
};

describe("ArtifactGraph", () => {
  it("acrescenta entidades sem alterar snapshots anteriores", () => {
    const empty = new ArtifactGraph(project);
    const withDocument = empty.withDocument(document);
    const withOriginal = withDocument.withArtifact(original);

    expect(empty.snapshot.documents).toHaveLength(0);
    expect(withDocument.snapshot.artifacts).toHaveLength(0);
    expect(withOriginal.artifactsFor(document.id)).toEqual([original]);
    expect(Object.isFrozen(withOriginal.snapshot.artifacts[0])).toBe(true);
  });

  it("rejeita identificadores duplicados e referências quebradas", () => {
    const graph = new ArtifactGraph(project).withDocument(document).withArtifact(original);

    expect(() => graph.withArtifact(original)).toThrow(DomainError);
    expect(() =>
      graph.withArtifact({
        ...original,
        id: asArtifactId("sem-documento"),
        documentId: asDocumentId("inexistente"),
      }),
    ).toThrow("documento inexistente");
  });

  it("registra operação sem permitir que o output substitua o input", () => {
    const derived: Artifact = {
      ...original,
      id: asArtifactId("artifact-derived"),
      kind: "DERIVED",
      hash: "b".repeat(64),
      storagePath: `blobs/bb/${"b".repeat(64)}`,
    };
    const operation: Operation = {
      id: asOperationId("operation-1"),
      toolId: "teste",
      status: "SUCCEEDED",
      parameters: {},
      createdAt: 4,
      startedAt: 4,
      finishedAt: 4,
    };
    const graph = new ArtifactGraph(project)
      .withDocument(document)
      .withArtifact(original)
      .withArtifact(derived);

    const result = graph.withOperation(operation, [original.id], [derived.id]);
    expect(result.snapshot.operationInputs).toEqual([
      { operationId: operation.id, artifactId: original.id },
    ]);
    expect(result.snapshot.operationOutputs).toEqual([
      { operationId: operation.id, artifactId: derived.id },
    ]);
    expect(() => graph.withOperation(operation, [original.id], [original.id])).toThrow(
      "não pode substituir",
    );
  });
});
