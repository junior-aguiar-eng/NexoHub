import type { DocumentLineageEdge } from "@nexohub/contracts";
import type { Artifact, Document } from "@nexohub/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentHistoryModal } from "./DocumentHistoryModal";

describe("DocumentHistoryModal - Histórico & Linhagem SQLite", () => {
  const mockDoc: Document = {
    id: "doc-1" as import("@nexohub/domain").DocumentId,
    projectId: "proj-1" as import("@nexohub/domain").ProjectId,
    title: "Petição e Laudo.pdf",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const mockArtifacts: Artifact[] = [
    {
      id: "art-1" as import("@nexohub/domain").ArtifactId,
      documentId: "doc-1" as import("@nexohub/domain").DocumentId,
      kind: "ORIGINAL",
      mimeType: "application/pdf",
      hash: "blake3-original-hash-12345",
      size: 50000,
      storagePath: "artifacts/doc-1/art-1.pdf",
      createdAt: 1700000000000,
    },
    {
      id: "art-2" as import("@nexohub/domain").ArtifactId,
      documentId: "doc-1" as import("@nexohub/domain").DocumentId,
      kind: "DERIVED",
      mimeType: "application/pdf",
      hash: "blake3-derived-hash-67890",
      size: 25000,
      storagePath: "artifacts/doc-1/art-2-comprimido.pdf",
      createdAt: 1700000010000,
    },
  ];

  const mockEdges: DocumentLineageEdge[] = [
    {
      operationId: "op-1",
      toolId: "pdf-compress",
      inputArtifactId: "art-1" as import("@nexohub/domain").ArtifactId,
      outputArtifactId: "art-2" as import("@nexohub/domain").ArtifactId,
      parameters: { compressionLevel: 4 },
      createdAt: 1700000010000,
    },
  ];

  it("renderiza a lista de artefatos e operações da linhagem SQLite", () => {
    render(
      <DocumentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        artifacts={mockArtifacts}
        edges={mockEdges}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Histórico & Linhagem SQLite/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 artefato(s) registrado(s)")).toBeInTheDocument();
    expect(screen.getByText("1 operação(ões) vinculada(s)")).toBeInTheDocument();
    expect(screen.getByText("ORIGINAL IMUTÁVEL")).toBeInTheDocument();
    expect(screen.getByText("Comprimir PDF")).toBeInTheDocument();
    expect(screen.getByText("blake3-original-hash-12345")).toBeInTheDocument();
  });

  it("permite selecionar um artefato para visualização", () => {
    const onSelect = vi.fn();
    render(
      <DocumentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        document={mockDoc}
        artifacts={mockArtifacts}
        edges={mockEdges}
        selectedArtifactId="art-2"
        onSelectArtifact={onSelect}
      />,
    );

    const viewOriginalBtn = screen.getByRole("button", { name: /Visualizar/i });
    fireEvent.click(viewOriginalBtn);
    expect(onSelect).toHaveBeenCalledWith(mockArtifacts[0]);
  });
});
