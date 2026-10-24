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

**Estado:** planejada. As restrições e evidências de setembro acima são históricas; este adendo
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

### UX-C1 — Visualização PDF reutilizável nas mesas atuais

**Modificar:** painéis `CropPdfPanel`, `SignPdfPanel`, `RedactPdfPanel`, `WatermarkPdfPanel`,
`PageNumbersPdfPanel`, `FormFillPdfPanel`, `PdfToJpgPanel` e `PdfToMarkdownPanel` em
`apps/client/src/features/launcher/`, `styles.css` e i18n.
**Criar:** `features/launcher/PdfViewportControls.tsx` e teste próximo.
**Testar:** `e2e/tool-workspace-size.spec.ts`, `tool-workspace-regressions.spec.ts`.

**Interface proposta:** `PdfViewportControls({ page, pageCount, zoom, onPageChange,
onZoomChange, onFitWidth })`; página 1-based, zoom multiplicador, callbacks numéricos e ajuste
sem argumentos. Não armazenar estado do motor dentro dos controles.

- [ ] Testar página 1/última, saltos, ajuste à largura, zoom e resize em 390–1440px; manter
  estado selecionado por teclado e controles legíveis, sem duplicar os já existentes no editor.
- [ ] Integrar incrementalmente controles e superfície ampla, renderizando apenas páginas
  necessárias. Zoom de visualização não pode alterar coordenadas do documento ou opções de export.
- [ ] Conferir por download marca, assinatura, recorte, ocultação e numeração nas coordenadas
  escolhidas após zoom/rotação/CropBox; cancelar fila de prévias ao trocar arquivo/sair.
- [ ] Editor e comparador preservam seus motores/controles especializados e consomem apenas
  elementos compatíveis; não migrar todos para um novo viewer em uma única alteração.

### SEC-C1 — Ocultação com remoção real, sem rasterizar o documento inteiro

**Modificar:** `platform/pdf-engine.ts` (`redactPdfDocument`), `features/launcher/RedactPdfPanel.tsx`,
`DedicatedToolView.tsx`, `platform/launcher-tool-runner.ts`; testes `pdf-security.test.ts` e
`e2e/security-excel-quality.spec.ts`. **Criar:** `platform/pdf-redaction-engine.ts` e testes,
encapsulando o motor escolhido sem expor seu runtime à UI.

- [ ] Provar [EmbedPDF v2](https://github.com/embedpdf/embed-pdf-viewer/tree/v2), em especial
  `@embedpdf/plugin-redaction@2.15.1` (MIT), com PDFium já instalado; manter todos os pacotes da
  família na mesma versão. Avaliar necessidade do plugin/UI versus acesso ao motor; não instalar
  a suíte inteira nem adotar v3 em desenvolvimento ou CloudPDF/server por associação de nome.
- [ ] Testar remoção em texto, imagem, Form XObject reutilizado, rotação e CropBox. O texto
  ocultado não pode ser extraído nem reaparecer em conteúdo residual/incremental; conteúdo fora
  da região, links e campos devem ser preservados ou a operação recusada com motivo específico.
- [ ] Manter o contrato `RedactPdfOptions` e novo artifact imutável. A revisão aplicada e o
  download devem usar os mesmos bytes; prévia de retângulo sozinho não comprova remoção.
- [ ] Auditar cópias residuais em objetos/streams/metadados associados ao trecho. Se não houver
  remoção segura para uma classe de PDF, manter o modo raster atual explicitamente identificado,
  com suas perdas, ou recusar; nunca trocar automaticamente por cobertura visual recuperável.
- [ ] Atualizar limites e evidências em `docs/AUDITORIA-PROTECAO-TARJA-EXCEL-WEB-2026-10-23.md`
  como resultado posterior, preservando a auditoria original. Proteger/Desbloquear compartilham
  o corpus de segurança; não trocar sua criptografia por consequência desta integração.

### OCR-C1 — OCR medido e preparação compartilhada com o scanner

**Modificar:** `platform/browser-ocr.ts`, `browser-ocr.test.ts`, `browser-ocr-searchable.test.ts`,
`pdf-ocr-text-layer.ts`, `features/launcher/OcrScannerPanel.tsx` e `e2e/language-image-quality.spec.ts`.
**Criar:** `platform/document-image-preprocessing.ts` e testes se o ganho for demonstrado.

**Interface proposta:** `prepareDocumentImage(source: Blob, options: DocumentImagePreparationOptions,
signal?: AbortSignal): Promise<Blob>`; opções tipadas de perspectiva/alinhamento/contraste;
nenhuma mutação da imagem original. DOC-C2 consome este mesmo adaptador.

- [ ] Medir Tesseract.js já instalado em corpus pt-BR com acentos, números, fotos inclinadas,
  baixo contraste e PDFs mistos; separar página digitalizada de página com texto extraível.
- [ ] Comparar pré-processamento atual com OpenCV.js de release estável Apache-2.0, sob demanda
  em worker. Preservar opção de original e rejeitar correção automática que corte conteúdo.
- [ ] Testar cancelamento e descarte entre páginas; PDF pesquisável mantém imagem e alinha texto
  às caixas reais. Exibir confiança como indicador de OCR, sem garantia de acerto.
- [ ] PaddleOCR/Docling são candidatos de avaliação fora do browser atual, não instalações
  automáticas. Exigem decisão de runtime, recursos, privacidade e licenças dos pesos; não anunciar
  suporte pela existência de pacote Python ou por fallback remoto invisível.

### XL-C1 / MD-C1 — Tabelas e leitura documental verificáveis

**Modificar:** `platform/excel-converter.ts`, `excel-converter.test.ts`,
`features/launcher/PdfToExcelPanel.tsx`, `PdfToMarkdownPanel.tsx`, `platform/pdf-engine.ts` e
`e2e/security-excel-quality.spec.ts`, `new-tools-quality.spec.ts`.

- [ ] XL-C1: testar tabelas com borda/sem borda, múltiplas páginas, células vazias/mescladas,
  códigos com zeros e números pt-BR. Conferir o XLSX por célula e estrutura, não por tamanho.
- [ ] Permitir selecionar página/região e corrigir separadores de colunas antes da exportação,
  reutilizando `extractPdfSpreadsheetData`/`PdfSpreadsheetData`; prévia e saída usam a mesma
  configuração. Não converter código em número nem reconstruir valores por suposição.
- [ ] MD-C1: testar ordem de leitura em duas colunas, títulos/listas e tabelas; preservar texto
  completo e indicar páginas sem camada textual. Reutilizar OCR-C1 apenas por escolha explícita.
- [ ] Avaliar [Camelot](https://github.com/camelot-dev/camelot) (MIT) para tabelas e
  [Docling](https://github.com/docling-project/docling) (código MIT, pesos separados) para estrutura.
  Registrar comparação por documento e custo. **Integração condicionada:** Python/Node/backend
  não entram no website local sem decisão arquitetural; a subetapa fica bloqueada, não concluída.

### TR-C1 — Tradução: qualidade, carregamento e direitos de uso do modelo

**Modificar:** `docs/TRADUCAO-WEB.md`, `platform/translation-protocol.ts`, `translation-runtime.ts`
e testes, `translation-segmentation.ts`, `features/launcher/TranslateDocumentPanel.tsx` e
`e2e/translation-loading.spec.ts`; ADR-011 se houver alteração da seleção de modelos.

- [ ] Confirmar em fonte primária a licença dos pesos `Xenova/nllb-200-distilled-600M` e do
  modelo original. A licença reportada do NLLB inclui restrição não comercial; a consulta direta
  da ficha foi bloqueada na pesquisa. Até confirmação e resolução, não declarar o tradutor
  homologado para exploração comercial. A licença do Transformers.js não libera os pesos.
- [ ] Comparar modelos compatíveis e licenciados para o uso pretendido em pares pt/en/es,
  com textos longos, números, nomes e negações. Não escolher apenas por tamanho nem transpor
  automaticamente os modelos nativos do ADR-011 para o navegador.
- [ ] Preservar worker, cache, progresso real, timeout por inatividade e cancelamento; medir
  primeiro download/inicialização/inferência em dispositivo modesto antes de trocar o perfil.
- [ ] Documentar modelo, revisão/hash, licença, limites e qualidade observada. Publicar somente
  após resolver o gate de licença e validar tradução real; mocks de download não medem qualidade.

**Entrega de cada complemento:** teste de regressão ou corpus antes, código mínimo, verificação
da saída, gates do roadmap e evidências aqui. Não reclassificar recursos novos como correções já
entregues em `43f9c1a`; sem commit/push/deploy implícitos.
