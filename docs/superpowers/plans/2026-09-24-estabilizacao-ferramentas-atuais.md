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
