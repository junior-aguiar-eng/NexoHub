import type { RecipeRunProgress, RecipeSnapshot } from "@nexohub/domain";
import { Check, Circle, LoaderCircle, OctagonX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type Props = {
  readonly open: boolean;
  readonly recipe: RecipeSnapshot;
  readonly progress: RecipeRunProgress;
  readonly onCancel: () => void;
  readonly onClose: () => void;
};

export function RecipeExecutionDialog({ open, recipe, progress, onCancel, onClose }: Props) {
  if (!open) return null;
  const running = progress.status === "PENDING" || progress.status === "RUNNING";
  return (
    <div className="recipe-dialog-backdrop">
      <section
        className="recipe-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-dialog-title"
      >
        <header>
          <div>
            <span className="eyebrow">{translate("recipes.execution.eyebrow")}</span>
            <h2 id="recipe-dialog-title">{recipe.name}</h2>
          </div>
          {!running && (
            <Button variant="ghost" onClick={onClose} aria-label={translate("recipes.close")}>
              <X size={18} />
            </Button>
          )}
        </header>
        <ol className="recipe-stepper">
          {progress.steps.map((step, index) => (
            <li key={step.stepId} data-status={step.status}>
              <span className="recipe-stepper__icon" aria-hidden="true">
                {step.status === "RUNNING" && <LoaderCircle className="recipe-spinner" />}
                {step.status === "SUCCEEDED" && <Check />}
                {(step.status === "FAILED" || step.status === "CANCELLED") && <OctagonX />}
                {step.status === "PENDING" && <Circle />}
              </span>
              <div>
                <strong>
                  {index + 1}. {step.toolId}
                </strong>
                <small>{translate(statusKeys[step.status])}</small>
                {step.artifactIds.length > 0 && <code>{step.artifactIds.join(", ")}</code>}
              </div>
            </li>
          ))}
        </ol>
        <footer>
          {running ? (
            <Button variant="ghost" onClick={onCancel}>
              {translate("recipes.cancel")}
            </Button>
          ) : (
            <Button variant="primary" onClick={onClose}>
              {translate("recipes.close")}
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}

const statusKeys = {
  PENDING: "recipes.status.PENDING",
  RUNNING: "recipes.status.RUNNING",
  SUCCEEDED: "recipes.status.SUCCEEDED",
  FAILED: "recipes.status.FAILED",
  CANCELLED: "recipes.status.CANCELLED",
} as const;
