# Refatoração visual das mesas — plano de implementação

> **Execução:** aplicar `superpowers:executing-plans` nesta sessão, com TDD e revisão independente
> ao final. Implementação autorizada pelo usuário em 25/10/2026; não pedir nova aprovação do conceito.

**Objetivo:** adequar as mesas existentes à janela, com documento em rolagem interna, opções e ação
principal acessíveis, preservando a identidade do NexoHub e o roteiro funcional em andamento.
**Arquitetura:** componentes de apresentação e estilos compartilhados no client; estado, ports,
registry, workers e executores documentais existentes permanecem responsáveis pelo processamento.
**Stack:** React/TypeScript strict, CSS e i18n pt-BR atuais, sem novas dependências.
**Spec:** `../specs/2026-10-24-padrao-mesas-ferramentas-design.md`.

## Restrições globais

- Apenas mesas: sem edição avançada nova, autenticação, cobrança, bloqueios ou substituição de motor.
- Manter logo/brand, catálogo, rotas, todos os recursos atuais gratuitos e originais imutáveis.
- Seletor de famílias existe apenas na maquete; cada ferramenta continua independente.
- Na execução original, sem commit, push, merge ou deploy. Preservar CMP-C1 e demais alterações
  locais preexistentes. Em solicitação posterior de 25/10/2026, o usuário autorizou consolidar
  commits e integrar com a `main`; push, publicação e deploy continuam fora dessa autorização.
- Não duplicar o backlog funcional: o próximo complemento continua OCR-C1/DOC-C2 depois desta adequação.
- Website local; preservar contratos e exportações. Textos novos usam chaves pt-BR.

## Foco de revisão

Arquivo com nome longo; muita altura de opções/achados; 390 px e janela de pouca altura/zoom200%;
trocar visualização sem perder campos/foco; cancelar/sair após navegar ou esconder um painel.
As verificações abaixo devem tornar esses cenários reproduzíveis sem substituir provas de exportação.

## Tarefa 1 — Estrutura compartilhada e comparador piloto

**Criar:** `features/launcher/ToolWorkspace.tsx`, `.css`, `.test.tsx`;
`e2e/tool-workspace-layout.spec.ts` (todos sob `apps/client/`).
**Modificar:** `App.tsx`, `PdfComparePanel.tsx`/CSS, `i18n/pt-BR.ts`.
**Contrato:** `WorkspaceView = 'document' | 'options'`; `WorkspaceTabs({view,onChange})`;
`ToolWorkspace({titleId,header,toolbar?,options,actions?,children,className?})`.
O frame conserva filhos montados ao alternar a vista; ações ficam fora do scroller de opções.

- [x] Escrever teste: alternar Documento/Opções não perde valor digitado nem recria conteúdo;
  título, controles, região do documento e rodapé da ação têm nomes acessíveis distintos.
  Alternância e preservação aprovadas; documento e ações agora são regiões nomeadas por i18n,
  verificadas junto com a região de opções nos testes do frame.
- [x] Executar teste isolado e observar falha de componente ausente.
- [x] Implementar frame e abas em pt-BR. App recebe classe explícita de mesa; header original
  preservado, main flexível em `100dvh`, rodapé institucional somente fora das mesas.
- [x] Mover controles existentes do comparador aos slots; manter semântica de pares, zoom, cache,
  download, cancelamento e seleção. Inputs de arquivo compactos quando há resultado.
- [x] E2E com dois PDFs: sem overflow do body, dois lados desktop, troca de aba móvel mantendo
  zoom/busca, ação visível e JSON/PDF correspondentes. Rodar unitários do comparador/frame.

## Tarefa 2 — Editor atual, sem novas capacidades

**Modificar:** `PdfEditorPanel.tsx`/CSS/testes e o E2E de layout.
**Consome:** `WorkspaceTabs`, tokens/altura útil do frame. **Produz:** mesma revisão do editor
em uma mesa limitada à janela, com barra, miniaturas/propriedades e salvar acessíveis.

- [x] Reproduzir overflow com arquivo carregado em 1366×768 e aba móvel 390 px.
- [x] Conservar toolbar e estado existentes; limitar os scrollers de página, miniaturas e
  propriedades, reservar altura da navegação e manter salvar no rodapé da região apropriada.
- [x] Alternar Documento/Opções sem desmontar a revisão nem perder rascunho; manter os controles
  atuais de mostrar páginas/propriedades, histórico e confirmação de saída.
- [x] E2E real: editar/adicionar com recursos existentes, alternar, desfazer/refazer e conferir
  texto exportado. Nenhuma capacidade do diagnóstico avançado será incluída.

## Tarefa 3 — Mesas PDF, lotes/imagens e texto existentes

**Modificar:** `DedicatedToolView.tsx`, painéis existentes com conteúdo/opções separados e
`ToolWorkspace.css`; testes unitários pertinentes e E2E de layout.
**Consome:** abas e tokens compartilhados. **Produz:** marcações `data-workspace-part` explícitas
para `document`/`options` em painéis atuais, sem inferir capacidades por CSS ou nome da ferramenta.

- [x] Mapear painéis e marcar suas regiões de apresentação. Reutilizar layouts compress/split/
  merge/rotate e inverter apenas a ordem visual das opções à esquerda (formulário/proteção/tarja).
- [x] Colocar a ação atual de `DedicatedToolView` fora do conteúdo rolável, sem alterar sua
  validação/handler. Lotes usam lista limitada/recolhível, sem restringir o processamento à prévia.
- [x] Em telas estreitas alternar documento/opções; conteúdo oculto permanece montado. Textos,
  tabelas e resultados usam seu próprio scroll; nenhum recurso some por overflow ou foco.
- [x] Verificar pelo menos uma entrada real de cada layout, seis ferramentas de imagem e
  ferramentas textuais; opções extensas e nomes longos não deslocam a ação para fora da janela.
- [x] Rodar regressões de prévia, formulários, imagens, cancelamento, texto e navegação.

## Tarefa 4 — Fechamento integrado ao roteiro

**Modificar:** `docs/ROADMAP.md`, documentação das mesas e registro deste plano; incluir E2E
de layout no executor `/hub/`.

- [x] Capturas com arquivos em 390/768/1024/1366/1440, pouca altura, tema escuro, movimento
  reduzido e zoom do navegador 200%; foco/teclado e ação acessíveis sem rolagem do body.
  Zoom real comprovado em Chromium com perfil isolado, `viewport: null` e seleção de 200%
  nas próprias configurações do navegador; DPR 1→2, largura CSS pela metade e janela externa
  constante. Ações do comparador, editor e compressão permanecem clicáveis sem overflow.
- [x] `pnpm check`, `pnpm test --maxWorkers=2`, build root e E2E de produção pertinentes;
  suíte geral root e build com `NEXOHUB_BASE_PATH=/hub/` + suíte da subpasta.
- [x] Revisão independente do diff visual, protegendo alterações funcionais anteriores;
  corrigir achados materiais com regressões. Registrar diferenças preexistentes e limitações.
- [x] Atualizar o estado no índice, sem declarar OCR-C1/DOC-C2 ou edição avançada implementados.

## Cobertura da especificação

Estrutura/semântica/ações: tarefa1; editor e regiões opcionais: tarefa2; ferramentas independentes,
lotes/texto/estados: tarefa3; responsividade, temas, integridade e evidências: tarefa4. Identidade e
gratuidade são restrições em todas. Recursos comerciais e edição avançada ficam fora da execução.

## Retomada — validação inicial de 25/10/2026

Registro histórico anterior ao fechamento da tarefa 4. Os resultados e pendências abaixo
descrevem aquela rodada; as correções e a validação final são registradas na seção de fechamento.

Implementação local no worktree `nexohub-editor-compatibilidade/NexoHub`, branch
`fix/auditoria-website`, HEAD `23df4cc`. O CMP-C1 preexistente foi preservado.
O checkout principal em `main`/`a5aef3f` não contém esta migração.

- Estrutura e painéis migrados permanecem montados ao alternar as regiões.
- O editor móvel abre páginas/propriedades pelos controles existentes e retorna ao documento
  ao escolher uma página. A região aberta recebe foco de teclado.
- Barras do editor passam a ter rolagem horizontal própria em janelas de pouca altura,
  preservando o rodapé de salvar. Regressões verificam interseções e clique real.
- Comparar, cancelar e progresso do comparador ficam fora do scroller de opções.
- Formatter, lint, tipagem, build e 28 testes focados aprovados na retomada.
  Suíte unitária completa aprovada: 703 testes (640 client, 44 domain, 16 SDK, 3 registry)
  com `pnpm test --maxWorkers=1 --reporter=verbose`. Duas execuções com dois workers tiveram
  uma falha de espera cada, em testes diferentes; código, asserções e timeouts foram preservados.
  Raiz: 250 E2E aprovados e cinco pulados na suíte geral; os 12 restantes passaram após
  adaptar os testes às abas e à lista recolhível, desambiguar o input de imagem e separar
  estado normal/hover no teste de contraste. Total coberto: 262 cenários aprovados.
  A matriz visual foi repetida e aprovada após posicionar texto legível na fixture.
  `/hub/`: 151 E2E aprovados na suíte oficial de 152; a comparação de streams da assinatura
  digitada falhou uma vez e passou isoladamente, sem alterar o teste. Essa intermitência
  permanece registrada para investigação, sem alegação de estabilidade por causa do reteste.
  Builds root e `/hub/` aprovados; aviso existente de chunks acima de 1000 kB.

Desvio de validação: o gate unitário foi repetido com um worker após as falhas de espera.
Isso demonstra a aprovação nessa configuração, sem declarar estabilidade da execução paralela.
O zoom real do navegador a 200% ainda exige conferência manual; viewports de pouca altura
não são apresentados como prova equivalente. Não foi executado o aplicativo Windows.

A base comum com a `main` é `7de5a35`. O reparo de PDF de `a5aef3f` não integra esta fatia;
a integração das branches permanece separada, sem merge autorizado nesta etapa.

A revisão independente encontrou os dois problemas do editor acima, reproduzidos antes das
correções. Encontrou também um item menor adiado: nomear semanticamente as regiões de documento
e ações do frame compartilhado, hoje `div` (as opções já têm nome acessível).
Edição avançada, cobrança, Windows e produção ficaram fora da revisão. O motor CMP-C1
preexistente mantém seus próprios testes. Não houve commit, push ou deploy.

### Indicador de compressão — solicitação adicional

O usuário apontou a deformação do check verde. Um teste de navegador reproduziu o círculo
com 15,25×22 px: o Flexbox encolhia sua largura ao acomodar o texto. O indicador agora usa
`flex: 0 0 22px`; o texto pode quebrar linha, e o card reserva 12 px entre texto e indicador.

O novo `e2e/compression-selection.spec.ts` passou nos builds root e `/hub/`, verificando
22×22 px no círculo e 14×14 px no SVG em 390/768/1024/1366 px, nos temas claro e escuro.
Formatter, lint, tipagem e os dois builds passaram novamente após o ajuste. O teste foi
incluído no executor de subpasta para as próximas execuções. Esta alteração não muda cores,
marca, perfis nem o processamento da compressão.

### Pendências identificadas na rodada inicial

- Conferência manual de zoom real do navegador a 200% e execução no Windows.
- Nomes acessíveis próprios de documento/ações no frame (item menor da revisão).
- Investigar as falhas de espera com dois workers e a intermitência de streams da assinatura.
- Integração à `main`, commit, push e deploy dependem de solicitação própria.

Esses itens motivaram a rodada de fechamento. A aprovação dos gates nas configurações
iniciais não foi usada como substituto dos critérios ainda não satisfeitos.

## Fechamento da tarefa 4 — concluído no website local

Todos os critérios da tarefa 4 foram satisfeitos neste worktree. Esta seção substitui as
pendências web da validação inicial; Windows nativo e publicação continuam etapas separadas.

- Documento e ações do frame agora têm regiões acessíveis nomeadas por chaves pt-BR.
- O novo E2E configura zoom real de 200% nas preferências de um perfil Chromium isolado:
  confere janela externa constante, DPR de 1 para 2 e largura CSS reduzida à metade.
  Compressão, editor e comparador verificam foco, ação acessível e ausência de rolagem do body.
  O cenário integra o executor oficial de `/hub/`.
- A inspeção dos PNGs encontrou captura parcial no zoom real. A captura agora usa o protocolo
  do Chromium e verifica as dimensões físicas do PNG. Isso revelou uma sobreposição real do
  cabeçalho: controles ocupavam 92 px enquanto o frame reservava 48 px. A regressão falhou
  antes da correção; o cabeçalho acompanha o conteúdo e, em janelas baixas, conserva os controles
  em uma linha com rolagem horizontal. A matriz de layout e zoom passou em conjunto (28 testes),
  incluindo a manutenção da prévia e do salvar em 390×320.
- O teste de assinatura fixa o relógio, preservando a comparação integral dos streams:
  a diferença reproduzida era o texto da data atravessando um minuto entre duas exportações.
- O limite de pixels da redação rasterizada é calculado antes de alocar canvases.
  A regressão prova rejeição sem renderizar e mantém controle positivo de renderização.
- Os testes aguardam os estados reais de conclusão de processamento e a preparação de mocks,
  preservando asserções de exportação, conteúdo, geometria, cancelamento e histórico.
- `pnpm test --maxWorkers=2`: 704 aprovados (641 client, 44 domain, 16 SDK e 3 registry).
  Formatter, lint, tipagem e build de produção da raiz aprovados.
- Revisão independente executada; os achados materiais adicionais estão registrados abaixo
  com suas correções e regressões.
- Isolamento de validação: `playwright.config.ts` e os executores raiz/subpasta aceitam
  `NEXOHUB_E2E_PORT`, mantendo 4173 como padrão; o teste de zoom usa o `baseURL` do projeto.
  Esse acréscimo ao conjunto de arquivos propostos evita colisão com a execução simultânea
  de testes do checkout principal. As rodadas finais usam a porta 4187.
- A revisão independente final encontrou recorte do menu Ferramentas na combinação de
  `overflow-x: auto` e `backdrop-filter`. O filtro foi removido somente no cabeçalho da mesa
  em baixa altura. A regressão confirma hit-testing e clique no item do menu em 683×384 e
  390×320, sem perder a prévia nem a ação de salvar (RED nos dois casos; GREEN nos dois).
- A suíte completa revelou perda de área da composição de imagem no celular: o cabeçalho
  corretamente dimensionado e a barra de comandos em várias linhas deixavam o canvas em
  60×40 px, sobrepondo os controles de toque. O teste existente de arraste falhou nas três
  reproduções. A barra agora tem uma linha com rolagem horizontal em mesas móveis; o mesmo
  teste passou nas três repetições, com as coordenadas originais preservadas.

### Validação final confirmada

| Gate | Resultado | Evidência em `.superpowers/sdd/2026-10-25-refatorar-mesas/` |
| --- | --- | --- |
| Formatter, lint e tipagem (`pnpm check`) | Aprovados | `closure-check-final.log` |
| Unitários (`pnpm test --maxWorkers=2`) | 704 aprovados | `closure-unit-after-sync.log` |
| Build de produção raiz | Aprovado | `closure-build-root-accepted.log` |
| E2E geral raiz, dois workers | 264 aprovados; cinco exclusivos de `/hub/` pulados | `closure-root-accepted.log` |
| Build com `NEXOHUB_BASE_PATH=/hub/` | Aprovado | `closure-build-hub-accepted.log` |
| Executor oficial de `/hub/`, dois workers | 154 aprovados | `closure-hub-accepted.log` |

Os E2E completos foram executados após as últimas correções de CSS; o build mantém o aviso
existente de chunks acima de 1000 kB. Capturas finais e `zoom-real.json` estão em
`accepted-root-captures/` e `accepted-hub-captures/`. No zoom, a janela externa ficou em 1366 px,
a largura interna passou de 1358 para 679 px e o DPR passou de 1 para 2. O registro detalhado
das rodadas, falhas reproduzidas e regressões está em `progress.md` na mesma pasta de evidências.

A execução nativa Windows permanece inconclusiva e separada do aceite do website local.
Este fechamento antecedeu a autorização posterior de consolidação dos commits e integração
com a `main`, em 25/10/2026. Push e publicação continuam separados e não foram solicitados.
