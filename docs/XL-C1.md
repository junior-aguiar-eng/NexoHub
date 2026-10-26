# XL-C1 — Seleção verificável de tabelas

Execução local em 26/10/2026 sobre OCR-C1 `f44071d`, no worktree
`nexohub-editor-compatibilidade`, branch `fix/auditoria-website`. O commit OCR-C1 foi autorizado
separadamente e deixou a árvore limpa. Commit de XL-C1 e da comparação isolada autorizado
posteriormente pelo usuário em 26/10/2026.
Sem push ou deploy.
DOC-C2 e MD-C1 continuam fora do escopo.

## Comportamento entregue

A mesa PDF para Excel seleciona páginas (`1,3-5` ou vazio para todas), região e separadores de
colunas antes de exportar XLSX/CSV. Região em porcentagem da página lógica/CropBox antes da
rotação, origem superior esquerda; separadores são posições X absolutas da página, ordenadas,
separadas por ponto e vírgula. A mesma região e colunas valem para todas as páginas escolhidas.
A navegação percorre somente as páginas selecionadas e mostra até 15 linhas de cada uma; a saída
inclui todas as linhas. Seleções inválidas e prévias antigas impedem exportar.

O extrator existente `extractPdfSpreadsheetData` e seu contrato `PdfSpreadsheetData` recebem as
opções do mesmo Tool Runner usado pela exportação. PDF.js, ZIP/OpenXML e CSV continuam locais.
Sem dependência nova, sidecar, backend, serviço pago ou upload externo.

O XLSX preserva valores como texto por padrão na UI, incluindo `00123`, `123`, `1.234,56` e
`15.50`, sem inferir tipos pelo conteúdo. Desmarcar a opção mantém a inferência numérica legada;
a API mantém esse padrão antigo para compatibilidade. CSV preserva a grafia e o escape contra
fórmulas existente, mas o programa que abrir o CSV pode inferir números. Não é possível controlar
essa inferência pelo formato CSV.

A região não corta fragmentos de texto: um fragmento cruzando sua borda ou um separador gera
erro explícito e exige corrigir a seleção. Fragmentos contíguos não ganham espaços artificiais.
Separadores manuais definem a estrutura inclusive quando o filtro automático de tabelas está ativo.
Vazios são conservados entre colunas; cabeçalhos abrangentes mantêm seu texto sem inventar
mesclagens OpenXML. Bordas gráficas não são um novo detector: a extração continua geométrica
sobre a camada textual. PDFs escaneados exigem OCR por escolha explícita em outra ferramenta.

Cancelamento destrói a tarefa de carregamento PDF.js, verifica o sinal entre páginas e após a
última página e bloqueia resultado tardio. Trocar arquivo/opções ou desmontar cancela a tarefa;
falha/cancelamento não produz novo download nem histórico.

## Corpus e prova da saída

Fonte autoral sintética MPL-2.0, sem dados pessoais ou conteúdo de terceiros:
[`corpus.ts`](../apps/client/src/platform/__fixtures__/xl-c1/corpus.ts) e
[`manifest.json`](../apps/client/src/platform/__fixtures__/xl-c1/manifest.json).
Os dois PDFs fixos ficam no mesmo diretório, com hashes SHA-256 no manifesto.
Cada PDF tem duas páginas, tabela de três colunas, células vazias, códigos com zeros,
identificador curto e decimais pt-BR. O PDF com bordas tem cabeçalho visual mesclado abrangendo
as três colunas; o sem bordas preserva o mesmo conteúdo. Título e rodapé ficam fora da região
selecionada. O gerador fixa as datas do PDF para reprodução. Testes adicionais cobrem texto
fragmentado por fonte, rotações 0/90/180/270 e páginas não contíguas `1,3`.

Os testes abrem o ZIP XLSX, leem as células e conferem coordenada/tipo/valor, abas e ausência de
mesclagens inventadas; o E2E compara a matriz inteira da prévia com o XLSX baixado e valida o
CSV literal. Há controles positivos para inferência numérica legada e proteção contra fórmulas.
O teste de cancelamento PDF.js cobre carregamento pendente e descarte da última página. O E2E
atrasa a leitura real de Blob, cancela pela UI e libera a conclusão tardia; não pretende medir
worker nativo. A tentativa de interceptar worker não criou workers nesse contexto e foi substituída
por esse controle de I/O observável. Não há afirmação de isolamento em worker de todo o PDF.js.

A revisão independente identificou navegação incorreta entre páginas `1,3`; teste de regressão
falhou antes e passou depois de navegar pela lista selecionada. O cancelamento no descarte da
última página também foi reproduzido antes da correção.

## Medição local reproduzível

`node scripts/medir-xl-c1.mjs` usa Chromium e Vite já disponíveis, em localhost temporário 4193.
O JSON versionado em [`medicoes-2026-10-26.json`](xl-c1/medicoes-2026-10-26.json) registra
hardware, versões, hashes dos originais/saídas, memória e resultados por cenário. As oito
execuções passaram na conferência de matriz e de cada célula; SHA-256 antes/depois confirmou
original inalterado. Isso prova integridade dos bytes, e a comparação com o corpus prova o
conteúdo esperado nesta amostra.

| PDF | Configuração | Passagem | ms | Linhas | Abas |
| --- | --- | --- | ---: | ---: | ---: |
| Sem bordas | automatic | first | 1083.5 | 10 | 2 |
| Sem bordas | automatic | repeat | 913.2 | 10 | 2 |
| Sem bordas | selected-region | first | 942.0 | 3 | 1 |
| Sem bordas | selected-region | repeat | 748.8 | 3 | 1 |
| Com bordas | automatic | first | 755.5 | 10 | 2 |
| Com bordas | automatic | repeat | 862.3 | 10 | 2 |
| Com bordas | selected-region | first | 762.8 | 3 | 1 |
| Com bordas | selected-region | repeat | 808.7 | 3 | 1 |

Tempo inclui extração da prévia e nova extração/serialização do XLSX. `first`/`repeat` são no
mesmo navegador e não representam processos frios independentes. A seleção é página 2, topo 10%,
altura 20%, largura 100%, separadores 30% e 62%. O automático inclui título/rodapé (10 linhas,
duas abas); a seleção os exclui (3 linhas, uma aba). Esta medição inicial não compara motores. A comparação posterior tem escopo de tempo distinto,
registrado em [XL-C1-COMPARACAO-ISOLADA.md](XL-C1-COMPARACAO-ISOLADA.md).
Máquina AMD Ryzen 5 3550H, 8 CPUs lógicas, 32 GB RAM; Chromium 151, PDF.js 6.3.289,
pdf-lib 1.17.1. Snapshot JS de cerca de 60 MB não é pico nem inclui memória de workers.
Não foi homologado dispositivo de pouca memória ou aplicativo desktop instalado.

## Gates e limites

Evidências locais em `.superpowers/sdd/2026-10-26-xl-c1/`: logs, PDFs medidos e capturas em
390/768/1024/1440px nos temas claro/escuro. Movimento reduzido habilitado nas capturas.
Build da raiz: chunk principal 1.107,49 kB / 304,80 kB gzip, contra 1.099,04 kB / 302,43 kB
gzip no OCR-C1 (+8,45 kB / +2,37 kB gzip). O aviso de chunk acima de 1.000 kB permanece.
Validações executadas:

- `pnpm check`: formatter/lint e tipagem dos pacotes aprovados.
- Testes unitários: 750 aprovados (44 domain, 16 tool-sdk, 3 registry e 687 client/96 arquivos).
  A primeira execução recursiva foi interrompida sem resultado do client; os três pacotes haviam
  concluído. O client foi reexecutado integralmente com `vitest run --maxWorkers=2 --reporter=verbose`
  e terminou com código 0. A tentativa interrompida não é contada como aprovada.
- `pnpm build:web`: raiz aprovada; E2E da raiz: 290 aprovados e cinco exclusivos de `/hub/`
  ignorados nessa execução.
- `pnpm licenses:check`: inventário auditado e aprovado. Manifests/lockfile inalterados.
- Antes do commit autorizado: `pnpm check`, 40 testes focados de XL-C1, cinco controles do
  avaliador e Ruff check/format aprovados; evidências do benchmark conferidas por hash.
- Build `/hub/` aprovado; `node e2e/executar-subpasta.mjs`: 181 E2E aprovados.
  Chunk principal da subpasta: 1.107,52 kB / 304,83 kB gzip.

Avisos de jsdom (`scrollTo`, canvas) e de fontes padrão PDF.js aparecem em testes existentes;
a execução completa do client terminou aprovada. Não foram executados testes Rust/Python,
instalador, aplicação Tauri instalada ou deploy, pois não houve alteração nativa nesta entrega.

A comparação isolada com Camelot e Docling foi autorizada posteriormente e **executada** em
26/10/2026: 14 casos/42 extrações, com qualidade por célula, tempo e RSS, registrados em
[XL-C1-COMPARACAO-ISOLADA.md](XL-C1-COMPARACAO-ISOLADA.md). Os runtimes/modelos ficaram no
venv de benchmark; nenhum arquivo do aplicativo ou dependência foi alterado nesta comparação.
A avaliação está concluída para o corpus; **integração no produto continua condicionada a decisão
arquitetural**. Não se generaliza qualidade desta amostra sintética para tabelas arbitrárias,
caligrafia, documentos reais ou reprodução visual do PDF. DOC-C2 e MD-C1 continuam fora do escopo.
