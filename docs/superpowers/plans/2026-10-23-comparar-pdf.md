# Comparar PDF — plano de implementação

> Para execução: aplicar desenvolvimento orientado a testes e revisão independente.

**Objetivo:** comparar dois PDFs no navegador com texto, imagens e relatório exportável.
**Arquitetura:** motor isolado em worker; executor compartilhado retorna relatório e resultado tipado;
componente dedicado apresenta pares alinhados e modos de análise.
**Stack:** React/TypeScript, PDF.js, motor textual existente, pixelmatch e pdf-lib.
**Spec:** ../specs/2026-10-23-comparar-pdf-design.md

## Restrições

Website, originais imutáveis, processamento local; pt-BR; sem commit/push/deploy.
Dependência nova deve ter licença permissiva e inventário atualizado.

## Foco de revisão

PDFs idênticos, páginas inseridas/removidas, digitalizações, CropBox/rotação/tamanhos distintos,
falhas e cancelamento/troca de arquivo com descarte de resultados atrasados.

## Entregas

- [x] Motor: `platform/pdf-comparison.ts` e testes reais. Contrato em `pdf-comparison-types.ts`.
  `comparePdfDocuments(left, right, options): Promise<PdfComparisonResult>`; extrair/renderizar,
  alinhar, comparar pixels/texto e devolver regiões normalizadas e imagens. Testar igualdade,
  mudança textual/visual, inserção/remoção, documentos sem texto, rotação/crop e limites.
- [x] Interface: `features/launcher/PdfComparePanel.tsx`, CSS e testes. Recebe `documentCore`, `onBack`,
  `initialFiles`; chama executor `pdf-compare` com `comparisonSignal` e `onComparisonProgress`.
  Testar troca de arquivos/cancelamento, modos, zoom, lista, busca, sincronização e downloads.
- [x] Integração: registry, capabilities web, rotas/catalogo, worker/proxy, executor e relatório.
  O output retorna `comparison`, PDF principal e JSON secundário. Sem habilitação nativa indevida.
- [x] Verificar lint/tipagem, testes unitários, E2E reais, quatro larguras, build e licenças.
  Revisar resultados e documentar limites antes de concluir. Sem commits nesta entrega.

## Evidências finais

- `pnpm check`: lint e tipagem aprovados.
- `pnpm test`: 469 testes aprovados (408 client, 61 pacotes).
- E2E Chromium no build de produção: 79 aprovados; após ajuste da margem do relatório,
  os cinco E2E do comparador foram repetidos e aprovados.
- `pnpm build:web`, `pnpm licenses:check` e `git diff --check`: aprovados.
- Capturas em 390, 768, 1024 e 1440 px, sem rolagem horizontal; foco por teclado verificado.
- Revisão independente identificou amostras largas saindo da margem do PDF; corrigido com
  medição da fonte e teste real de extração do relatório (falhou antes, passou depois).
- Limites finais documentados em `docs/COMPARAR-PDF-WEB.md`. Sem commit, push ou deploy.

## Fase de complementação — 24/10/2026

### CMP-C1 — Navegação e relatório mais legíveis, mantendo o motor atual

**Estado:** concluído no website, validado localmente. Consome Q-C0/UX-C1 e os
[gates comuns](../../ROADMAP.md#regras-comuns-de-execução-e-aceite).
**Modificar:** `apps/client/src/features/launcher/PdfComparePanel.tsx`/CSS e testes,
`platform/pdf-comparison.ts`, `pdf-comparison-report.ts` e testes,
`e2e/pdf-compare.spec.ts`, `docs/COMPARAR-PDF-WEB.md`.

- [x] Acrescentar corpus com páginas quase iguais, repetidas/reordenadas, branco inserido,
  documentos mistos e Unicode fora das fontes padrão; conferir alinhamento e relatório exportado.
- [x] Melhorar ajuste à largura, zoom e salto para alteração, preservando sincronização e
  contexto da página; reaproveitar controles de UX-C1 somente se mantiverem a semântica dos pares.
- [x] Evitar `?` em caracteres do relatório mediante fonte local licenciada e incorporada;
  provar extração/visualização, paginação e margens. JSON continua completo, sem perda silenciosa.
- [x] Apresentar limites do alinhamento heurístico e páginas sem texto. Não rotular diferenças
  como prova de autenticidade, plágio ou interpretação semântica; OCR só após OCR-C1 e escolha
  explícita por documento/página, preservando os resultados originais separadamente.
- [x] Medir renderizações e memória; carregar detalhes sob demanda sem enfraquecer detecção de
  páginas inseridas/removidas. Testar cancelar/trocar arquivos durante cálculo e geração do relatório.

Não adicionar outro diff/viewer por padrão. PDF.js, pixelmatch e o comparador textual existentes
permanecem até que uma comparação com o corpus demonstre necessidade de substituição.

## Registro complementar — CMP-C1 (24/10/2026)

Base: `23df4cc` (`perf(web): renderizar páginas do editor PDF sob demanda`), commit solicitado
do ED-C2 na branch `fix/auditoria-website`. CMP-C1 permanece sem commit, push, merge ou deploy.

- Corpus real sintético: páginas quase iguais, repetidas, reordenadas, branco inserido,
  texto/imagem mistos, Unicode grego/cirílico, nomes de 3 mil caracteres e alteração extensa.
  Conferidos índices de todas as páginas, inserção sem cascata, bytes originais, texto completo,
  limites de coordenadas e continuação do relatório. Reordenação continua sendo uma limitação
  declarada do alinhamento monotônico, sem inventar detecção de movimentação.
- Navegação por todas as páginas e saltos às alterações do filtro ativo; foco no contexto do par,
  escala mantida entre pares, ajuste à largura/tamanho renderizado e âncora de rolagem no zoom.
  Sobreposição continua condicionada à presença dos dois lados. Não reutiliza controles de página
  única onde apagariam a semântica dos pares original/revisado.
- PDF com Source Sans 3 Regular 3.052R incorporada em subconjunto, licença OFL e hash distribuídos.
  Nomes/texto alterado completos paginados, imagens em folhas separadas. Glifos não cobertos
  representados por código Unicode explícito; JSON integral. `@pdf-lib/fontkit` 1.1.1 MIT fixado,
  fork de baixa cadência limitado à fonte local conhecida. Fonte/README/licença incluídos;
  `pnpm audit --prod` sem vulnerabilidades conhecidas e `pnpm licenses:check` aprovado.
  Inventário regenerado; preservadas ordenação e entradas de outras plataformas para evitar ruído.
- Assinaturas e pixels de todas as páginas continuam na detecção. Relatório incorpora um par
  por vez; UI recebe metadados e carrega apenas a prévia do par visual por meio do mesmo executor.
  Cache até dois pares/4 MiB estimados de strings, sem prometer teto global de RAM. Requests
  antigos são cancelados/descartados ao navegar, mudar modo, substituir, cancelar ou desmontar.
  Em Texto não cria worker de prévia. Nenhum motor substituído, OCR ou limite ampliado.

### Medições locais

Windows, AMD Ryzen 5 3550H, 32 GiB RAM, Node 24.19.0, pnpm 11.19.0 e Chromium Playwright 1.62.1.
Ensaio de vinte páginas de 300×200 pt em cada arquivo: 80 renderizações tanto no caminho anterior
com imagens retidas como no caminho sem retenção; 2 para uma prévia isolada. Pico calculado dos
seis buffers RGBA do par: 3.240.000 bytes. Imagens no resultado: 191.832 caracteres → zero.
Primeira execução com parser frio: 4.178 ms; seguinte sem retenção com parser aquecido: 817 ms;
prévia: 47 ms. Os tempos misturam aquecimento e estratégia, portanto não provam razão de aceleração.
Não medem heap, RSS, GPU, fontes ou os streams comprimidos necessários ao PDF de saída.

E2E root repetido: solicitação visual sem cache 1.385 ms e retorno ao par em cache 59 ms,
incluindo interação/worker/pintura; primeiro ensaio sob concorrência: 2.000/99 ms. Resultado
não generalizado a máquinas com pouca RAM. O comparador worker cresceu de 1.054,94 para
1.770,77 kB sem gzip (+715,83 kB); fonte TTF local 431.196 bytes. Main: 1.075,93 kB/gzip 296,38 kB,
ante 1.072,02/295,36 kB. Aviso de chunk grande permanece; nada é carregado de fonte remota.

### Verificação e revisão

- Testes direcionados: 54 aprovados; seis E2E do comparador aprovados no build root.
- Falha de rede da fonte foi reproduzida e corrigida com erro estruturado, sem fallback parcial.
- `pnpm test --maxWorkers=2`: **701 testes aprovados** (638 client + 63 pacotes), após a revisão.
- `pnpm check`: formatter/lint/typecheck aprovados. Builds root e `/hub/` aprovados.
- E2E root geral: **234 aprovados e 5 ignorados** exclusivos de subpasta. Após as correções da
  revisão, os **7 E2E do comparador** foram executados novamente e aprovados, incluindo nova
  regressão de tamanho nativo. Não somar os casos sobrepostos como testes distintos.
- Suíte completa `/hub/`: **125 aprovados**, incluindo os sete casos do comparador.
- Capturas em 390/768/1024/1440 px, tema escuro e movimento reduzido; relatório exportado renderizado
  e inspecionado visualmente. O cabeçalho global escuro continua com limitação preexistente de
  contraste; isso não foi apresentado como auditoria AA aprovada.
- Revisão independente detectou CFF inválido produzido pelo subset OTF do fontkit (`offSize=6`).
  Reproduzido em teste estrutural. Adotada a variante **TTF da mesma fonte/release/licença**;
  teste do stream TrueType, extração e renderização aprovados, sem warning CFF nos E2E finais.
  O teste aceita as assinaturas TrueType válidas `0x00010000` e `true`, também reconhecidas pelo PDF.js.
- Revisão também reproduziu página de 150 px ampliada para 260 px pelo `min-width:50%` do canvas.
  Removido o piso percentual; regressão real confere 150 px e 75 px em zoom 50%, root e `/hub/`.
- Declarações de limites mantidas: sem detecção própria de movimento de páginas, homologação
  Tauri/leitores externos, medição de pico global de RAM ou OCR automático.
- Usuário solicitou uma **proposta separada de padrão global de mesas** durante o fechamento:
  [design](../specs/2026-10-24-padrao-mesas-ferramentas-design.md) e simulação visual, sem aplicar
  essa reformulação no produto. Não confundir com o layout atual entregue no CMP-C1.
- CMP-C1 permanece sem commit, push, merge ou deploy. Próximo item funcional do índice:
  OCR-C1/DOC-C2. A proposta visual depende de avaliação antes do plano de migração.
