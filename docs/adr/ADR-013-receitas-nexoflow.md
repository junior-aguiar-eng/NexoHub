# ADR-013 — Receitas NexoFlow como grafos acíclicos visuais

## Contexto

Sequências recorrentes do NexoFlow precisam ser reutilizadas, ramificadas e inspecionadas em uma
superfície visual sem introduzir uma linguagem de programação embutida.

## Decisão

Uma Recipe é um snapshot declarativo, imutável e nomeado de um grafo acíclico. Cada `RecipeStep`
referencia uma ferramenta pelo identificador canônico do Tool Registry e mantém somente seus
parâmetros, posição visual e dependências. `RecipeParameter` expõe um parâmetro editável de uma
etapa específica.

O `RecipeRunner` executa as etapas em ordem topológica pelo `ToolRunner`. Antes de iniciar, valida todas
as ferramentas, capacidades e executores. A saída de cada etapa é a entrada da seguinte; cada
resultado permanece disponível para inspeção. Progresso, falha e cancelamento são estados explícitos.

O executor de cada ferramenta continua responsável por persistir sua operação e seus artifacts no
Operation Graph. A receita não acessa filesystem, SQLite, shell ou sidecars e não contorna o Tool
Registry nem a Capability Layer.

## Consequências

- pipelines lineares continuam representáveis como o caso simples do DAG;
- ciclos são rejeitados e não há loops, expressões ou linguagem de script;
- uma etapa indisponível bloqueia toda a receita antes da primeira operação;
- falha intermediária conserva os artifacts já produzidos e impede etapas posteriores;
- cancelamento usa o mesmo `AbortSignal` das ferramentas;
- editar ou executar uma receita não altera originals.
