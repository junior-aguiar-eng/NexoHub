# Plano de Implementação — Ergonomia, Encadeamento e Superioridade Competitiva (REA 6.8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o primeiro salto evolutivo do NexoHub baseado na engenharia reversa do iLovePDF (REA 6.8), dotando a plataforma de Dropzone Global inteligente, encadeamento contínuo de ferramentas na tela de sucesso sem re-upload, micro-interações táteis de rotação e exclusão em miniaturas de páginas, e presets de numeração forense (PJe/Tribunais).

**Architecture:** A aplicação receberá um componente de detecção global de arrastar e soltar (`GlobalDropzone`), integrado ao roteador de ferramentas do launcher. A tela de sucesso de `DedicatedToolView` receberá a `ToolChainingBar` para passar o `outputBlob` diretamente para uma nova ferramenta em memória. O painel `PdfPageGridPanel` passará a fornecer ações rápidas por página, e o gerador de numeração de páginas incluirá o padrão forense de folhas processuais.

**Tech Stack:** React 19, TypeScript strict, Lucide Icons, PDF.js, PDF-lib, Vitest, Biome.

**Spec:** `C:\Users\Boni Jr\.gemini\antigravity\brain\cdc139e3-34ea-4918-bd28-ceca63a3d436\relatorio-engenharia-reversa-ilovepdf-nexohub.md`.

## Global Constraints

- Manter compatibilidade com React 19, TypeScript strict, sem `any`.
- Português brasileiro (`pt-BR`) como catálogo canônico exclusivo via `translate()`.
- O original importado é estritamente imutável; operações documentais produzem novos artifacts em memória.
- Zero envio não consentido para a rede: todo processamento deste pacote roda estritamente no cliente (*Local-First*).
- Preservar testes existentes e adicionar testes unitários com cobertura para cada novo componente.

## Review Focus

1. Arrastar arquivos sobre elementos filhos sem disparar múltiplos eventos de dragleave flickering.
2. Encadeamento de ferramentas transferindo o arquivo gerado sem vazamento de memória de Object URLs.
3. Rotação individual de miniatura no grid sem perder o estado de reordenação prévia das páginas.
4. Numeração forense ("Fls. X de Y") respeitando margens de corte e rotação da página sem sobrepor o texto existente.
5. Acessibilidade total via teclado (Escape para fechar modal de dropzone e foco semântico nos botões de ação rápida).

---

### Task 1: Componente Dropzone Global Fullscreen (`GlobalDropzone.tsx`)

**Files:**
- Create: `apps/client/src/features/launcher/GlobalDropzone.tsx`
- Create: `apps/client/src/features/launcher/GlobalDropzone.test.tsx`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/i18n/pt-BR.ts`
- Modify: `apps/client/src/styles.css`

**Interfaces:**
- Produces:
  ```ts
  export interface GlobalDropzoneProps {
    onSelectToolWithFiles: (toolId: string, files: File[]) => void;
  }
  ```

- [ ] **Step 1: Escrever testes unitários em `GlobalDropzone.test.tsx`**
  - Testar overlay ativando quando evento `dragenter` ocorre na janela com arquivos.
  - Testar overlay desativando com `dragleave` ou tecla Escape.
  - Testar soltar múltiplos PDFs sugerindo e abrindo "Juntar PDF" (`pdf-merge`).
  - Testar soltar um PDF exibindo diálogo de escolha rápida de ferramenta.
  - Testar soltar imagens sugerindo "Imagens para PDF" (`images-to-pdf`).

- [ ] **Step 2: Executar testes para confirmar falha**
  - Run: `pnpm --filter @nexohub/client test src/features/launcher/GlobalDropzone.test.tsx`
  - Expected: FAIL com arquivo ou componente não encontrado.

- [ ] **Step 3: Adicionar chaves i18n em `apps/client/src/i18n/pt-BR.ts`**
  - Chaves: `globalDrop.overlayTitle`, `globalDrop.overlaySubtitle`, `globalDrop.chooseAction`, `globalDrop.quickMerge`, `globalDrop.quickCompress`, `globalDrop.quickOcr`, `globalDrop.quickImagesToPdf`.

- [ ] **Step 4: Implementar `GlobalDropzone.tsx` e estilos em `styles.css`**
  - Capturar eventos globais de drag & drop na janela com contador de nós para evitar flickering.
  - Exibir overlay translúcido com animação suave e ícone pulsante de upload.
  - Se apenas 1 PDF for solto, exibir menu suspenso ou cartões rápidos de ação recomendada.

- [ ] **Step 5: Integrar `GlobalDropzone` no `App.tsx`**
  - Conectar ao handler existente de abertura de ferramentas (`handleOpenTool(toolId, files)`).

- [ ] **Step 6: Executar testes para confirmar aprovação**
  - Run: `pnpm --filter @nexohub/client test src/features/launcher/GlobalDropzone.test.tsx`
  - Expected: PASS.

---

### Task 2: Encadeamento Contínuo de Ferramentas na Tela de Sucesso (`ToolChainingBar.tsx`)

**Files:**
- Create: `apps/client/src/features/launcher/ToolChainingBar.tsx`
- Create: `apps/client/src/features/launcher/ToolChainingBar.test.tsx`
- Modify: `apps/client/src/features/launcher/DedicatedToolView.tsx`
- Modify: `apps/client/src/i18n/pt-BR.ts`
- Modify: `apps/client/src/styles.css`

**Interfaces:**
- Produces:
  ```ts
  export interface ToolChainingBarProps {
    currentToolId: string;
    outputBlob: Blob;
    outputFileName: string;
    onChainToTool: (targetToolId: string, file: File) => void;
  }
  ```

- [ ] **Step 1: Escrever testes unitários em `ToolChainingBar.test.tsx`**
  - Verificar sugestão de "Comprimir PDF", "Proteger PDF" e "Numerar Páginas" após operação de PDF (ex: `pdf-merge`).
  - Verificar sugestão de "Converter para PDF" após operação de imagem (ex: `image-compress`).
  - Verificar que o clique em uma ação cria um `File` com o mesmo nome e conteúdo do `outputBlob` e chama `onChainToTool`.

- [ ] **Step 2: Executar testes para confirmar falha**
  - Run: `pnpm --filter @nexohub/client test src/features/launcher/ToolChainingBar.test.tsx`
  - Expected: FAIL.

- [ ] **Step 3: Adicionar chaves i18n em `pt-BR.ts`**
  - Chaves: `chaining.title`, `chaining.subtitle`, `chaining.compressPdf`, `chaining.protectPdf`, `chaining.pageNumbers`, `chaining.ocrPdf`, `chaining.imagesToPdf`.

- [ ] **Step 4: Implementar `ToolChainingBar.tsx` e estilos em `styles.css`**
  - Mapear ferramentas de destino ideais por categoria e tipo MIME do arquivo resultante.
  - Renderizar botões táteis elegantes com ícones representativos.

- [ ] **Step 5: Integrar `ToolChainingBar` no estágio de sucesso de `DedicatedToolView.tsx`**
  - Ao clicar no botão de encadeamento, redefinir o estado da ferramenta para o novo `toolId` e injetar o `File` derivado do `outputBlob`.

- [ ] **Step 6: Executar testes para confirmar aprovação**
  - Run: `pnpm --filter @nexohub/client test src/features/launcher/ToolChainingBar.test.tsx src/features/launcher/DedicatedToolView.test.tsx`
  - Expected: PASS.

---

### Task 3: Ações Rápidas em Miniaturas de Página (`PdfPageGridPanel.tsx`)

**Files:**
- Modify: `apps/client/src/features/launcher/PdfPageGridPanel.tsx`
- Modify: `apps/client/src/features/launcher/PdfPageGridPanel.test.tsx`
- Modify: `apps/client/src/i18n/pt-BR.ts`
- Modify: `apps/client/src/styles.css`

**Interfaces:**
- Produces:
  ```ts
  onRotatePage?: (pageIndex: number) => void;
  onDeletePage?: (pageIndex: number) => void;
  ```

- [ ] **Step 1: Escrever testes unitários adicionais em `PdfPageGridPanel.test.tsx`**
  - Testar botão de rotação rápida acionando callback com o índice correto.
  - Testar botão de exclusão rápida removendo a miniatura correspondente.
  - Testar navegação acessível por teclado com botões focáveis no card da página.

- [ ] **Step 2: Executar testes para confirmar falha**
  - Run: `pnpm --filter @nexohub/client test src/features/launcher/PdfPageGridPanel.test.tsx`
  - Expected: FAIL pelas ações ainda não implementadas.

- [ ] **Step 3: Implementar botões de hover e atalhos táteis em `PdfPageGridPanel.tsx`**
  - Overlay de ação rápida sobre a miniatura com `RotateCw` e `Trash2`.
  - Tratamento de foco para teclado.

- [ ] **Step 4: Executar testes para confirmar aprovação**
  - Run: `pnpm --filter @nexohub/client test src/features/launcher/PdfPageGridPanel.test.tsx`
  - Expected: PASS.

---

### Task 4: Presets de Numeração Forense PJe/Tribunais (`PageNumbersPdfPanel.tsx` e `pdf-engine.ts`)

**Files:**
- Modify: `apps/client/src/platform/pdf-engine.ts`
- Modify: `apps/client/src/features/launcher/PageNumbersPdfPanel.tsx`
- Modify: `apps/client/src/features/launcher/PageNumbersPdfPanel.test.tsx`
- Modify: `apps/client/src/i18n/pt-BR.ts`

**Interfaces:**
- Updates `PageNumberFormat`:
  ```ts
  export type PageNumberFormat = "pageXofY" | "xSlashY" | "onlyX" | "flsXofY" | "flsX";
  ```
- Updates `addPageNumbersToPdfDocument(options: { ... customPrefix?: string; format: PageNumberFormat })`

- [ ] **Step 1: Escrever testes unitários em `PageNumbersPdfPanel.test.tsx` e `pdf-engine.test.ts`**
  - Testar formatação com "Fls. 1 de 10" e "Fls. 1".
  - Testar prefixo customizado de processo (ex: "Processo 12345 - Fls. 1").

- [ ] **Step 2: Executar testes para confirmar falha**
  - Run: `pnpm --filter @nexohub/client test src/features/launcher/PageNumbersPdfPanel.test.tsx`
  - Expected: FAIL.

- [ ] **Step 3: Implementar suporte forense em `pdf-engine.ts` e `PageNumbersPdfPanel.tsx`**
  - Formatar texto gerado com "Fls." e suporte a prefixo de peticionamento eletrônico.
  - Adicionar chaves i18n correspondentes em `pt-BR.ts`.

- [ ] **Step 4: Executar testes para confirmar aprovação**
  - Run: `pnpm --filter @nexohub/client test src/features/launcher/PageNumbersPdfPanel.test.tsx`
  - Expected: PASS.

---

### Task 5: Verificação Global de Qualidade e Build

- [ ] **Step 1: Executar `pnpm lint` (`biome check .`)**
- [ ] **Step 2: Executar `pnpm typecheck`**
- [ ] **Step 3: Executar suíte de testes Vitest completa das ferramentas alteradas**
- [ ] **Step 4: Executar `pnpm build:web`**
