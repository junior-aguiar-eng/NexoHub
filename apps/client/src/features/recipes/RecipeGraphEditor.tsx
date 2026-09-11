import { Recipe, type RecipeSnapshot } from "@nexohub/domain";
import {
  CheckSquare2,
  Cpu,
  FileSearch,
  GitFork,
  Minimize2,
  MoveVertical,
  Plus,
  ScanText,
} from "lucide-react";
import { translate } from "@/i18n";
import { getFriendlyToolName } from "./tool-names";

type Props = {
  readonly recipe: RecipeSnapshot;
  readonly onChange?: (recipe: RecipeSnapshot) => void;
};

function getToolIcon(toolId: string) {
  if (toolId.includes("ocr")) return <ScanText size={16} aria-hidden="true" />;
  if (toolId.includes("organize")) return <MoveVertical size={16} aria-hidden="true" />;
  if (toolId.includes("compress")) return <Minimize2 size={16} aria-hidden="true" />;
  if (toolId.includes("extract")) return <FileSearch size={16} aria-hidden="true" />;
  if (toolId.includes("review")) return <CheckSquare2 size={16} aria-hidden="true" />;
  return <Cpu size={16} aria-hidden="true" />;
}

function getCategoryBadge(toolId: string) {
  if (toolId.includes("ocr")) return { label: "OCR & Texto", className: "badge-ocr" };
  if (toolId.includes("organize")) return { label: "Estrutura", className: "badge-organize" };
  if (toolId.includes("compress")) return { label: "Otimização", className: "badge-compress" };
  if (toolId.includes("extract")) return { label: "Inteligência", className: "badge-extract" };
  if (toolId.includes("review")) return { label: "Revisão", className: "badge-review" };
  return { label: "Nativo", className: "badge-default" };
}

export function RecipeGraphEditor({ recipe, onChange }: Props) {
  const NODE_WIDTH = 210;
  const NODE_HEIGHT = 135;

  const positions = new Map(
    recipe.steps.map((step, index) => [step.id, step.position ?? { x: 20 + index * 235, y: 24 }]),
  );

  const minWidth = Math.max(700, ...[...positions.values()].map((p) => p.x + NODE_WIDTH + 24));
  const minHeight = Math.max(200, ...[...positions.values()].map((p) => p.y + NODE_HEIGHT + 36));

  function toggleDependency(stepId: string, dependencyId: string) {
    if (!onChange || stepId === dependencyId) return;
    try {
      onChange(
        new Recipe({
          ...recipe,
          steps: recipe.steps.map((step) => {
            if (step.id !== stepId) return step;
            const dependencies = step.dependsOn ?? [];
            return {
              ...step,
              dependsOn: dependencies.includes(dependencyId)
                ? dependencies.filter((id) => id !== dependencyId)
                : [...dependencies, dependencyId],
            };
          }),
        }).snapshot,
      );
    } catch {
      // A conexão é ignorada quando introduzir ciclo ou referência inválida.
    }
  }

  return (
    <div
      className="recipe-graph"
      style={{
        minHeight,
        minWidth,
      }}
    >
      <svg aria-hidden="true" className="recipe-graph__edges" width="100%" height="100%">
        <defs>
          <marker
            id="recipe-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--color-primary, #15803d)" />
          </marker>
        </defs>
        {recipe.steps.flatMap((step) =>
          (step.dependsOn ?? []).map((dependency) => {
            const from = positions.get(dependency);
            const to = positions.get(step.id);
            if (!from || !to) return null;

            const isHorizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);

            const x1 = isHorizontal ? from.x + NODE_WIDTH : from.x + NODE_WIDTH / 2;
            const y1 = isHorizontal ? from.y + 46 : from.y + NODE_HEIGHT;
            const x2 = isHorizontal ? to.x - 2 : to.x + NODE_WIDTH / 2;
            const y2 = isHorizontal ? to.y + 46 : to.y - 2;

            return (
              <line
                key={`${dependency}-${step.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                markerEnd="url(#recipe-arrow)"
              />
            );
          }),
        )}
      </svg>
      {recipe.steps.map((step, index) => {
        const position = positions.get(step.id);
        const friendlyName = getFriendlyToolName(step.toolId);
        const icon = getToolIcon(step.toolId);
        const badge = getCategoryBadge(step.toolId);
        const deps = step.dependsOn ?? [];

        return (
          <div key={step.id} style={{ display: "contents" }}>
            <article
              className="recipe-node"
              style={{
                left: position?.x,
                top: position?.y,
                width: NODE_WIDTH,
              }}
            >
              <div className="recipe-node__header">
                <span className={`recipe-node__badge ${badge.className}`}>{badge.label}</span>
                <span className="recipe-node__step-num">Etapa {index + 1}</span>
              </div>

              <div className="recipe-node__body">
                <div className="recipe-node__title-row">
                  <span className="recipe-node__icon">{icon}</span>
                  <strong title={step.toolId}>{friendlyName}</strong>
                </div>
                <div className="recipe-node__sub">
                  <span className="recipe-node__tool-id">{step.id}</span>
                  <span className="recipe-node__privacy-tag">Nativo • Offline</span>
                </div>
              </div>

              {onChange && (
                <details className="recipe-node__deps">
                  <summary>
                    <GitFork size={12} aria-hidden="true" />
                    <span>{translate("recipes.dependencies")}</span>
                    {deps.length > 0 && (
                      <span className="recipe-node__dep-counter">{deps.length}</span>
                    )}
                  </summary>
                  <div className="recipe-node__deps-list">
                    {recipe.steps
                      .filter((candidate) => candidate.id !== step.id)
                      .map((candidate) => (
                        <label key={candidate.id} className="recipe-node__dep-label">
                          <input
                            type="checkbox"
                            checked={deps.includes(candidate.id)}
                            onChange={() => toggleDependency(step.id, candidate.id)}
                          />
                          <span>{candidate.id}</span>
                        </label>
                      ))}
                  </div>
                </details>
              )}
            </article>

            {index < recipe.steps.length - 1 && (
              <div
                className="recipe-step-connector"
                style={{
                  left: (position?.x ?? 0) + NODE_WIDTH + 5,
                  top: (position?.y ?? 0) + 40,
                }}
              >
                <div
                  className="recipe-step-connector__btn"
                  title="Conector de fluxo contínuo"
                  aria-hidden="true"
                >
                  <Plus size={12} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
