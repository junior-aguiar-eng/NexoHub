# Nexo Design System

O Nexo Design System define a identidade visual, a ergonomia e os contratos de interação compartilhados pelo
Hub de Ferramentas (Launcher) e pela suíte de documentos NexoHub. O português brasileiro (`pt-BR`) é a fonte
de verdade dos textos; todos os componentes consomem chaves do catálogo de internacionalização.

## Fundamentos Visuais

- **Cores & Harmonia:**
  - **Fundo & Superfícies:** `#f8fafc` para background geral e `#ffffff` com bordas sutis `#e2e8f0` para painéis e cards.
  - **Tipografia & Contraste:** Ardósia profundo (`#0f172a`) para títulos e legibilidade primária; ardósia médio (`#64748b` e `#475569`) para metadados, descrições e estados secundários.
  - **Acento de Ação:** Coral característico (`#e11d48` / `rgb(225, 29, 72)`) para o destaque de marca **NEXO**<span style="color:#e11d48">HUB</span>, estados ativos e hovers de interação.
- **Tipografia:** Tipografia moderna, legível e empacotada localmente (sem CDNs externas), garantindo funcionamento 100% offline.
- **Espaçamento e Ergonomia:**
  - **Cabeçalho:** 74px de altura (`app-header--ilovepdf`), proporcionando respiro visual e conforto para navegação e busca.
  - **Grade de Ferramentas:** Layout fluido com largura mínima de 270px (`minmax(270px, 1fr)`) e espaçamento de `1.5rem`.
  - **Cards de Ferramentas:** Padding generoso de `1.75rem`, cantos arredondados de `16px` e container de ícones ampliado para `48px`.
- **Movimento e Microinterações:**
  - **Plano de Fundo Parallax Dinâmico:** Tipografia flutuante sutil com os nomes reais das ferramentas em 3 camadas de profundidade, suavizada por interpolação contínua (LERP) em `requestAnimationFrame`.
  - **Acessibilidade:** Suporte estrito a `prefers-reduced-motion` (via `useReducedMotion()`), desativando o parallax e atenuando transições para usuários sensíveis a movimento.
- **Camadas & Empilhamento:**
  - Fundo Parallax: `z-index: 0` com `pointer-events: none` e `aria-hidden="true"`.
  - Conteúdo Principal e Rodapé: `position: relative; z-index: 1`.
  - Cabeçalho Fixo: `position: sticky; z-index: 100`.
  - Modais e Paleta de Comandos: `z-index: 1000+`.

## Componentes e Padrões de Interação

- **Header Integrado:** Logo oficial do NexoHub, atalhos rápidos das ferramentas mais usadas, menu expansível de categorias e gatilho da Paleta de Comandos (`Ctrl+K`).
- **Cards de Ferramenta (`ToolCard`):** Área de clique integral, suporte a arraste e solte de arquivos (`drag and drop`), estados de hover responsivos e foco visível acessível por teclado.
- **Tela Dedicada (`DedicatedToolView`):** Fluxo focado em 2 colunas no estilo iLovePDF, com zona ampla de upload, visualização de miniaturas, controles específicos e download instantâneo do artefato gerado.
- **Rodapé Monocromático Unificado:** Apresentação limpa com logo oficial, selos de privacidade/segurança em tom neutro e sem poluição visual.

## Acessibilidade e Contratos

- **Navegação por Teclado:** Foco visível em todos os controles interativos, suporte a setas e fechamento de modais via `Escape`.
- **Área Mínima de Toque:** Elementos clicáveis mantêm dimensões ergonômicas (mínimo de 44px).
- **Sem Dados Fictícios:** Todos os textos, nomes de ferramentas e contadores refletem fielmente o estado real do `ToolRegistry` e do Document Core.
