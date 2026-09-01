import { Recipe, type RecipeSnapshot } from "@nexohub/domain";

type Props = {
  readonly recipe: RecipeSnapshot;
  readonly onChange?: (recipe: RecipeSnapshot) => void;
};

export function RecipeGraphEditor({ recipe, onChange }: Props) {
  const positions = new Map(
    recipe.steps.map((step, index) => [step.id, step.position ?? { x: 24, y: 24 + index * 120 }]),
  );
  const height = Math.max(180, ...[...positions.values()].map((position) => position.y + 100));

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
    <div className="recipe-graph" style={{ minHeight: height }}>
      <svg aria-hidden="true" className="recipe-graph__edges">
        {recipe.steps.flatMap((step) =>
          (step.dependsOn ?? []).map((dependency) => {
            const from = positions.get(dependency);
            const to = positions.get(step.id);
            if (!from || !to) return null;
            return (
              <line
                key={`${dependency}-${step.id}`}
                x1={from.x + 90}
                y1={from.y + 72}
                x2={to.x + 90}
                y2={to.y}
              />
            );
          }),
        )}
      </svg>
      {recipe.steps.map((step) => {
        const position = positions.get(step.id);
        return (
          <article
            className="recipe-node"
            key={step.id}
            style={{ left: position?.x, top: position?.y }}
          >
            <span>{step.id}</span>
            <strong>{step.toolId}</strong>
            {onChange && (
              <details>
                <summary>Dependências</summary>
                {recipe.steps
                  .filter((candidate) => candidate.id !== step.id)
                  .map((candidate) => (
                    <label key={candidate.id}>
                      <input
                        type="checkbox"
                        checked={(step.dependsOn ?? []).includes(candidate.id)}
                        onChange={() => toggleDependency(step.id, candidate.id)}
                      />
                      {candidate.id}
                    </label>
                  ))}
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}
