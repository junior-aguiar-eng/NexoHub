# Revisão Profissional de Mesas e Motores (Abordagem A) — Plano de Implementação

> **Para executores agênticos:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Elevar todas as 36 ferramentas do NexoHub ao padrão visual/espacial do iLovePDF (Onda 1) e dotar os 7 motores locais deficientes de potência documental real no navegador e no Windows (Onda 2).

**Arquitetura:** Mantém o monólito modular local-first em React 19 + TypeScript strict (`apps/client`), com contratos únicos no `@nexohub/tool-registry` e executores em `apps/client/src/platform/`. A Onda 1 consolida todos os painéis sob o shell `[data-workspace-panel]` de `ToolWorkspace.css`, ajusta a escala das folhas em fit-to-viewport e abre ferramentas de texto direto em edição; a Onda 2 atualiza os algoritmos locais usando bibliotecas já presentes no projeto (`docx`, `pdfjs-dist`, `@embedpdf/pdfium`, `@jsquash/*`, `pdf-lib`, DOM/Canvas).

**Stack técnica:** React 19, TypeScript 7 strict, Tailwind CSS + CSS tokens (`styles.css`, `ToolWorkspace.css`), Vitest, Playwright + Chrome, `pdf-lib`, `pdfjs-dist`, `@embedpdf/pdfium`, `docx`, `@jsquash/jpeg`.

**Especificação:** [2026-11-13-revisao-profissional-mesas-e-motores-design.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/docs/superpowers/specs/2026-11-13-revisao-profissional-mesas-e-motores-design.md)

## Restrições Globais

- Português brasileiro (`pt-BR`) via `translate()` em `@/i18n` para todo novo texto visível ao usuário ([AGENTS.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/AGENTS.md) regra 13).
- TypeScript permanece `strict`; nenhum `any` sem justificativa ([AGENTS.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/AGENTS.md) regra 9).
- UI nunca acessa filesystem, SQLite, shell ou sidecars diretamente ([AGENTS.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/AGENTS.md) regra 5).
- Nenhuma dependência GPL/AGPL ou novo microserviço/upload externo sem ADR ([AGENTS.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/AGENTS.md) regras 3 e 7).
- O original importado permanece imutável ([AGENTS.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/AGENTS.md) regra 4).
- Nenhum commit/PR/deploy sem solicitação explícita ([AGENTS.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/AGENTS.md) regra 12).

## Foco de Revisão (Modos de Falha Críticos a Cobrir em Teste)

- Página A4 única com razão extrema (retrato alta ou paisagem larga) em `1366×768` e `1920×1080` não pode gerar altura > viewport disponível no modo padrão nem micro-miniatura `< 360px` quando há espaço livre.
- Barra lateral com muitas opções (`pdf-compress`, `pdf-page-numbers`, `pdf-form-fill`, `pdf-sign`, `pdf-crop`, `pdf-protect`, `pdf-ocr`, `pdf-to-excel`, `image-watermark`) nunca pode ter controle clicável escondido atrás do rodapé fixo sem área de rolagem independente (`min-height: 0; overflow-y: auto`).
- PDF corrompido com tabela `xref` truncada ou contagem `/Count` divergente no `/Pages` deve tentar recuperação estrutural via PDFium antes de abortar com `CORRUPTED_DOCUMENT`.
- PDF com colunas próximas (`< 18 pt` entre célula numérica e descrição) em `pdf-to-excel` e `pdf-to-word` precisa separar em colunas distintas via projeção horizontal da página.
- HTML contendo imagem `data:image/png` embutida e estilos CSS (`color`, `background`, grid/flex) em `html-to-pdf` deve preservar imagem no PDF gerado além de conter camada de texto pesquisável/selecionável.

---

## Onda 1 — Sistema Único de Mesas e UX (Tarefas 1 a 5)

### Tarefa 1: Corrigir geometria do shell, largura 1080p, fit-to-viewport das páginas e scroll de sidebars

**Arquivos:**
- Modificar: `apps/client/src/styles.css:9394-9567`
- Modificar: `apps/client/src/features/launcher/ToolWorkspace.css:220-365`
- Teste: `apps/client/e2e/tool-workspace-size.spec.ts`, `apps/client/e2e/tool-workspace-layout.spec.ts`

**Interfaces:**
- Mantém classes `[data-workspace-panel]`, `[data-workspace-part="document"]`, `[data-workspace-part="options"]` e `.dedicated-tool-page--workspace`.

- [ ] **Step 1: Atualizar ou adicionar asserção E2E de proporção da folha e largura em `1920×1080`**

Adicionar verificação em `apps/client/e2e/tool-workspace-layout.spec.ts` garantindo que em `1366×768`: (a) `.ilovepdf-file-thumb-img, .redact-thumb-image, .protect-thumb-img, .form-fill-preview-image` tenham altura renderizada menor ou igual à altura do container `[data-workspace-part="document"]` no modo padrão; (b) último controle interativo dentro de `[data-workspace-part="options"]` não esteja sobreposto ao `.dedicated-tool-bottom-bar`.

- [ ] **Step 2: Rodar os testes E2E de layout para confirmar a falha atual**

Run: `node -e "...playwright..."` usando Chrome do sistema contra o build atual em `/numero-de-paginas`, `/comprimir-pdf`, `/proteger-pdf`, `/ocultar-pdf`
Expected: FAIL (`imgHeight > docBoxHeight` em `1366×768` e `wsW === 1440 < 1800` em `1920×1080`).

- [ ] **Step 3: Remover teto `1440px` e corrigir CSS de escala da página e flex-scroll das sidebars**

Em `apps/client/src/styles.css:9394-9567` e `apps/client/src/features/launcher/ToolWorkspace.css:220-365`:
1. Remover `max-width: 1440px` em `.dedicated-tool-page--workspace` (usar `max-width: none; width: 100%;`).
2. Configurar container de folha única (`.ilovepdf-file-card-center`, `.ilovepdf-rotate-card-center`, `.redact-preview-canvas-wrapper`, `.protect-thumb-wrapper`) e imagens de folha com encaixe proporcional ao palco: `width: auto; max-width: 100%; height: auto; max-height: min(68dvh, calc(var(--workspace-viewport-height) - 96px)); object-fit: contain;` por padrão (preservando zoom explicito quando escala `> 100%`).
3. Garantir que `[data-workspace-part="options"]` estique até `100%` da coluna direita (`height: 100%; background: var(--color-surface); border-left: 1px solid var(--color-border);`) e os wrappers internos (`.ilovepdf-compress-options-sidebar`, `.redact-sidebar`, `.protect-sidebar`, etc.) tenham `flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-bottom: 20px;` eliminando tanto as fendas cinzas quanto o clipping pelo botão CTA.
4. Corrigir espaçamento `padding-right: 44px` nos `<input type="password">` em `.protect-sidebar` e contraste do papel em `.protect-thumbnail-canvas` (`background: #fff`).

- [ ] **Step 4: Validar build e re-executar verificação em Chrome (`1366×768` e `1920×1080`)**

Run: `pnpm --filter @nexohub/client build` + checagem Playwright em Chrome.
Expected: PASS (`wsW >= 1900` em `1920×1080`, `scrollH === 768` em `1366×768`, folha inteira visível sem corte).

---

### Tarefa 2: Abertura direta em mesa de texto (`text-review`, `text-compare`, `text-translate`) e compactação de `<CloudProcessingChoice>`

**Arquivos:**
- Modificar: `apps/client/src/features/launcher/DedicatedToolView.tsx:2468-2612, 2788-2799`
- Modificar: `apps/client/src/features/launcher/ReviewDocumentPanel.tsx`
- Modificar: `apps/client/src/features/launcher/TranslateDocumentPanel.tsx`
- Modificar: `apps/client/src/features/launcher/CloudProcessingChoice.tsx`
- Modificar: `apps/client/src/i18n/pt-BR.ts` (se houver chave nova de botão "Carregar arquivo")
- Teste: `apps/client/src/features/launcher/ReviewWorkflow.test.tsx`, `apps/client/src/features/launcher/TranslationWorkflow.test.tsx`, `apps/client/src/features/launcher/CloudProcessingChoice.test.tsx`

**Interfaces:**
- Consome `inputTab`, `files`, `directText`, `cloudEnabled` de `DedicatedToolView.tsx`.
- Produz prop `compact?: boolean` opcional em `CloudProcessingChoiceProps` e prop `onUploadFileClick?: () => void` em `ReviewDocumentPanelProps` e `TranslateDocumentPanelProps`.

- [ ] **Step 1: Escrever teste falhando em `ReviewWorkflow.test.tsx` e `TranslationWorkflow.test.tsx`**

Testar que renderizando `DedicatedToolView` para `tool.id === "text-review"` e `tool.id === "text-translate"` sem `files` nem `initialFiles` já exibe imediatamente o workspace editável (`textarea`) e o botão secundário de importação de arquivo (`onUploadFileClick`), além do botão primário de execução.

- [ ] **Step 2: Rodar os testes de launcher para confirmar falha**

Run: `pnpm --filter @nexohub/client test -- ReviewWorkflow.test.tsx TranslationWorkflow.test.tsx`
Expected: FAIL (`dropzone` de upload renderiza em vez da mesa de texto).

- [ ] **Step 3: Implementar abertura direta e encaixe no `[data-workspace-panel]` para texto e OCR**

1. Em `DedicatedToolView.tsx:2788-2793`, adicionar `tool.id === "text-review" || tool.id === "text-translate"` ao `isWorkspaceMode` (mantendo estado coerente quando o usuário soltar/escolher um `.txt`, `.docx` ou `.pdf`).
2. Migrar `ReviewDocumentPanel.tsx`, `TranslateDocumentPanel.tsx` e `DocumentComparePanel.tsx` para usar a estrutura `[data-workspace-panel]` (`data-workspace-part="document"` para editor/comparador à esquerda + `[data-workspace-part="options"]` para regras/idiomas/nomes preservados/estatísticas à direita) e botão secundário para carregar arquivo na barra superior do editor.
3. Em `CloudProcessingChoice.tsx` e `DedicatedToolView.tsx:2468-2575`: mover `<CloudProcessingChoice compact />` para dentro da coluna `[data-workspace-part="options"]` de `OcrScannerPanel` e `TranslateDocumentPanel` (ou ocultar quando o runtime remoto estiver desativado e não houver seleção nuvem), liberando `100%` da altura vertical do palco em desktop e mobile.

- [ ] **Step 4: Rodar testes unitários de workflow e verificar UI em Chrome (`1366×768` e `390×844`)**

Run: `pnpm --filter @nexohub/client test -- ReviewWorkflow.test.tsx TranslationWorkflow.test.tsx CloudProcessingChoice.test.tsx`
Expected: PASS; em `390×844` o palco de `/reconhecer-texto` sobe de `139px` para `>= 420px`.

---

### Tarefa 3: Unificar `PdfToExcelPanel`, `PdfToWordPanel`, `PdfRepairPanel` e telas de páginas (`Organize`, `Extract`, `Remove`) ao sistema claro padrão

**Arquivos:**
- Modificar: `apps/client/src/features/launcher/PdfToExcelPanel.tsx` + estilos em `styles.css`
- Modificar: `apps/client/src/features/launcher/PdfToWordPanel.tsx` + `DedicatedToolView.tsx`
- Modificar: `apps/client/src/features/launcher/PdfRepairPanel.tsx` + `PdfRepairPanel.css`
- Modificar: `apps/client/src/features/launcher/PdfPageGridPanel.tsx`, `ExtractPagesPanel.tsx`, `RemovePagesPanel.tsx`
- Teste: `apps/client/src/features/launcher/PdfToExcelPanel.test.tsx`, `apps/client/src/features/launcher/PdfToWordPanel.test.tsx`, `apps/client/src/features/launcher/PdfRepairPanel.test.tsx`, `apps/client/src/features/launcher/ExtractPagesPanel.test.tsx`

- [ ] **Step 1: Escrever/atualizar testes de componente verificando presença de `[data-workspace-panel]` e botão primário único**

Garantir em teste que `PdfToWordPanel` não renderiza botão duplicado central + rodapé, `PdfToExcelPanel` renderiza `[data-workspace-panel]` sem fundo dark forçado, e `ExtractPagesPanel`/`RemovePagesPanel`/`PdfRepairPanel` usam `[data-workspace-part="document"]` + `[data-workspace-part="options"]`.

- [ ] **Step 2: Rodar testes atuais e observar falhas nos painéis antigos**

Run: `pnpm --filter @nexohub/client test -- PdfToWordPanel.test.tsx PdfToExcelPanel.test.tsx PdfRepairPanel.test.tsx ExtractPagesPanel.test.tsx`
Expected: FAIL nas novas asserções estruturais.

- [ ] **Step 3: Refatorar painéis mantendo 100% dos callbacks existentes**

1. `PdfToExcelPanel`: substituir container `#0f172a` escuro por tokens `--color-surface` / `--color-surface-subtle` claros do NexoHub; renderizar grade tabular + prévia da página na esquerda e opções na direita sem clipping do rodapé.
2. `PdfToWordPanel`: converter estado idle para `[data-workspace-panel]` (cartão/prévia das páginas + resumo na esquerda; opções de conversão na direita; acionar execução apenas pelo botão único padrão do workspace e convergir sucesso para o padrão visual do hub).
3. `ExtractPagesPanel`, `RemovePagesPanel` e `PdfPageGridPanel`: condensar o cabeçalho gigante em barra compacta horizontal no palco e mover resumo + presets ("Todas", "Pares", "Ímpares", intervalo) para a sidebar direita `[data-workspace-part="options"]`.
4. `PdfRepairPanel`: alinhar prévia do documento, cores de marca (`--color-brand`) e painel lateral ao mesmo grid padrão.

- [ ] **Step 4: Rodar testes unitários e construir bundle**

Run: `pnpm --filter @nexohub/client test -- PdfToWordPanel.test.tsx PdfToExcelPanel.test.tsx PdfRepairPanel.test.tsx ExtractPagesPanel.test.tsx RemovePagesPanel.test.tsx`
Expected: PASS.

---

### Tarefa 4: Padronizar `PdfEditorPanel` (`pdf-edit`), `PdfComparePanel` (`pdf-compare`) e correções pontuais (`pdf-sign`, `pdf-crop`, `image-watermark`, landing mobile)

**Arquivos:**
- Modificar: `apps/client/src/features/launcher/PdfEditorPanel.tsx`, `PdfEditorPanel.css`
- Modificar: `apps/client/src/features/launcher/PdfComparePanel.tsx`, `PdfComparePanel.css`
- Modificar: `apps/client/src/features/launcher/DedicatedToolView.tsx` (espaçamento `amostra.pdf • 13,8 KB` em `pdf-sign`/`pdf-crop`, redução de blocos excessivos pré-upload em landing mobile)
- Teste: `apps/client/src/features/launcher/PdfEditorPanel.test.tsx`, `apps/client/src/features/launcher/PdfComparePanel.test.tsx`

- [ ] **Step 1: Verificar testes atuais de `PdfEditorPanel` e `PdfComparePanel`**

Run: `pnpm --filter @nexohub/client test -- PdfEditorPanel.test.tsx PdfComparePanel.test.tsx`
Expected: baseline PASS antes do ajuste visual/CSS.

- [ ] **Step 2: Alinhar paleta, altura do palco e fluxo**

1. Substituir cores `#c34c38`/`#df614b` em `PdfEditorPanel.css` e `PdfComparePanel.css` pelos tokens canônicos `--color-brand` (`var(--color-brand)`) e bordas/tipografia de `ToolWorkspace.css`.
2. Ajustar `.pdf-editor-canvas` / escala de exibição em `PdfEditorPanel` para que a página ocupe ~`80%–88%` da altura do palco por padrão (resolvendo a miniatura `330×467` perdida no cinza), mantendo nitidez de clique e seleção.
3. Corrigir separador ` • ` entre `fileName` e `formatFileSize` em `pdf-sign` e `pdf-crop`, e transformar o posicionamento de `image-watermark` para não ser cortado em `1366×768`.
4. Compactar seção informativa abaixo da dropzone em telas móveis (`@media (max-width: 768px)`) evitando `scrollH > 8000px`.

- [ ] **Step 3: Re-executar testes de editor, comparador e auditoria visual em Chrome**

Run: `pnpm --filter @nexohub/client test -- PdfEditorPanel.test.tsx PdfComparePanel.test.tsx`
Expected: PASS.

---

## Onda 2 — Elevação de Potência dos Motores Locais (Tarefas 5 a 11)

### Tarefa 5: `pdf-to-word` com reconstrução real de Tabelas, Imagens, Colunas e OCR opcional

**Arquivos:**
- Modificar: `apps/client/src/platform/pdf-to-word-converter.ts`
- Modificar: `apps/client/src/platform/launcher-tool-runner.ts` e `PdfToWordPanel.tsx` (opção "Executar OCR automático em páginas sem texto")
- Teste: `apps/client/src/platform/pdf-to-word-converter.test.ts`

**Interfaces:**
- Atualiza `PdfToWordOptions` em `apps/client/src/platform/pdf-to-word-converter.ts`:
  `export interface PdfToWordOptions { onProgress?: (current: number, total: number) => void; preserveTables?: boolean; extractImages?: boolean; runOcrIfScanned?: boolean; }`
- `PdfToWordReport` passa a incluir `tableCount: number; imageCount: number; usedOcr: boolean;`.

- [ ] **Step 1: Escrever teste falhando em `pdf-to-word-converter.test.ts`**

Criar fixture sintética PDF via `pdf-lib` contendo tabela 3×3 alinhada por coordenadas + título grande + imagem PNG embutida; verificar que ao converter para `.docx` e inspecionar `word/document.xml` (descompactando com `fflate`), existem elementos `<w:tbl>` (tabela real Word) e `<w:drawing>` / mídia `word/media/` (imagem preservada).

- [ ] **Step 2: Rodar teste para confirmar falha atual**

Run: `pnpm --filter @nexohub/client test -- pdf-to-word-converter.test.ts`
Expected: FAIL (`word/document.xml` atual contém apenas `<w:p>`, zero `<w:tbl>` e zero imagem).

- [ ] **Step 3: Implementar detecção de tabelas, colunas, extração de imagens e OCR fallback em `pdf-to-word-converter.ts`**

1. Usar `pdfjs-dist` (`page.getTextContent()` + `page.getOperatorList()`) para extrair retângulos/linhas de grade e operadores de imagem (`OPS.paintImageXObject`).
2. Detectar blocos tabulares por interseção com linhas de grade ou recorrência de múltiplas colunas alinhadas em X (>= 2 linhas consecutivas com >= 2 células alinhadas) e emití-los como `new Table({ rows: [...] })` do pacote `docx`.
3. Detectar cabeçalhos, listas com marcador/número e ordem de leitura em 2 colunas; embutir imagens via `new ImageRun({ ... })` respeitando limites de bytes.
4. Quando `totalWords === 0` e `options.runOcrIfScanned !== false`, acionar reconhecimento local (quando em ambiente de browser com canvas/OCR disponível) em vez de devolver apenas alerta estático.

- [ ] **Step 4: Rodar testes de `pdf-to-word-converter`**

Run: `pnpm --filter @nexohub/client test -- pdf-to-word-converter.test.ts`
Expected: PASS.

---

### Tarefa 6: `html-to-pdf` com renderização CSS + imagens e camada pesquisável real

**Arquivos:**
- Modificar: `apps/client/src/platform/html-to-pdf-converter.ts`
- Modificar: `apps/client/src/features/launcher/DedicatedToolView.tsx` e `apps/client/src/i18n/pt-BR.ts` (remover aviso degradante de "imagens não são incluídas / disposição muda")
- Teste: `apps/client/src/platform/html-to-pdf-converter.test.ts`

- [ ] **Step 1: Escrever teste falhando em `html-to-pdf-converter.test.ts`**

Criar HTML com `<style>` (cor de fundo, borda, fonte, Flexbox) + `<img src="data:image/png;base64,...">`; testar em modo browser/mock DOM que o PDF gerado incorpora imagem XObject (`/Subtype /Image`) além de texto extraível preservado pela camada pesquisável.

- [ ] **Step 2: Rodar teste para confirmar falha atual**

Run: `pnpm --filter @nexohub/client test -- html-to-pdf-converter.test.ts`
Expected: FAIL (atualmente o parser ignora `<img>` e CSS flexbox/fundo).

- [ ] **Step 3: Implementar pipeline de renderização fiel em `html-to-pdf-converter.ts`**

1. Preservar fallback estrutural atual apenas quando não houver suporte de DOM/Canvas (SSR/Node puro sem browser).
2. No browser (`typeof document !== "undefined"`), montar árvore HTML sanitizada (sem `<script>`, `on*`, URLs externas não-data) em container com dimensões exatas da folha (`pageSize`, `orientation`, `margin`), rasterizar cada folha em `Canvas` via SVG `foreignObject` / DOM layout engine (mantendo CSS completo, cores, fontes carregadas e `<img>`/`<svg>`), e gravar no `pdf-lib` com camada de texto selecionável alinhada via `Range.getClientRects()` + `addOcrTextLayer`.

- [ ] **Step 4: Rodar testes de `html-to-pdf-converter` e verificar no Chrome**

Run: `pnpm --filter @nexohub/client test -- html-to-pdf-converter.test.ts`
Expected: PASS.

---

### Tarefa 7: `pdf-repair` com recuperação profunda de `xref` / objetos via `@embedpdf/pdfium`

**Arquivos:**
- Modificar: `apps/client/src/platform/pdf-repair-engine.ts`
- Modificar: `apps/client/src/platform/pdf-repair.worker.ts` e `pdf-repair-client.ts`
- Teste: `apps/client/src/platform/pdf-repair-engine.test.ts`

- [ ] **Step 1: Escrever teste falhando para PDF com `xref` corrompido, objeto indireto inválido e `/Count` divergente**

Em `pdf-repair-engine.test.ts`, criar buffer PDF válido e corromper: (a) tabela `xref` com offsets falsos + lixo; (b) `/Count 99` divergente no `/Pages`; verificar que `repairPdfDocument` recupera as páginas válidas e marca `report.fixedXref === true` em vez de lançar `CORRUPTED_DOCUMENT`.

- [ ] **Step 2: Rodar teste para confirmar falha atual**

Run: `pnpm --filter @nexohub/client test -- pdf-repair-engine.test.ts`
Expected: FAIL (`throwOnInvalidObject: true` e `declaredPages !== pages.length` rejeitam antes de recuperar).

- [ ] **Step 3: Implementar recuperação em 2 camadas (`pdf-lib` tolerante + PDFium `FPDF_SaveAsCopy`)**

1. Na Camada 1 (`pdf-repair-engine.ts`), relaxar `PDFDocument.load(bytes, { throwOnInvalidObject: false, ignoreEncryption: false })`, corrigir discrepância simples de `/Pages /Count` e reconstruir `xref`/trailer quando páginas válidas puderem ser salvas com integridade.
2. Na Camada 2 (quando `pdf-lib` falhar por corrupção grave de tabela `xref` ou objetos), acionar `@embedpdf/pdfium` (`FPDF_LoadMemDocument` + `FPDF_SaveAsCopy` quando módulo WASM disponível no worker), validando páginas recuperadas e emitindo relatório transparente (`recoveredPages`, `totalDetectedPages`, `fixedXref`, `warnings`).

- [ ] **Step 4: Rodar testes de `pdf-repair-engine`**

Run: `pnpm --filter @nexohub/client test -- pdf-repair-engine.test.ts`
Expected: PASS.

---

### Tarefa 8: `pdf-to-excel` com clustering inteligente de colunas + detecção de grades vetoriais e separadores visuais na prévia

**Arquivos:**
- Modificar: `apps/client/src/platform/excel-converter.ts`
- Modificar: `apps/client/src/features/launcher/PdfToExcelPanel.tsx`
- Teste: `apps/client/src/platform/excel-converter.test.ts`

- [ ] **Step 1: Escrever teste falhando para células próximas (`Servico A` e `2` separadas por `12pt`) e linha vetorial separadora**

Em `excel-converter.test.ts`, criar página PDF com 2 colunas separadas por apenas `12pt` (menor que o limiar rígido antigo de `18pt`) em 3 linhas alinhadas à mesma coordenada X; verificar que `extractPdfSpreadsheetData` separa `"Servico A"` e `"2"` em **duas colunas distintas**, não em uma só célula `"Servico A 2"`.

- [ ] **Step 2: Rodar teste para confirmar falha atual**

Run: `pnpm --filter @nexohub/client test -- excel-converter.test.ts`
Expected: FAIL (`"Servico A 2"` colapsado na mesma coluna).

- [ ] **Step 3: Implementar clustering global de eixo X + linhas de grade + separadores clicáveis**

1. Em `excel-converter.ts`: além dos intervalos intralinha, calcular intervalos vazios verticais globais recorrentes em todas as linhas candidatas à tabela na página e linhas vetoriais de `getOperatorList()` para determinar âncoras de coluna precisas mesmo quando o espaçamento visual é `>= 8pt`.
2. Em `PdfToExcelPanel.tsx`: exibir miniatura da página lado a lado ou alternável com linhas verticais clicáveis que atualizam `separatorsText` diretamente no clique/arraste, mantendo entrada numérica sincronizada.

- [ ] **Step 4: Rodar testes de `excel-converter` e `PdfToExcelPanel`**

Run: `pnpm --filter @nexohub/client test -- excel-converter.test.ts PdfToExcelPanel.test.tsx`
Expected: PASS.

---

### Tarefa 9: `pdf-compress`, `pdf-redact` e `pdf-to-jpg` com recursos completos estilo iLovePDF

**Arquivos:**
- Modificar: `apps/client/src/platform/pdf-engine.ts` (`compressPdfDocument` + renderização por página em `pdf-to-jpg`)
- Modificar: `apps/client/src/platform/pdf-redaction-engine.ts` + `DedicatedToolView.tsx`
- Modificar: `apps/client/src/platform/launcher-tool-runner.ts` + painéis de `Compress`, `Redact` e `PdfToJpg`
- Teste: `apps/client/src/platform/compression-quality.test.ts`, `apps/client/src/platform/pdf-redaction-engine.test.ts`

- [ ] **Step 1: Escrever testes falhando**

1. `pdf-redaction-engine.test.ts`: testar que um PDF de 2 páginas com tarja aplicada apenas na página 1 **preserva texto selecionável na página 2** após reconstrução seletiva, e testar função `findTextRedactionRects(pdfBytes, queryOrRegex)` encontrando ocorrências para tarja automática por texto/CPF/e-mail.
2. `compression-quality.test.ts`: testar perfil de compressão removendo metadados duplicados + uso de `useObjectStreams: true` e análise prévia (`inspectPdfCompressibility(pdfBytes)`) retornando estimativa realista baseada em imagens elegíveis reais vs documento puramente textual.

- [ ] **Step 2: Rodar testes para confirmar falhas**

Run: `pnpm --filter @nexohub/client test -- compression-quality.test.ts pdf-redaction-engine.test.ts`
Expected: FAIL nos novos comportamentos.

- [ ] **Step 3: Implementar melhorias nos 3 módulos**

1. **`pdf-redact`**: reconstruir apenas as páginas que contêm áreas de tarja (preservando páginas intactas com texto/vetores nativos!) e adicionar busca textual/padrões (Palavra-chave, CPF, CNPJ, E-mail) na sidebar gerando áreas marcadas editáveis antes da aplicação final.
2. **`pdf-compress`**: ativar recompressão aprimorada (incluindo `@jsquash/jpeg` para JPEG e tratamento de streams elegíveis) + `useObjectStreams: true` + `inspectPdfCompressibility` na sidebar com expectativa honesta de ganho.
3. **`pdf-to-jpg`**: liberar escolha de qualidade/DPI (`72`, `150`, `300 DPI`) e seleção de páginas (`Todas` ou intervalo `1-3, 5`) conectados ao executor.

- [ ] **Step 4: Rodar testes unitários**

Run: `pnpm --filter @nexohub/client test -- compression-quality.test.ts pdf-redaction-engine.test.ts`
Expected: PASS.

---

## Verificação Final de Ponta a Ponta

- [ ] **Step 1: Typecheck, Lint, Formatter e Suíte Completa Unitária**

Run:
- `pnpm --filter @nexohub/client typecheck`
- `pnpm --filter @nexohub/client test`
- Checagem de lint/biome do workspace (`pnpm lint` ou equivalente configurado no root `package.json`)

- [ ] **Step 2: Build de Produção + Varredura Completa das 36 Ferramentas em Chrome (`1366×768`, `1920×1080`, `390×844`)**

Run: `pnpm --filter @nexohub/client build` + executar script Playwright em Chrome nas **36 rotas**:
- Verificar visualmente capturas-chave com `read_file` após as mudanças (`pdf-page-numbers`, `pdf-compress`, `pdf-redact`, `pdf-protect`, `pdf-sign`, `pdf-crop`, `pdf-edit`, `pdf-repair`, `pdf-to-word`, `pdf-to-excel`, `html-to-pdf`, `pdf-ocr`, `text-translate`, `text-review`, `image-watermark`).
- Confirmar 0 erros de console/página, `overflowX: false` em todas as viewports, largura `>= 1800px` em `1920×1080`, folhas encaixadas em `1366×768` e todos os fluxos de execução funcionais.

---

### Auto-Revisão do Plano vs Especificação
1. **Cobertura da Spec:** Todos os itens das seções 2.1–2.3 (escala, 10 painéis + Excel, abertura direta texto, CloudProcessing, correções `protect`/`sign`/`crop`/`watermark`) e 3.1–3.5 (`pdf-to-word`, `html-to-pdf`, `pdf-repair`, `pdf-to-excel`, `pdf-compress`, `pdf-redact`, `pdf-to-jpg`) têm tarefas e testes explícitos.
2. **Consistência de Tipos e Nomes:** `CloudProcessingChoiceProps.compact`, `ReviewDocumentPanelProps.onUploadFileClick`, `TranslateDocumentPanelProps.onUploadFileClick`, `PdfToWordOptions`, `PdfToWordReport` mantêm nomenclatura consistente em todas as tarefas.
3. **Proporção e Escopo:** Plano direto ao ponto, dividido em entregas verificáveis por TDD; nenhuma ferramenta da Onda 3 (`word-to-pdf`, `powerpoint-to-pdf`, `excel-to-pdf`, `pdf-to-powerpoint`, `pdf-to-pdfa`, `pdf-summarize`) foi incluída neste ciclo.
