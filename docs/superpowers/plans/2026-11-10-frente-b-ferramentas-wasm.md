# Frente B — Aprimoramento das Ferramentas WASM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernizar as ferramentas WebAssembly do NexoHub (PDFium, JSquash, OxiPNG, MozJPEG, LibWebP), adicionando feedback de progresso percentual real via Web Workers, prévia dinâmica de tamanho estimado nos painéis de compressão e skeletons fluidos durante a renderização de páginas.

**Architecture:** Canal de mensagens estruturadas bidirecional de Web Workers (`{ type: "progress", percent, stage }`), badges táteis de estimativa volumétrica em painéis de compressão, e esqueleto de carregamento com shimmer CSS para páginas rasterizadas por PDFium.

**Tech Stack:** React 19, TypeScript strict, Web Workers, CSS Keyframes / Shimmer, Vitest, Testing Library.

**Spec:** `C:\Users\Boni Jr\.gemini\antigravity\brain\cdc139e3-34ea-4918-bd28-ceca63a3d436\proposta-revisao-profissional.md`.

## Global Constraints

- Manter 100% de compatibilidade retroativa com mensagens existentes de workers (`{ blob }` / `{ error }`).
- TypeScript estrito (`strict: true`), sem `any`.
- Textos via catálogo i18n `pt-BR`.
- Acessibilidade preservada (`aria-busy`, `role="status"`).
- Testes 100% verdes.

---

### Task 1: Progresso granular em Web Workers e na Barra de Ações

**Files:**
- Modify: `apps/client/src/platform/image-processing.ts`
- Modify: `apps/client/src/platform/image-processing.worker.ts`
- Modify: `apps/client/src/platform/image-processing.test.ts`
- Modify: `apps/client/src/features/launcher/DedicatedToolView.tsx`

- [ ] **Step 1.1: Atualizar `image-processing.ts` com callback `onProgress` e testes**
- [ ] **Step 1.2: Atualizar `image-processing.worker.ts` com emissão de eventos de progresso**
- [ ] **Step 1.3: Atualizar `DedicatedToolView.tsx` para sincronizar progresso percentual visual no botão**
- [ ] **Step 1.4: Executar testes de `image-processing.test.ts` e validar aprovação**

---

### Task 2: Prévia dinâmica de tamanho estimado nos painéis de compressão

**Files:**
- Modify: `apps/client/src/features/launcher/ImageCompressPanel.tsx`
- Modify: `apps/client/src/features/launcher/CompressPdfPanel.tsx`
- Create: `apps/client/src/features/launcher/ImageCompressPanel.test.tsx`
- Create: `apps/client/src/features/launcher/CompressPdfPanel.test.tsx`

- [ ] **Step 2.1: Escrever testes para `ImageCompressPanel.test.tsx` e `CompressPdfPanel.test.tsx`**
- [ ] **Step 2.2: Implementar estimativa dinâmica e badge tátil em `ImageCompressPanel.tsx`**
- [ ] **Step 2.3: Implementar estimativa dinâmica e badges de redução em `CompressPdfPanel.tsx`**
- [ ] **Step 2.4: Executar testes e validar aprovação**

---

### Task 3: Skeletons fluidos na renderização de miniaturas (PDFium)

**Files:**
- Modify: `apps/client/src/features/launcher/LazyPageThumbnail.tsx`
- Create: `apps/client/src/features/launcher/LazyPageThumbnail.test.tsx`
- Modify: `apps/client/src/styles.css`

- [ ] **Step 3.1: Escrever testes para `LazyPageThumbnail.test.tsx`**
- [ ] **Step 3.2: Implementar skeleton shimmer em `LazyPageThumbnail.tsx` e `styles.css`**
- [ ] **Step 3.3: Executar testes e validar aprovação**

---

### Task 4: Verificação de Qualidade Global

- [ ] **Step 4.1: Executar `pnpm typecheck`**
- [ ] **Step 4.2: Executar `pnpm lint` (`biome check .`)**
- [ ] **Step 4.3: Executar suíte de testes de launcher e platform**
- [ ] **Step 4.4: Executar `pnpm build:web`**
