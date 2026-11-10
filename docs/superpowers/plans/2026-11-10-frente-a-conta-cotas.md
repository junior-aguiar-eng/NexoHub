# Frente A — Área da Conta e Gestão de Cotas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o painel visual de cotas mensais (OCR, Tradução, Office) e o seletor de preferência de processamento (*Local-First* vs *Híbrido*) na área da conta (`CloudAccountPage.tsx`), com persistência resiliente, i18n canônico em pt-BR e cobertura de testes rigorosa no Vitest.

**Architecture:** Módulo independente de preferências do usuário com resiliência a restrições de storage (`processing-preference.ts`), subcomponente desacoplado de cotas (`CloudQuotaDashboard.tsx`), controles acessíveis de preferência e integração em `CloudAccountPage.tsx` consumindo `account.usage()`.

**Tech Stack:** React 19, TypeScript strict, Lucide React, Vitest, Testing Library, Tailwind CSS / NexoHub Design System.

**Spec:** `C:\Users\Boni Jr\.gemini\antigravity\brain\cdc139e3-34ea-4918-bd28-ceca63a3d436\proposta-revisao-profissional.md` e `docs/adr/ADR-020-nuvem-opcional-cotas.md`.

## Global Constraints

- Preservar local-first (ADR-001): modo local padrão, sem login obrigatório e sem fallback automático que envie arquivos sem confirmação explícita.
- TypeScript estrito (`strict: true`), sem `any`.
- Textos de interface estritamente via catálogo de internacionalização `pt-BR` em `apps/client/src/i18n/pt-BR.ts`.
- Resiliência contra ambientes com `localStorage` indisponível (navegação anônima / `SecurityError`).
- Formatação de datas e números via padrões nativos do navegador (`Intl.DateTimeFormat("pt-BR")` e `toLocaleString("pt-BR")`).
- Não mascarar ou remover testes existentes; manter suite 100% verde.

## Review Focus

1. `account.usage()` rejeita com erro (ex: `AUTH_UNAVAILABLE` ou rede): a página não deve quebrar nem travar; deve exibir a conta normalmente com aviso amigável de cotas temporariamente indisponíveis.
2. Usuário sem cotas ativas (`usage` nulo ou piloto fechado): deve exibir aviso informativo claro sem jargões de erro técnico.
3. `localStorage` lança `SecurityError`: a troca de preferência de processamento deve funcionar na sessão em memória sem propagar exceção não capturada.
4. Divisão por zero no cálculo de percentual de cotas (`used + remaining === 0`): deve resultar em 0% sem `NaN`.
5. Acessibilidade (`aria-label`, `role="radiogroup"`, `role="progressbar"`): leitor de tela deve anunciar valores atuais de cota e opção selecionada.

---

### Task 1: Preferências de Processamento (`processing-preference.ts`)

**Files:**
- Create: `apps/client/src/features/cloud/processing-preference.ts`
- Test: `apps/client/src/features/cloud/processing-preference.test.ts`

- [ ] **Step 1.1: Escrever teste falho para `processing-preference.ts`**
  Cobrir:
  - Leitura padrão retornando `"local-first"` quando storage vazio.
  - Gravação de `"hybrid"` e leitura subsequente.
  - Resiliência quando `window.localStorage` lança erro (modo anônimo).
  - Hook `useProcessingPreference` sincronizando estado React.

- [ ] **Step 1.2: Executar teste para confirmar falha**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/processing-preference.test.ts`

- [ ] **Step 1.3: Implementar `processing-preference.ts`**
  Exportar:
  - `type ProcessingPreference = "local-first" | "hybrid"`
  - `getProcessingPreference(): ProcessingPreference`
  - `setProcessingPreference(preference: ProcessingPreference): void`
  - `useProcessingPreference(): [ProcessingPreference, (pref: ProcessingPreference) => void]`

- [ ] **Step 1.4: Executar teste e validar sucesso**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/processing-preference.test.ts`

---

### Task 2: Chaves de Internacionalização em `pt-BR.ts`

**Files:**
- Modify: `apps/client/src/i18n/pt-BR.ts`

- [ ] **Step 2.1: Adicionar chaves para cotas e preferências**
  Adicionar em `ptBR`:
  - `account.page.quotasTitle`: "Cotas mensais gratuitas"
  - `account.page.quotasSubtitle`: "Saldo disponibilizado mensalmente para tarefas opcionais em nuvem."
  - `account.page.ocrQuota`: "OCR na nuvem"
  - `account.page.translationQuota`: "Tradução"
  - `account.page.officeQuota`: "Documentos Office"
  - `account.page.budgetQuota`: "Saldo do piloto"
  - `account.page.quotasUnavailable`: "Informações de cotas temporariamente indisponíveis."
  - `account.page.quotasPilot`: "Processamento em nuvem em preparação para o piloto."
  - `account.page.renewsOn`: "Renovação em {date}"
  - `account.page.preferencesTitle`: "Preferência de processamento"
  - `account.page.prefLocal`: "Estritamente Local (Recomendado)"
  - `account.page.prefLocalDesc`: "Todo processamento roda no seu navegador via WebAssembly. Seus arquivos nunca saem do dispositivo."
  - `account.page.prefHybrid`: "Híbrido Inteligente"
  - `account.page.prefHybridDesc`: "Sugere aceleração na nuvem para arquivos pesados, sempre solicitando sua confirmação antes de qualquer envio."

---

### Task 3: Componente `CloudQuotaDashboard.tsx`

**Files:**
- Create: `apps/client/src/features/cloud/CloudQuotaDashboard.tsx`
- Test: `apps/client/src/features/cloud/CloudQuotaDashboard.test.tsx`

- [ ] **Step 3.1: Escrever teste falho para `CloudQuotaDashboard.test.tsx`**
  Cobrir:
  - Renderização das 3 barras de cotas (OCR páginas, Tradução caracteres, Office arquivos).
  - Cálculo percentual correto e atributos de acessibilidade `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.
  - Exibição da data de renovação formatada.
  - Exibição de estado quando `usage` é nulo ou indisponível.

- [ ] **Step 3.2: Executar teste para confirmar falha**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/CloudQuotaDashboard.test.tsx`

- [ ] **Step 3.3: Implementar `CloudQuotaDashboard.tsx`**
  - Cartões com visual moderno, sombras suaves e barras de progresso táteis com classes semânticas.
  - Formatação defensiva de números (`toLocaleString("pt-BR")`) e data (`toLocaleDateString("pt-BR")`).
  - Badges de status para saldo reservado vs restante.

- [ ] **Step 3.4: Executar teste e validar sucesso**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/CloudQuotaDashboard.test.tsx`

---

### Task 4: Componente `ProcessingPreferenceControl.tsx`

**Files:**
- Create: `apps/client/src/features/cloud/ProcessingPreferenceControl.tsx`
- Test: `apps/client/src/features/cloud/ProcessingPreferenceControl.test.tsx`

- [ ] **Step 4.1: Escrever teste falho para `ProcessingPreferenceControl.test.tsx`**
  Cobrir:
  - Exibição dos dois modos: Local-First e Híbrido.
  - Seleção e disparo de mudança com acessibilidade (`role="radiogroup"` ou radio buttons).
  - Persistência refletida no teste.

- [ ] **Step 4.2: Executar teste para confirmar falha**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/ProcessingPreferenceControl.test.tsx`

- [ ] **Step 4.3: Implementar `ProcessingPreferenceControl.tsx`**
  - Cartões interativos clicáveis com radio visual, títulos em destaque e descrições explicativas.

- [ ] **Step 4.4: Executar teste e validar sucesso**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/ProcessingPreferenceControl.test.tsx`

---

### Task 5: Integração Completa em `CloudAccountPage.tsx` e Estilização

**Files:**
- Modify: `apps/client/src/features/cloud/CloudAccountPage.tsx`
- Modify: `apps/client/src/features/cloud/CloudAccountPage.test.tsx`
- Modify: `apps/client/src/styles.css`

- [ ] **Step 5.1: Escrever testes unitários em `CloudAccountPage.test.tsx`**
  Cobrir:
  - Chamada a `account.usage()` quando logado e exibição do dashboard de cotas.
  - Exibição e interação com o seletor de preferência de processamento.
  - Preservação dos testes existentes de saída de dispositivo, cópia de identificador e privacidade.

- [ ] **Step 5.2: Executar testes de `CloudAccountPage` para validar novas falhas esperadas**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/CloudAccountPage.test.tsx`

- [ ] **Step 5.3: Integrar em `CloudAccountPage.tsx` e `styles.css`**
  - Carregar `usage` no `useEffect` via `account.usage().catch(() => null)`.
  - Inserir `<CloudQuotaDashboard usage={usage} processingEnabled={processingEnabled} />`.
  - Inserir `<ProcessingPreferenceControl />`.
  - Adicionar regras de CSS modernas para os cards de cotas, barras de progresso com gradiente e seletores táteis.

- [ ] **Step 5.4: Executar testes de `CloudAccountPage` e validar passagem**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/CloudAccountPage.test.tsx`

---

### Task 6: Verificação de Qualidade Global e Regressão

**Files:**
- Workspace inteiro

- [ ] **Step 6.1: Executar typecheck estrito**
  Executar: `pnpm typecheck`

- [ ] **Step 6.2: Executar testes da feature cloud**
  Executar: `pnpm --filter @nexohub/client test src/features/cloud/`

- [ ] **Step 6.3: Executar build web para assegurar ausência de quebras de bundle**
  Executar: `pnpm build:web`
