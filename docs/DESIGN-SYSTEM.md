# Nexo Design System

O sistema visual do NexoHub compartilha identidade, medidas e estados entre o catálogo e as telas
web de ferramentas. O catálogo `pt-BR` é a fonte de verdade dos textos da interface.

## Fundamentos visuais

- **Marca:** coral `#e11d48`, interação forte `#be123c`, superfície de destaque `#fff1f4`.
  Logotipo, filtros ativos e ações principais usam esses tokens.
- **Superfícies:** fundo `#f7f7fc`, painéis brancos, superfície secundária `#f0f1f8` e bordas
  `#e1e4ef`. Sombras discretas diferenciam planos sem depender de contornos pesados.
- **Texto:** títulos `#0f172a`, texto secundário `#566176`, fonte Inter empacotada localmente.
  Texto base de 16px; descrições de 14px com entrelinha 1,6; títulos principais entre 28 e 36px.
- **Cores das ferramentas:** o catálogo de apresentação mantém o acento de cada ferramenta.
  Ícones brancos sobre fundos vivos ajudam a reconhecer as ações; a cor também aparece na borda
  de hover, foco e arraste. Ícones funcionais devem ter contraste mínimo de 3:1; textos, 4,5:1.
- **Medidas:** escala de espaçamento em múltiplos de 4px; controles com altura mínima de 44px;
  raios de 10px para controles, 14px para cartões/painéis e 24px para grandes áreas de upload.
  Tokens ficam em `apps/client/src/styles.css`; acentos das ferramentas, no catálogo existente.

## Página inicial e cartões

- Cabeçalho de 74px; em telas menores os atalhos individuais cedem espaço ao menu completo e à
  busca. Abaixo de 760px, o menu usa o rótulo curto “Ferramentas”. O gatilho anuncia o estado
  expandido e referencia o catálogo aberto. Escape fecha o catálogo e devolve o foco ao gatilho;
  Tab mantém a ordem natural dos controles e fecha o catálogo ao sair dele.
- Conteúdo central com largura máxima de 1320px, incluindo margens internas de 24px; abaixo de
  760px, margens internas de 16px. Título, descrição e filtros formam um bloco compacto.
- Grade com intervalo de 16px: uma coluna abaixo de 520px, duas de 520 a 759px, três de 760 a
  999px, quatro de 1000 a 1200px e cinco acima de 1200px.
- Cartões com padding de 20px, raio de 14px, altura mínima de 200px e ícones de 48px. A grade
  iguala a altura dos cartões de cada linha; o conteúdo começa pelo topo, com títulos alinhados.
  Títulos e descrições quebram linha livremente, sem truncamento ou alturas máximas.
- Cartão integralmente acionável por clique, Enter ou Espaço; upload por arraste preservado.
  Hover e arraste destacam a borda e a superfície; foco tem contorno de 3px na cor da ferramenta.
  A seta fica junto ao topo, sem sobrepor a descrição.
- Filtros quebram em linhas em telas estreitas, mantendo alvos mínimos de 44px e navegação por
  setas, Home e End. O rodapé mantém marca e informações de privacidade existentes.

## Movimento e camadas

- Fundo decorativo fixo, com até seis nomes reais de ferramentas e três formas suaves nas bordas.
  As três profundidades usam fatores de 1/3, 2/3 e 1. O deslocamento vetorial máximo é de 18px.
- O ponteiro inicia `requestAnimationFrame`; interpolação de 0,12 por frame suaviza o movimento.
  Ao chegar a menos de 0,025px do alvo, a posição é concluída e novos frames deixam de ser agendados.
- Movimento só ocorre com ponteiro fino, hover e sem preferência por movimento reduzido. Toque
  permanece estático. Mudanças da preferência, aba oculta e desmontagem cancelam frames e zeram a
  posição; saída do ponteiro e perda de foco retornam suavemente ao centro.
- `prefers-reduced-motion` também reduz animações e transições da interface. O fundo não recebe
  eventos, não participa da navegação e usa `aria-hidden="true"`.
- Fundo em `z-index: 0`; conteúdo e rodapé em 1; cabeçalho em 100. Diálogos mantêm suas camadas
  existentes acima do conteúdo. Formas ficam recortadas no fundo, sem esconder overflow da página.

## Telas das ferramentas e acessibilidade

- Upload, opções e resultados usam os mesmos tokens de cor, tipografia, raio e elevação.
  As ações principais usam coral; os acentos por ferramenta continuam identificando a operação.
- Painéis específicos de juntar, dividir, comprimir e rotacionar empilham abaixo de 981px;
  colunas genéricas usam trilhas que podem encolher sem causar overflow.
- Controles das ferramentas mantêm alvos mínimos de 44px, com quebra de linha nos grupos de
  miniaturas. Foco de teclado recebe contorno visível; conteúdo de arquivo e textos longos
  devem permanecer acessíveis.
- Nomes, disponibilidade e contadores refletem o Tool Registry e o Document Core. O refinamento
  visual não introduz estatísticas, serviços externos ou mudanças no processamento documental.

## Validação

Verificar a página inicial e uma tela de upload em 390, 768, 1024 e 1440px, com capturas após
as animações de entrada. Conferir legibilidade, contraste, altura e alinhamento dos cartões,
ausência de rolagem horizontal, foco por teclado, filtros, arraste e movimento reduzido.
Os testes do parallax verificam início sob demanda, limite de deslocamento, estabilização,
mudança de preferência e cancelamento na desmontagem.
