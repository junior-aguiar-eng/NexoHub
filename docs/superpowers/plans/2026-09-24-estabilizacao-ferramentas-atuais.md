# Plano de estabilização das ferramentas atuais

**Base:** `main` em `c93b0d8` (24/09/2026).  
**Objetivo:** fazer cada operação anunciada entregar o resultado correspondente ou informar indisponibilidade antes da execução, preservando o processamento local e os originais.  
**Referências:** `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, ADR-004, ADR-005, ADR-006 e `docs/DEFINITION-OF-DONE.md`.

## Limites

- Não adicionar ferramenta, plataforma, servidor, upload, telemetria ou dependência.
- Não implementar agora conversores ou proteção de PDF que não possuem executor verificável. Mantê-los no registro, mas indisponíveis na superfície afetada, com mensagem em `pt-BR`.
- Manter a web e o desktop como superfícies distintas quanto às capacidades. Disponibilidade exige executor operacional naquela superfície, e não apenas manifesto no Tool Registry.
- Reaproveitar o Document Core, o Tool Runner, os ports e os engines existentes. Alterar somente os fluxos afetados.
- Este plano não autoriza commit, PR, release nem publicação.

## 1. Impedir sucesso sem processamento — prioridade crítica

**Arquivos principais:** `apps/client/src/features/launcher/data.ts`, `DedicatedToolView.tsx`, `apps/client/src/platform/browser-document-core.ts`, `browser-ocr.ts`, `apps/client/src/features/capabilities/useCapabilities.ts`, catálogo `pt-BR`.

1. Derivar a disponibilidade da ferramenta de uma capacidade real por plataforma. Remover o provider que declara todas as capacidades como disponíveis. PDF para Word, Word para PDF, imagens para PDF e proteção de PDF só devem aparecer como executáveis quando tiverem executor validado; até lá, desabilitar a ação com motivo claro ou ocultar o card conforme o padrão existente do Launcher.
2. Substituir o ramo genérico de `DedicatedToolView.handleExecute` que devolve o arquivo de entrada por erro estruturado de operação indisponível. O mesmo vale para “extrair imagens” quando nenhuma imagem for encontrada: informar resultado vazio sem oferecer o PDF original como ZIP.
3. Remover respostas documentais fabricadas em `BrowserDocumentCorePort` (`inspect_docx`, `create_docx`, `audit_project` e disponibilidade de modelos). Operação sem implementação web deve falhar com código explícito; o desktop pode continuar usando os comandos nativos existentes.
4. Remover textos e níveis de confiança inventados dos fallbacks do OCR. Falha de worker ou de reconhecimento deve virar erro visível. Para OCR de PDF na web, exigir renderização real das páginas antes de declarar suporte; enquanto o caminho não estiver demonstrado, deixar essa combinação indisponível. OCR de imagens permanece se passar em teste com imagem real.
5. Remover a simulação de instalação de capacidades no navegador. Estado `installed` só pode resultar de verificação do componente realmente disponível; o gerenciamento nativo permanece no port Tauri.

**Aceite:** nenhuma ferramenta conclui com `success` usando bytes de entrada inalterados por falta de executor; falhas não produzem download nem entrada de histórico; cards e mensagens de indisponibilidade correspondem à plataforma. Testes focados devem cobrir ferramenta sem executor, OCR que falha e ausência de imagens.

## 2. Corrigir resultados enganosos e perda silenciosa — prioridade alta

**Arquivos principais:** `apps/client/src/platform/pdf-engine.ts`, `DedicatedToolView.tsx`, `CompressPdfPanel.tsx`, `useRecentOperations.ts` e testes correspondentes.

1. Calcular economia de compressão a partir dos tamanhos reais. Quando o resultado crescer, exibir crescimento ou ausência de redução. Não aceitar seleção de níveis que usam exatamente o mesmo algoritmo: manter apenas a opção efetiva ou ligar a escolha a parâmetros que produzam diferença comprovada no engine já existente.
2. Na junção, abortar e identificar o arquivo inválido; não ignorá-lo e entregar um PDF incompleto. Na extração de páginas, rejeitar seleção vazia ou fora do intervalo em vez de devolver o original. Manter validação de PDF inválido antes do estado de sucesso.
3. Remover a limpeza de histórico baseada em palavras do nome do arquivo. Se a migração de registros antigos ainda for necessária, filtrar apenas identificadores conhecidos desses registros; preservar nomes reais como `contrato.pdf` e `relatorio.pdf`.
4. Diferenciar revisão e tradução executadas pelo sidecar nativo das rotinas simples do navegador. Não chamar o dicionário local de tradução neural nem registrar modelo instalado sem verificação. Se a web não atender ao contrato da ferramenta, declarar indisponibilidade em vez de apresentar equivalência.

**Aceite:** tamanho e percentual exibidos conferem com o arquivo baixado; arquivos inválidos interrompem a operação sem saída parcial; histórico legítimo sobrevive à recarga; origem e capacidade do motor informado ao usuário correspondem à execução.

## 3. Reunificar a execução nas interfaces existentes — prioridade alta

**Arquivos principais:** `DedicatedToolView.tsx`, `QuickToolRunnerModal.tsx`, `packages/tool-sdk/src/index.ts`, `apps/client/src/platform/document-core.ts`, adapters browser/Tauri e, apenas se necessário, contratos existentes.

1. Mapear por ferramenta os comandos já implementados no Rust/sidecar e os transformadores realmente suportados no navegador. A matriz resultante deve ter colunas `web`, `desktop`, `entrada`, `saída` e `executor`; não criar executor para preencher lacunas.
2. Fazer a tela dedicada chamar o mesmo Tool Runner/port usado pelo restante do produto. Reusar o caminho de `import_document` e comandos nativos já empregados por `QuickToolRunnerModal`; manter funções de `pdf-lib` atrás do adapter browser para as ferramentas web válidas.
3. No desktop, registrar o artifact derivado e a operação no Document Core antes de anunciar sucesso. A exportação para download deve usar o artifact resultante. No navegador, conservar o resultado local e declarar com precisão quando não há projeto persistente.
4. Centralizar o tratamento de `running`, `success`, `error` e cancelamento no fluxo afetado; nunca adicionar histórico de uma tentativa falha. Preservar os originais importados.

**Aceite:** a mesma ferramenta chega ao executor correspondente à plataforma, sem chamada direta da UI a filesystem/SQLite/sidecar; no desktop, reabrir o projeto mostra o novo artifact e sua linhagem; nenhuma operação altera o hash do original.

## 4. Provar os fluxos e alinhar as declarações — gate final

**Arquivos principais:** testes de `apps/client/src/platform`, `apps/client/e2e`, testes do Document Core afetados, `README.md`, `docs/ROADMAP.md` e `docs/DEFINITION-OF-DONE.md`.

1. Usar fixtures pequenas e válidas: PDF de duas páginas, PDF já comprimido, PDF inválido, imagem com texto conhecido e nomes reais de documentos. Verificar bytes, MIME, páginas e conteúdo da saída; não apenas presença de botão ou de mensagem de sucesso.
2. Cobrir pelo menos os fluxos alterados: compressão sem redução, junção com segundo arquivo inválido, seleção vazia, OCR bem-sucedido e falho, ferramenta indisponível, histórico após recarga e persistência/linhagem nativa. Testar os caminhos web e desktop separadamente.
3. Rodar `pnpm check`, `pnpm test`, `pnpm build:web`, `pnpm test:e2e`, `cargo fmt --all --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, `cargo test --workspace --locked`, Ruff e pytest. Executar apenas os gates de instalador previstos no checklist quando houver pacote candidato; registrar resultado e limitações.
4. Ajustar README, roadmap e critérios de conclusão para distinguir ferramenta anunciada, implementada no core, integrada na UI e validada no produto instalado. Não declarar concluída uma combinação de ferramenta e plataforma sem evidência do fluxo correspondente.

**Aceite final:** nenhuma saída fictícia, perda silenciosa ou estatística fabricada permanece nos fluxos expostos; cada ferramenta visível tem executor e teste proporcional; documentação e interface descrevem somente capacidades demonstradas. Validação de máquina limpa continua como gate separado de release.

## Ordem de entrega

1. **Bloqueio dos sucessos falsos:** etapa 1. Já torna a interface honesta sem esperar integração ampla.
2. **Integridade dos resultados:** etapa 2. Corrige dados apresentados ao usuário e perda de histórico.
3. **Integração com o core:** etapa 3. Reusa a arquitetura existente e elimina o desvio da tela dedicada.
4. **Validação e documentação:** etapa 4. Fecha os gates afetados e registra o estado comprovado.

Cada etapa pode ser revista separadamente. Mudanças de código e documentação pertinentes à mesma correção permanecem juntas; não há exigência de criar commits neste plano.

## Registro de execução — 24/09/2026

- **Etapas 1 e 2:** o Launcher filtra ferramentas pelo executor da plataforma; sucessos e dados
  fabricados foram removidos dos fluxos expostos. PDF inválido na junção interrompe a operação e
  identifica o arquivo. Divisão respeita todos os intervalos; seleção vazia falha. A compressão
  informa a variação calculada pelo tamanho do arquivo produzido. O histórico preserva nomes reais.
- **Etapa 3:** as ferramentas visíveis da tela dedicada passam pelo Tool Runner. Compressão e
  organização usam o Document Core em memória na web e o core Rust com artifacts persistidos no
  desktop. As demais transformações web funcionam no adapter do client; o registro nativo de
  artifacts para junção, divisão, rotação e comparação ainda não existe.
- **Etapa 4:** `pnpm check`, `pnpm test` (74 testes), `pnpm build:web` e `pnpm test:e2e` (12 testes)
  passaram. `cargo fmt --all --check`, `cargo clippy --workspace --all-targets --locked -- -D
  warnings` e `cargo test --workspace --locked` passaram (49 testes; 1 ignorado por requisito
  opcional). Ruff e pytest passaram (35 testes Python). Os testes E2E exercitam o client web;
  a execução do aplicativo Tauri instalado e a máquina limpa permanecem sem validação.

OCR, revisão, tradução, extração de imagens, conversão e proteção permanecem ocultos quando não
existe fluxo da tela dedicada validado. Não foi criado commit, PR, release ou deploy.

## Continuação — registro nativo das quatro ferramentas

Junção, divisão, rotação e comparação continuam processando no client. No desktop, antes de anunciar
sucesso, a porta Tauri importa os arquivos ou textos usados, registra o resultado e a operação no
Document Core e lê os bytes do artifact persistido para o download. A junção registra uma aresta por
PDF de entrada; a divisão com vários intervalos registra o ZIP produzido. A validação automatizada
cobre o caminho de persistência e a reabertura da linhagem no core.

Na janela Tauri de desenvolvimento, executei as quatro ferramentas sobre dados sintéticos no projeto
temporário `NexoHub-QA-2026-09-24`. O SQLite registrou duas entradas e um relatório na comparação,
duas entradas e um PDF de três páginas na junção, uma entrada e um ZIP com duas partes PDF na divisão,
e uma entrada e um PDF com rotação de 90° na rotação. Também foi corrigido o estado da tela dedicada,
que mantinha o resultado anterior ao trocar de ferramenta. O instalador e a máquina limpa continuam
sem validação.

## Fase de complementação — 24/10/2026

**Estado:** UX-C1 concluído e validado no website. Os demais complementos seguem
seus gates. As restrições e evidências de setembro acima são históricas; este adendo
trata somente as ferramentas atuais no website e não reabre o fechamento nativo. A ordem única
e os gates estão no [roadmap](../../ROADMAP.md#complementação-das-ferramentas-atuais--24102026).
Não criar executores paralelos, habilitar ferramentas planejadas ou instalar todos os candidatos.

### Q-C0 — Homologação antes de ampliar promessas comerciais

**Modificar:** `docs/DEFINITION-OF-DONE.md`, `docs/THIRD_PARTY_LICENSES.md` e o documento técnico
da ferramenta afetada. **Fixtures:** diretórios `__fixtures__` de `apps/client/src/platform`
e geradores de testes existentes; usar material sintético ou com licença demonstrada.

- [ ] Registrar por ferramenta um corpus versionado com origem/licença/hash e expectativa:
  imagens fotográficas e gráficas, PDF textual/digitalizado, CropBox/rotação, fontes incorporadas,
  campos, tabelas sem/com borda e arquivos inválidos. Gerar arquivos grandes em teste.
- [ ] Fixar no documento da ferramenta quais casos são suportados, recusados e ainda não
  medidos. Preservar todos os testes anteriores; nenhum ganho pode ocultar perda em outro caso.
- [ ] Antes da integração de cada candidato, registrar versão publicada, licença do wrapper,
  binário/codec/modelo, dependências transitivas, manutenção e advisories. Alterar
  `apps/client/package.json`/lockfile apenas depois dessa avaliação e do aceite da prova técnica.
- [ ] Medir baseline e candidato no mesmo corpus/dispositivo, frio/quente, bytes transferidos,
  JS/WASM carregado e memória quando disponível. Aceitar somente se acrescentar capacidade ou
  qualidade comprovada, sem bloquear a interface; justificar o custo e fixar limites no documento.
- [ ] Definir o teste de resultado por tipo: pixels/dimensões para imagem; texto/objetos/regiões
  para PDF; células/estrutura para Excel; taxa de erro de caracteres/palavras para OCR. Métrica
  heurística do motor não deve aparecer como probabilidade de correção do documento.

### Consolidação incremental Q-C0 — 27/10/2026

Base `a9f3385`, após commit autorizado da avaliação isolada AVIF. O
[índice JSON](../../quality/q-c0.json) cobre as 35 ferramentas ativas, com origem/licença,
referências com SHA-256, expectativas, recusas, limites e testes. O
[relatório](../../quality/README.md) distingue arquivo, gerador e manifesto; cobertura
do índice não demonstra execução dos motores nem fidelidade dos downloads.

`pnpm quality:check` verifica cobertura exata do catálogo ativo, referências locais e hashes;
não inclui ferramentas planejadas e não exporta o checker para o aplicativo. Os critérios
globais acima continuam parciais: corpus amplo, medições por dispositivo, avaliações de
candidatos e homologação instalada permanecem nas entregas responsáveis. Sem dependências
novas, integração de Camelot/Docling ou alteração de runtime. DOC-C2 fora do escopo.

Validação local: gate Q-C0 com 7 testes, suíte Tool Registry com 10 testes, `pnpm check` e
`pnpm licenses:check` aprovados. Sem repetição de benchmarks, build, E2E ou instalação Windows
nesta fatia de metadados/testes. Commit local autorizado posteriormente pelo usuário;
sem push, deploy ou integração no checkout principal.

### Q-C0 — resultado das operações básicas PDF (27/10/2026)

Base `f50a1c0`, após commit autorizado do índice. Próxima fatia: [PDF estático básico](../../quality/PDF-BASICO.md),
com corpus autoral para juntar, dividir, organizar e girar. Texto é conferido em PDF.js;
MediaBox, CropBox, rotação e bytes JPEG em pdf-lib; originais comparados antes/depois.
Os downloads reais das quatro mesas recebem E2E na raiz e no executor `/hub/`.

O cenário de seleção vazia em `reorganizePdfDocument` produzia PDF em branco. A validação
agora recusa esse caso, índices inválidos e rotação não finita/fora de múltiplos de 90 com
código estruturado antes de criar a saída. Teste negativo observado antes da correção.
Os quatro registros passam a perfil restrito do corpus estático, sem afirmar preservação
universal de formulários, anexos, assinaturas ou metadados globais. Q-C0 permanece parcial.

Sem dependências, nova interface ou integração de motores candidatos. DOC-C2 excluído;
commit local desta fatia autorizado posteriormente pelo usuário, sem push, deploy ou
mudança no checkout principal.

Validação: check, 766 testes do cliente, 10 do Tool Registry, builds raiz e `/hub/`,
4 E2E específicos na raiz e 248 E2E em `/hub/` aprovados. Testes específicos 15/15;
revisão única sem achados materiais. Suíte E2E inteira da raiz e instalação Windows
não repetidas nesta fatia. Evidências e limites no documento vinculado acima.

### Q-C0 — recorte e sobreposições PDF (27/10/2026)

Base `82db4d1`, após commit autorizado do PDF básico. Corpus e resultados em
[PDF-GEOMETRIA.md](../../quality/PDF-GEOMETRIA.md): recorte, marca d’água, numeração e
assinatura visual, nas quatro rotações e com CropBox. Novos testes conferem caixas,
streams/JPEG/texto original, textos acrescentados e posições; controles negativos recusam
saída sem carimbo, caixa alterada ou numeração correta na posição errada.

Reutilizados os executores atuais, sem alteração de código do aplicativo ou dependências.
`tool-quality.spec.ts` passou a aceitar `/hub/` e integrar o executor da subpasta. Índice:
26 perfis restritos e 9 regressões; Q-C0 global continua parcial. Não certifica PDF complexo,
tipografia universal, hardware físico ou Windows instalado. Tolerância horizontal de 0,5 pt
documentada, distinguindo largura com kerning e avanço de texto extraído.

Commit local autorizado posteriormente pelo usuário, sem push, deploy ou integração no
checkout principal. DOC-C2 excluído.
Resultados finais de validação pertencem ao relatório vinculado.

### Q-C0 — conversão e extração raster (27/10/2026)

Base `d18ae56`, após commit autorizado da geometria. Próxima fatia em
[PDF-RASTER.md](../../quality/PDF-RASTER.md): imagens→PDF, PDF→JPG e extração de imagens,
com corpus autoral, provas de pixels/alpha/dimensões/ordem/ZIP e originais preservados.
Renderização aferida no Chromium real, sem usar o JPEG sintético do caminho de teste Node
como prova de fidelidade. E2E integra também o executor normal de `/hub/`.

Correção pontual do mapeamento `NO_IMAGES_FOUND` para aviso existente em pt-BR após
regressões no runner/E2E; motores e geometria da interface preservados. Sem dependências
ou candidato externo. Índice passa
a 29 perfis restritos e 6 regressões. Q-C0 global, hardware físico e Windows continuam
parciais/pendentes; DOC-C2 excluído. Commit local autorizado posteriormente pelo usuário,
sem push, deploy ou integração na principal.
Resultados e limites ficam no relatório vinculado.

Validação: check, 790 testes do cliente, 10 do Tool Registry, builds raiz e `/hub/`,
13 E2E pertinentes em cada base aprovados. Regressão do aviso observada antes da correção;
revisão única sem achados materiais. Sem E2E integral ou homologação instalada nesta fatia.

### Q-C0 — proteger e desbloquear PDF (27/10/2026)

Base `75782aa`, após commit autorizado de raster. Corpus rico e variantes fixas em
[PDF-ACESSO.md](../../quality/PDF-ACESSO.md): AES-256/RC4, credenciais exatas, flags de
permissão, texto, geometria, valores/widgets, Info e anexos. Comparação PDF.js antes/depois,
com controles explícitos e verificação estrutural/editável em pdf-lib; limites de independência
do leitor registrados. E2E nas duas bases, incluindo senha incorreta e recusa de ByteRange.

Sem mudança dos executores, UI, dependências ou arquitetura. Índice: 31 perfis restritos,
4 regressões. Q-C0 global e homologação instalada continuam parciais; DOC-C2 excluído.
Commit local autorizado posteriormente pelo usuário, sem push, deploy ou integração na
principal. Evidências no relatório vinculado.

Validação: check, 50 testes pertinentes, 10 do Tool Registry, builds raiz e `/hub/`,
quatro E2E em cada base aprovados. Revisão única sem achados materiais. Sem repetição das
suítes completas do cliente/E2E ou instalação Windows nesta fatia de testes/documentação.

### Q-C0 — comparação e revisão de texto (27/10/2026)

Base `62cd023`, após commit autorizado de acesso PDF. Corpus e limites em
[TEXTO.md](../../quality/TEXTO.md): linhas, Unicode, identificadores, relatório baixado,
aplicação explícita e dicionário real no Chromium. O par selecionado 1×3 passa ao executor,
inclusive com documento 2 vazio; mensagem sem sugestões deixa de afirmar correção linguística.
Ambas as falhas foram reproduzidas antes das correções. Sem dependência nova.

Índice: 33 perfis restritos, 2 regressões (`pdf-compress` e `scan-to-pdf`), 24 corpora.
Q-C0 global permanece parcial: fidelidade ampla, medições por dispositivo, nova matriz de
larguras/teclado/tema para texto e Windows instalado continuam pendentes. DOC-C2 excluído.
Commit local desta etapa autorizado posteriormente pelo usuário, sem push, deploy ou
integração na principal.

Validação: 808 testes do cliente, 44 do domínio, check e quality:check aprovados;
builds raiz e `/hub/` aprovados. E2E e revisão final registrados no relatório vinculado.

### UX-C1 — Visualização PDF reutilizável nas mesas atuais

**Modificar:** painéis `CropPdfPanel`, `SignPdfPanel`, `RedactPdfPanel`, `WatermarkPdfPanel`,
`PageNumbersPdfPanel`, `FormFillPdfPanel`, `PdfToJpgPanel` e `PdfToMarkdownPanel` em
`apps/client/src/features/launcher/`, `styles.css` e i18n.
**Criar:** `features/launcher/PdfViewportControls.tsx` e teste próximo.
**Testar:** `e2e/tool-workspace-size.spec.ts`, `tool-workspace-regressions.spec.ts`.

**Interface proposta:** `PdfViewportControls({ page, pageCount, zoom, onPageChange,
onZoomChange, onFitWidth })`; página 1-based, zoom multiplicador, callbacks numéricos e ajuste
sem argumentos. Não armazenar estado do motor dentro dos controles.

- [x] Testar página 1/última, saltos, ajuste à largura, zoom e resize em 390–1440px; manter
  estado selecionado por teclado e controles legíveis, sem duplicar os já existentes no editor.
- [x] Integrar incrementalmente controles e superfície ampla, renderizando apenas páginas
  necessárias. Zoom de visualização não pode alterar coordenadas do documento ou opções de export.
- [x] Conferir por download marca, assinatura, recorte, ocultação e numeração nas coordenadas
  escolhidas após zoom/rotação/CropBox; cancelar fila de prévias ao trocar arquivo/sair.
- [x] Editor e comparador preservam seus motores/controles especializados e consomem apenas
  elementos compatíveis; não migrar todos para um novo viewer em uma única alteração.

### SEC-C1 — Ocultação com remoção real, sem rasterizar o documento inteiro

**Modificar:** `platform/pdf-engine.ts` (`redactPdfDocument`), `features/launcher/RedactPdfPanel.tsx`,
`DedicatedToolView.tsx`, `platform/launcher-tool-runner.ts`; testes `pdf-security.test.ts` e
`e2e/security-excel-quality.spec.ts`. **Criar:** `platform/pdf-redaction-engine.ts` e testes,
encapsulando o motor escolhido sem expor seu runtime à UI.

- [x] Provar [EmbedPDF v2](https://github.com/embedpdf/embed-pdf-viewer/tree/v2), em especial
  `@embedpdf/plugin-redaction@2.15.1` (MIT), com PDFium já instalado; manter todos os pacotes da
  família na mesma versão. Avaliar necessidade do plugin/UI versus acesso ao motor; não instalar
  a suíte inteira nem adotar v3 em desenvolvimento ou CloudPDF/server por associação de nome.
- [x] Testar remoção em texto, imagem, Form XObject reutilizado, rotação e CropBox. O texto
  ocultado não pode ser extraído nem reaparecer em conteúdo residual/incremental; conteúdo fora
  da região, links e campos devem ser preservados ou a operação recusada com motivo específico.
- [x] Manter o contrato `RedactPdfOptions` e novo artifact imutável. A revisão aplicada e o
  download devem usar os mesmos bytes; prévia de retângulo sozinho não comprova remoção.
- [x] Auditar cópias residuais em objetos/streams/metadados associados ao trecho. Se não houver
  remoção segura para uma classe de PDF, manter o modo raster atual explicitamente identificado,
  com suas perdas, ou recusar; nunca trocar automaticamente por cobertura visual recuperável.
- [x] Atualizar limites e evidências em `docs/AUDITORIA-PROTECAO-TARJA-EXCEL-WEB-2026-10-23.md`
  como resultado posterior, preservando a auditoria original. Proteger/Desbloquear compartilham
  o corpus de segurança; não trocar sua criptografia por consequência desta integração.


Resultado de 24/10/2026: modo de preservação opcional no website, restrito ao perfil descrito
na auditoria de segurança. PDFium 2.15.1 existente, sem novos pacotes; remoção nativa seguida
de gravação completa e reconstrução do grafo. Recursos não utilizados são podados em páginas,
Forms e aparências sem alterar recursos compartilhados de outros proprietários. Documentos
fora do perfil são recusados; o modo imagem continua padrão e só muda mediante escolha do
usuário. Revisão e download compartilham o Blob aplicado. Revisão independente encontrou três
falhas materiais, corrigidas com regressões: recursos órfãos de aparências, dicionários privados
de anotações e caixas invertidas. Compatibilidade universal e desempenho nos limites continuam
fora da homologação; não ampliar fontes, imagens ou classes sem novas provas.

### OCR-C1 — OCR medido e preparação compartilhada com o scanner

**Modificar:** `platform/browser-ocr.ts`, `browser-ocr.test.ts`, `browser-ocr-searchable.test.ts`,
`pdf-ocr-text-layer.ts`, `features/launcher/OcrScannerPanel.tsx` e `e2e/language-image-quality.spec.ts`.
**Criar:** `platform/document-image-preprocessing.ts` e testes se o ganho for demonstrado.

**Interface proposta:** `prepareDocumentImage(source: Blob, options: DocumentImagePreparationOptions,
signal?: AbortSignal): Promise<Blob>`; opções tipadas de perspectiva/alinhamento/contraste;
nenhuma mutação da imagem original. DOC-C2 consome este mesmo adaptador.

- [x] Medir Tesseract.js já instalado em corpus pt-BR com acentos, números, fotos inclinadas,
  baixo contraste e PDFs mistos; separar página digitalizada de página com texto extraível.
- [x] Comparar pré-processamento atual com OpenCV.js de release estável Apache-2.0, sob demanda
  em worker. Preservar opção de original e rejeitar correção automática que corte conteúdo.
- [x] Testar cancelamento e descarte entre páginas; PDF pesquisável mantém imagem e alinha texto
  às caixas reais. Exibir confiança como indicador de OCR, sem garantia de acerto.
- [x] PaddleOCR/Docling são candidatos de avaliação fora do browser atual, não instalações
  automáticas. Exigem decisão de runtime, recursos, privacidade e licenças dos pesos; não anunciar
  suporte pela existência de pacote Python ou por fallback remoto invisível.

**Execução OCR-C1 — 26/10/2026:** entrega no website local, sem iniciar DOC-C2. Corpus e
resultado técnico em [OCR-C1](../../OCR-C1.md); quatro PNGs sintéticos versionados, com texto
esperado e hashes, mais PDF misto de duas páginas. As imagens de inclinação/perspectiva são
simulações, sem homologação de fotografias de campo. Tesseract/core 7.0.0 existentes, 24
reconhecimentos reais; CER/WER, custo e política de cache registrados no JSON de medições.

OpenCV 4.12.0 (`@techstark/opencv-js@4.12.0-release.1`) foi testado em worker isolado e
**reprovado para integração**: sem ganho sobre o preparo linear e com regressão em perspectiva,
mais 10,9 MB de JS/WASM. Não foi adicionado ao package.json/lockfile nem foi criado o adaptador
condicionado `prepareDocumentImage`. Preservada a opção original; nenhuma correção geométrica
automática foi habilitada. PaddleOCR/Docling permanecem sujeitos a decisão de runtime, sem instalação.

Implementados: classificação por página, preservação da camada textual existente sem espaços
artificiais entre fragmentos, worker proprietário cancelável desde a inicialização, descarte de
recursos e resultados tardios, sinal na geração da camada, validação de caixas e relatório pt-BR
por página. O PDF misto preservou streams de imagem, texto nativo único e alinhamento real da
primeira linha OCR. A revisão independente identificou fragmentação textual e inicialização
não cancelável; ambos corrigidos com regressões RED→GREEN. Não há homologação nativa nem
equivalência comercial universal.

**Fechamento local:** formatter/lint/typecheck (`pnpm check`) aprovados; 728 unitários (665 client,
44 domínio, 16 SDK, 3 registry) com dois workers e revalidação final dos 24 testes de UI afetada;
builds raiz e `/hub/` aprovados; suíte geral da raiz com 284 E2E aprovados e cinco exclusivos da
subpasta pulados; executor oficial de `/hub/` com 175 aprovados. OCR está incluído nesse executor.
Inventário de licenças aprovado; package.json e lockfile inalterados. Capturas em
390/768/1024/1440 px, tema escuro e movimento reduzido preservadas e inspecionadas. Logs,
PDFs e capturas em `.superpowers/sdd/2026-10-25-ocr-c1/`; dados e corpus versionados no documento
técnico. Commit local autorizado posteriormente em 26/10/2026; sem push, deploy ou início de
DOC-C2. A principal permanece preservada.

### XL-C1 / MD-C1 — Tabelas e leitura documental verificáveis

**Execução XL-C1 autorizada em 26/10/2026**, após o commit OCR-C1 `f44071d` e árvore limpa.
DOC-C2 e MD-C1 permanecem fora desta execução. Sem commit adicional, push ou deploy implícitos.
Manter PDF.js, extrator e serializadores locais existentes; sem novos pacotes ou runtimes.

Sequência interna de XL-C1 (os checkboxes de aceite abaixo continuam sendo a fonte de verdade):
1. Corpus sintético com células verificadas por coordenada no XML XLSX/CSV: bordas, múltiplas
   páginas, vazios, cabeçalho abrangente, zeros, números pt-BR e fronteiras que cortam texto.
2. Ampliar `PdfToExcelOptions` com páginas 1-based, região normalizada e separadores de coluna;
   preservar extração automática compatível e recusar configurações inválidas/cortes de fragmentos.
   Região e separadores referem-se à página lógica antes da rotação, como o extrator atual.
3. Controles pt-BR na mesa atual; prévia por página, mesmas opções na exportação, preservação
   de valores como texto por padrão na UI, cancelamento/invalidação ao trocar entrada ou opções.
4. Conferir exportações reais, quatro larguras/temas, suítes e builds na raiz e `/hub/`; registrar
   evidências no documento técnico. A comparação isolada de Camelot/Docling foi autorizada
   posteriormente e executada conforme o registro abaixo; integração continua condicionada.

**Modificar:** `platform/excel-converter.ts`, `excel-converter.test.ts`,
`features/launcher/PdfToExcelPanel.tsx`, `PdfToMarkdownPanel.tsx`, `platform/pdf-engine.ts` e
`e2e/security-excel-quality.spec.ts`, `new-tools-quality.spec.ts`.

- [x] XL-C1: testar tabelas com borda/sem borda, múltiplas páginas, células vazias/mescladas,
  códigos com zeros e números pt-BR. Conferir o XLSX por célula e estrutura, não por tamanho.
- [x] Permitir selecionar página/região e corrigir separadores de colunas antes da exportação,
  reutilizando `extractPdfSpreadsheetData`/`PdfSpreadsheetData`; prévia e saída usam a mesma
  configuração. Não converter código em número nem reconstruir valores por suposição.
- [x] MD-C1: testar ordem de leitura em duas colunas, títulos/listas e tabelas; preservar texto
  completo e indicar páginas sem camada textual. Reutilizar OCR-C1 apenas por escolha explícita.
- [x] Avaliar [Camelot](https://github.com/camelot-dev/camelot) (MIT) para tabelas e
  [Docling](https://github.com/docling-project/docling) (código MIT, pesos separados) para estrutura.
  Comparação por documento/custo executada isoladamente em 26/10/2026: 14 casos/42 extrações.
  [Evidências](../../XL-C1-COMPARACAO-ISOLADA.md). **Integração condicionada:** Python/Node/backend
  não entram no website local sem decisão arquitetural. Avaliação concluída; integração não realizada.

### Registro local — XL-C1 (26/10/2026)

- Entrega funcional e corpus em [XL-C1.md](../../XL-C1.md), com matriz esperada, PDFs autorais,
  hashes, medições e limites. O cabeçalho visual mesclado conserva texto sem fabricar `mergeCells`.
- Páginas/região/separadores configuráveis na mesa existente; prévia por página e exportação
  compartilham opções. XLSX textual por padrão na UI; CSV conserva grafia com proteção de fórmulas.
  AbortSignal invalida tarefas e resultados; seleções que cortam fragmentos são recusadas.
- Testes específicos em `excel-selection.test.ts`, `excel-cancellation.test.ts` e
  `e2e/excel-selection.spec.ts`, além do painel e dos controles legados no E2E de segurança.
  Não foi necessário alterar Markdown nem `pdf-engine.ts`; o extrator já era reexportado por ele.
- Revisão reproduziu navegação incorreta de `1,3`, corrigida com teste antes/depois. O descarte
  da última página também ganhou regressão de cancelamento. Oito cenários de medição passaram
  na comparação das células, preservando os bytes dos originais.
- Camelot/Docling inicialmente não executados. Após autorização explícita, comparação isolada
  concluída em 26/10/2026, com versões/modelos fixados, qualidade por célula, tempo e RSS.
  Network recuperou a matriz-alvo nos dois PDFs; Docling Accurate não detectou tabela sem bordas.
  42 extrações e reabertura dos XLSX verificadas; cinco controles do avaliador, Ruff e `pnpm check`
  aprovados. Hashes de 306 arquivos do aplicativo/manifests preservados nesta avaliação.
  Integração continua condicionada; MD-C1 e DOC-C2 não iniciados. Commit de XL-C1 e da comparação
  isolada autorizado posteriormente pelo usuário em 26/10/2026; sem push/deploy.
- Gates: formatter/lint/tipos, 750 testes unitários, builds raiz e `/hub/`, auditoria de licenças;
  290 E2E na raiz (cinco exclusivos da subpasta ignorados) e 181 na suíte oficial `/hub/`.
  Limitações e execução unitária inicialmente interrompida registradas no documento técnico.

### Execução autorizada — MD-C1 (26/10/2026)

Base `74fb3b4`, worktree `fix/auditoria-website` inicialmente limpo. DOC-C2 e integração de
Camelot/Docling fora do escopo. Execução local sem commit, push ou deploy.

Sequência e interfaces (o checkbox MD-C1 acima permanece o aceite canônico):
1. Corpus autoral antes do código: duas colunas com blocos abrangentes, títulos/listas,
   tabela com vazios/zeros/barras e página sem texto, incluindo controle de texto curto.
2. Corrigir ordenação e formação de tabelas em `markdown-converter.ts`, com opção de ordem
   automática/por linhas/duas colunas e recusa de adivinhação sem evidência geométrica.
3. Propagar relatório de páginas pelo Tool Runner à mesa Markdown, indicar páginas sem texto
   por evidência real e oferecer abertura explícita do OCR-C1, sem executá-lo automaticamente.
4. Conferir código Markdown, visualização e download; cancelamento/invalidação; gates locais
   e documentação com limites. Sem nova dependência ou alteração de arquitetura.

Premissa: a geometria não determina semântica universalmente. Ordem automática conservadora,
com escolha manual; títulos abrangentes particionam as faixas. Texto ambíguo permanece visível.
Interfaces compartilhadas: resultado do conversor → Tool Runner → estado/painel e exportação;
novos campos serão opcionais no consumidor legado. E2E/testes/corpus focados adicionais serão
usados além dos arquivos já propostos, sem modificar módulos de Excel ou scanner.

### Registro local — MD-C1 (26/10/2026)

- [Evidências e limites](../../MD-C1.md), corpus autoral MPL-2.0 de quatro páginas, PDF fixo,
  matriz esperada, saída `.md` e seis medições com hashes dos originais preservados.
- Ordem automática conservadora ou manual por linhas/duas colunas; blocos abrangentes delimitam
  faixas. Âncoras mantêm vazios e valores literais de tabelas. Relatório por página substitui o
  aviso baseado em quantidade de caracteres. Página sem texto deixa marcador mesmo sem divisores.
- Mesa, Tool Runner e conversor compartilham opções e AbortSignal; alteração de arquivo/opções
  invalida resultado anterior. OCR-C1 abre com o original apenas por clique explícito, sem iniciar
  reconhecimento. `pdf-engine.ts` já reexportava a operação; nenhuma mudança foi necessária nele.
- Testes antes do código reproduziram ordem intercalada, vazios deslocados e omissão de aviso.
  Revisão independente única encontrou perda de barras/traços literais na prévia: escape na origem
  e regressões corrigiram o achado. Capturas detectaram contraste e numeração; controles agora
  exigem razão 4,5 e preservam início de lista. Campos/avisos novos usam catálogo pt-BR.
- Gates: formatter/lint/tipos e licenças aprovados; **772 unitários**, **296 E2E na raiz**
  (cinco exclusivos da subpasta ignorados) e **187 E2E oficiais em `/hub/`** aprovados; builds dos
  dois caminhos. Capturas de documento/opções em 390/768/1024/1440 px, ambos os temas e movimento
  reduzido, sem overflow horizontal. Geometria continua heurística, sem homologação universal.
- Sem dependência nova, integração de Camelot/Docling, alteração de scanner/DOC-C2, commit,
  push ou deploy durante a implementação. Commit de MD-C1 autorizado posteriormente pelo usuário,
  sem push/deploy. Base da execução `74fb3b4`; Tauri instalado não homologado.

### TR-C1 — Tradução: qualidade, carregamento e direitos de uso do modelo

**Modificar:** `docs/TRADUCAO-WEB.md`, `platform/translation-protocol.ts`, `translation-runtime.ts`
e testes, `translation-segmentation.ts`, `features/launcher/TranslateDocumentPanel.tsx` e
`e2e/translation-loading.spec.ts`; ADR-011 se houver alteração da seleção de modelos.

**Arquivos de apoio reconciliados:** `platform/translation-model.ts` e testes (tokenizer sem
consulta a `main`), fixtures autorais/baseline em `platform/__fixtures__/tr-c1/`, controladores
`scripts/medir-tr-c1.*`, `docs/TR-C1-VALIDACAO.md` e `docs/evidencias/tr-c1/`. Sem dependência nova.
`DedicatedToolView.tsx`, catálogo PT-BR e runner `/hub/` recebem somente o aviso de download
pertinente ao caminho browser e cobertura correspondente. O executor nativo mantém seus perfis.

- [x] Confirmar em fonte primária a licença dos pesos `Xenova/nllb-200-distilled-600M` e do
  modelo original. A licença reportada do NLLB inclui restrição não comercial; a consulta inicial
  da ficha havia sido bloqueada; foi resolvida na execução local registrada abaixo. Até confirmação e resolução, não declarar o tradutor
  homologado para exploração comercial. A licença do Transformers.js não libera os pesos.
- [x] Comparar modelos compatíveis e licenciados para o uso pretendido em pares pt/en/es,
  com textos longos, números, nomes e negações. Não escolher apenas por tamanho nem transpor
  automaticamente os modelos nativos do ADR-011 para o navegador.
- [x] Preservar worker, cache, progresso real, timeout por inatividade e cancelamento; medir
  primeiro download/inicialização/inferência em dispositivo modesto antes de trocar o perfil.
- [x] Documentar modelo, revisão/hash, licença, limites e qualidade observada. Publicar somente
  após resolver o gate de licença e validar tradução real; mocks de download não medem qualidade.

### Execução autorizada — TR-C1 (26/10/2026)

Base `3854b68`, worktree `fix/auditoria-website` inicialmente limpo. DOC-C2 fora do escopo;
sem commit, push ou deploy. Licenças antes de qualquer seleção de perfil.

1. Arquivar fichas/revisões/fontes primárias do NLLB original e ONNX e dos candidatos.
   NLLB original/conversão confirmados CC-BY-NC-4.0: não selecionar para uso comercial.
2. Comparar M2M100 (base MIT) e OPUS-MT (bases Apache-2.0) em corpus autoral pt/en/es,
   com inferência ONNX real local, nomes/números/negações e texto longo; não usar mocks como
   prova de qualidade. Conversões sem licença própria exigem origem e atribuição explícitas.
3. Somente após evidência, selecionar perfil browser compatível, fixar revisão e hashes,
   preservar worker/cache/progresso/timeout/cancelamento. Conforme correção de apresentação
   solicitada pelo usuário, a mesa informa somente o download necessário; licença/custo/limites
   ficam na documentação técnica.
   Atualizar ADR-011 se a seleção mudar. Sem transpor modelos nativos para o browser por suposição.
4. Testes RED→GREEN proporcionais, revisão única, gates web raiz e `/hub/`, documentação de
   qualidade e limites. Downloads/modelos apenas no diretório ignorado do ensaio/cache local.

Resultado local: 783 unitários aprovados; 297 E2E distintos na raiz (cinco ignorados existentes,
com repetição focada após corrigir preparo dos testes TR); 190 E2E oficiais em `/hub/`.
Builds e três E2E TR em ambas as bases repetidos após o catálogo final. Formatter, lint,
typecheck e licenças aprovados. Comparação real, hashes e limites em `docs/TR-C1-VALIDACAO.md`.
Medições na máquina disponível: Ryzen 5 3550H/32 GB; baixa RAM, WebGPU, Tauri instalado e
fidelidade fora do corpus não homologados. Nenhuma publicação ou aprovação comercial genérica.
DOC-C2 continua fora do escopo; HEAD permanece `3854b68`, índice sem alterações staged.

Premissa: confirmar licença não homologa qualidade semântica. Não corrigir valores ou negações
por gabarito; registrar falhas e revisão necessária. Modelos NC não serão baixados para este
ensaio de seleção de perfil do produto; a comparação executável usa candidatos permissivos.

Fechamento: commit de TR-C1, incluindo a simplificação do aviso, autorizado posteriormente pelo
usuário no mesmo worktree. Sem push/deploy e sem início de DOC-C2.

**Entrega de cada complemento:** teste de regressão ou corpus antes, código mínimo, verificação
da saída, gates do roadmap e evidências aqui. Não reclassificar recursos novos como correções já
entregues em `43f9c1a`; sem commit/push/deploy implícitos.

### Aplicação incremental do Q-C0 — IM-C1

Critérios web adicionados em `docs/DEFINITION-OF-DONE.md`; corpus sintético, hashes de entrada,
resultados esperados e medição de bundle registrados em `docs/IMAGE-WEB-QUALITY.md`. Nenhuma
dependência/modelo novo foi adotado em IM-C1; licenças dos motores candidatos e corpus de
PDF/OCR/Excel/tradução continuam pendentes nos respectivos complementos. O registro de execução
e os checkboxes de IM-C1 pertencem ao plano de PDF/Imagem, sem duplicação aqui.

### Registro de implementação — UX-C1 (24/10/2026)

- Base `59a3cb2`, preservando os commits IM-C1–IM-C4. Commit do UX-C1 autorizado posteriormente pelo usuário, sem
  push/deploy. Nenhuma dependência adicionada ou alteração no executor de saída.
- `PdfViewportControls` controlado e `PdfViewport` com estado apenas de zoom; integrados nas
  oito mesas previstas. Numeração permite explorar outras páginas sem mudar a página inicial
  da exportação; não desenha número antes dela. Editor/comparador não foram migrados.
- Cache de seis páginas por arquivo, além da primeira/última prévia existentes. Renderização
  PDF.js com sinal de cancelamento ao navegar, trocar arquivo ou sair; miniaturas de grade
  preservam sua fila serial. Limites de prévia existentes: 1800px e 3MP, sem ampliar uso de memória
  para simular um viewer vetorial. Zoom elevado pode pixelar: resolução adaptativa fica para
  uma etapa com orçamento medido de memória, sem aumentar as promessas desta entrega.
- Testes de navegação/zoom e resize nas oito mesas; arquivos sintéticos com CropBox e rotação.
  Downloads de recorte, marca, numeração, assinatura e ocultação conferidos por geometria e
  streams decodificados. Tarja desenhada após zoom é baixada/reaberta e seus pixels verificados;
  assinatura arrastada após zoom confere coordenadas do operador no PDF baixado.
- Revisão única apontou página lenta bloqueando a próxima. Reproduzido em teste e corrigido
  com cancelamento por solicitação; nova página inicia sem aguardar a anterior. Oclusão real
  no Markdown corrigida ao alinhar o conteúdo ao início da mesa, sem relaxar testes de clique.
- Capturas em 390/768/1024/1440px e tema escuro: artefatos em
  `/workspace/artifacts/complementacao-pdf-viewport-2026-10-24`. Sem overflow externo.
- Bundle principal `/hub/` 1054,29kB / 289,93kB gzip, acréscimo de 2,30kB / 1,09kB gzip sobre IM-C4
  neste ambiente. Limites de licença dos motores existentes seguem seus registros; esta etapa
  não introduz código de terceiros.

- Zoom proporcional também sobre textos, imagens e carimbos: teste de dimensão visual da marca
  reproduziu ampliação apenas da folha e passou com `zoom` CSS nativo junto da largura proporcional.
  Validado em Chromium, sem prometer homologação de versões antigas de outros navegadores.
- Removida rolagem externa redundante somente nas mesas com viewport, deixando a região inteira
  alcançável. Teste em altura de 1000px detectou o recorte pelo limite legado; confirmado nas oito
  mesas. Guard de leitura da fila de grades preservado e fortalecido por teste após desmontagem.

- Validação final: 603 testes unitários (540 client), 53 E2E de mesas/viewport na raiz e 82 E2E
  em `/hub/` aprovados; formatter/lint, tipagem de todos os pacotes e builds aprovados. Suíte
  geral da raiz: 211 aprovados/5 exclusivos da subpasta antes dos últimos ajustes proporcionais
  de zoom/rolagem; os 53 focados e 82 da subpasta cobrem esses ajustes. Guard final da fila de
  grades validado no teste fortalecido e na suíte completa de 603 testes, sem suprimir assertions.
- Commit do UX-C1 autorizado pelo usuário, sem push/deploy. Próximo complemento no índice: DOC-C1, valores de formulário na
  prévia e navegação por campo; não implementado nesta entrega.
