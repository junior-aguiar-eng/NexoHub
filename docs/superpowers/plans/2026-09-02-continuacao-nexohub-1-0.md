# Plano de implementação da continuação do NexoHub 1.0

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar este plano tarefa por tarefa. As etapas usam
> checkboxes (`- [ ]`) para acompanhamento.

**Objetivo:** transformar a base técnica existente em um produto Windows utilizável de ponta a
ponta, validado em instalação limpa e apto a avançar de `alpha` para release candidate.

**Arquitetura:** preservar o monólito modular, o client React compartilhado e as fronteiras de
ports and adapters. A sequência começa pelo caminho crítico seguro entre UI, Tauri e Document Core;
depois entrega capacidades como fatias verticais e, por último, executa certificação e publicação.

**Stack:** React 19, TypeScript strict, Tauri 2, Rust 1.88, SQLite, Python 3.14 com `uv`, pnpm
11.19.0, Vitest, Playwright, Biome, Ruff e pytest.

**Especificações:** `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`,
`docs/DEFINITION-OF-DONE.md`, `docs/HARDENING.md` e ADRs aceitos em `docs/adr/`.

## Restrições globais

- Windows x64 é o único alvo desktop; web continua como client compartilhado limitado às
  capacidades do navegador.
- Linux, Android, iOS, cloud, conta, billing, RAG e recursos jurídicos permanecem fora do escopo.
- Originals são imutáveis; cada transformação produz novo artifact e Operation Graph rastreável.
- A UI não acessa filesystem, SQLite, shell ou sidecars diretamente.
- Quick Tools e Studio consomem o mesmo Tool Registry, Capability Layer e executores.
- Nenhum peso de modelo, JRE ou snapshot LanguageTool entra no Git.
- Dependência nova exige licença, manutenção, segurança, tamanho e necessidade demonstrados.
- Toda mudança funcional começa por teste de regressão e termina com gate proporcional ao risco.
- Commit, push, build, instalação, release e publicação são autorizações independentes.

## Estado de partida

- Branch `main` sincronizada e ambiente pnpm reparado.
- Client: Biome, typecheck e 18 testes unitários verdes na última validação local.
- Core: persistência, blobs, compressão PDF, revisão textual, overlays, anchors e hardening existem.
- Engines Python: OCR, DOCX e tradução existem isoladamente.
- Bloqueio central: o client produtivo ainda não usa o adapter Tauri nem possui concessões seguras
  para caminhos escolhidos pelo usuário.
- Bloqueio de release: CI remota e instalação limpa dos artifacts ainda não estão certificadas.

---

## Marco 1: definir a fronteira segura de caminhos

### Tarefa 1: ADR do broker de grants

**Arquivos:**

- Criar: `docs/adr/ADR-014-broker-de-grants-de-caminho.md`
- Modificar: `docs/ARCHITECTURE.md`
- Modificar: `docs/HARDENING.md`

**Produz:** contrato aprovado para seleção nativa, concessão, escopo, expiração, reabertura de
projetos recentes e revogação. Nenhum código funcional deve começar antes da aprovação desse ADR.

- [ ] Modelar as ameaças: caminho forjado pelo renderer, symlink/reparse point, grant reutilizado
  em operação incompatível, grant expirado e projeto recente reaberto após reinício.
- [ ] Comparar token opaco mantido no processo nativo com token autenticado persistível.
- [ ] Adotar como padrão token opaco, escopado e resolvido apenas no processo Tauri; persistência de
  recentes permanece nativa e guarda identidade confiável, não autorização fornecida pelo renderer.
- [ ] Definir os escopos mínimos: criar projeto, abrir projeto, importar documento e exportar.
- [ ] Definir erro IPC estruturado para grant ausente, expirado, revogado ou incompatível.
- [ ] Registrar explicitamente que o core Rust continua recebendo caminhos canônicos somente após
  resolução e validação no host Tauri.
- [ ] Submeter o ADR como gate independente; não misturar com implementação.

### Tarefa 2: implementar e testar o broker no host desktop

**Arquivos:**

- Criar: `apps/desktop/src-tauri/src/path_grants.rs`
- Criar: `apps/desktop/src-tauri/tests/path_grants.rs`
- Modificar: `apps/desktop/src-tauri/src/lib.rs`
- Modificar: `apps/desktop/src-tauri/Cargo.toml`
- Modificar: `packages/contracts/src/index.ts`

**Consome:** decisão aceita no ADR-014.

**Produz:** `PathGrantId`, `PathGrantScope`, resposta segura de seleção e resolução nativa de grant
antes de qualquer comando baseado em caminho.

- [ ] Escrever testes para escopo correto, escopo incorreto, expiração, revogação e tentativa de
  reutilização quando o ADR definir uso único.
- [ ] Executar os testes e confirmar falha pela ausência do broker.
- [ ] Implementar armazenamento em memória no `State` do Tauri e seleção por diálogo nativo.
- [ ] Canonicalizar e validar arquivo/diretório, symlink e reparse point no momento da concessão e
  novamente no consumo.
- [ ] Mapear falhas para códigos IPC estáveis sem expor caminhos sensíveis na mensagem.
- [ ] Executar `cargo fmt --all --check`, Clippy e testes do desktop/core.
- [ ] Solicitar autorização separada antes de commit.

**Gate do marco:** nenhum comando de projeto/importação aceita caminho arbitrário originado do
renderer; testes negativos demonstram a rejeição.

---

## Marco 2: conectar o client ao Document Core nativo

### Tarefa 3: criar adapters de plataforma

**Arquivos:**

- Criar: `apps/client/src/platform/tauri-document-core.ts`
- Criar: `apps/client/src/platform/tauri-document-core.test.ts`
- Criar: `apps/client/src/platform/path-broker.ts`
- Criar: `apps/client/src/platform/platform.ts`
- Modificar: `apps/client/src/platform/document-core.ts`
- Modificar: `apps/client/package.json` e `pnpm-lock.yaml` somente se a API oficial do Tauri ainda
  não estiver declarada; fixar versão e auditar licença antes.

**Produz:** composição de plataforma que fornece `DocumentCorePort`, broker de seleção e
capabilities reais sem detecção de sistema operacional nos componentes.

- [ ] Escrever testes de serialização de cada comando e conversão de erros IPC estruturados.
- [ ] Escrever teste que mantém o adapter browser indisponível sem tentar carregar Tauri.
- [ ] Implementar `TauriDocumentCorePort.invoke()` sobre a API oficial de invoke.
- [ ] Implementar composição explícita no entrypoint desktop e fallback browser.
- [ ] Confirmar que nenhum componente importa `@tauri-apps/api` diretamente.
- [ ] Executar Biome, typecheck e testes do client.

### Tarefa 4: abrir projeto e materializar o workspace

**Arquivos:**

- Criar: `apps/client/src/features/projects/ProjectPicker.tsx`
- Criar: `apps/client/src/features/projects/ProjectPicker.test.tsx`
- Criar: `apps/client/src/features/projects/use-project-workspace.ts`
- Criar: `apps/client/src/features/projects/use-project-workspace.test.ts`
- Modificar: `apps/client/src/App.tsx`
- Modificar: `apps/client/src/features/studio/StudioWorkspace.tsx`
- Modificar: `apps/client/src/features/launcher/RecentProjects.tsx`
- Modificar: `apps/client/src/i18n/pt-BR.ts`

**Produz:** seleção/criação de projeto, árvore de documentos e artifacts reais, contexto ativo para
editor, overlays, anchors e ferramentas.

- [ ] Testar criação, abertura, cancelamento do diálogo e erro de grant.
- [ ] Testar carregamento de documentos/artifacts e troca de seleção sem resultado assíncrono
  obsoleto.
- [ ] Implementar estado de workspace a partir de `list_documents`, `get_document` e
  `list_artifacts`.
- [ ] Substituir estados vazios apenas quando dados reais estiverem disponíveis.
- [ ] Persistir recentes somente pela porta nativa definida no ADR-014.
- [ ] Executar teste unitário e E2E Tauri mínimo: abrir projeto, importar arquivo e reabrir projeto.

**Gate do marco:** em Windows, o usuário cria/abre projeto, importa documento e navega por artifacts;
na web, a indisponibilidade continua explícita e sem chamadas nativas.

---

## Marco 3: entregar a fatia PDF de ponta a ponta

### Tarefa 5: ativar compressão PDF em Quick Tool e Studio

**Arquivos:**

- Criar: `apps/client/src/features/pdf/PdfCompressTool.tsx`
- Criar: `apps/client/src/features/pdf/PdfCompressTool.test.tsx`
- Criar: `apps/client/src/platform/tool-executors.ts`
- Criar: `apps/client/src/platform/tool-executors.test.ts`
- Modificar: `apps/client/src/features/launcher/QuickToolGrid.tsx`
- Modificar: `apps/client/src/features/studio/StudioWorkspace.tsx`
- Modificar: `apps/client/src/features/launcher/data.ts`
- Modificar: `apps/client/src/i18n/pt-BR.ts`

**Produz:** executor nativo `pdf-compress` registrado uma vez e consumido por Quick Tool, Studio e
RecipeRunner.

- [ ] Testar capability disponível somente quando houver adapter nativo e artifact PDF ativo.
- [ ] Testar progresso, cancelamento, erro estruturado e novo artifact sem mutar o original.
- [ ] Implementar executor que chama `compress_pdf` pelo `DocumentCorePort`.
- [ ] Remover o selo “Em breve” somente desta ferramenta após o E2E real passar.
- [ ] Executar testes client, core e Playwright da fatia.

### Tarefa 6: completar organização e visualização PDF

**Arquivos:**

- Modificar: `packages/contracts/src/index.ts`
- Modificar: `crates/nexohub-core/src/pdf_tools.rs`
- Modificar: `crates/nexohub-core/src/commands.rs`
- Modificar: `apps/desktop/src-tauri/src/lib.rs`
- Criar: `apps/client/src/features/pdf/PdfOrganizeTool.tsx`
- Criar: `apps/client/src/features/pdf/PdfViewer.tsx`
- Criar testes unitários junto aos componentes e casos de integração em
  `crates/nexohub-core/tests/document_core.rs`.

**Produz:** reordenar, extrair, remover e combinar páginas como operações derivadas, além de viewer
capaz de projetar overlays sem regravar o original.

- [ ] Especificar operações PDF e limites em `docs/TOOL-SPEC.md` antes do executor.
- [ ] Testar índices inválidos, PDF criptografado, limites e preservação do original.
- [ ] Implementar uma operação por vez no core e expor por contratos/IPC.
- [ ] Integrar viewer e overlays sem sink de HTML bruto.
- [ ] Executar fixtures sintéticas, testes Rust, client e E2E.

**Gate do marco:** PDF importado pode ser visualizado, comprimido e organizado; todos os resultados
são artifacts derivados navegáveis.

---

## Marco 4: integrar texto, revisão e engines Python

### Tarefa 7: concluir o ciclo textual básico

**Arquivos:**

- Modificar: `apps/client/src/features/studio/TextEditor.tsx`
- Modificar: `apps/client/src/features/studio/ReviewPanel.tsx`
- Criar: `apps/client/src/features/text/TextCompareTool.tsx`
- Criar: `apps/client/src/features/text/TextCompareTool.test.tsx`
- Modificar testes existentes em `apps/client/src/features/studio/`.

**Produz:** edição UTF-8/Markdown, comparação e revisão persistidas sobre o artifact derivado mais
recente.

- [ ] Testar importação, edição, comparação, aplicação de achados e duas revisões sucessivas.
- [ ] Implementar comparação determinística no adapter browser e persistir o diff como artifact.
- [ ] Conectar o LanguageTool instalado ao contexto real do projeto.
- [ ] Validar offsets UTF-16, sobreposição, edição concorrente e indisponibilidade do sidecar.

### Tarefa 8: criar supervisor único para o sidecar Python

**Arquivos:**

- Criar: `crates/nexohub-core/src/python_engine.rs`
- Modificar: `crates/nexohub-core/src/sidecar.rs`
- Modificar: `crates/nexohub-core/src/lib.rs`
- Modificar: `apps/desktop/src-tauri/src/lib.rs`
- Modificar: `packages/contracts/src/index.ts`
- Testar em `crates/nexohub-core/tests/document_core.rs` e `engines/python/tests/`.

**Produz:** adapter JSON Lines permitido para OCR, DOCX e tradução, com timeout, limite de saída,
cancelamento, encerramento e erros estruturados comuns.

- [ ] Testar handshake de versão, método inexistente, crash, timeout, saída excessiva e JSON
  inválido.
- [ ] Implementar processo sem servidor HTTP, caminhos arbitrários ou stderr documental.
- [ ] Validar distribuição do wheel/runtime e compatibilidade do protocolo.
- [ ] Executar testes Rust e Python antes de conectar qualquer painel.

### Tarefa 9: ativar OCR, OCR→Markdown, DOCX e tradução

**Arquivos:**

- Modificar: `apps/client/src/features/studio/OcrPanel.tsx`
- Modificar: `apps/client/src/features/studio/TranslationPanel.tsx`
- Criar: `apps/client/src/features/docx/DocxPanel.tsx`
- Criar: `apps/client/src/features/ocr/OcrMarkdownPreview.tsx`
- Modificar: `packages/tool-registry/src/index.ts`
- Modificar: `apps/client/src/features/launcher/data.ts`
- Adicionar testes próximos aos componentes e E2E em `apps/client/e2e/`.

**Produz:** OCR e tradução gerando artifacts; OCR→Markdown preservando páginas e linhas; inspeção e
criação DOCX sem sobrescrever original.

- [ ] Testar ausência de engine/modelo antes dos casos de sucesso.
- [ ] Testar OCR de imagem e PDF, limites e persistência do texto/Markdown.
- [ ] Testar DOCX malicioso e documento válido sintético.
- [ ] Testar tradução leve e avançada com placeholders, quebras e entrada longa.
- [ ] Remover “Em breve” individualmente apenas após cada capability e E2E ficarem verdes.

**Gate do marco:** texto, revisão, OCR, DOCX e tradução funcionam sobre projeto real instalado, sem
rede e com artifacts derivados rastreáveis.

---

## Marco 5: validar NexoFlow e fechar lacunas do 1.0

### Tarefa 10: executar receitas sobre os executores reais

**Arquivos:**

- Modificar: `apps/client/src/features/recipes/RecipePanel.tsx`
- Modificar: `apps/client/src/features/recipes/RecipeGraphEditor.tsx`
- Modificar: `packages/tool-sdk/src/RecipeRunner.ts`
- Modificar testes existentes em `apps/client/src/features/recipes/` e
  `packages/tool-sdk/src/recipe-runner.test.ts`.

**Produz:** salvar, editar e executar DAG real com artifacts intermediários inspecionáveis.

- [ ] Testar preflight sem efeitos, ordem topológica, ramificação, falha intermediária,
  cancelamento e repetição.
- [ ] Conectar o mesmo mapa de executores usado pelas Quick Tools.
- [ ] Exibir artifact produzido por etapa e permitir abrir no Studio.
- [ ] Validar crash recovery no produto instalado.

### Tarefa 11: especificar e implementar extração de imagens

**Arquivos:**

- Modificar: `docs/TOOL-SPEC.md`
- Modificar: `packages/contracts/src/index.ts`
- Modificar: `packages/tool-registry/src/index.ts`
- Criar executor no runtime escolhido após avaliação de licença e cobertura de formatos.
- Criar UI e testes sob `apps/client/src/features/images/`.

**Produz:** assets de imagem vinculados ao artifact de origem, nunca arquivos soltos sem
rastreabilidade.

- [ ] Fixar formatos, limites, metadados e política de duplicação na especificação.
- [ ] Aprovar engine e licença antes de adicionar dependência.
- [ ] Testar PDFs/DOCX sintéticos com imagens repetidas, corrompidas e acima do limite.
- [ ] Persistir cada imagem como asset/artifact conforme ADR-003.

### Tarefa 12: auditoria de fechamento funcional

**Arquivos:**

- Modificar: `docs/DEFINITION-OF-DONE.md`
- Modificar: `docs/ROADMAP.md`
- Modificar: `CHANGELOG.md`

- [ ] Executar cada critério do DoD sobre o aplicativo instalado.
- [ ] Manter “Parcial” quando existir apenas teste isolado ou build sem uso real.
- [ ] Registrar limitações reproduzíveis e separar defeito, ambiente e publicação.
- [ ] Não iniciar release enquanto qualquer critério obrigatório estiver parcial.

---

## Marco 6: certificação e release

### Tarefa 13: executar a matriz completa de qualidade

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm build:web`
- [ ] `pnpm test:e2e`
- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --workspace --all-targets --locked -- -D warnings`
- [ ] `cargo test --workspace --locked`
- [ ] `cargo build --release --workspace --locked`
- [ ] `uv sync --locked --project engines/python`
- [ ] `uv run --locked --project engines/python ruff check .`
- [ ] `uv run --locked --project engines/python pytest`
- [ ] `pnpm audit`, `cargo deny`, `uv audit --locked` e `pnpm licenses:check`

### Tarefa 14: certificar artifacts Windows

**Consome:** matriz local e GitHub Actions integralmente verdes.

- [ ] Construir MSI e NSIS com sidecars obtidos exclusivamente pelos manifests fixados.
- [ ] Registrar SHA-256 e tamanho dos artifacts.
- [ ] Em máquina Windows limpa, instalar, abrir, criar projeto, importar PDF/DOCX, executar uma
  ferramenta de cada engine, fechar, reabrir e desinstalar.
- [ ] Confirmar ausência de processo sidecar órfão e de dados fora dos diretórios previstos.
- [ ] Comparar os binaries candidatos com os artifacts dos workflows.
- [ ] Atualizar `docs/RELEASE-VALIDATION.md` somente com evidência efetivamente coletada.

### Tarefa 15: decidir e publicar o próximo canal

- [ ] Avaliar separadamente se a evidência autoriza nova `alpha`, `beta` ou `rc`; não presumir RC.
- [ ] Atualizar versões e changelog em alteração exclusiva de release.
- [ ] Solicitar autorização expressa para commit, tag, push e publicação.
- [ ] Publicar installers, web e checksums apenas após aprovação de todos os gates.

## Ordem obrigatória

1. Marco 1: broker de grants.
2. Marco 2: integração nativa e projetos reais.
3. Marco 3: fatia PDF completa.
4. Marco 4: texto e engines.
5. Marco 5: receitas e lacunas funcionais.
6. Marco 6: certificação e release.

Não paralelizar tarefas que alterem `packages/contracts`, `apps/desktop/src-tauri/src/lib.rs` ou a
composição de plataforma do client. Testes isolados de engines e especificações podem avançar em
paralelo somente quando não dependam de contrato ainda não aprovado.

## Primeiro checkpoint recomendado

Encerrar a primeira rodada após a aprovação do ADR-014 e a prova automatizada de que um renderer
não consegue invocar importação com caminho não concedido. Esse checkpoint reduz o maior risco
arquitetural antes de conectar qualquer capacidade já existente à UI produtiva.
