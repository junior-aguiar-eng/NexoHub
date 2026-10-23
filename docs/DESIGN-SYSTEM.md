# Nexo Design System

O sistema visual do NexoHub compartilha identidade, medidas e estados entre o catálogo e as telas
web de ferramentas. O catálogo `pt-BR` é a fonte de verdade dos textos da interface.

## Fundamentos visuais

- **Marca:** coral `#e11d48`, interação forte `#be123c`, superfície de destaque `#fff1f4`.
  Logotipo e ações principais usam esses tokens; filtros ativos do catálogo usam zinc `#18181b`.
- **Superfícies:** fundo do catálogo `#fafafa`, painéis brancos, superfície secundária `#f0f1f8` e bordas
  `#e1e4ef`. Sombras discretas diferenciam planos sem depender de contornos pesados.
- **Texto:** títulos `#0f172a`, texto secundário `#566176`, fonte Inter empacotada localmente.
  Texto base de 16px; descrições de 14px com entrelinha 1,6; títulos principais entre 28 e 36px.
- **Cores do catálogo:** ícones brancos sobre fundos sólidos por grupo: organização coral
  `#e11d48`; conversão/extração amber `#b45309`; texto/OCR indigo `#4f46e5`;
  otimização/assinatura/formulários emerald `#047857`; trava/desbloqueio rose `#be123c`.
  Os cartões permanecem brancos; foco usa a cor do grupo e arraste usa sua versão tonal suave.
  Os acentos das telas dedicadas permanecem independentes. Contraste mínimo: ícones 3:1; textos 4,5:1.
- **Medidas:** escala de espaçamento em múltiplos de 4px; controles com altura mínima de 44px;
  raios de 10px para controles, 14px para cartões/painéis e 24px para grandes áreas de upload.
  Tokens ficam em `apps/client/src/styles.css`; acentos das ferramentas, no catálogo existente.

## Página inicial e cartões

- Cabeçalho de 74px, atalhos de 15px e intervalo de 24px; em telas menores os atalhos individuais cedem espaço ao menu completo e à
  busca. Abaixo de 760px, o menu usa o rótulo curto “Ferramentas”. O gatilho anuncia o estado
  expandido e referencia o catálogo aberto. Escape fecha o catálogo e devolve o foco ao gatilho;
  Tab mantém a ordem natural dos controles e fecha o catálogo ao sair dele.
- Conteúdo central com largura máxima de 1440px, incluindo margens internas de 24px; abaixo de
  760px, margens internas de 16px. Título, descrição, busca, aviso de privacidade e filtros formam um bloco compacto.
- Aviso de privacidade discreto abaixo da busca, fonte de 11px, sem fundo ou borda e cadeado emerald.
  Busca central com largura máxima de 512px,
  altura mínima de 52px, nome acessível e filtragem imediata por título/descrição sem acentos.
  Escape limpa o campo. Ctrl/⌘K e o botão do atalho abrem a paleta de comandos existente.
- Grade com intervalo de 20px: uma coluna abaixo de 520px, duas de 520 a 759px, três de 760 a
  999px, quatro de 1000 a 1200px e cinco acima de 1200px.
- Cartões com padding de 24px, altura mínima de 224px, raio de 16px e ícones em caixas de 44px com raio de 12px.
  Títulos de 16px/600 e descrições de 14px com entrelinha 1,6. A grade
  iguala a altura dos cartões de cada linha; o conteúdo começa pelo topo, com títulos alinhados.
  Títulos e descrições quebram linha livremente, sem truncamento ou alturas máximas.
- Cartão integralmente acionável por clique, Enter ou Espaço; upload por arraste preservado.
  Hover eleva 4px com sombra e borda neutra, em 200ms ease-out; arraste usa fundo tonal.
  Foco tem contorno de 3px na cor semântica. Com movimento reduzido, a elevação é desativada.
  A seta fica junto ao topo, sem sobrepor a descrição.
- Filtros quebram em linhas em telas estreitas, com fonte de 16px (14px em telas menores), alvos mínimos de 48px, intervalo de 12px e navegação por
  setas, Home e End. O rodapé mantém marca e informações de privacidade existentes.

## Fundo e rodapé

- O catálogo usa três névoas radiais estáticas sobre `#fafafa`: coral a 18% no canto superior
  esquerdo, lavanda a 15% na borda direita e azul a 12% na região inferior. Gradientes amplos
  desaparecem em transparência, sem animações, rótulos flutuantes ou marcas d'água.
- Selos do rodapé usam fonte de 12px e zinc `#71717a`, espaçamento de 32px e separadores sutis.
  Em telas abaixo de 1000px formam duas colunas, sem separadores.
- Animações de entrada dos cards respeitam a preferência por movimento reduzido.

## Telas das ferramentas e acessibilidade

- Na entrada de upload, título de 32–44px, frase específica da ferramenta de 18–22px,
  descrição de 18px, botão principal de 20px e orientação de arraste de 16px.
  As frases descrevem benefícios sem prometer resultados ou recursos não disponíveis.
- Upload, opções e resultados usam os mesmos tokens de cor, tipografia, raio e elevação.
  As ações principais usam coral; os acentos por ferramenta continuam identificando a operação.
- Painéis específicos de juntar, dividir, comprimir e rotacionar empilham abaixo de 981px;
  colunas genéricas usam trilhas que podem encolher sem causar overflow.
- Após o upload, as mesas usam a largura disponível, com margens laterais de 12–32px e
  controles de 320px em telas largas. A página principal chega a 860px de largura; documentos
  altos têm rolagem na prévia, sem redução automática a uma miniatura. Em telas menores, a
  página acompanha a largura disponível e os controles ficam empilhados.
- Prévias individuais são renderizadas em escala 1,8, limitadas a 1800px no lado maior e
  3 megapixels por página. Grades usam escala 0,6 e arquivos adicionais de junção usam 1,2.
  Esses limites afetam apenas a visualização; o documento exportado mantém seu processamento.
  Miniaturas de organização têm altura de 300px; cartões de junção têm largura de 260px.
- Editor e comparação aproveitam até 1920px; a comparação amplia também a altura dos leitores
  em telas largas. A rotação reserva o espaço da página já girada para evitar cortes laterais.
- Controles das ferramentas mantêm alvos mínimos de 44px, com quebra de linha nos grupos de
  miniaturas. Foco de teclado recebe contorno visível; conteúdo de arquivo e textos longos
  devem permanecer acessíveis.
- Nomes, disponibilidade e contadores refletem o Tool Registry e o Document Core. O refinamento
  visual não introduz estatísticas, serviços externos ou mudanças no processamento documental.
- HTML para PDF mostra uma prévia isolada, com scripts, navegação e recursos remotos bloqueados.
  A interface informa que a saída usa um layout documental próprio, preservando textos, listas e
  tabelas, sem reproduzir CSS ou incluir imagens. Linhas Unicode fora da fonte padrão usam a
  renderização do navegador e uma camada selecionável na mesma ordem do conteúdo.
- Remover e extrair páginas validam o intervalo inteiro, limpam a seleção vazia e reiniciam o
  estado ao trocar o arquivo. Os campos AcroForm das páginas mantidas permanecem editáveis.
  O scanner aceita JPEG, PNG e WebP; encerra a câmera ao sair e libera as URLs das miniaturas.

## Validação

Verificar a página inicial e uma tela de upload em 390, 768, 1024 e 1440px, com capturas após
as animações de entrada. Conferir legibilidade, contraste, altura e alinhamento dos cartões,
ausência de rolagem horizontal, foco por teclado, filtros, arraste e movimento reduzido.
A busca combina filtros, permite limpar com Escape e preserva o acesso à paleta por Ctrl/⌘K.
