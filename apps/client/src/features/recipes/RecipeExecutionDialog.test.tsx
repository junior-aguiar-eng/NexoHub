import type { RecipeRunProgress, RecipeSnapshot } from "@nexohub/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeExecutionDialog } from "./RecipeExecutionDialog";

const recipe: RecipeSnapshot = {
  id: "test",
  name: "Fluxo visual",
  parameters: [],
  steps: [
    { id: "one", toolId: "pdf-ocr", parameters: {}, dependsOn: [] },
    { id: "two", toolId: "pdf-compress", parameters: {}, dependsOn: ["one"] },
  ],
};

const progress: RecipeRunProgress = {
  recipeId: recipe.id,
  status: "RUNNING",
  currentStepIndex: 1,
  steps: [
    { stepId: "one", toolId: "pdf-ocr", status: "SUCCEEDED", artifactIds: ["artifact-1"] },
    { stepId: "two", toolId: "pdf-compress", status: "RUNNING", artifactIds: [] },
  ],
};

describe("RecipeExecutionDialog", () => {
  it("mostra o DAG em execução e permite cancelar", () => {
    const onCancel = vi.fn();
    render(
      <RecipeExecutionDialog
        open
        recipe={recipe}
        progress={progress}
        onCancel={onCancel}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Fluxo visual" })).toBeInTheDocument();
    expect(screen.getByText("artifact-1")).toBeInTheDocument();
    expect(screen.getByText("Em execução")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar execução" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("permite inspecionar e abrir artifact produzido no Studio", () => {
    const onOpenArtifact = vi.fn();
    render(
      <RecipeExecutionDialog
        open
        recipe={recipe}
        progress={progress}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onOpenArtifact={onOpenArtifact}
      />,
    );

    const artifactButton = screen.getByRole("button", { name: "artifact-1" });
    expect(artifactButton).toBeInTheDocument();
    fireEvent.click(artifactButton);
    expect(onOpenArtifact).toHaveBeenCalledWith("artifact-1");
  });
});
