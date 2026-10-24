# Nexo Design System

O NexoHub usa uma estrutura visual compartilhada por PDF e Imagem. Componentes e medidas são
os mesmos; catálogo, textos e paleta mudam pela zona `pdf|img`. pt-BR é a fonte dos textos.

## Fundamentos e temas

- Fonte Inter local. Texto base 16px, títulos dos cards 16px/600, descrições 14px/1,6.
- Catálogo sobre `#fafafa`, cards brancos e bordas zinc suaves. Tema escuro herda superfícies
  escuras do sistema; a zona não força uma superfície clara nas mesas de ferramentas.
- PDF: acento coral `#e11d48`, forte `#be123c`, fundo tonal `#fff1f4`.
- Imagem: azul `#2563eb`, forte `#1d4ed8`, fundo tonal `#eff6ff`; violeta `#7c3aed` e ciano
  `#22d3ee` como apoio. Ciano/neon é decorativo, não texto pequeno sobre branco.
- Camaleão orgânico B em SVG inline: corpo grafite `#202936` e crista coral/azul por modo.
  No tema escuro o corpo usa tom claro para contraste. Cabeçalho e rodapé usam o mesmo componente;
  favicon SVG micro acompanha a zona. Estudos originais ficam em `docs/branding/camaleao-b/`.
- Contraste mínimo: texto normal 4,5:1, ícones funcionais/foco 3:1. Ativos azuis/corais usam
  texto branco no claro e tinta escura no tema escuro. Não depender somente de cor para seleção.
- Tokens em `apps/client/src/styles.css`, selecionados pelo root `data-zone`. Evitar hexadecimais
  duplicados nos componentes. Acentos semânticos das ilustrações são tokens por grupo.

## Cabeçalho e catálogo

- Cabeçalho desktop de 74px. Marca, seletor PDF/Imagem, atalhos do modo ativo, menu completo e
  lupa. Uma única instância do seletor; grupo de botões com `aria-pressed`, não tabs incompletas.
- Seletor de 172px no desktop, 160px no mobile e alvos de 44px. Em telas abaixo de 760px,
  cabeçalho quebra em duas linhas, sem encolher alvos interativos nem ocultar a busca.
- Atalhos individuais cedem espaço ao menu em larguras menores. Escape fecha menu e devolve
  foco; sair por Tab fecha o menu. Menu de Imagem usa os mesmos componentes e agrupamento do PDF.
- Busca somente pela lupa do cabeçalho ou Ctrl/⌘K, na paleta existente. Busca nomes, descrições
  e aliases de ação sem diferenciar acentos. Resultados/categorias pertencem à zona ativa.
- Hero com título e uma frase curta. Sem campo central de busca. Aviso de privacidade discreto
  no rodapé, junto do fechamento institucional. Não adicionar métricas fictícias ou selos repetidos.
- Largura máxima do catálogo 1440px; margens de 24px, ou 16px abaixo de 760px.
- Grade com gap 16px: 1 coluna abaixo de 520px; 2 em 520–759px; 3 em 760–999px;
  4 em 1000–1200px; 5 acima de 1200px. Hero/filtros compactos: pílulas com 24px de respiro até os cards (20px entre blocos mais 4px internos); primeira linha até y=264px
  em 1440×900. Mobile pode quebrar título e categorias para preservar leitura.
- Filtros de 48px de altura mínima, fonte 16px (14px no mobile), gap 12px. Ativo grafite;
  inativos neutros. Teclado: setas, Home e End.

## Cartões e ilustrações

- Padding 24px, raio 16px, altura mínima 224px. Altura uniforme por linha; títulos e descrições
  completos, sem clamp/truncamento. Ilustrações próprias de 48px em duotone: páginas, fotos,
  direção de fluxo e símbolos da operação. Ícones dos controles permanecem funcionais/discretos.
- PDF: organização coral; conversão/extração amber `#b45309`; texto/OCR indigo `#4f46e5`;
  otimização/assinatura/formulários emerald `#047857`; segurança de senha rose `#be123c`.
- Imagem: otimização/conversão azul; edição violeta; marca d'água teal `#0f766e`. Variantes
  claras no tema escuro. Fundo de card não muda por grupo; foco/arraste usam acento e tonal suave.
- Card acionável por clique, Enter, Espaço e arraste de arquivos. Hover eleva 4px com sombra
  e borda neutra em 200ms. Foco visível de 3px. Entrada tem atraso máximo de 120ms: o fim
  do catálogo não fica invisível por um escalonamento longo.

## Fundo, movimento e rodapé

- Três névoas estáticas: manchas largas nas mesmas posições em ambos os modos, sem texto ou
  marca d'água. PDF: coral 18%, lavanda 15%, azul 12%; Imagem: azul, violeta e ciano nesses pesos.
- Marca interpola cores em 250ms, sem mudança de tamanho nem animação contínua. Movimento
  reduzido desliga transições da marca/seletor e elevação dos cards. Não há rótulos flutuantes.
- Selos do rodapé: 12px, cor secundária, gap simétrico de 32px e separadores sutis; em telas
  estreitas quebram em colunas. Marca e promessa de privacidade consistentes entre os modos.

## Mesas de ferramentas

PDF preserva a área ampla e os controles já existentes. Painéis de Imagem usam prévia grande
em uma coluna flexível e controles de 360px a partir de 981px; abaixo disso ficam empilhados.
Prévia com `object-fit: contain`, sem recortar a imagem para caber na miniatura. Labels e inputs
de 14px, alvos mínimos de 44px, foco visível. Ações usam tokens do modo, não azul/coral fixos.
Limites, formatos e testes do motor: [IMAGE-WEB-QUALITY.md](IMAGE-WEB-QUALITY.md).

- Superfícies e bordas semânticas são registradas no `@theme` do Tailwind; aliases de texto
  acompanham os tokens de tinta. Resets de fonte e cor pertencem à camada `base`, para não
  sobrepor tamanho de texto ou contraste de estados ativos dos componentes.
- Grades de opções respondem à largura do painel, não à largura da janela: formatos com
  colunas mínimas de 180px, proporções com 130px e coordenadas em duas colunas flexíveis.
  A paleta quebra linhas e preserva botões de 44×44px, sem disputar espaço com os ranges.
- Prévias de rotação e marca d'água preservam a proporção e podem ocupar até 680px de altura.
  A marca d'água usa o mesmo motor da exportação, com atualização após 200ms e cancelamento
  de resultados obsoletos; os estados de atualização e erro são explícitos.
- A seleção de recorte é visível, movível por ponteiro ou setas (Shift: 10px) e limitada à
  imagem original. Medidas informadas e arquivo exportado devem coincidir.
- Grades PDF carregam miniaturas reais adicionais quando entram na área visível. Numeração
  mostra a página efetivamente escolhida, incluindo a opção de pular a capa.
