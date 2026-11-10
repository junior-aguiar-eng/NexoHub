# Correção de Memory Leak de Imagens e Código Morto — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar o vazamento de memória por retenção de Object URLs na ferramenta "Imagens para PDF" em `DedicatedToolView.tsx` e remover o código morto inalcançável de `text-translate` em `launcher-tool-runner.ts`, alinhando os tipos ao contrato `@nexohub/contracts`.

**Architecture:** Implementar gerenciamento determinístico de ciclo de vida para miniaturas geradas via `URL.createObjectURL` em `DedicatedToolView`, garantindo revogação de URLs quando imagens forem removidas ou quando a tela for desmontada. Em `launcher-tool-runner.ts`, limpar os parâmetros residuais e a tipagem de `text-translate` na persistência de resultados do launcher, garantindo aderência estrita à interface `RecordLauncherResultRequest`.

**Tech Stack:** React 19, TypeScript strict, Vitest, Testing Library React, Tauri v2 Contracts.

**Spec:** Relatório de Auditoria e Análise Profunda [relatorio-analise-bugs.md](file:///C:/Users/Boni%20Jr/.gemini/antigravity/brain/cdc139e3-34ea-4918-bd28-ceca63a3d436/relatorio-analise-bugs.md) (Itens Médios 3 e 4).

## Global Constraints

- Manter TypeScript estrito (`strict: true`), sem nenhum uso injustificado de `any` (AGENTS.md Regra 9).
- Não remover nem quebrar testes existentes (AGENTS.md Regra 10).
- Não realizar commits, PRs, merges ou deploys sem autorização expressa (AGENTS.md Regra 12).
- Mensagens e textos devem aderir ao português brasileiro canônico (AGENTS.md Regra 13).
- Respeitar o isolamento arquitetural das portas de plataforma (AGENTS.md Regra 5).

## Review Focus

1. **Revogação completa na desmontagem:** Fechar a ferramenta ou navegar para outro fluxo deve revogar todas as URLs de blob armazenadas em `fileThumbnails`.
2. **Revogação na remoção de imagem individual:** Remover uma imagem da lista de entrada de "Imagens para PDF" deve revogar apenas a URL correspondente àquele arquivo, mantendo as demais intactas.
3. **Substituição de lote de imagens:** Ao substituir o conjunto de arquivos por um novo, todas as URLs dos arquivos antigos devem ser liberadas.
4. **Alinhamento com contratos tipados:** `launcher-tool-runner.ts` deve aceitar estritamente as 9 ferramentas suportadas por `RecordLauncherResultRequest` sem coerção insegura para `"text-translate"`.
5. **Sem regressão de linter ou testes:** Biome 2.6 e a suíte completa de testes (914 testes) devem continuar passando com 0 falhas.

---

### Task 1: Gerenciamento de Ciclo de Vida e Limpeza de Object URLs em `DedicatedToolView`

**Files:**
- Modify: `apps/client/src/features/launcher/DedicatedToolView.tsx:1089-1106`
- Test: `apps/client/src/features/launcher/DedicatedToolView.test.tsx`

**Interfaces:**
- Consumes: `URL.createObjectURL(file: Blob | File): string` e `URL.revokeObjectURL(url: string): void`.
- Produces: `fileThumbnails` com liberação automática de recursos em remoção de arquivos e desmontagem do componente.

- [x] **Step 1: Escrever teste de regressão em `DedicatedToolView.test.tsx` verificando revogação de URLs de miniaturas**

Criar teste que renderiza `DedicatedToolView` com a ferramenta `images-to-pdf` e múltiplos arquivos de imagem, espionando `URL.createObjectURL` e `URL.revokeObjectURL`. Simular a remoção de um arquivo e depois a desmontagem (`unmount()`), verificando que `revokeObjectURL` é chamado para a URL do arquivo removido e para todas as URLs restantes ao desmontar.

- [x] **Step 2: Executar o teste para verificar a falha**

Run: `pnpm --filter @nexohub/client exec vitest run src/features/launcher/DedicatedToolView.test.tsx -t "revoga URLs de miniaturas"`
Expected: FAIL indicando que `URL.revokeObjectURL` não foi chamado.

- [x] **Step 3: Implementar o ciclo de vida e limpeza de URLs em `DedicatedToolView.tsx`**

1. Criar uma referência mutável `fileThumbnailsRef` sincronizada com `fileThumbnails`:
```tsx
const fileThumbnailsRef = useRef<ReadonlyMap<File, string>>(new Map());
useEffect(() => {
  fileThumbnailsRef.current = fileThumbnails;
}, [fileThumbnails]);
```
2. Adicionar limpeza na desmontagem geral do componente:
```tsx
useEffect(() => {
  return () => {
    for (const url of fileThumbnailsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
  };
}, []);
```
3. No efeito de sincronização de miniaturas da ferramenta `images-to-pdf`:
- Identificar arquivos presentes no mapa anterior que não estão mais no array `files` (ou se a ferramenta mudou).
- Invocar `URL.revokeObjectURL(url)` para cada imagem removida.
- Criar URLs apenas para novas imagens e retornar o mapa atualizado.

- [x] **Step 4: Executar os testes de `DedicatedToolView.test.tsx`**

Run: `pnpm --filter @nexohub/client exec vitest run src/features/launcher/DedicatedToolView.test.tsx`
Expected: PASS em todos os testes (incluindo o novo teste de ciclo de vida).

---

### Task 2: Remoção de Código Morto e Alinhamento com Contratos em `launcher-tool-runner.ts`

**Files:**
- Modify: `apps/client/src/platform/launcher-tool-runner.ts:1615-1638`
- Test: `apps/client/src/platform/launcher-translation-routing.test.ts`

**Interfaces:**
- Consumes: `@nexohub/contracts` (`RecordLauncherResultRequest["toolId"]`).
- Produces: `executeLauncherTool()` tipado estritamente com as 9 ferramentas suportadas pelo core na persistência.

- [x] **Step 1: Escrever teste de regressão em `launcher-translation-routing.test.ts`**

Adicionar teste garantindo que `text-translate` retorne o output diretamente sem invocar `persistLauncherResult`, e que as ferramentas suportadas recebam apenas seus respectivos parâmetros sem propriedades mortas.

- [x] **Step 2: Executar teste de `launcher-translation-routing.test.ts`**

Run: `pnpm --filter @nexohub/client exec vitest run src/platform/launcher-translation-routing.test.ts`
Expected: PASS verificado.

- [x] **Step 3: Remover o código morto em `apps/client/src/platform/launcher-tool-runner.ts`**

1. Remover o bloco morto de `toolId === "text-translate"` em `parameters`.
2. Remover `"text-translate"` da união na chamada `documentCore.persistLauncherResult`, mantendo a tipagem idêntica à de `RecordLauncherResultRequest["toolId"]`.

- [x] **Step 4: Executar testes de `launcher-tool-runner.test.ts` e `launcher-translation-routing.test.ts`**

Run: `pnpm --filter @nexohub/client exec vitest run src/platform/launcher-tool-runner.test.ts src/platform/launcher-translation-routing.test.ts`
Expected: PASS em todos os testes.

---

### Task 3: Verificação Integral da Suíte e Conformidade do Monorepo

**Files:**
- Validação completa do monorepo.

- [x] **Step 1: Executar checagem de tipos em todos os pacotes**

Run: `pnpm typecheck`
Expected: Exit code 0, 0 erros em 6 pacotes.

- [x] **Step 2: Executar checagem de linter e formatação com Biome**

Run: `pnpm lint`
Expected: Exit code 0, 457 arquivos checados sem correções pendentes.

- [x] **Step 3: Executar a suíte de testes do monorepo**

Run: `pnpm test`
Expected: Todos os testes aprovados com 0 falhas.
