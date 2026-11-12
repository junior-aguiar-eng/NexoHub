# Design Document: Redesign Espacial Unificado e Estabilização Funcional do NexoHub

**Data:** 12 de Novembro de 2026  
**Status:** Aprovado  
**Autores:** Equipe NexoHub  
**Referência:** `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`

---

## 1. Contexto e Motivação

O usuário apontou que, embora o NexoHub possua uma cobertura impressionante de 33 ferramentas (30 para PDF e 3 para imagens), a experiência visual e espacial não transmite profissionalismo ("tudo é muito deslocado no espaço, o design não segue o padrão limpo, prático e espacialmente bem desenhado para comportar com perfeição as ferramentas").

Uma auditoria visual automatizada em 72 permutações (Desktop 1440x900 e Mobile 390x844) diagnosticou que a interface sofre de fragmentação em 3 famílias conflitantes de layouts, declarações CSS duplicadas e conflitantes em `styles.css`, ausência de estilização para contêineres críticos (como a barra de ação inferior) e bordas vermelhas estridentes em estados ociosos.

Este documento estabelece o **Molde Único de Ferramenta (Canonical Tool Shell)**, a harmonização visual de todas as famílias e a metodologia de depuração funcional ponta a ponta.

---

## 2. Princípios de Design & Ergonomia

1. **Espacialidade Canônica e Previsível:**
   - Todo ambiente de ferramenta possui largura máxima delimitada (`1360px` ou `max-w-7xl`), centralizada na tela, com margens laterais consistentes (`px-4 sm:px-6 lg:px-8`).
   - Nenhum conteúdo fica colado nas bordas da viewport nem provoca rolagem horizontal indesejada (`overflow-x: hidden`).
2. **Hierarquia de 2 Colunas Limpa:**
   - Coluna Principal (Esquerda/Centro): visualização, dropzone, canvas ou miniaturas do documento (`minmax(0, 1fr)`).
   - Coluna de Controles (Direita): painel de parâmetros, opções e configurações (`340px` a `380px`), empilhando verticalmente em telas menores que `980px`.
3. **Barra de Ação Inferior (Bottom Bar) Estável:**
   - A barra de ação inferior (`.dedicated-tool-bottom-bar`) é flutuante ou docada com fundo translúcido (`backdrop-filter: blur(12px)`), borda superior sutil e z-index adequado, garantindo que o botão primário de conversão (`.ilovepdf-action-red-btn`) nunca seja cortado ou sobreposto.
4. **Tranquilidade Visual (Zero Falsos Alarmes):**
   - Estados ociosos de upload e caixas de soltar arquivos usam tons neutros e suaves (`border-border`, cinza discreto), reservando cores de alerta/marca exclusivamente para hover, drag-active ou erros confirmados.
5. **Navegação Uniforme:**
   - Botão de retorno padronizado com o rótulo canônico `translate("dedicated.back")` ("Todas as ferramentas") em absolutamente todas as telas, incluindo o Editor PDF.
   - Ponto de cor da categoria (PDF vermelho/vinho, Imagem azul/ciano) e identificador claro da ferramenta.

---

## 3. Arquitetura da Solução

### 3.1 Unificação do CSS e Remoção de Duplicidades

- Em `apps/client/src/styles.css`, consolidar as regras duplicadas de `.dedicated-tool-page`, `.dedicated-tool-header` e `.dedicated-tool-back-btn` (linhas 853 e 6098).
- Definir explicitamente as classes ausentes:
  - `.dedicated-tool-bottom-bar`: flex container com centralização, padding seguro, z-index 30, fundo com efeito glass e suporte a botões secundários/progresso.
  - Ajustes de `max-width` e espaçamento para `.dedicated-tool-page--workspace` e `.dedicated-tool-workspace-main`.

### 3.2 Harmonização das Famílias de Ferramentas

#### Família B: Painéis de 2 Colunas (`HtmlToPdfPanel`, `ScanToPdfPanel`, `DocumentComparePanel`)
- Remover wrappers aninhados redundantes que forçam `max-w-6xl` e criam conflito com o shell externo.
- Corrigir alinhamento à esquerda em `HtmlToPdfPanel` para que a área de código e a prévia do documento preencham o grid de 2 colunas harmonicamente.
- No `ScanToPdfPanel`, alinhar o feed da câmera e o grid de páginas capturadas aos mesmos padrões das demais ferramentas.
- No `DocumentComparePanel`, garantir sincronia de rolagem e proporções equivalentes sem scroll horizontal na janela principal.

#### Família A: Mesas Centralizadas (`ExtractPagesPanel`, `ReviewDocumentPanel`, `RemovePagesPanel`, etc.)
- Normalizar dropzones ociosos: substituir bordas tracejadas vermelhas por bordas neutras com transição suave para a cor da marca no arrasto.
- Unificar o espaçamento de cabeçalho e subtítulo com `translate(tool.descriptionKey)`.

#### Família C: Editor PDF (`PdfEditorPanel.tsx` e `PdfEditorPanel.css`)
- Ajustar o cabeçalho do editor para herdar o padrão da barra de navegação de ferramentas (`.ilovepdf-tool-nav`).
- Atualizar o botão de voltar para exibir "Todas as ferramentas" com o ícone padrão de seta.
- Migrar estilos com cores hexadecimais engessadas para as variáveis de tema do NexoHub.

### 3.3 Protocolo de Depuração Funcional

Para cada uma das ferramentas:
1. **Verificação de Execução Local:**
   - Garantir que arquivos sintéticos (PDF válidos, imagens JPEG/PNG, HTML) passem pelo executor correspondente em `launcher-tool-runner.ts` sem exceções não tratadas.
2. **Feedback de Estado:**
   - Toda execução longa deve exibir progresso ou spinner no botão primário.
   - Todo erro deve ser exibido com mensagem compreensível em português (`pt-BR`) e opção de tentar novamente sem recarregar a página.

---

## 4. Plano de Verificação e Qualidade

1. **Testes Automatizados de Regressão:**
   - Executar suíte de testes unitários do cliente: `pnpm --filter @nexohub/client test`.
   - Executar verificação de tipos e linter: `pnpm check`.
2. **Auditoria Visual Automatizada (Playwright):**
   - Rodar script headless de auditoria comparativa antes/depois nas 3 famílias de ferramentas em Desktop (1440x900) e Mobile (390x844).
   - Validar ausência de `overflow-x` no `document.body` e presença visível do botão primário de ação.
3. **Auditoria DevTools / Lighthouse:**
   - Validar acessibilidade e layout sem quebras nas páginas auditadas.
