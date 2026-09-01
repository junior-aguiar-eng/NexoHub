import {
  type NexoFlowSnapshot,
  type RecipeRunProgress,
  type RecipeSnapshot,
  saveFlowAsRecipe,
} from "@nexohub/domain";
import { BookmarkPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { recipePresets } from "./presets";
import { RecipeExecutionDialog } from "./RecipeExecutionDialog";
import { RecipeGraphEditor } from "./RecipeGraphEditor";

type Props = {
  readonly flow?: NexoFlowSnapshot;
  readonly onSave?: (recipe: RecipeSnapshot) => void | Promise<void>;
  readonly onRun?: (
    recipe: RecipeSnapshot,
    cancellationToken: AbortSignal,
    onProgress: (progress: RecipeRunProgress) => void,
  ) => Promise<void>;
};

export function RecipePanel({ flow, onSave, onRun }: Props) {
  const [savedName, setSavedName] = useState<string>();
  const [execution, setExecution] = useState<{
    recipe: RecipeSnapshot;
    progress: RecipeRunProgress;
    controller: AbortController;
  }>();

  async function save() {
    if (!flow || !onSave) return;
    const recipe = saveFlowAsRecipe(flow, {
      id: `recipe-${Date.now()}`,
      name: translate("recipes.saved.defaultName"),
    }).snapshot;
    await onSave(recipe);
    setSavedName(recipe.name);
  }

  async function run(recipe: RecipeSnapshot) {
    if (!onRun) return;
    const controller = new AbortController();
    const progress: RecipeRunProgress = {
      recipeId: recipe.id,
      status: "PENDING",
      steps: recipe.steps.map((step) => ({
        stepId: step.id,
        toolId: step.toolId,
        status: "PENDING",
        artifactIds: [],
      })),
    };
    setExecution({ recipe, progress, controller });
    try {
      await onRun(recipe, controller.signal, (next) =>
        setExecution((current) => (current ? { ...current, progress: next } : current)),
      );
    } catch {
      // O callback do runner já publica o estado estruturado de falha ou cancelamento.
    }
  }

  return (
    <div className="recipe-panel">
      <Button variant="ghost" disabled={!flow || !onSave} onClick={save}>
        <BookmarkPlus size={16} />
        {translate("recipes.save")}
      </Button>
      {savedName && (
        <small>
          {translate("recipes.saved")}: {savedName}
        </small>
      )}
      <ul className="recipe-presets" aria-label={translate("recipes.presets")}>
        {recipePresets.map((preset) => (
          <li key={preset.id}>
            <Button variant="ghost" disabled={!onRun} onClick={() => run(preset)}>
              {preset.name}
            </Button>
          </li>
        ))}
      </ul>
      <RecipeGraphEditor recipe={recipePresets[0]} />
      {execution && (
        <RecipeExecutionDialog
          open
          recipe={execution.recipe}
          progress={execution.progress}
          onCancel={() => execution.controller.abort()}
          onClose={() => setExecution(undefined)}
        />
      )}
    </div>
  );
}
