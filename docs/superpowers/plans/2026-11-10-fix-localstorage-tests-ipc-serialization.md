# Atualização do Node.js 26, Bibliotecas e Correções de Storage e IPC — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o runtime do Node.js da versão 22 para a versão 26 no Dockerfile, Workflows de CI/CD e tipagens; atualizar bibliotecas seguras do ecossistema JS/TS; eliminar as 22 falhas de testes decorrentes do `localStorage` experimental do Node.js 22/26+; blindar a UI contra falhas em ambientes com storage restrito; e otimizar a serialização de buffers no IPC Desktop substituindo `Array.from()` por `Uint8Array`.

**Architecture:** Alinhar os ambientes de build e CI para Node.js 26 (`node:26-bookworm-slim` e `actions/setup-node@v4` com `node-version: 26`); atualizar `@types/node` para 26.x; mapear defensivamente `globalThis.localStorage` no ambiente de teste Vitest/JSDOM; assegurar resiliência em `useRecentOperations` e `App`; e transmitir buffers tipados `Uint8Array` nativamente no `TauriDocumentCorePort`.

**Tech Stack:** Node.js 26 LTS, TypeScript strict, Vitest, JSDOM, React 19, Tailwind CSS 4, Vite 8, Biome 2.6, Tauri v2 IPC, Docker, GitHub Actions.

**Spec:** Relatório de auditoria [relatorio-analise-bugs.md](file:///C:/Users/Boni%20Jr/.gemini/antigravity/brain/cdc139e3-34ea-4918-bd28-ceca63a3d436/relatorio-analise-bugs.md) e solicitação de atualização do usuário.

## Global Constraints

- Manter TypeScript estrito (`strict: true`), sem nenhum uso injustificado de `any` (AGENTS.md Regra 9).
- Não quebrar nem remover testes existentes para forçar aprovação (AGENTS.md Regra 10).
- Textos e mensagens devem permanecer no padrão pt-BR canônico (AGENTS.md Regra 13).
- Não criar commits, pull requests ou releases sem solicitação explícita (AGENTS.md Regra 12).
- Os limites documentados de arquivos e de tamanho de persistência (64 MiB) devem ser estritamente preservados.
- Preservar `pdfjs-dist` na versão homologada `6.3.289` devido ao plugin de compilação interno `pdfjs-unlock-internals` documentado no ADR pertinente.

## Review Focus

1. **Compatibilidade dos Workflows e Dockerfile com Node.js 26:** Build, CI e pipelines de segurança devem apontar para a versão 26 sem regressões em imagens Debian bookworm.
2. **Execução de testes em Node.js 26 sem flag `--localstorage-file`:** Todo teste que invoca `localStorage.clear()`, `localStorage.setItem` ou `localStorage.getItem` deve executar sem `TypeError: Cannot read properties of undefined`.
3. **Ambiente com storage desativado / bloqueado (modo anônimo estrito):** A UI (`useRecentOperations` e `App`) não pode lançar exceções não tratadas (`SecurityError`) ao tentar ler ou persistir histórico e configurações.
4. **Cache de vocabulário customizado:** Invalidação controlada de cache entre testes e alterações de palavras via `clearCustomVocabularyCache()`.
5. **IPC Desktop sem conversão pesada para array genérico:** `tauri-document-core.ts` deve enviar `Uint8Array` diretamente em vez de instanciar dezenas de milhões de números JavaScript com `Array.from()`.

---

### Task 1: Polyfill de `localStorage` no Ambiente de Teste e Invalidação de Cache em `user-vocabulary`

**Files:**
- Modify: `apps/client/src/test-setup.ts:1-20`
- Modify: `apps/client/src/platform/user-vocabulary.ts:1-79`
- Test: `apps/client/src/platform/user-vocabulary.test.ts`
- Test: `apps/client/src/platform/browser-reviewer.test.ts`

**Interfaces:**
- Produces: `clearCustomVocabularyCache(): void` em `apps/client/src/platform/user-vocabulary.ts`.
- Consumes: `window.localStorage` provido pelo JSDOM em `apps/client/src/test-setup.ts`.

- [x] **Step 1: Escrever teste de regressão para invalidação de cache e presença do polyfill em `user-vocabulary.test.ts`**

Adicionar verificação explícita de que `clearCustomVocabularyCache` redefine o cache em memória e que `localStorage.clear()` funciona no ambiente de teste sem exceção.

```ts
import { clearCustomVocabularyCache } from "./user-vocabulary";

it("limpa o cache em memória ao invocar clearCustomVocabularyCache", () => {
  addCustomWord("palavranova");
  expect(getCustomVocabulary().has("palavranova")).toBe(true);
  localStorage.clear();
  clearCustomVocabularyCache();
  expect(getCustomVocabulary().has("palavranova")).toBe(false);
});
```

- [x] **Step 2: Executar teste para verificar a falha**

Run: `pnpm --filter @nexohub/client exec vitest run src/platform/user-vocabulary.test.ts`
Expected: FAIL com `TypeError: Cannot read properties of undefined (reading 'clear')` ou `clearCustomVocabularyCache is not a function`.

- [x] **Step 3: Implementar o binding de `globalThis.localStorage` em `apps/client/src/test-setup.ts` e o método `clearCustomVocabularyCache` em `apps/client/src/platform/user-vocabulary.ts`**

Em `apps/client/src/test-setup.ts`:
```ts
if (typeof window !== "undefined" && window.localStorage) {
  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: window.localStorage,
      writable: true,
      configurable: true,
    });
  } catch {
    // Preserva caso não possa ser redefinido
  }
}
```

Em `apps/client/src/platform/user-vocabulary.ts`:
Exportar a função:
```ts
export function clearCustomVocabularyCache(): void {
  customWordsCache = null;
}
```
E garantir que acessos a `localStorage` usem `window.localStorage` com guarda defensiva.

- [x] **Step 4: Executar testes de `user-vocabulary` e `browser-reviewer` para verificar se passam**

Run: `pnpm --filter @nexohub/client exec vitest run src/platform/user-vocabulary.test.ts src/platform/browser-reviewer.test.ts`
Expected: PASS em todos os 12 testes dos dois arquivos.

---

### Task 2: Resiliência contra Storage Restrito em `useRecentOperations` e SSR em `App.tsx`

**Files:**
- Modify: `apps/client/src/features/launcher/useRecentOperations.ts:25-72`
- Test: `apps/client/src/features/launcher/useRecentOperations.test.tsx`
- Modify: `apps/client/src/App.tsx:165-205`
- Test: `apps/client/src/App.test.tsx`

**Interfaces:**
- Consumes: `window.localStorage` com tratamento de `SecurityError` e detecção de disponibilidade.
- Produces: `useRecentOperations()` e `App()` resilientes a ambientes restritivos e SSR.

- [x] **Step 1: Verificar falha atual dos testes de `App.test.tsx` e `useRecentOperations.test.tsx`**

Run: `pnpm --filter @nexohub/client exec vitest run src/App.test.tsx src/features/launcher/useRecentOperations.test.tsx`
Expected: Confirmação de status anterior.

- [x] **Step 2: Blindar `useRecentOperations.ts` contra exceções de storage**

Substituir acessos diretos de `localStorage` por verificação defensiva de `typeof window !== "undefined" && window.localStorage`.
Envolver `window.localStorage.getItem`, `window.localStorage.setItem` e `window.localStorage.removeItem` em blocos `try/catch`.

- [x] **Step 3: Blindar `App.tsx` para compatibilidade com SSR e storage seguro**

Na linha 195 de `apps/client/src/App.tsx`:
```ts
const activePath = useRef(typeof window !== "undefined" ? window.location.pathname : "/");
```
E no carregamento de `saved`:
```ts
if (typeof window !== "undefined" && window.localStorage) {
  const saved = window.localStorage.getItem("nexohub_work_zone");
  // ...
}
```

- [x] **Step 4: Executar os testes de `App.test.tsx` e `useRecentOperations.test.tsx`**

Run: `pnpm --filter @nexohub/client exec vitest run src/App.test.tsx src/features/launcher/useRecentOperations.test.tsx`
Expected: PASS em todos os 12 testes.

---

### Task 3: Otimização da Serialização de Buffers no IPC Desktop (`tauri-document-core.ts`)

**Files:**
- Modify: `apps/client/src/platform/tauri-document-core.ts:25-130`
- Modify: `apps/client/src/platform/tauri-document-core.test.ts:15-118`

**Interfaces:**
- Consumes: `packages/contracts` (`SaveLauncherOutputRequest`, `ImportDocumentBytesRequest`, `RecordLauncherResultRequest` aceitam `readonly number[] | Uint8Array`).
- Produces: `TauriDocumentCorePort` que despacha `Uint8Array` sem instanciar arrays JavaScript genéricos com `Array.from()`.

- [x] **Step 1: Ajustar teste `tauri-document-core.test.ts` para verificar envio de `Uint8Array`**

Em `apps/client/src/platform/tauri-document-core.test.ts`:
Na asserção de `save_launcher_output` (linha 29):
```ts
expect(invoke).toHaveBeenCalledWith("save_launcher_output", {
  request: { fileName: "resultado.pdf", bytes: new Uint8Array([1, 2, 3]) },
});
```
Na asserção de `record_launcher_result` (linha 116):
```ts
expect(calls.find((call) => call.command === "record_launcher_result")?.request).toMatchObject({
  projectPath: "C:/Projetos/NexoHub.nexohub",
  documentId: "document-1",
  inputArtifactIds: ["original-1", "original-2"],
  toolId: "pdf-merge",
  bytes: new Uint8Array([4, 5, 6]),
});
```

- [x] **Step 2: Executar teste para verificar falha decorrente de `Array.from`**

Run: `pnpm --filter @nexohub/client exec vitest run src/platform/tauri-document-core.test.ts`
Expected: FAIL indicando divergência entre `[1, 2, 3]` e `Uint8Array [1, 2, 3]`.

- [x] **Step 3: Atualizar `tauri-document-core.ts` para usar `new Uint8Array(...)`**

Em `apps/client/src/platform/tauri-document-core.ts`:
- Linha 31:
  `bytes: new Uint8Array(await request.blob.arrayBuffer()),`
- Linha 97:
  `bytes: new Uint8Array(await file.arrayBuffer()),`
- Linha 117:
  `bytes: new Uint8Array(await request.output.arrayBuffer()),`

- [x] **Step 4: Executar testes de `tauri-document-core.test.ts`**

Run: `pnpm --filter @nexohub/client exec vitest run src/platform/tauri-document-core.test.ts`
Expected: PASS em todos os 4 testes.

---

### Task 4: Atualização da Infraestrutura e CI/CD para Node.js 26

**Files:**
- Modify: `Dockerfile:1`
- Modify: `.github/workflows/ci.yml:19`
- Modify: `.github/workflows/main.yml:43`
- Modify: `.github/workflows/release.yml:25,48`
- Modify: `.github/workflows/security.yml:34`
- Modify: `package.json`
- Modify: `apps/client/src/polyfills.ts:2`

**Interfaces:**
- Produces: Contêiner Docker e GitHub Workflows padronizados no Node.js 26.
- Consumes: Node.js 26 LTS nos runners e ambientes de build.

- [x] **Step 1: Atualizar imagem base no `Dockerfile`**

Alterar linha 1 de `Dockerfile`:
```dockerfile
FROM node:26-bookworm-slim AS frontend-builder
```

- [x] **Step 2: Atualizar versões do Node.js nos fluxos do GitHub Actions**

Em `.github/workflows/ci.yml`, `.github/workflows/main.yml`, `.github/workflows/release.yml` e `.github/workflows/security.yml`:
Substituir:
```yaml
node-version: 22
```
Por:
```yaml
node-version: 26
```

- [x] **Step 3: Declarar engines no `package.json` raiz e documentação em `polyfills.ts`**

No `package.json` raiz:
Adicionar/atualizar:
```json
"engines": {
  "node": ">=26.0.0"
}
```
Em `apps/client/src/polyfills.ts`:
Atualizar o comentário do cabeçalho indicando compatibilidade com Node.js 26.

---

### Task 5: Atualização Controlada de Dependências do Projeto

**Files:**
- Modify: `package.json`
- Modify: `apps/client/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Pacotes atualizados do registro npm via pnpm.
- Produces: `pnpm-lock.yaml` sincronizado e verificado com as novas versões.

- [x] **Step 1: Atualizar pacotes de desenvolvimento no `package.json` raiz**

Atualizar:
- `@biomejs/biome`: `^2.6.6`
- `@playwright/test`: `^1.65.0`

- [x] **Step 2: Atualizar dependências em `apps/client/package.json`**

Atualizar:
- `@types/node`: `^26.6.6` (alinhado ao Node.js 26)
- `@base-ui/react`: `^1.9.0`
- `@tailwindcss/vite`: `^4.3.5`
- `tailwindcss`: `^4.3.5`
- `@vitejs/plugin-react`: `^6.3.0`
- `vite`: `^8.3.7`
- `@fontsource-variable/playfair-display`: `^5.3.0`
- `@fontsource-variable/plus-jakarta-sans`: `^5.3.0`
- `docx`: `^9.15.3`

*Nota:* Manter `pdfjs-dist@6.3.289` estritamente travado conforme contrato técnico de desbloqueio.

- [x] **Step 3: Instalar e regenerar lockfile**

Run: `pnpm install`
Expected: Instalação bem-sucedida e `pnpm-lock.yaml` atualizado.

---

### Task 6: Verificação Integral da Suíte de Testes e Homologação

**Files:**
- Validação completa do monorepo.

- [x] **Step 1: Executar typecheck em todos os pacotes**

Run: `pnpm typecheck`
Expected: Exit code 0, 0 erros de tipagem em 6 pacotes.

- [x] **Step 2: Executar checagem de linter e formatação com o novo Biome**

Run: `pnpm lint`
Expected: Exit code 0, sem violações.

- [x] **Step 3: Executar a suíte completa de testes do monorepo**

Run: `pnpm test`
Expected: Todos os 842 testes do `@nexohub/client` aprovados (116 arquivos passados, 0 falhas), além de domain, tool-sdk e tool-registry.

- [x] **Step 4: Executar validação de release e políticas de instalação**

Run: `pnpm release:verify`
Expected: Release 0.2.4 validado com versões íntegras.
