# Especificação de Design — Onda 3 (PDF/A, Suíte Office e Resumo IA Local)

**Data:** 2026-11-13  
**Base normativa:** [ADR-016 (Office)](../../adr/ADR-016-motor-documentos-office.md), [ADR-017 (IA Local)](../../adr/ADR-017-resumo-documental-ia-local.md), [ADR-021 (PDF/A)](../../adr/ADR-021-arquivamento-pdfa-iso19005.md) e [ADR-020 (Nuvem Opcional)](../../adr/ADR-020-nuvem-opcional-cotas.md).  
**Ordem aprovada de implementação:** **Fase 3A (`pdf-to-pdfa`) → Fase 3B (Suíte Office) → Fase 3C (`pdf-summarize`)**.

---

## 1. Objetivo Geral

Completar as 6 ferramentas pendentes da Seção 3 de [CATALOGO-FERRAMENTAS.md](../../CATALOGO-FERRAMENTAS.md) — elevando o catálogo ativo de 36 para até 42 ferramentas conforme sua disponibilidade real por plataforma — sem sacrificar:
1. O padrão espacial iLovePDF consolidado na Onda 1 (`[data-workspace-panel]` claro, prévia proporcional e CTA visível).
2. A garantia de **originais imutáveis** (`ADR-004`), **zero upload implícito** (`ADR-001`) e **licenças compatíveis** (`ADR-008`).
3. A regra de **honestidade funcional**: nenhuma ferramenta entra em `coreToolRegistry` nem na vitrine antes de ter executor testado, pré-diagnóstico real e critério de qualidade independente aprovado.

---

## 2. Visão Arquitetural por Bloco

### 2.1 Bloco 3A — `pdf-to-pdfa` (ADR-021, 100% Local Web + Desktop)

* **Motor (`apps/client/src/platform/pdfa-converter.ts` + worker `pdfa.worker.ts`):**
  * **Preflight instantâneo (`inspectPdfForPdfa`):** varre o PDF carregado com `pdf-lib` para detectar criptografia (`/Encrypt`), assinaturas digitais (`/ByteRange` / `SigFlags`), fontes padrão não incorporadas, transparências (`SMask` / `ExtGState`), ações proibidas (`/JS`, `/JavaScript`, `/OpenAction`, `/AA`) e presença prévia de `/OutputIntents` + XMP `pdfaid`.
  * **Normalização ISO 19005-2b (`convertPdfToPdfA`):**
    1. Recusar com erro estruturado PDFs criptografados (orientando a usar `/desbloquear-pdf`) e PDFs assinados digitalmente (ou exigir confirmação explícita de geração de cópia arquivável sem assinatura preservada).
    2. Remover/neutralizar ações proibidas (`/JS`, `/JavaScript`, `/AA`, `/Launch`, `/RichMedia`, `/3D`, anotações ocultas).
    3. Embutir perfil **sRGB IEC61966-2.1** auditado em `apps/client/public/` no `/OutputIntents` (`GTS_PDFA2`).
    4. Garantir incorporação de 100% das fontes: preservar vetorialmente fontes já incorporadas ou substituíveis com `LiberationSans` / `SourceSans3` via `@pdf-lib/fontkit`, e reconstruir via `@embedpdf/pdfium` + camada pesquisável com fonte TrueType incorporada apenas as páginas cujo conjunto de fontes/espaços de cor não possa ser sanado diretamente.
    5. Gravar `/ID` no trailer + pacote `/Metadata` XMP UTF-8 (`pdfaid:part="2"`, `pdfaid:conformance="B"`) sincronizado com `/Info` (`dc:title`, `dc:creator`, `xmp:CreateDate`, `xmp:ModifyDate`).
* **Interface (`/pdf-para-pdfa` — `PdfToPdfaPanel.tsx`):**
  * Mesa única `[data-workspace-panel]` clara com prévia do PDF à esquerda, diagnóstico pré-conversão em card informativo na sidebar direita, seletor de perfil (`PDF/A-2b` padrão / `PDF/A-1b` legado) e relatório transparente no estado `.dedicated-tool-page--success`.
* **Qualidade / Gate:** suíte Unit/Integration em Vitest + script de validação contra **veraPDF CLI** no corpus de desenvolvimento/CI (uso exclusivo em verificação; não integra o bundle distribuído).

---

### 2.2 Bloco 3B — Suíte Office (`word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`, `pdf-to-powerpoint`, ADR-016)

* **Diferenciação explícita por plataforma em `@/platform/tool-availability.ts`:**
  * Até a Onda 2, `browserSupportedToolIds` e `tauriSupportedToolIds` apontam igualmente para `activeToolIds`. A partir da Onda 3B, o `Capability Layer` deve distinguir explicitamente capacidades que requerem **Superpoder nativo instalado** (Desktop Windows) ou **Nuvem Híbrida opcional autorizada** (Web via ADR-020).
* **Desktop Windows (Tauri + `nexohub-core`):**
  * Adicionar superpoder opcional em `crates/nexohub-core/src/capabilities.rs` (download sob demanda com verificação de tamanho e **SHA-256** no padrão ADR-019) para o pacote **LibreOffice portátil headless** + fontes livres equivalentes.
  * Criar adapter dedicado no core (`office_engine.rs` / sidecar wrapper) com perfil efêmero isolado (`-env:UserInstallation`), bloqueio de macros e acesso à rede desabilitado, preflight anti-Zip-Bomb (`<= 100x`) e encerramento garantido de processo em cancelamento/timeout (`120s`).
* **Web + Nuvem Opcional (ADR-020):**
  * No browser em modo offline puro: as rotas `/word-para-pdf`, `/excel-para-pdf`, `/powerpoint-para-pdf` exibem indisponibilidade clara e instrutiva (ou acionam o fluxo de consentimento híbrido caso o usuário esteja logado e o piloto tenha `cloudEnabled: true`).
  * No servidor (`crates/nexohub-server/src/cloud/`): substituir `FakeProvider` por `OfficeCloudProvider` isolado para `CloudTool::OfficeToPdf` apenas quando habilitado por variável/política, respeitando limites de `hybrid-policy.json` (`10 MiB`, `50` páginas, `10` arquivos/mês, `egress` de saída bloqueado durante conversão).
  * `pdf-to-powerpoint`: entra primeiro como executor nativo Desktop via LibreOffice/PDFium sob demanda; eventual inclusão na cota web exige estender `CloudTool` em ADR/contrato futuro.

---

### 2.3 Bloco 3C — `pdf-summarize` (`Resumir com IA`, ADR-017, 100% Local)

* **Motor (`apps/client/src/platform/pdf-summarizer.ts` + `pdf-summarize.worker.ts`):**
  * Baseado em `@huggingface/transformers` já instalado (`WebGPU` preferencial; fallback `ONNX WASM SIMD` para modelos compactos sob aviso de desempenho).
  * Download sob demanda com exibição prévia de tamanho do modelo, licença **Apache-2.0/MIT** auditada em `THIRD_PARTY_LICENSES.md`, cache local persistente (`Cache API` / OPFS no browser; manifesto SHA-256 em `runtime/` no Windows), timeout de inatividade (60s) e cancelamento destrutivo real (`worker.terminate()`).
* **Pipeline Map-Reduce com Ancoragem:**
  * Extrai texto página a página (`pdfjs-dist`), agrupa em blocos respeitando janela de contexto com rótulos `[p. X]`, sintetiza em 3 modos (`Resumo executivo`, `Pontos de ação e prazos`, `Por seção`) e gera links clicáveis de página no resultado para conferência direta na prévia lateral do documento.
  * Se o PDF não possuir texto selecionável, sugere encadeamento direto (Tool Chaining em RAM já existente) para `/ocr-pdf` antes de resumir.

---

## 3. Segurança, Internacionalização e Regras Gerais (`AGENTS.md`)

* **i18n `pt-BR`:** todas as novas rotas, diagnósticos, alertas de indisponibilidade, modais de consentimento de download (modelo SLM / superpoder LibreOffice / cota nuvem) e relatórios pertencem exclusivamente a `apps/client/src/i18n/pt-BR.ts`.
* **Qualidade de código:** TypeScript `strict: true`, erros IPC estruturados sem dados sensíveis/conteúdo de arquivo nos logs, e cobertura proporcional em Vitest + Rust `cargo test` + Playwright E2E.
