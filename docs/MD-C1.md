# MD-C1 — Leitura documental verificável em Markdown

Implementação local em 26/10/2026 sobre `74fb3b4`, worktree
`nexohub-editor-compatibilidade`, branch `fix/auditoria-website`, inicialmente limpa.
Commit de MD-C1 autorizado posteriormente pelo usuário. Sem push ou deploy.
DOC-C2 e integração de Camelot/Docling continuam fora do escopo.
Nenhuma nova dependência, modelo, sidecar, backend ou upload foi introduzido.

## Comportamento entregue

O conversor PDF.js existente passa a ordenar faixas de leitura, mantendo os blocos abrangentes
antes/depois de duas colunas. A mesa oferece três opções, aplicadas ao documento inteiro:

- **Automática (conservadora):** considera duas colunas quando há ao menos três linhas em cada
  lado, sobreposição vertical e largura mediana de texto de pelo menos 22% da página por lado,
  sem fragmentos atravessando o centro naquela faixa.
- **Por linhas / tabelas:** conserva a leitura horizontal, útil para tabelas largas ou casos
  ambíguos. O filtro de tabelas continua sendo uma opção separada.
- **Duas colunas (centro da página):** escolhe a coluna esquerda antes da direita nas faixas
  divisíveis. Um fragmento atravessando o centro mantém a faixa por linhas; não é cortado.

Blocos únicos que atravessam o centro particionam as faixas. As coordenadas são da página
lógica/CropBox antes de Rotate, conservando a ordem do conteúdo ao girar a página no corpus.
O resultado informa quais páginas realmente foram lidas por colunas; não declara confiança
semântica nem acerto universal de layout.

Tabelas consecutivas usam âncoras X recorrentes para preservar a posição dos vazios entre
colunas. Códigos e números permanecem literais, como `00123`, `123`, `1.234,56` e `0,50`.
Fragmentos contíguos de uma palavra não recebem espaços artificiais. Títulos usam a relação
entre tamanhos de fonte e listas preservam marcadores, com numeração explícita na visualização.

Barras, HTML e caracteres de Markdown são escapados quando necessários para conservar texto.
A prévia separa células respeitando escapes e decodifica texto em nós React; não injeta HTML.
Traços literais de células não viram linha de sintaxe. Linhas como `| --- | --- |` e `---`
continuam visíveis como texto, inclusive com a detecção de tabelas desligada. O visor é básico:
não é um renderizador completo de CommonMark nem reproduz a geometria do PDF.

O resultado inclui relatório real por página (`textItemCount` e ordem efetivamente aplicada).
Páginas sem texto selecionável são identificadas na mesa e deixam um marcador no `.md`, mesmo
com separadores desligados. Texto curto nativo não é classificado como escaneado por contagem de
caracteres. Sem texto selecionável em todo o documento, a conversão falha explicitamente,
sem entregar apenas marcadores como se o texto tivesse sido extraído.

**OCR-C1 só por escolha explícita:** o botão abre a ferramenta existente com o PDF original,
sem iniciar reconhecimento automaticamente. O usuário escolhe e executa OCR nessa mesa; não
há OCR embutido no conversor Markdown nem integração com Camelot ou Docling.

Cancelamento usa AbortSignal no conversor/Tool Runner. Trocar arquivo ou opções invalida a
saída anterior e cancela tarefa pendente; conclusão tardia não volta à mesa nem cria histórico.
Carga inicial e descarte da última página têm controles específicos. A UI permite cancelar
uma conversão e descarta a leitura de arquivo que completar depois do cancelamento.

## Corpus e fidelidade observada

Fonte sintética autoral MPL-2.0: [gerador](../apps/client/src/platform/__fixtures__/md-c1/corpus.ts),
[manifesto e matriz esperada](../apps/client/src/platform/__fixtures__/md-c1/manifest.json),
[PDF fixo](../apps/client/src/platform/__fixtures__/md-c1/corpus.pdf) e
[saída automática](md-c1/saida-corpus.md). Datas do PDF fixadas para reprodução.

Quatro páginas:

1. Título, duas colunas pintadas deliberadamente de forma intercalada, bullet, item numerado,
   subtítulo abrangente e parágrafo de largura integral.
2. Tabela de nove células com posição vazia, código com zero, número curto, números pt-BR,
   barra literal e texto `<teste> & condição`.
3. Imagem sem camada textual; não é fixture de qualidade de reconhecimento OCR.
4. Texto nativo curto `Fim.`, controle positivo contra falso aviso de escaneamento.

Além do corpus, os testes criam rotações 90/180/270°, texto dividido entre fontes, 180 linhas
sem truncamento, traços/barras literais e cancelamentos controlados. Os E2E comparam a matriz
inteira da tabela da prévia com os nove valores esperados e comparam o `.md` baixado ao código
exibido, verificando a ordem e presença dos blocos das duas colunas.

SHA-256 do PDF: `a3bdb6f5f72c3d3afed07904c758f7a83210fb8c3c7063e1972637d70a8ef983`.
Os seis ensaios conservaram esse hash antes/depois e cada linha das duas colunas apareceu uma
vez na saída. Hash comprova integridade dos bytes; a conferência de conteúdo e ordem sustenta
a fidelidade observada nesta amostra. Não é prova de fidelidade universal ou de qualidade OCR.

## Medição local

Reprodução: `node scripts/medir-md-c1.mjs`. Usa apenas Vite/Chromium e pacotes existentes,
servidor temporário em loopback:4193, encerrado ao terminar. Sem dependências dos benchmarks
Python de XL-C1. [JSON com resultados e hashes de saída](md-c1/medicoes-2026-10-26.json).

| Configuração | Passagem | Conversão (ms) | Saída UTF-8 (bytes) |
| --- | --- | ---: | ---: |
| Automática | first | 741.7 | 755 |
| Automática | repeat | 464.7 | 755 |
| Auto, sem separadores | first | 397.7 | 680 |
| Auto, sem separadores | repeat | 385.4 | 680 |
| Por linhas, sem tabelas | first | 385.9 | 708 |
| Por linhas, sem tabelas | repeat | 433.4 | 708 |

Tempo inclui extração e formatação, sem carregar a página inicial do aplicativo. `first` e
`repeat` usam o mesmo navegador/cache; não são processos frios independentes. Medição em
AMD Ryzen 5 3550H, oito CPUs lógicas e 32 GB RAM; versões/hardware no JSON. Não mede pico de
memória nem homologa equipamento de pouca memória. As opções Por linhas/sem tabelas têm
estrutura diferente por escolha explícita, sem retirar texto.

## Validação

- RED→GREEN para ordenação, vazios, marcadores de página sem texto, controle manual, escapes e
  renderização. O teste legado de separadores foi ajustado para verificar ausência de linha
  horizontal de página (`^---$`), permitindo o separador legítimo de tabela `| --- |` que antes
  não era produzido corretamente. A verificação de conteúdo não foi removida.
- Revisão independente única identificou perda de barras/traços literais na prévia. Reprodução,
  escape na origem e regressões do visor corrigiram o achado, sem integrar um novo renderizador.
- Inspeção visual identificou contraste do novo rótulo no tema escuro (reproduzido em E2E com
  razão 1,05) e numeração herdada de bullet anterior; ambas corrigidas. E2E exige contraste
  mínimo 4,5 para o rótulo e verifica início da lista `1`. Teste unitário controla início `7`.
- Capturas de documento e opções em 390/768/1024/1440 px, nos temas claro/escuro, com movimento
  reduzido e sem overflow horizontal. Evidências em `.superpowers/sdd/2026-10-26-md-c1/`.
- `pnpm check`: formatter/lint e tipagem de todos os pacotes aprovados. `pnpm licenses:check`:
  inventário auditado e aprovado; manifests e lockfile inalterados.
- `pnpm --recursive --if-present test --maxWorkers=2 --reporter=verbose`: 772 testes aprovados
  (709 client em 98 arquivos, 44 domain, 16 tool-sdk, 3 registry).
- Build da raiz aprovado. Suíte E2E geral: 296 aprovados e cinco exclusivos de `/hub/` ignorados
  na raiz. Build `/hub/` aprovado; suíte oficial da subpasta: **187 E2E aprovados**.
- Bundle principal `/hub/`: 1.112,62 kB / 306,17 kB gzip.
- Bundle principal na raiz: 1.112,59 kB / 306,16 kB gzip, contra 1.107,49 kB / 304,80 kB gzip
  no XL-C1 (+5,10 kB / +1,36 kB gzip). O aviso existente de chunk acima de 1.000 kB permanece.
- Avisos de jsdom/canvas e fontes padrão PDF.js aparecem em testes existentes sem reprovação
  da suíte. Rust/Python, instalador e Tauri instalado não foram executados nesta entrega web.

## Limites

A geometria não determina de forma universal se dois blocos são tabela ou colunas. O modo
manual existe para revisar essa decisão. Centro fixo, duas colunas de larguras razoáveis e
faixas retangulares são o alvo desta heurística; colunas assimétricas/mais de duas, texto
inclinado/vertical, notas flutuantes, aninhamento de listas e mesclagens complexas não foram
homologados. A hierarquia de títulos usa limiares de fonte, sem garantir níveis semânticos.
Tabelas usam o primeiro registro como cabeçalho Markdown e não inventam mesclagens.
Uma linha totalmente sem texto não fornece evidência para reconstruir uma linha vazia de tabela.

O resultado conserva texto selecionável; não extrai texto dentro de imagens nem recria imagens,
tipografia ou diagramação. Página sem texto selecionável pode ser imagem ou página vazia:
o aviso não prova que há texto a reconhecer. Exige revisão do usuário em layouts ambíguos.

A alteração reutiliza `markdown-converter.ts`, o Tool Runner e a mesa existentes. `pdf-engine.ts`
já reexportava a operação e não precisou ser alterado. Nenhum módulo de Excel, scanner,
instalador, banco, Rust ou Python do aplicativo foi modificado. Aplicação Tauri instalada,
máquina limpa, push e deploy são validações/ações separadas, não executadas nesta entrega.
