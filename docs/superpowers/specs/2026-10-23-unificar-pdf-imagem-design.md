# NexoHub PDF e Imagem — direção visual

## Objetivo e escopo

Um único website com dois modos de trabalho, PDF e Imagem. A mesma estrutura, medidas,
tipografia, estados e qualidade de interação; ferramentas, textos e paleta variam por modo.
Referência de organização: capturas de iLovePDF/iLoveIMG fornecidas pelo usuário, sem copiar
marca, ícones ou textos. Somente website; sem push, deploy ou mudanças desktop.

## Composição aprovada para planejamento

- Cabeçalho de 74px com camaleão B, wordmark NexoHub, seletor compacto PDF/Imagem,
  atalhos pertinentes ao modo, menu completo e busca. Mesma composição nos dois modos.
- Seletor com altura/alvos mínimos de 44px e largura total desejada de 160–184px no desktop.
  Em 390px, reorganizar cabeçalho sem comprimir os alvos ou provocar rolagem horizontal.
- Hero: título e uma frase curta; remover busca central. Aviso de processamento local
  discreto abaixo da grade ou junto aos selos do rodapé, sem ocupar o topo.
- Busca apenas pelo cabeçalho/paleta existente, com Ctrl/⌘K, Escape e navegação por teclado.
  Buscar por nome, ação e descrição sem distinguir acentos; resultados do modo ativo.
- Margens: 24px no desktop, 16px abaixo de 760px; largura máxima do catálogo de 1440px.
  Grade com gap de 16px em vez de 20px. Separar os filtros dos cards por 24px visuais, conforme refinamento solicitado após aprovação. Manter 5 colunas acima de 1200px, 4 de 1000 a
  1200px, 3 de 760 a 999px, 2 de 520 a 759px e 1 abaixo de 520px.
- Cards: padding 24px, raio 16px, altura mínima 224px e altura uniforme por linha;
  títulos 16px/600, descrições 14px/1,6, sem truncamento. Ilustrações de 48px.
- Filtros: alvos de 48px, gap 12px, ativo grafite e inativos neutros. Não reduzir legibilidade
  para aumentar densidade. Alvo de composição: primeira linha iniciando até 264px do topo
  em 1440×900, com título de uma linha. Em telas menores, permitir quebra natural.

## Temas e marca

| Elemento | PDF | Imagem |
| --- | --- | --- |
| Corpo do camaleão e texto principal | Grafite `#202936` | Grafite `#202936` |
| Acento principal/wordmark/ações | Coral `#e11d48` | Azul `#2563eb` |
| Acentos secundários | Paleta temática existente | Violeta `#7c3aed`, ciano `#22d3ee` |
| Névoas | Coral, lavanda e azul | Azul, violeta e ciano |

Ciano/neon é detalhe decorativo, não cor de texto pequeno sobre branco. Fundo claro `#fafafa`
e cards brancos em ambos. Manter as mesmas três manchas e distribuição espacial, começando
pelas opacidades já usadas (18%, 15%, 12%); ajustar somente se a comparação visual exigir.
Sem palavras no fundo, brilho intenso ou animação contínua. Texto deve manter contraste 4,5:1;
ícones funcionais e foco, 3:1. Verificar também o tema escuro existente e o contraste da marca.

Usar o SVG orgânico B documentado em `docs/branding/camaleao-b/`. Corpo estável e crista
parametrizada por tokens; no modo Imagem, acento azul e pequeno detalhe ciano. Mesma silhueta,
sem voltar ao símbolo N. Transição de cor de 250ms, sem salto de layout. Movimento opcional
somente na troca, sem seguir ponteiro constantemente; respeitar movimento reduzido.
Aplicar marca de forma consistente em cabeçalho/rodapé e manter favicon legível em 16/32px.

## Ícones e textos

Criar pequenas composições SVG próprias com duotone, geometria consistente e símbolos
relacionados à ação: páginas convergindo para juntar; páginas separando para dividir;
imagem com alças para redimensionar; enquadramento para recortar; selo sobre foto para marca.
Cores por grupos, não sorteadas por card. No lado PDF preservar os grupos já reconhecíveis;
no lado Imagem usar famílias azul, violeta e teal com intensidade controlada. Não aplicar
roxo a todos os ícones nem copiar as ilustrações do concorrente.

Textos originais em pt-BR, no catálogo de traduções, curtos e verificáveis. Exemplos de direção:
“Menos peso para compartilhar suas imagens”, “Ajuste as dimensões para o seu próximo uso”,
“Dê destaque ao que importa com um recorte preciso”. Não prometer compressão sem perdas,
suporte a formatos, IA ou processamento em lote que o executor não entregue.

## Qualidade das ferramentas

Auditar as seis implementações existentes antes de trocar o motor. Rotação, composição e
marca d'água podem continuar com Canvas. Redimensionamento e codecs especializados devem
ser comparados com os resultados atuais. Arquivos originais imutáveis, saída com MIME/extensão
corretos, orientação EXIF e transparência tratadas explicitamente. Não transformar animações
em uma imagem estática sem avisar e obter uma escolha do usuário.

Carregamento de bibliotecas por ferramenta, processamento pesado em worker, fila com
concorrência limitada, progresso e cancelamento. Downloads de modelos não enviam arquivos,
mas precisam de indicação própria de tamanho/progresso. Sem backend ou envio externo.
A seleção de bibliotecas está no plano associado; instalar somente após avaliar licença,
necessidade, manutenção, segurança, peso e qualidade com fixtures reais.
