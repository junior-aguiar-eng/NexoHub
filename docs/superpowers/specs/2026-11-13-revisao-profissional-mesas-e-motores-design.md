# Especificação de Design — Revisão Profissional de Mesas e Motores (Abordagem A)

**Data:** 2026-11-13  
**Escopo aprovado:** Abordagem A (Onda 1 — Sistema Único de Mesas padrão iLovePDF + Onda 2 — Elevação de Potência dos Motores Locais), com registro de fronteira para a futura Onda 3 da Abordagem B (suíte Office/PDF-A).  
**Base de evidências:** Auditoria forense em Chrome (`1366×768`, `1920×1080`, `390×844`) sobre as 36 ferramentas ativas e leitura direta dos executores e estilos da branch `feat/redesign-espacial-e-debug`.

---

## 1. Objetivos e Princípios Inegociáveis

1. **Paridade visual e espacial com o iLovePDF:** nenhuma página de PDF ou imagem pode estourar o palco nem miniatura alguma pode ficar minúscula no vazio. Em desktop (`1366×768` e `1920×1080`), o usuário vê a folha inteira (ou a grade completa de miniaturas), os controles laterais sem cortes e o botão principal no primeiro quadro sem rolagem da página externa.
2. **Arquitetura única para todas as 36 ferramentas:** todas usam o mesmo contrato espacial de [ToolWorkspace.css](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/features/launcher/ToolWorkspace.css) e [DedicatedToolView.tsx](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/features/launcher/DedicatedToolView.tsx), com barra superior contextual limpa, palco esquerdo/central de documento (`#F4F6F9`) e barra lateral única (`320px`) clara (`#FFFFFF`) com corpo rolável + rodapé fixo dedicado ao CTA principal.
3. **Abertura instantânea em ferramentas textuais:** `text-review`, `text-compare` e `text-translate` abrem diretamente na mesa de edição/colagem, com ação secundária discreta para importar `.txt`, `.docx` ou `.pdf`.
4. **Potência real de motor 100% local-first:** nenhuma nova dependência pesada é exigida para Onda 1 e Onda 2 — aproveita-se `@embedpdf/pdfium`, `pdfjs-dist`, `docx`, `pdf-lib`, `@jsquash/*` e APIs nativas do navegador/WebView2.
5. **Idioma e regras de engenharia ([AGENTS.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/AGENTS.md)):** todo texto voltado ao usuário usa chaves `pt-BR` em `@/i18n`; `TypeScript strict` sem `any` injustificado; UI não acessa filesystem/sidecars diretamente.

---

## 2. Onda 1 — Sistema Único de Mesas e Correções de UX/Layout

### 2.1 Escala do Palco Documental (Fim das folhas gigantes ou minúsculas)
- Remover o teto `max-width: 1440px` de `.dedicated-tool-page--workspace` em [styles.css](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/styles.css#L9403-L9408) para que a mesa ocupe `100%` da largura útil em monitores `1920×1080` (`>= 1800px`), restaurando conformidade com [tool-workspace-size.spec.ts](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/e2e/tool-workspace-size.spec.ts).
- Substituir as regras em [styles.css](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/styles.css#L9448-L9538) que aplicavam `width: 100%; max-height: none;` em cima de `--workspace-page-width: 860px` por **modo fit-to-viewport real** por padrão:
  - Container de prévia única (`pdf-compress`, `pdf-page-numbers`, `pdf-watermark`, `pdf-to-jpg`, `pdf-to-markdown`, `pdf-form-fill`, `pdf-redact`, `pdf-protect`, `pdf-unlock`, `pdf-rotate`, `pdf-crop`, `pdf-sign`, `pdf-repair`): a folha é centralizada vertical e horizontalmente com `width: auto; height: auto; max-width: 100%; max-height: calc(100% - 24px); aspect-ratio` preservado quando zoom estiver em `Ajustar`. Quando o usuário aumenta o zoom (`125%`, `150%`, `+`), o palco ativa rolagem interna suave sem transbordar a viewport.
  - Tamanho mínimo visual garantido quando há espaço disponível (corrigindo folhas minúsculas de `pdf-unlock` `339×480`, `pdf-repair` `365×515` e `pdf-edit` `330×467` para preencher ~`85%` da altura útil do palco).

### 2.2 Anatomia Única de Mesa (`[data-workspace-panel]`) em todas as 36 ferramentas
- **Barra Lateral Direita Única (`320px`, `display: flex; flex-direction: column; height: 100%`):**
  - Toda barra `[data-workspace-part="options"]` estica `height: 100%` da faixa de trabalho até o topo do rodapé, eliminando as fendas cinzas e os cortes de controles (como ocorria em `pdf-compress`, `pdf-page-numbers`, `pdf-form-fill`, `pdf-sign`, `pdf-crop`, `pdf-protect`, `pdf-ocr`, `pdf-to-excel` e `image-watermark`).
  - O corpo de opções tem `flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-bottom: 16px;` acima do botão CTA principal fixo no pé da sidebar (ou na barra inferior mobile), garantindo que nenhum campo ou opção fique escondido atrás do botão em `1366×768` ou `1920×1080`.
- **Unificação das 10 ferramentas fora do padrão + `pdf-to-excel`:**
  - `pdf-to-excel` ([PdfToExcelPanel.tsx](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/features/launcher/PdfToExcelPanel.tsx)): abandonar o tema escuro `#0f172a` isolado; adotar a superfície clara oficial com grade tabular limpa e seletor visual sobre a página na esquerda + opções na direita.
  - `pdf-to-word` ([PdfToWordPanel.tsx](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/features/launcher/PdfToWordPanel.tsx)): usar `[data-workspace-panel]` com prévia das páginas à esquerda e opções de conversão (Preservar tabelas/imagens, OCR automático se escaneado) + botão único na barra lateral à direita; resultado converge para `.dedicated-tool-page--success` com prévia/estatísticas.
  - `pdf-organize`, `pdf-remove-pages` e `pdf-extract-pages`: cabeçalho compacto em barra única fina no topo do palco (sem card gigante laranja) + sidebar direita com resumo, atalhos de seleção ("Todas", "Pares", "Ímpares", intervalo) e CTA.
  - `pdf-edit` e `pdf-compare`: unificar tokens de cor para `--color-brand` da zona PDF (remover `#c34c38`/`#df614b`), usar a barra de navegação padrão do workspace, ampliar o canvas do editor em modo "Ajustar à altura" com sidebars colapsáveis e permitir saída consistente após salvar.
  - `pdf-repair`: migrar para o mesmo layout `[data-workspace-panel]` claro com card informativo + diagnóstico na direita e miniatura proporcional no palco.
  - `text-review`, `text-compare`, `text-translate`: adotar `[data-workspace-panel]` com editor/comparador amplo à esquerda e configurações + resumo de achados/idiomas + botão principal à direita.

### 2.3 Fluxo Direto nas Ferramentas de Texto, Limpeza de `<CloudProcessingChoice>` e Mobile
- **Abertura direta na mesa de edição/colagem (`text-review`, `text-compare`, `text-translate`):**
  - Incluir `tool.id === "text-review"` e `tool.id === "text-translate"` na condição de entrada direta em `isWorkspaceMode` no [DedicatedToolView.tsx](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/features/launcher/DedicatedToolView.tsx#L2788-L2794).
  - Inserir botão secundário `Carregar arquivo (.txt, .docx, .pdf)` diretamente na barra superior da área de texto, mantendo suporte a drag-and-drop e colagem imediata.
- **`<CloudProcessingChoice>` sem desperdício de retrabalho:**
  - Manter o componente e seus contratos intactos, mas renderizá-lo **apenas quando o modo nuvem estiver habilitado** (`cloudEnabled`) ou como seletor segmentado compacto no topo da barra lateral direita (`options`), devolvendo a altura integral do palco em `pdf-ocr` e `text-translate` (resolvendo `docH: 139px` no mobile `390×844` e `doc.y: 325px` no desktop).
- **Correções pontuais de UI:**
  - Corrigir sobreposição de texto/ícone de olho nos inputs de senha em `pdf-protect` (`padding-right: 44px`) e fundo branco real na miniatura do PDF protegido.
  - Corrigir ausência de espaço entre nome e tamanho (`amostra.pdf • 13,8 KB`) em `pdf-sign` e `pdf-crop`.
  - Reduzir altura desnecessária da landing pré-upload no mobile (`scrollH` de `8105px` em `/numero-de-paginas` para layout enxuto em blocos compactos).

---

## 3. Onda 2 — Elevação de Potência dos Motores Locais

### 3.1 `pdf-to-word`: Conversão Estrutural Real (Tabelas, Imagens, Listas e OCR)
- Evoluir [pdf-to-word-converter.ts](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/platform/pdf-to-word-converter.ts) para pipeline em 4 estágios:
  1. **Extração geométrica enriquecida:** coletar `TextContent` (fonte, tamanho, peso, itálico, cor/alinhamento estimado) **e** `getOperatorList()` via `pdfjs-dist` para capturar retângulos/linhas de grade e imagens embutidas (`OPS.paintImageXObject` / `OPS.paintInlineImageXObject`).
  2. **Detecção de layout:** identificar múltiplas colunas (clusters X), cabeçalhos (`HeadingLevel`), listas com marcadores/numeração e **grades tabulares** (linhas verticais/horizontais ou alinhamento tabular recorrente em 2+ colunas) gerando **`Table`, `TableRow` e `TableCell`** reais via `docx`.
  3. **Imagens no DOCX:** extrair bitmaps elegíveis em PNG/JPEG e embutir com `ImageRun` mantendo proporção e limite seguro de memória.
  4. **Integração OCR:** se uma página não tiver texto vetorial e o modo "OCR automático" estiver ativo, oferecer/executar OCR local via `browser-ocr` antes de montar o `.docx` (em vez de devolver apenas mensagem de erro no Word).

### 3.2 `html-to-pdf`: Renderização Fiel com CSS e Imagens Locais
- Substituir o desenho simplista baseado apenas em texto/`StandardFonts` em [html-to-pdf-converter.ts](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/platform/html-to-pdf-converter.ts) por renderizador local fiel com preservação visual de CSS e imagens:
  1. Sanitizar HTML removendo scripts/event handlers perigosos e permitindo data-URIs/recursos locais embutidos sem rede externa (`img`, SVG inline, CSS `<style>`).
  2. Renderizar paginação controlada em iframe isolado (`sandbox`) ou SVG `foreignObject`/canvas em alta resolução (`2x`/`192 DPI`) respeitando tamanho da página (`A4`/`Letter`/`A3`), orientação e margens, embutindo as páginas no PDF **junto com camada de texto selecionável/pesquisável invisível** (`addOcrTextLayer` / caixas calculadas pelo `Range.getClientRects()` no DOM real).
  3. Fallback determinístico para o motor estrutural apenas em ambientes sem DOM (ex.: testes Node puros sem layout engine).

### 3.3 `pdf-repair`: Recuperação Real de PDFs Corrompidos com PDFium WASM
- Evoluir [pdf-repair-engine.ts](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/platform/pdf-repair-engine.ts) de mero `PDFDocument.load(..., { throwOnInvalidObject: true })` para pipeline em 2 camadas:
  1. **Camada 1 (Estrutural rápida `pdf-lib` tolerante):** sanitizar lixo antes de `%PDF-`, reconstruir trailer/EOF ausente, limpar objetos nulos ou `/Info` órfão e tentar `load({ throwOnInvalidObject: false, ignoreEncryption: false })`.
  2. **Camada 2 (Recuperação profunda via `@embedpdf/pdfium` WASM em worker):** quando a Camada 1 falhar por `xref` quebrado, `/Count` inconsistente ou objetos indiretos inválidos, carregar os bytes no PDFium (que possui parser tolerante estilo Chromium capaz de varrer objetos e recuperar tabelas quebradas) e reserializar com `FPDF_SaveAsCopy` mantendo páginas recuperáveis, retornando relatório honesto (`recoveredPages`, `fixedXref`, `warnings`) sem mascarar perda parcial.

### 3.4 `pdf-to-excel`: Detecção Tabular por Eixo/Linhas + Guia Visual Clicável
- Aprimorar [excel-converter.ts](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/platform/excel-converter.ts):
  1. Substituir o limiar fixo `gap > 18 pt` por **clustering dinâmico de colunas por projeção X na página inteira** (histograma de intervalos horizontais de todos os itens + reforço por linhas verticais/horizontais extraídas via `getOperatorList()`), resolvendo casos onde células próximas como `"Servico A"` e `"2"` colapsavam numa só coluna.
  2. Detecção automática de formato numérico/monetário (`R$ 150,00`, porcentagens, datas) no XLSX com estilos limpos de cabeçalho/largura de coluna.
  3. Na UI ([PdfToExcelPanel.tsx](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/features/launcher/PdfToExcelPanel.tsx)), mostrar a prévia visual da página com linhas de separadores arrastáveis/clicáveis sincronizadas com a tabela extraída em tempo real.

### 3.5 `pdf-compress`, `pdf-redact`, `pdf-to-jpg` e `pdf-edit`
- **`pdf-compress`**: adicionar suporte em `compressPdfDocument` ([pdf-engine.ts](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/apps/client/src/platform/pdf-engine.ts)) para otimização com `@jsquash/jpeg` / reamostragem controlada inclusive em streams RGB/Gray/DeviceCMYK convertíveis e remoção real de objetos não referenciados (`useObjectStreams: true` configurável + limpeza de duplicatas); na UI, mostrar **análise real de composição** (quantas imagens recompressíveis existem) em vez de promessa fixa "~40%".
- **`pdf-redact`**: **preservar texto selecionável nas páginas sem tarja** (só reconstruir em raster ou redigir vetorialmente as páginas efetivamente marcadas!) + adicionar **Busca e Tarja Automática** na sidebar (por palavra-chave exata, CPF, CNPJ, e-mail e telefone com pré-visualização antes de aplicar).
- **`pdf-to-jpg`**: adicionar seletor de **DPI/Qualidade (`72 DPI Web`, `150 DPI Padrão`, `300 DPI Impressão`)** e **Seleção de páginas (`Todas` ou intervalo personalizado)** com grade visual das páginas.
- **`pdf-edit`**: além das correções visuais e de ajuste de página inteira, melhorar descoberta de edição adicionando destaque de seleção claro, suporte a destaque de texto/marcador (`Retângulo` translúcido como marca-texto) e carimbo/assinatura rápida reaproveitando os componentes do editor.

---

## 4. Fronteira com a Onda 3 (Futura Abordagem B)
- As ferramentas listadas na seção 3 de [CATALOGO-FERRAMENTAS.md](file:///c:/Users/Boni%20Jr/.antigravity-ide/NexoHub/docs/CATALOGO-FERRAMENTAS.md) (`word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`, `pdf-to-powerpoint`, `pdf-to-pdfa`, `pdf-summarize`) **não integram esta entrega**. Permanecem documentadas para o próximo ciclo com ADR específico (motor Office local/híbrido + conformidade ISO 19005).

---

## 5. Critérios de Aceitação Verificáveis
1. Em Chrome (`1366×768`, `1920×1080` e `390×844`), **todas as 36 ferramentas**:
   - Sem rolagem horizontal (`scrollWidth <= innerWidth`).
   - Sem clipping de controles na sidebar direita (`scrollHeight` acessível sem itens cobertos pelo botão fixo).
   - Em `1366×768`, folhas em prévia única cabem verticalmente por inteiro em modo padrão (`fit`) e o workspace em `1920×1080` ultrapassa `1800px` de largura.
   - `text-review`, `text-compare` e `text-translate` abrem direto em modo de mesa editável sem dropzone bloqueando a tela.
2. Todos os motores da Onda 2 possuem testes automatizados unitários/integração (`vitest`) cobrindo tabelas/imagens no `pdf-to-word`, imagens/CSS + camada pesquisável no `html-to-pdf`, PDFs com `xref`/EOF corrompidos no `pdf-repair`, colunas próximas no `pdf-to-excel`, busca de padrões + páginas intactas no `pdf-redact` e perfis no `pdf-compress` / `pdf-to-jpg`.
3. `pnpm --filter @nexohub/client typecheck`, `pnpm --filter @nexohub/client test`, `pnpm --filter @nexohub/client build` e suite E2E em Chrome passam sem regressões nem violações de `AGENTS.md`.
