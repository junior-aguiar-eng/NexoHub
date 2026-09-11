import {
  type NexoFlowSnapshot,
  type RecipeRunProgress,
  type RecipeSnapshot,
  saveFlowAsRecipe,
} from "@nexohub/domain";
import {
  BookmarkPlus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Play,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
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
  readonly onOpenArtifact?: (artifactId: string) => void;
};

const presetDetails: Record<string, { icon: typeof Sparkles; summary: string }> = {
  "digitalizacao-limpa": {
    icon: Sparkles,
    summary: "OCR + Organização + Compressão",
  },
  "higienizacao-rapida": {
    icon: Zap,
    summary: "Alinhamento e compressão balanceada",
  },
  "extracao-editorial": {
    icon: BookOpen,
    summary: "OCR inteligente, extração e revisão",
  },
};

export function RecipePanel({ flow, onSave, onRun, onOpenArtifact }: Props) {
  const [savedName, setSavedName] = useState<string>();
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSnapshot>(recipePresets[0]);
  const graphScrollRef = useRef<HTMLDivElement | null>(null);
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
    setSelectedRecipe(recipe);
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
      setExecution((current) => {
        if (
          !current ||
          current.controller !== controller ||
          (current.progress.status !== "PENDING" && current.progress.status !== "RUNNING")
        ) {
          return current;
        }

        const status = controller.signal.aborted ? "CANCELLED" : "FAILED";
        const currentStepIndex =
          current.progress.currentStepIndex ??
          current.progress.steps.findIndex(
            (step) => step.status === "PENDING" || step.status === "RUNNING",
          );

        return {
          ...current,
          progress: {
            ...current.progress,
            status,
            currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : undefined,
            steps: current.progress.steps.map((step, index) =>
              index === currentStepIndex ? { ...step, status } : step,
            ),
          },
        };
      });
    }
  }

  return (
    <div className="recipe-panel">
      <header className="recipe-panel__header">
        <div className="recipe-panel__title-group">
          <div className="recipe-panel__badge">
            <Workflow size={14} />
            <span>NexoFlow Studio</span>
          </div>
          <h2>Pipeline Visual &amp; Receitas Automatizadas</h2>
          <p>
            Encadeie ferramentas documentais em um grafo acíclico sem mutação do original. Selecione
            uma receita pré-configurada ou personalize as dependências de cada etapa.
          </p>
        </div>
        <div className="recipe-panel__header-actions">
          <Button
            variant="secondary"
            disabled={!flow || !onSave}
            onClick={save}
            title={!flow ? "Promova um fluxo no Launcher para salvar" : undefined}
          >
            <BookmarkPlus size={16} />
            {translate("recipes.save")}
          </Button>
        </div>
      </header>

      {savedName && (
        <div className="recipe-panel__saved-banner">
          <ShieldCheck size={16} />
          <span>
            {translate("recipes.saved")}: <strong>{savedName}</strong>
          </span>
        </div>
      )}

      <section className="recipe-panel__presets-section">
        <span className="recipe-panel__section-label">{translate("recipes.presets")}</span>
        <ul className="recipe-presets" aria-label={translate("recipes.presets")}>
          {recipePresets.map((preset) => {
            const isSelected = selectedRecipe.id === preset.id;
            const details = presetDetails[preset.id] ?? {
              icon: Sparkles,
              summary: "Pipeline de automação sequencial",
            };
            const PresetIcon = details.icon;

            return (
              <li
                key={preset.id}
                className={`recipe-preset-card ${isSelected ? "recipe-preset-card--selected" : ""}`}
              >
                <div className="recipe-preset-card__header">
                  <div className="recipe-preset-card__icon-badge">
                    <PresetIcon size={16} />
                  </div>
                  <span className="recipe-preset-card__count">{preset.steps.length} etapas</span>
                </div>
                <Button
                  variant={isSelected ? "primary" : "secondary"}
                  onClick={() => {
                    setSelectedRecipe(preset);
                    if (onRun) {
                      run(preset);
                    }
                  }}
                >
                  {preset.name}
                </Button>
                <span className="recipe-preset-card__desc">{details.summary}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="recipe-panel__canvas-section">
        <div className="recipe-panel__canvas-header">
          <div className="recipe-panel__canvas-title-box">
            <span className="recipe-panel__canvas-title">Grafo de Execução da Receita</span>
            <span className="recipe-panel__canvas-hint">
              Conectores automáticos • Arraste ou configure dependências
            </span>
          </div>
          <div className="recipe-panel__scroll-controls">
            <Button
              variant="secondary"
              size="compact"
              onClick={() => graphScrollRef.current?.scrollBy({ left: -260, behavior: "smooth" })}
              title="Rolar para a esquerda"
              aria-label="Rolar para a esquerda"
              className="recipe-panel__scroll-btn"
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => graphScrollRef.current?.scrollBy({ left: 260, behavior: "smooth" })}
              title="Rolar para a direita"
              aria-label="Rolar para a direita"
              className="recipe-panel__scroll-btn"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
        <div ref={graphScrollRef} className="recipe-panel__graph-scroll-container">
          <RecipeGraphEditor
            recipe={selectedRecipe}
            onChange={(updated) => setSelectedRecipe(updated)}
          />
        </div>
      </section>

      <footer className="recipe-actions">
        <div className="recipe-actions__hint">
          <ShieldCheck size={15} style={{ color: "var(--color-primary)" }} />
          <span>
            Original protegido com hash BLAKE3 • Cada etapa produz um novo artifact derivado
          </span>
        </div>
        <Button variant="primary" disabled={!onRun} onClick={() => run(selectedRecipe)}>
          <Play size={15} style={{ marginRight: "0.25rem" }} />
          {translate("recipes.runSelected")}
        </Button>
      </footer>

      {execution && (
        <RecipeExecutionDialog
          open
          recipe={execution.recipe}
          progress={execution.progress}
          onCancel={() => execution.controller.abort()}
          onClose={() => setExecution(undefined)}
          onOpenArtifact={onOpenArtifact}
        />
      )}
    </div>
  );
}
