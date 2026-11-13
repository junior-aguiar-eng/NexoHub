# Plano de Implementação — Onda 3 (PDF/A → Suíte Office → Resumo IA Local)

> **Para agentes executores:** implementar uma sub-onda por vez (`3A` → `3B` → `3C`) seguindo TDD, `AGENTS.md` e os gates de licença (`ADR-008`) e validação independente. Não promover nenhuma ferramenta para `coreToolRegistry` ativo antes de concluir o respectivo gate de qualidade.

**Objetivo:** Entregar as 6 ferramentas pendentes do catálogo do NexoHub respeitando o padrão espacial único `[data-workspace-panel]`, a privacidade *local-first* e as fronteiras definidas nos ADRs [ADR-016](../../adr/ADR-016-motor-documentos-office.md), [ADR-017](../../adr/ADR-017-resumo-documental-ia-local.md) e [ADR-021](../../adr/ADR-021-arquivamento-pdfa-iso19005.md).

---

## Pré-requisito Transversal: Capability Layer por Plataforma

Antes de ativar ferramentas cuja disponibilidade varia entre Browser Offline, Browser Híbrido (`ADR-020`) e Desktop Windows:

- [ ] **Task 0.1:** Evoluir `apps/client/src/platform/tool-availability.ts` e testes em `tool-availability.test.ts` para suportar capacidades declaradas por ambiente (`local-browser`, `local-desktop-superpower`, `cloud-optional`) sem esconder os motivos técnicos da UI quando uma ferramenta exigir download de superpoder ou login híbrido.
- [ ] **Task 0.2:** Atualizar `packages/tool-registry/src/index.ts` e `packages/tool-registry/src/quality.test.ts` mantendo metadados declarativos de requisitos (`requiresSuperpower`, `optionalCloudTool`) para orientar cards da vitrine e a tela dedicada sem quebrar os 36 contratos existentes.

---

## Fase 3A — `pdf-to-pdfa` (ISO 19005-2b 100% Local — Prioridade 1)

**ADRs:** `ADR-021`, `ADR-008`, `ADR-004`.

### Task 3A.1: Auditoria de Asset sRGB ICC e Contrato de Domínio
- [ ] Selecionar e incorporar perfil **sRGB IEC61966-2.1** com licença permissiva explicitamente compatível com `MPL-2.0` (CC0 / MIT / Zlib / domínio público auditado) em `apps/client/public/icc/`.
- [ ] Registrar origem, versão, hash SHA-256 e texto integral da licença em `docs/THIRD_PARTY_LICENSES.md` e `apps/client/public/licenses/`.

### Task 3A.2: Motor `pdfa-converter.ts` + Web Worker `pdfa.worker.ts` (TDD)
- [ ] Criar testes unitários e de integração (`apps/client/src/platform/pdfa-converter.test.ts`) cobrindo:
  - `inspectPdfForPdfa` detectando fontes não incorporadas, transparências, JavaScript/actions proibidas, criptografia e assinaturas `/ByteRange`.
  - Conversão `PDF/A-2b` gerando `/OutputIntents` (`/S /GTS_PDFA2`), `/Metadata` XMP (`pdfaid:part=2`, `pdfaid:conformance=B`) sincronizado com `/Info` UTF-8, `/ID` no trailer, e remoção de `/JS` / `/JavaScript` / `/AA` / `/OpenAction`.
  - Garantia de 100% de fontes incorporadas: preservação vetorial quando todas as fontes são incorporadas/normalizáveis + reconstrução controlada por página via PDFium + camada de texto com `LiberationSans` incorporada quando houver fonte proprietária ausente.
  - Recusa explícita e segura para PDF criptografado e PDF assinado digitalmente.
  - Cancelamento limpo em `pdfa.worker.ts` sem vazamento de memória.
- [ ] Implementar `pdfa-converter.ts` e `pdfa.worker.ts` e integrar em `apps/client/src/platform/launcher-tool-runner.ts`.

### Task 3A.3: Gate de Validação Independente ISO 19005 (veraPDF)
- [ ] Criar script de validação de qualidade local/CI (`scripts/quality/validar-pdfa-verapdf.mjs` ou equivalente) que gera o corpus PDF/A pelo motor do NexoHub e valida a saída com **veraPDF CLI (`-f 2b`)** garantindo **0 erros de conformidade**.
- [ ] Documentar limites, corpus testado e resultados em `docs/quality/PDFA-C1.md` (seguindo o padrão de `DOC-C4.md` / `R-C1-VALIDACAO.md`).

### Task 3A.4: Interface `/pdf-para-pdfa` (`PdfToPdfaPanel.tsx`) & Registro
- [ ] Registrar `pdf-to-pdfa` no `@nexohub/tool-registry`, rota `/pdf-para-pdfa` em `apps/client/src/App.tsx`, e chaves `pdfToPdfa.*` em `apps/client/src/i18n/pt-BR.ts`.
- [ ] Criar `PdfToPdfaPanel.tsx` sobre `[data-workspace-panel]` padrão iLovePDF (prévia PDF à esquerda; diagnóstico pré-conversão, perfil `PDF/A-2b`/`1b` e botão principal à direita; relatório detalhado no `.dedicated-tool-page--success`).
- [ ] Criar testes de componente (`PdfToPdfaPanel.test.tsx`) + E2E em Playwright (`e2e/pdfa-quality.spec.ts` nas 4 larguras e tema claro/escuro).

---

## Fase 3B — Suíte Office (`word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`, `pdf-to-powerpoint` — Prioridade 2)

**ADRs:** `ADR-016`, `ADR-019`, `ADR-020`, `ADR-015`, `ADR-007`, `ADR-008`.

### Task 3B.1: Superpoder Desktop LibreOffice Headless (`crates/nexohub-core`)
- [ ] Estender `CapabilityCategory` (ex.: `Office`) e catálogo de superpoderes em `crates/nexohub-core/src/capabilities.rs` com manifesto versionado (URL oficial fixada, tamanho exato em bytes e SHA-256) e script de instalação opcional para Windows Sandbox (espelhando o padrão de `install-languagetool.ps1`).
- [ ] Criar `crates/nexohub-core/src/office_engine.rs` e comandos Tauri restritos (com paths exclusivamente validados via `grant_broker` ADR-014):
  - Preflight estrutural contra Zip Bomb (`<= 100x`), travessia de caminhos e symlinks antes de invocar o runtime.
  - Execução de `soffice` em modo headless com perfil isolado temporário (`-env:UserInstallation`), bloqueio de macros/links externos, timeout configurável (`120s`) e `Job Object` no Windows para encerrar árvores de processo ao cancelar.
  - Limpeza de perfil temporário pós-execução e validação do PDF/PPTX gerado.
- [ ] Validar em `cargo test` e Windows Sandbox limpo (instalação por hash, recusa de corrupção, conversão real de DOCX/XLSX/PPTX e cancelamento).

### Task 3B.2: Provedor Office Opcional no `nexohub-server` (Web Híbrido ADR-020)
- [ ] Implementar adapter real `OfficeCloudProvider` (implementando `Provider` em `crates/nexohub-server/src/cloud/providers.rs`) acionando container/worker LibreOffice efêmero isolado **sem egress externo** para `CloudTool::OfficeToPdf` (`.docx`, `.xlsx`, `.pptx`).
- [ ] Atualizar Dockerfile/infra de produção com o runtime isolado apenas quando habilitado explicitamente pelos gates financeiros e `cloudEnabled` do ADR-020.
- [ ] Integrar testes reais de cota/idempotência/reembolso em `crates/nexohub-server/tests/`.

### Task 3B.3: Interface Unificada de Ferramentas Office (`OfficeConvertPanel.tsx`) & Registro
- [ ] Promover `word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf` (e `pdf-to-powerpoint` no escopo desktop) conforme disponibilidade apurada pelo `Capability Layer`.
- [ ] Na UI (`[data-workspace-panel]`):
  - No **Desktop Windows**, orientar instalação do Superpoder Office caso ausente (com progresso e SHA-256 transparente) ou executar localmente após instalado.
  - Na **Web**, apresentar escolha híbrida clara (`CloudProcessingChoice` quando disponível e autenticado) com consumo previsto antes de enviar; em modo offline puro sem login, exibir indisponibilidade honesta sem mock nem fallback degradado.
- [ ] Adicionar chaves `officeConvert.*` em `pt-BR.ts`, testes React e E2E.

---

## Fase 3C — `pdf-summarize` (`Resumir com IA` Estritamente Local — Prioridade 3)

**ADRs:** `ADR-017`, `ADR-008`, `ADR-011`.

### Task 3C.1: Benchmark de Modelos SLM Permisssivos e Registro de Licenças
- [ ] Auditar e fixar versão/revisão exata de 1–2 modelos ONNX quantizados (`Apache-2.0` ou `MIT`) com bom desempenho em português brasileiro (perfil WebGPU `q4` + perfil leve CPU/WASM) e registrar licenças em `docs/THIRD_PARTY_LICENSES.md`.
- [ ] Medir em dispositivo real de referência: tamanho do download, uso de VRAM/RAM, latência em WebGPU vs. WASM SIMD e fidelidade factual em documentos jurídicos/técnicos `pt-BR`.

### Task 3C.2: Motor `pdf-summarizer.ts` & Worker `pdf-summarize.worker.ts` (TDD)
- [ ] Implementar preflight de hardware (`navigator.gpu`, `deviceMemory`), cache persistente com progresso em bytes e timeout de inatividade (60s) + cancelamento destrutivo (`worker.terminate()`).
- [ ] Implementar pipeline *Extract → Chunk por página `[p. X–Y]` → Map-Reduce → Grounding* com proteção contra *prompt injection* embutido no texto do PDF.
- [ ] Detectar PDF sem texto selecionado e retornar sinal estruturado para oferecer encadeamento imediato para `/ocr-pdf`.
- [ ] Escrever testes unitários/contrato em `pdf-summarizer.test.ts` simulando download, cancelamento, falha de rede, recusa de documento vazio/escaneado e limpeza do worker.

### Task 3C.3: Mesa `[data-workspace-panel]` para `pdf-summarize` (`PdfSummarizePanel.tsx`)
- [ ] Registrar `pdf-summarize` no `@nexohub/tool-registry`, rota `/resumir-pdf` em `App.tsx` e chaves `pdfSummarize.*` em `pt-BR.ts`.
- [ ] Construir interface padrão iLovePDF: prévia do PDF à esquerda com navegação automática ao clicar nas citações `[p. X]` geradas no resumo; à direita, estado do modelo local (tamanho explícito antes do primeiro download), modo de síntese (`Executivo`, `Obrigações e Datas`, `Por Seção`), botão de execução/cancelamento e exportação imutável em `.md`/`.txt`/`.pdf`.
- [ ] Executar testes Vitest + Playwright E2E (com worker mockado determinístico no CI) antes da promoção final na vitrine.

---

## Verificação Global Obrigatória ao Final de Cada Sub-Onda

1. `pnpm check` (`biome check .` + `pnpm --recursive --if-present typecheck`)
2. `pnpm quality:check` e atualização consciente do índice Q-C0 quando aplicável
3. `pnpm --filter @nexohub/client test` + `cargo test --workspace` (quando Rust for tocado) + `pnpm --filter @nexohub/client build`
4. Auditoria de licenças (`THIRD_PARTY_LICENSES.md`) + `pnpm audit --prod` para qualquer nova dependência ou asset
5. Validação visual em Chrome (`390×844`, `1366×768`, `1920×1080`) e, no bloco desktop, validação em Windows Sandbox limpo.
