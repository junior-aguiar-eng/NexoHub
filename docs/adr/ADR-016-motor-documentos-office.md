# ADR-016: Arquitetura do motor para conversões de documentos Office

- **Estado:** aceito para planejamento em 13/11/2026; implementação e ativação na vitrine condicionadas aos gates de segurança, licença (ADR-008) e homologação de corpus.
- **Substitui parcialmente:** rascunho inicial do ADR-016 (o escopo de arquivamento **PDF/A** passa a ser governado especificamente pelo [ADR-021](ADR-021-arquivamento-pdfa-iso19005.md)).
- **Relação:** [ADR-001 (Local-first)](ADR-001-local-first.md), [ADR-005 (Tool Registry)](ADR-005-tool-registry.md), [ADR-006 (Capability Layer)](ADR-006-capability-layer.md), [ADR-007 (Sidecars)](ADR-007-sidecar-model.md), [ADR-008 (Licenças)](ADR-008-license-policy.md), [ADR-019 (Instalação opcional)](ADR-019-distribuicao-runtime-languagetool.md) e [ADR-020 (Nuvem opcional e cotas)](ADR-020-nuvem-opcional-cotas.md).

---

## 1. Contexto

O catálogo planejado do NexoHub (`packages/tool-registry` em `plannedToolManifests` e seção 3 de `CATALOGO-FERRAMENTAS.md`) prevê quatro ferramentas de conversão de alto nível envolvendo suíte Office:

1. **Word para PDF** (`word-to-pdf`, rota `/word-para-pdf` já reservada): `.doc`, `.docx` → `.pdf`
2. **Excel para PDF** (`excel-to-pdf`): `.xls`, `.xlsx`, `.ods` → `.pdf`
3. **PowerPoint para PDF** (`powerpoint-to-pdf`): `.ppt`, `.pptx`, `.odp` → `.pdf`
4. **PDF para PowerPoint** (`pdf-to-powerpoint`): `.pdf` → `.pptx`

Diferente da manipulação geométrica de PDFs ou da extração heurística (`pdf-to-word` e `pdf-to-excel` já evoluídos na Onda 2), converter DOCX/XLSX/PPTX com layout complexo exige um motor completo de diagramação tipográfica, métricas de fonte, quebra de páginas, fórmulas de planilha, slides com mestre/formas e gráficos embutidos.

Adicionalmente:
- O instalador base do aplicativo Windows não deve inchar em ~150–250 MB para usuários que usam apenas ferramentas PDF/Imagem.
- No navegador (client web puro em modo 100% offline), compilações WebAssembly completas de suítes Office pesam ~80–150 MB por carregamento, inviabilizando inicialização ágil e dispositivos modestos.
- O `ADR-020` já preparou contratos iniciais de backend para `CloudTool::OfficeToPdf` (`crates/nexohub-server/src/cloud/quotes.rs`), limites operacionais em `scripts/cloud/hybrid-policy.json` (`office.monthlyFiles`, `maxInputBytes`, `maxOutputPages`, `timeoutSeconds`) e o port `CloudProcessingPort`, ainda com `cloudEnabled: false` e `FakeProvider` em `providers.rs`.

---

## 2. Alternativas Avaliadas

1. **Parsers puros em JS/Python (`docx`, `python-docx-ng`, `openpyxl`, HTML intermediário):**
   - *Rejeitada para Office fiel:* não possuem motor de diagramação tipográfica/tabelas aninhadas/SmartArt/fórmulas; reproduziriam apenas extração aproximada já coberta por `pdf-to-word` e `html-to-pdf`.
2. **WebAssembly completo de suíte Office no browser (`soffice.wasm` / ZetaOffice) como caminho padrão:**
   - *Rejeitada para o estágio atual:* custo elevado de banda/RAM (~80–150 MB + múltiplas fontes), tempo de arranque alto e risco de OOM em abas com orçamento restrito. Pode ser reavaliada apenas em ADR futuro caso exista perfil estável e leve.
3. **Modelo Híbrido Pragmático por Plataforma (Escolhida):**
   - **Desktop Windows:** LibreOffice portátil/headless instalado **sob demanda** como Superpoder gerenciado pelo `Capability Layer` (`crates/nexohub-core/src/capabilities.rs`), seguindo o mesmo padrão de instalação opcional verificada por tamanho e SHA-256 do ADR-019.
   - **Web:** no modo **offline/local puro**, as ferramentas Office permanecem **explicitamente indisponíveis** (com orientação clara e sem fallback simulado). Quando o usuário autenticado habilitar e confirmar o modo **Híbrido Opcional (ADR-020)** — após abertura dos gates de homologação e provedor real no `nexohub-server` — a conversão passa pelo worker isolado do backend efêmero com cota por arquivo/página.

---

## 3. Decisão Arquitetural

### 3.1 Contrato por Superfície (`Platform / Capability Layer`)

| Ferramenta | Desktop Windows (Local-first) | Web (Offline puro) | Web (Híbrido Opcional ADR-020) |
| --- | --- | --- | --- |
| `word-to-pdf` | Superpoder local LibreOffice headless (sob demanda) | Indisponível explícito | Worker Office isolado após consentimento e reserva de cota |
| `excel-to-pdf` | Superpoder local LibreOffice headless (sob demanda) | Indisponível explícito | Worker Office isolado após consentimento e reserva de cota |
| `powerpoint-to-pdf` | Superpoder local LibreOffice headless (sob demanda) | Indisponível explícito | Worker Office isolado após consentimento e reserva de cota |
| `pdf-to-powerpoint` | Sidecar local (PDFium/Impress headless com política explícita) | Indisponível explícito | Fora do escopo inicial de `CloudTool::OfficeToPdf`; exige extensão de `quotes.rs` e corpus |

> **Regra de honestidade funcional (`PRODUCT.md` e `ADR-005`):** ferramentas sem executor homologado na superfície ativa não podem fingir funcionamento com conversões degradadas nem entrar na vitrine ativa antes de passarem pelo gate de homologação e atualizarem `@/platform/tool-availability.ts`. Enquanto a plataforma web não tiver `cloudEnabled` nem executor local, a vitrine web distingue capacidade por plataforma via `Capability Layer` (`browserSupportedToolIds` vs. `tauriSupportedToolIds`), em vez de exibir botões mortos.

### 3.2 Distribuição e Protocolo do Motor Desktop Windows (ADR-007 + ADR-019)

1. **Instalador enxuto:** o instalador base do Windows (`nexohub.iss`) não empacota binários do LibreOffice.
2. **Catálogo de Superpoderes:** adicionar categoria apropriada em `crates/nexohub-core/src/capabilities.rs` (ex.: superpoder dedicado para conversão Office) com manifesto contendo URL oficial fixada, tamanho exato em bytes e hash **SHA-256** verificado antes da ativação em `runtime/`.
3. **Execução via sidecar estruturado (ADR-007):**
   - A UI nunca passa argumentos de linha de comando ou caminhos arbitrários. Todo caminho passa pelo `grant_broker` (ADR-014) e entra via `DocumentCorePort`.
   - O core Rust invoca um wrapper/runner dedicado com perfil de usuário isolado por execução (`-env:UserInstallation=file:///<temp-isolado>`), `--headless --norestore --invisible --nodefault --nolockcheck --nofirststartwizard`, **sem acesso à rede** sempre que aplicável e com **timeout rígido** (ex.: 120s) e árvore de processos encerrável em caso de cancelamento (`Job Object` no Windows).
   - **Fontes livres embarcadas:** para reduzir desvios métricos no Windows limpo, o runtime do superpoder referencia fontes métricas equivalentes livres já auditadas (Liberation Sans / Serif / Mono / Caladea / Carlito conforme revisão em `THIRD_PARTY_LICENSES.md`).

### 3.3 Hardening e Segurança de Documentos Office

Arquivos `.doc/.docx/.xls/.xlsx/.ppt/.pptx` são vetores históricos de macros, links externos e bombas XML (XXE / Zip Bomb):
1. **Preflight estrutural antes de invocar o motor:** validar cabeçalho OLE/ZIP, razão de expansão máxima (`<= 100x` conforme padrão já adotado em `quotes.rs`), limite de tamanho de entrada (`10 MiB` inicial no piloto em nuvem; limite explícito configurado no desktop) e contagem de entradas internas sem symlinks ou traversal.
2. **Desativação total de macros e conexões externas:** configurar perfil headless com execução de macros bloqueada (`MacroExecutionMode = NEVER_EXECUTE`), atualização de vínculos DDE/OLE externos bloqueada e proibir carregamento de imagens/fontes por URL remota durante a renderização.
3. **Sanitização de metadados opcionais** e produção estrita de novo artifact derivado imutável (ADR-004).

### 3.4 Caminho Híbrido Opcional na Web (Extensão do ADR-020)

1. Implementar um `Provider` real em `crates/nexohub-server/src/cloud/providers.rs` substituindo o `FakeProvider` apenas quando a flag de configuração e a tabela de preços/políticas estiverem válidas (`office` em `hybrid-policy.json`).
2. O worker remoto deve rodar em **container isolado sem acesso à internet de saída** (egress bloqueado para evitar SSRF via links internos do DOCX/XLSX/HTML embutido no Office), com armazenamento exclusivamente efêmero em `/tmp` e limpeza garantida (`ADR-015`).
3. Na interface, o usuário web visualiza claramente antes do envio: cota mensal restante (`monthlyFiles: 10` no piloto), limites do documento (`10 MiB` / `50` páginas) e confirmação explícita do envio temporário com descarte imediato pós-conversão (`CloudProcessingChoice`). Se o usuário optar por não usar nuvem ou não estiver autenticado/convidado, a UI informa com transparência que a conversão Office offline exige o aplicativo desktop Windows com o superpoder instalado.

### 3.5 Gate de Licenças (ADR-008)

- O código principal do LibreOffice é distribuído sob **MPL-2.0** (com componentes **LGPLv3+**), sem exigir alteração da licença MPL-2.0 do NexoHub quando consumido como runtime externo instalado sob demanda no sistema do usuário (ADR-019).
- Fontes opcionais agregadas devem respeitar **SIL Open Font License (OFL)** ou licença Apache-2.0/MIT/Liberation, todas inventariadas em `docs/THIRD_PARTY_LICENSES.md` antes de qualquer release.

---

## 4. Critérios de Aceite para Promoção à Vitrine Ativa

1. Corpus mínimo real e sintético cobrindo tabelas aninhadas, cabeçalho/rodapé, fórmulas simples do Excel, slides 16:9 e documentos com links/macros maliciosos neutralizados.
2. Cancelamento limpo em meio de execução encerrando o processo filho sem deixar locks ou diretórios órfãos (`soffice.bin` não pode permanecer residente).
3. Verificação automática de saída PDF legível por PDF.js/PDFium (páginas `>= 1`, texto selecionável preservado).
4. Testes específicos de autorização/cota/rollback no `nexohub-server` para o provider real quando o caminho híbrido for ligado.

---

## 5. Consequências

- **Positivas:** o instalador Windows e o bundle Web permanecem leves; nenhuma conversão "falsa" com HTML precário entra no produto; reutiliza integralmente a infraestrutura já construída para superpoderes desktop (`capabilities.rs`) e nuvem opcional (`ADR-020`).
- **Custos assumidos:** na Web em modo estritamente offline sem login/cota híbrida, as ferramentas Office não operam localmente (decisão explícita de honestidade técnica sobre fidelidade de layout). O suporte a `pdf-to-powerpoint` no servidor exigirá atualização futura de `CloudTool` caso seja oferecido na Web.
