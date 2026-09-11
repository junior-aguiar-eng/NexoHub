import type { ArtifactId, DocumentId, RecipeSnapshot } from "@nexohub/domain";
import { describe, expect, it, vi } from "vitest";
import type { DocumentCorePort } from "@/platform/document-core";
import { runStudioRecipe } from "./studio-runner";

describe("Studio Recipe Runner", () => {
  const dummyDocumentCore: DocumentCorePort = {
    invoke: vi.fn(async (cmd, _args: unknown) => {
      if (cmd === "execute_ocr") {
        return {
          artifact: { id: "ocr-artifact-id" as ArtifactId, name: "ocr.txt" },
          operation: { id: "op-ocr" },
        } as never;
      }
      if (cmd === "organize_pdf") {
        return {
          artifact: { id: "organize-artifact-id" as ArtifactId, name: "organized.pdf" },
          operation: { id: "op-org" },
        } as never;
      }
      if (cmd === "compress_pdf") {
        return {
          artifact: { id: "compress-artifact-id" as ArtifactId, name: "compressed.pdf" },
          operation: { id: "op-comp" },
        } as never;
      }
      throw new Error(`Comando não mockado: ${cmd}`);
    }) as DocumentCorePort["invoke"],
  };

  const recipe: RecipeSnapshot = {
    id: "test-flow",
    name: "Fluxo de teste",
    parameters: [],
    steps: [
      { id: "ocr", toolId: "pdf-ocr", parameters: {}, dependsOn: [] },
      { id: "org", toolId: "pdf-organize", parameters: {}, dependsOn: ["ocr"] },
      { id: "comp", toolId: "pdf-compress", parameters: { level: 9 }, dependsOn: ["org"] },
    ],
  };

  it("executa etapas de receita sobre documentCore e encadeia artifacts", async () => {
    const onProgress = vi.fn();
    const controller = new AbortController();

    const progress = await runStudioRecipe(
      {
        documentCore: dummyDocumentCore,
        projectPath: "C:\\TestProject",
        documentId: "doc-1" as DocumentId,
        initialArtifactId: "art-initial" as ArtifactId,
      },
      recipe,
      controller.signal,
      onProgress,
    );

    expect(progress.status).toBe("SUCCEEDED");
    expect(dummyDocumentCore.invoke).toHaveBeenCalledWith(
      "execute_ocr",
      expect.objectContaining({
        projectPath: "C:\\TestProject",
        documentId: "doc-1",
        artifactId: "art-initial",
      }),
    );
    expect(dummyDocumentCore.invoke).toHaveBeenCalledWith(
      "organize_pdf",
      expect.objectContaining({
        artifactId: "ocr-artifact-id",
      }),
    );
    expect(dummyDocumentCore.invoke).toHaveBeenCalledWith(
      "compress_pdf",
      expect.objectContaining({
        artifactId: "organize-artifact-id",
        compressionLevel: 9,
      }),
    );
  });
});
