# Editar PDF — plano de implementação

**Goal:** editor web local com elementos novos e substituição real de texto existente.
**Architecture:** adapter PDFium em worker reconstrói revisões a partir do original e comandos;
React apresenta a revisão renderizada pelo mesmo motor que exporta.
**Tech Stack:** TypeScript, React, PDFium WASM; PDF.js/pdf-lib para verificação independente.
**Spec:** ../specs/2026-10-23-editar-pdf-design.md (aprovada com “pode começar”).

## Restrições globais

Website; originais imutáveis; assets locais; pt-BR; sem commit, push ou deploy.
Sem cobertura branca simulando substituição, sem rasterizar o PDF inteiro na exportação.
Dependência fixa, licenças e binários auditados. Casos inseguros recusados explicitamente.
Execução nativa nesta sessão; revisão independente final. Branch de trabalho existente `work`.

## Foco de revisão

Fontes incorporadas/subconjuntos e glifos ausentes: validar ou exigir substituição explícita.
CropBox e rotações: coordenadas da seleção e exportação devem coincidir.
Texto maior que a caixa ou vizinhos: recusar sobreposição detectável.
Troca de documento ou cancelamento: nenhuma resposta antiga altera a sessão nova.
Histórico misto e falha ao salvar: preservar revisão e permitir recuperação.

## Tarefa 1 — motor e prova técnica

Arquivos: `platform/pdf-editor-types.ts`, `pdf-editor-engine.ts`, `pdf-editor-engine.test.ts`.
Interface: `editPdf(bytes, commands): Promise<Uint8Array>`; `inspect/render` em sessão PDFium.
- [x] Instalar versão fixa, inspecionar APIs/licenças e medir assets.
- [x] Testes RED com PDFs reais: substituição/extração, acentos, fontes, rotação/crop, não editados.
- [x] Implementar operações tipadas, limites e limpeza; executar testes GREEN e prova no navegador.

## Tarefa 2 — sessão e histórico

Arquivos: `pdf-editor-client.ts`, `pdf-editor.worker.ts`, `pdf-editor-state.ts` e testes.
Interface: sessão worker recebe original e comandos; retorna revisão com páginas, texto e prévia.
- [x] Testes RED de undo/redo misto, descarte de respostas antigas, falha/cancelamento.
- [x] Implementar comunicação cancelável, snapshots de comandos, render e exportação.
- [x] Verificar testes GREEN; nunca retornar bytes de uma revisão diferente da exibida.

## Tarefa 3 — área de trabalho e integração

Arquivos: `features/launcher/PdfEditorPanel.tsx`, `.css`, `.test.tsx`; registry, rotas, executor,
capabilities web, data, i18n e contagens de catálogo.
- [x] Testes RED de seleção/edição, elementos novos, propriedades, histórico e exportação.
- [x] Implementar miniaturas, canvas central, barra de ferramentas e propriedades contextuais;
  mover/redimensionar/duplicar/excluir/ordenar, texto/imagem/formas/desenho, teclado e responsivo.
- [x] Integrar `pdf-edit` e `/editar-pdf`; executar testes GREEN sem habilitar desktop.

## Tarefa 4 — verificação e revisão

Arquivos: `e2e/pdf-editor.spec.ts`, `docs/EDITAR-PDF-WEB.md`, inventário de licenças.
- [x] E2E real: upload, alteração de texto original e novo, undo/redo, download e extração.
- [x] Verificar quatro larguras, foco, limites, senha, erros e recuperação.
- [x] Executar lint/tipagem, testes, E2E, build e licenças; revisar diff de forma independente.
- [x] Corrigir achados com testes, documentar limites e atualizar as entregas deste plano.

## Registro de execução

Decisão: trabalhar na branch `work` já usada nesta conversa, preservando o diretório compartilhado.
Não criar commits intermediários: a autorização atual é para implementar, não commitar.

## Resultado e evidências

- Instalação: `@embedpdf/pdfium@2.15.1`; WASM local 4,65 MB (2,16 MB gzip no build).
- `pnpm test`: 508 testes aprovados, incluindo 447 no client e 61 nos pacotes.
- E2E Chromium: 86 aprovados no build final, incluindo sete cenários do editor.
- Lint/tipagem, build web, inventário de licenças e `git diff --check` aprovados.
- Quatro capturas conferidas, sem overflow; botões principais com contraste mínimo 4,76:1.
- Revisão independente encontrou cinco problemas, corrigidos com regressões:
  glifos, navegação sem confirmação, quantização de coordenadas, transparência e miniaturas.
- Fontes não padrão usam repertório observado, com fallback explícito e verificação independente
  dos bytes exportados. Recriação de objetos transparentes/com recorte especial é recusada.
- Nenhum achado importante permaneceu aberto. Alterações mantidas no checkout `work`, sem commit,
  push ou deploy. Limites finais em `docs/EDITAR-PDF-WEB.md`.

## Fase de complementação — 24/10/2026

**Estado:** ED-C1 e ED-C2 concluídos no website no perfil conservador documentado, sem ampliar limites.
Preserva as quatro tarefas concluídas. Consome Q-C0 e os
[gates comuns](../../ROADMAP.md#regras-comuns-de-execução-e-aceite). Não trocar o motor atual por
um editor visual de imagens: Fabric/Konva não editam o texto existente no conteúdo de um PDF.

### ED-C1 — Compatibilidade textual demonstrada

**Modificar:** `apps/client/src/platform/pdf-editor-engine.ts`, `pdf-editor-types.ts`,
`pdf-editor-verify.ts` e testes; `features/launcher/PdfEditorPanel.tsx` e teste próximo.
**Fixtures:** `platform/__fixtures__/pdf-editor/`; documento técnico `docs/EDITAR-PDF-WEB.md`.

- [x] Expandir o corpus com fontes incorporadas completas/subconjuntos, ligaduras, acentos,
  transparência, texto transformado, múltiplas colunas e formulários; registrar por classe
  edição suportada ou recusa. Conferir visualmente e por extração independente a saída.
- [x] Mostrar o motivo de incompatibilidade antes de editar e oferecer troca explícita de
  fonte quando segura. Não usar largura de glifo como prova de suporte nem cobertura branca.
- [x] Melhorar seleção de objetos e propriedades sem introduzir sobreposição ou reflow
  implícito; texto maior que a caixa continua recusado até existir prova específica de reflow.
- [x] Verificar original, regiões não editadas e campos após substituições, exclusão e histórico.
  Homologar qualquer expansão do repertório antes de remover restrições do documento técnico.

### ED-C2 — Documentos maiores com orçamento de recursos

**Modificar:** `pdf-editor-engine.ts`, `pdf-editor-client.ts`, `pdf-editor.worker.ts`,
`pdf-editor-state.ts`, `PdfEditorPanel.tsx`/CSS e `e2e/pdf-editor.spec.ts`.

- [x] Medir parsing, render e histórico próximos aos limites atuais de 20 MiB/30 páginas/3.000
  objetos. Testar página ativa, navegação rápida, cancelamento e saída durante renderização.
- [x] Implementar renderização/cache sob demanda onde a medição indicar custo, mantendo uma
  revisão canônica e histórico de comandos. Reaproveitar UX-C1 só onde compatível com o editor.
- [x] Aumentar limites somente depois de comprovar memória, tempo e responsividade em máquina
  modesta. Limites de elementos e exportação continuam explícitos; falha preserva última revisão.
- [x] Validar preview/download/undo/redo da mesma revisão e fontes locais em `/hub/`.

**Dependências:** manter `@embedpdf/pdfium@2.15.1` enquanto atender ao corpus; avaliar atualização
seletiva da linha estável v2, inventariando WASM e licenças. Não migrar para v3 em desenvolvimento,
nem instalar CloudPDF/server. OCR com reconstrução e edição universal de parágrafos continuam
fora desta complementação até demonstração de viabilidade e escopo próprios.

## Registro complementar — ED-C1 (24/10/2026)

- Base: `529f36b`, branch `fix/auditoria-website`, em worktree isolado. Nenhum commit, push,
  merge ou deploy desta etapa. `main` preservada.
- Inspeção expõe motivo de recusa e política de caracteres por objeto. A lista permite consultar
  os incompatíveis sem iniciar edição. UI e motor compartilham pré-verificação; fallback é explícito.
- Corpus sintético versionado com SHA-256, fonte Liberation existente completa/subconjunto,
  duas colunas, campo, transparência, inclinação e ligadura. O stream da fonte completa tem o
  mesmo hash do TTF local; a licença existente contém exceção de incorporação documental.
- Recorte interno e ligaduras/códigos privados ficam recusados antes da edição. Fonte completa
  não implica repertório irrestrito: caracteres novos continuam exigindo fallback seguro.
  Espaços gerados pelo leitor são normalizados, sem promessa de fidelidade tipográfica de espaços.
- Testes reais conferem texto por PDF.js, campos, pixels não editados, exclusão, desfazer/refazer
  e renderização dos bytes exportados comparada à prévia. Original permanece byte a byte intacto.
- Revisão independente encontrou P2 na agregação de objetos contíguos pelo PDF.js. Corrigido
  com regressão RED/GREEN e E2E: confere alvo e vizinhos conhecidos completos sem substring solta.
  Lacunas de evidência sobre exclusão/histórico e aparência exportada também foram cobertas.
- `pnpm check`, formatter e `git diff --check` aprovados; `pnpm test`: 672 aprovados
  (609 client + 63 pacotes). Builds raiz e `/hub/` aprovados, sem nova dependência.
- E2E raiz com dois workers: 230 aprovados, cinco pulados por serem exclusivos de subpasta e
  um timeout ao carregar Recortar imagem. O arquivo de recorte inteiro passou na repetição
  (nove casos), sem alteração de asserções: 231 casos únicos aprovados no conjunto. Causa do
  timeout não demonstrada. A primeira rodada também expôs caminhos de fontes dos testes
  incompatíveis com Windows; corrigidos para barras `/`, preservando as verificações.
- E2E `/hub/`: 116 aprovados, incluindo os nove do editor adicionados à suíte da subpasta.
- Capturas em 390/768/1024/1440 px: novas mensagens sem overflow; tema escuro e movimento
  reduzido conferidos. Contraste baixo do título/navegação do shell escuro é uma pendência
  preexistente registrada, sem mudança de CSS nesta fatia.
- Medição pontual do cenário de objetos contíguos: abertura inicial 1.059 ms e revisão seguinte
  955 ms na raiz; 1.011/948 ms em `/hub/`. Windows, Ryzen 5 3550H, 32 GB RAM, Node 24.19.0,
  Chromium do Playwright 1.62.1, Vite local e dois workers. Não é benchmark frio/quente controlado
  nem prova de ganho de desempenho; ED-C2 continua responsável por documentos maiores.
- Recursos do build raiz: worker do editor 167,08 kB; verificador 490,44 kB; bundle principal
  1.069,52 kB (294,44 kB gzip). O aviso de chunk grande já existente permanece. Limites e WASM
  atuais preservados; sem homologação desktop ou promessa de edição universal.

## Registro complementar — ED-C2 (24/10/2026)

**Estado:** implementado e validado localmente. Base `87087db`, commit
autorizado do ED-C1. Commit do ED-C2 autorizado em 24/10/2026; sem push ou deploy.

- Navegação usa modo interno de prévia no mesmo executor `pdf-edit`/ToolRunner. O worker abre
  os bytes da revisão validada, carrega a página solicitada e renderiza sem reconstruir comandos,
  inspecionar as demais páginas ou serializar outro PDF. Download e histórico não são alterados.
- Renderer compartilhado conserva formulários, CropBox e rotações. A entrada da prévia interna
  admite o limite exportável já existente de 80 MiB; importar continua limitado a 20 MiB.
- Cache LRU por revisão, até 16 MiB de pixels e três páginas. Nova revisão/arquivo limpa cache;
  resposta cancelada/obsoleta não o alimenta. Um acerto dispensa worker. Miniaturas iniciais foram
  mantidas: no corpus de 30 páginas somam 1.926.000 bytes, sem custo que justificasse outro pipeline.
- Histórico limitado a 50 etapas e 64 MiB estimados de payloads, deduplicando buffers compartilhados.
  Ao exceder o orçamento, remove passado antigo e informa o usuário; a revisão atual permanece.
  A revisão independente encontrou retenção direta no marcador salvo, corrigida com identidade
  fraca (`WeakSet`), sem guardar snapshots/bitmaps descartados. O teste comportamental confirma
  que desfazer até a versão salva e refazer mantêm o guard de navegação correto. Não foi alegada
  medição determinística de GC nem um teto para o heap total do processo.
- Corpus sintético executável em `pdf-editor-budget.test.ts`: 30 páginas/3.000 objetos e imagem
  RGB em PDF de 20.890.697 bytes. Ensaios isolados com um worker Vitest, Windows/Ryzen 5 3550H/
  32 GB, Node 24.19.0: reconstrução para navegar 258 ms versus render isolado 17 ms no primeiro;
  revisão 377 ms versus render isolado 99 ms no PDF grande. Medidas locais, sem inicialização do
  worker web, sem benchmark frio controlado e sem promessa de velocidade em documentos arbitrários.
- Capacidade linear WASM ao fim dos ensaios: 18.612.224 e 106.168.320 bytes respectivamente;
  não equivale a pico RSS/heap do navegador. Cada prévia medida tem 5.600.000 bytes RGBA.
  Os orçamentos de cache/histórico excluem documentos, Canvas, cópias de transferência e WASM.
- Limites de 20 MiB/30 páginas/3.000 objetos preservados: não há corpus/dispositivo físico de baixa
  memória suficiente para ampliá-los. Sem dependência, serviço, runtime ou plataforma novos.
- Validação final: formatter, `pnpm check` (lint/tipagem), `git diff --check` e builds raiz/`/hub/`
  aprovados. `pnpm test --maxWorkers=2`: 687 aprovados (624 client + 63 pacotes). A renderização
  isolada de formulários no histórico recebeu comparação adicional dos pixels dos bytes exportados;
  os 38 testes reais do engine foram reexecutados e aprovados após essa ampliação de evidência.
- E2E Chromium, dois workers: 233 aprovados na raiz e cinco exclusivos de subpasta pulados;
  118 aprovados em `/hub/`. Os 11 casos do editor cobrem revisão canônica, bytes de download
  idênticos após navegar, cache sem novo worker, invalidação ao editar, cancelamento/saída durante
  renderização, fontes locais, histórico e quatro larguras. Nenhuma falha nessa rodada final.
- Navegação no navegador (30 páginas/3.000 objetos): 286 ms fora do cache/110 ms retorno em cache
  na raiz e 287/99 ms em `/hub/`, sem criar outro worker no retorno. Inclui interação/worker/Canvas;
  não confundir com os ensaios nativos anteriores nem usar como promessa de latência.
- Build raiz: worker do editor 168,41 kB; verificador 490,44 kB; principal 1.072,02 kB
  (295,36 kB gzip). Acréscimo frente ao ED-C1: 1,33 kB no worker e 2,50 kB/0,92 kB gzip no principal.
  O aviso preexistente de chunk grande permanece. Revisão independente teve um P2 de retenção,
  corrigido conforme acima; nenhuma segunda rodada de revisão foi declarada.
- Commit do ED-C2 autorizado em 24/10/2026 após validação; sem push, merge ou deploy.
  Próximo item do índice: CMP-C1.
