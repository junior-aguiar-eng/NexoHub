# Redesign Espacial Unificado e Estabilização Funcional do NexoHub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar o layout espacial e a navegação de todas as 33 ferramentas do NexoHub (30 PDF e 3 Imagem) em um Molde Único de Ferramenta (Canonical Tool Shell), eliminando classes duplicadas em `styles.css`, corrigindo distorções visuais e transbordamentos horizontais, e assegurando estabilidade funcional ponta a ponta.

**Architecture:** Adotar uma estrutura responsiva canônica centralizada com limite de largura (`max-w-7xl` / `1440px`), espaçamento lateral consistente (`px-4 sm:px-6 lg:px-8`), barra de ação inferior (`dedicated-tool-bottom-bar`) docada com backdrop blur garantindo visibilidade total do botão primário de execução, harmonização das 3 famílias de interface e validação por testes automatizados e script visual Playwright.

**Tech Stack:** React 19, TypeScript (strict), Tailwind CSS + CSS Modules/Design Tokens, Vitest, Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-espacial-e-debug-ferramentas-design.md`

## Global Constraints

- O idioma canônico é o Português Brasileiro (`pt-BR`). Textos de interface utilizam `translate(...)` e o catálogo `pt-BR.ts`.
- TypeScript estrito (`strict`), sem uso de `any` injustificado.
- Nenhum microserviço, backend remoto ou upload externo sem decisão arquitetural explícita (`AGENTS.md`).
- Operações em documentos produzem novos artefatos; o original importado é imutável.
- Código deve passar em `biome check .`, `pnpm typecheck` e nos testes unitários e de integração aplicáveis.

## Review Focus

1. **Transbordamento horizontal (Horizontal Scroll):** Em telas desktop (1440px) e mobile (390px), nenhuma ferramenta deve provocar barra de rolagem horizontal no `body`.
2. **Botão de ação inacessível ou cortado:** A barra de ação inferior deve permanecer visível em qualquer altura de viewport sem colidir ou cortar o botão vermelho primário.
3. **Bordas de alarme em estado ocioso:** Dropzones ociosos não devem exibir bordas tracejadas vermelhas agressivas antes de qualquer ação do usuário.
4. **Navegação de retorno inconsistente:** Todas as ferramentas devem exibir o mesmo botão "Todas as ferramentas" (`dedicated.back`) com layout e comportamento idênticos.
5. **Erros silenciosos e loaders infinitos:** Ferramentas que falharem devem exibir mensagem clara em `pt-BR` e botão para reiniciar o estado, sem travar a interface.

---

### Task 1: Unificação de CSS e Estilização da Barra de Ação Inferior

**Files:**
- Modify: `apps/client/src/styles.css:852-875, 6094-6140, 9700-9715`
- Test: `apps/client/src/features/launcher/DedicatedToolView.test.tsx`

**Interfaces:**
- Consumes: CSS Variables de tema (`var(--color-surface)`, `var(--color-border)`, `var(--glass-bg)`, `var(--color-brand)`)
- Produces: Classes CSS consolidadas `.dedicated-tool-page`, `.dedicated-tool-page--workspace`, `.dedicated-tool-bottom-bar`, `.dedicated-tool-workspace-main`

- [ ] **Step 1: Write unit test validating that `.dedicated-tool-bottom-bar` is rendered in workspace mode**

```tsx
// In apps/client/src/features/launcher/DedicatedToolView.test.tsx
it("renderiza a barra de acao inferior com a classe dedicated-tool-bottom-bar", async () => {
  const tool = { id: "pdf-split", titleKey: "tools.split.title", manifest: { category: "pdf" } };
  // Renderiza DedicatedToolView com arquivo em modo workspace
  // Verifica presença de .dedicated-tool-bottom-bar e do botão de execução
});
```

- [ ] **Step 2: Run test to verify it fails if bottom bar is missing or improperly structured**

Run: `pnpm --filter @nexohub/client test -- run DedicatedToolView.test.tsx`  
Expected: PASS ou FAIL documentando a estrutura existente

- [ ] **Step 3: Unify CSS classes and declare `.dedicated-tool-bottom-bar` in `apps/client/src/styles.css`**

Eliminar a declaração duplicada de `.dedicated-tool-page`, `.dedicated-tool-header`, `.dedicated-tool-back-btn` (linhas 853-875) mantendo a versão canônica e unificada. Adicionar a especificação de `.dedicated-tool-bottom-bar`:
```css
.dedicated-tool-bottom-bar {
  position: sticky;
  bottom: 0;
  z-index: 30;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4, 1rem);
  padding: 1rem 1.5rem;
  background: var(--glass-bg, rgba(255, 255, 255, 0.9));
  backdrop-filter: var(--glass-blur, blur(12px));
  border-top: 1px solid var(--color-border, #e2e8f0);
  box-sizing: border-box;
}
```
Ajustar `.dedicated-tool-page--workspace` para conter padding horizontal harmonioso e centralização limpa.

- [ ] **Step 4: Run tests to verify styles compile and DedicatedToolView tests pass**

Run: `pnpm --filter @nexohub/client test -- run DedicatedToolView.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add apps/client/src/styles.css apps/client/src/features/launcher/DedicatedToolView.test.tsx
git commit -m "style: unifica classes de ferramenta e estiliza barra de acao inferior"
```

---

### Task 2: Harmonização Espacial da Família B (HTML→PDF, Digitalizar, Comparar)

**Files:**
- Modify: `apps/client/src/features/launcher/HtmlToPdfPanel.tsx:94-110`
- Modify: `apps/client/src/features/launcher/ScanToPdfPanel.tsx:209-225`
- Modify: `apps/client/src/features/launcher/DocumentComparePanel.tsx:50-80`
- Test: `apps/client/src/features/launcher/HtmlToPdfPanel.test.tsx`, `apps/client/src/features/launcher/ScanToPdfPanel.test.tsx`, `apps/client/src/features/launcher/DocumentComparePanel.test.tsx`

**Interfaces:**
- Consumes: `HtmlToPdfPanelProps`, `ScanToPdfPanelProps`, `DocumentComparePanelProps`
- Produces: Componentes responsivos alinhados com o container pai sem transbordamento lateral

- [ ] **Step 1: Write/Update test ensuring containers have consistent responsive wrapper classes**

```tsx
// Validate that HtmlToPdfPanel root element does not force rigid max-w-6xl when embedded
expect(screen.getByTestId("html-to-pdf-panel")).toHaveClass("w-full");
```

- [ ] **Step 2: Run test to verify current state**

Run: `pnpm --filter @nexohub/client test -- run HtmlToPdfPanel.test.tsx`  
Expected: PASS

- [ ] **Step 3: Refactor layout wrappers in `HtmlToPdfPanel.tsx`, `ScanToPdfPanel.tsx` and `DocumentComparePanel.tsx`**

1. Em `HtmlToPdfPanel.tsx`:
   - Ajustar container raiz: usar largura total e grid responsivo de 2 colunas equilibrado (`grid grid-cols-1 lg:grid-cols-2 gap-6`).
   - Evitar margens e paddings conflitantes (`p-0 sm:p-2`).
2. Em `ScanToPdfPanel.tsx`:
   - Harmonizar grid de miniaturas e visualização da câmera para encaixe natural no espaço da mesa.
3. Em `DocumentComparePanel.tsx`:
   - Garantir que as 2 colunas de texto de comparação ocupem `1fr 1fr` de forma simétrica com rolagem interna independente, sem estourar a viewport da página.

- [ ] **Step 4: Run tests across the three panels to verify functionality**

Run: `pnpm --filter @nexohub/client test -- run HtmlToPdfPanel.test.tsx ScanToPdfPanel.test.tsx DocumentComparePanel.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add apps/client/src/features/launcher/HtmlToPdfPanel.tsx apps/client/src/features/launcher/ScanToPdfPanel.tsx apps/client/src/features/launcher/DocumentComparePanel.tsx
git commit -m "fix(layout): harmoniza containers espaciais de html-to-pdf, scan e comparacao"
```

---

### Task 3: Harmonização Visual da Família A (Dropzones Neutros) e Família C (Editor PDF)

**Files:**
- Modify: `apps/client/src/features/launcher/ExtractPagesPanel.tsx`
- Modify: `apps/client/src/features/launcher/ReviewDocumentPanel.tsx`
- Modify: `apps/client/src/features/launcher/PdfEditorPanel.tsx:100-140`
- Modify: `apps/client/src/features/launcher/PdfEditorPanel.css:1-75`
- Test: `apps/client/src/features/launcher/PdfEditorPanel.test.tsx`

**Interfaces:**
- Consumes: `translate("dedicated.back")`, variáveis CSS de tema
- Produces: Dropzones elegantes sem bordas vermelhas ociosas; cabeçalho de Editor PDF padronizado com as demais ferramentas

- [ ] **Step 1: Write/Update test verifying `PdfEditorPanel` uses standard back button translation**

```tsx
// In apps/client/src/features/launcher/PdfEditorPanel.test.tsx
it("utiliza o rotulo padrao de navegacao para retorno", () => {
  // Verifica presença de botão com texto translate("dedicated.back")
});
```

- [ ] **Step 2: Run test to verify failure/difference**

Run: `pnpm --filter @nexohub/client test -- run PdfEditorPanel.test.tsx`  
Expected: Fail se ainda estiver com texto "Voltar às ferramentas"

- [ ] **Step 3: Update `PdfEditorPanel.tsx`, `PdfEditorPanel.css`, `ExtractPagesPanel.tsx`, and `ReviewDocumentPanel.tsx`**

1. Em `PdfEditorPanel.tsx`:
   - Atualizar botão de retorno para usar `translate("dedicated.back")` ("Todas as ferramentas") e renderizar estrutura alinhada à `.ilovepdf-tool-nav`.
2. Em `PdfEditorPanel.css`:
   - Substituir variáveis engessadas por variáveis de tema (`var(--color-brand)`, `var(--color-border)`).
3. Em `ExtractPagesPanel.tsx` e `ReviewDocumentPanel.tsx`:
   - Substituir bordas tracejadas vermelhas de repouso por bordas cinzas neutras com transição para `border-brand` no arrasto ativo.

- [ ] **Step 4: Run tests to verify all pass**

Run: `pnpm --filter @nexohub/client test -- run PdfEditorPanel.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add apps/client/src/features/launcher/PdfEditorPanel.tsx apps/client/src/features/launcher/PdfEditorPanel.css apps/client/src/features/launcher/ExtractPagesPanel.tsx apps/client/src/features/launcher/ReviewDocumentPanel.tsx
git commit -m "style: normaliza dropzones ociosos e cabeçalho do editor pdf"
```

---

### Task 4: Estabilização e Depuração Funcional de Ferramentas

**Files:**
- Modify: `apps/client/src/features/launcher/DedicatedToolView.tsx`
- Test: `apps/client/src/features/launcher/DedicatedToolView.test.tsx`

**Interfaces:**
- Consumes: Ferramentas registradas em `@nexohub/tool-registry` e executores em `launcher-tool-runner.ts`
- Produces: Execução robusta com feedback visual, tratamento de exceções amigável em `pt-BR` e ausência de loaders infinitos

- [ ] **Step 1: Write unit tests covering error recovery and cancellation across asynchronous tools**

```tsx
it("cancela e reseta estado ao ocorrer erro sem travar a interface", async () => {
  // Testa transição de status para idle após falha
});
```

- [ ] **Step 2: Run tests to verify existing coverage**

Run: `pnpm --filter @nexohub/client test -- run DedicatedToolView.test.tsx`  
Expected: PASS

- [ ] **Step 3: Refine error feedback and status transitions in `DedicatedToolView.tsx`**

1. Assegurar que ao ocorrer falha ou cancelamento (ex: OCR, Excel, Markdown, Reparo, Redação), o controlador aborte a operação limpa e o estado `status` retorne a `"idle"` ou exiba alerta acessível com `role="alert"`.
2. Garantir que os botões de ação e cancelamento estejam visíveis na barra inferior sem sobreposição.

- [ ] **Step 4: Run complete client test suite to ensure zero regressions**

Run: `pnpm --filter @nexohub/client test`  
Expected: PASS em todos os arquivos de teste

- [ ] **Step 5: Commit changes**

```bash
git add apps/client/src/features/launcher/DedicatedToolView.tsx apps/client/src/features/launcher/DedicatedToolView.test.tsx
git commit -m "fix(tools): aprimora resiliencia de cancelamento e feedback de execucao"
```

---

### Task 5: Validação Visual Automatizada (Playwright E2E) e Checagem de Qualidade

**Files:**
- Test: `scratch/audit-layout.cjs`
- Audit artifacts: `scratch/shots/*.png`

**Interfaces:**
- Consumes: Chrome headless local (`C:/Program Files/Google/Chrome/Application/chrome.exe`)
- Produces: Capturas de tela e relatório de ausência de overflow horizontal em 33 ferramentas

- [ ] **Step 1: Execute visual regression audit across Desktop (1440x900) and Mobile (390x844)**

Run: `node scratch/audit-layout.cjs` (ajustado com asserções de `scrollWidth <= clientWidth` e verificação da bottom bar)  
Expected: 100% das ferramentas sem scroll horizontal espúrio e com botão de ação visível

- [ ] **Step 2: Run linter, typecheck and workspace-wide tests**

Run: `pnpm check && pnpm test`  
Expected: Zero erros de Biome, zero erros de TypeScript, suíte completa aprovada

- [ ] **Step 3: Commit final adjustments and test artifacts if appropriate**

```bash
git add apps/client/src/
git commit -m "chore: finaliza ajustes de layout e validacoes de qualidade"
```
