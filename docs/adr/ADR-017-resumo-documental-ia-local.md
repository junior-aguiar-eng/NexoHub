# ADR-017: Arquitetura do motor de resumo documental e PDF Intelligence local (`pdf-summarize`)

- **Estado:** aceito para planejamento em 13/11/2026; implementação e ativação na vitrine condicionadas aos gates de modelo, hardware mínimo, privacidade e testes de qualidade.
- **Relação:** [ADR-001 (Local-first)](ADR-001-local-first.md), [ADR-004 (Originais imutáveis)](ADR-004-immutable-originals.md), [ADR-005 (Tool Registry)](ADR-005-tool-registry.md), [ADR-008 (Licenças)](ADR-008-license-policy.md), [ADR-011 (Modelos de tradução)](ADR-011-modelos-de-traducao.md) e [ADR-019 (Instalação opcional de runtimes)](ADR-019-distribuicao-runtime-languagetool.md).

---

## 1. Contexto

O catálogo planejado do NexoHub (`CATALOGO-FERRAMENTAS.md` seção 3 e `ROADMAP.md` Fase 20) prevê a ferramenta **Resumir com IA** (`pdf-summarize`). A promessa central do produto proíbe enviar conteúdos documentais sensíveis (petições, contratos, laudos, relatórios financeiros) a APIs proprietárias de IA em nuvem (OpenAI, Anthropic, Google Gemini) sem decisão arquitetural distinta e consentimento híbrido equivalente ao ADR-020.

Por outro lado, a execução moderna de Pequenos Modelos de Linguagem (**SLMs** quantizados) já é tecnicamente viável:
- No **navegador/WebView2**, via **`@huggingface/transformers`** (`^4.3.1`, já presente no `@nexohub/client`) utilizando **WebGPU** quando disponível e fallback controlado em **ONNX Runtime WASM SIMD** (`ort-wasm-simd-threaded`).
- No **Windows desktop**, via runtime nativo ONNX Runtime GenAI / llama.cpp-like em sidecar local (ADR-007) e superpoder opcional sob demanda (ADR-019), aproveitando todos os núcleos da CPU ou GPU/NPU local sem depender da cota de memória de uma aba WebView2.

---

## 2. Alternativas Avaliadas

1. **Chamada a LLM em nuvem (API proprietária ou backend próprio de IA):**
   - *Desvantagem crítica:* eleva custo financeiro recorrente incompatível com o modelo gratuito e, principalmente, transmite texto íntegro do documento para infraestrutura externa. **Rejeitada** como arquitetura de `pdf-summarize`.
2. **Resumo puramente extrativo estatístico (TextRank / TF-IDF sem modelo neural):**
   - *Vantagem:* levíssimo (~10 KB), instantâneo e determinístico.
   - *Desvantagem:* não sintetiza nem responde em português fluido com compreensão contextual real quando comparado ao padrão esperado pelo usuário para "Resumir com IA". Pode atuar apenas como pré-filtro/seleção de trechos auxiliares, nunca anunciado isoladamente como IA generativa sem clareza.
3. **SLM Local sob demanda com arquitetura de Chunking + Citações Verificáveis (Escolhida):**
   - Inferência 100% no dispositivo do usuário (WebGPU/ONNX no Web/WebView2; opcionalmente sidecar nativo quantizado no Windows para documentos extensos), com download explícito e opt-in do modelo antes da primeira execução.

---

## 3. Decisão Arquitetural

### 3.1 Garantia Estrita de Privacidade e Offline
- `pdf-summarize` **nunca** envia texto extraído, prompts ou metadados documentais para fora do dispositivo.
- Os pesos do modelo são baixados apenas uma vez, mediante clique explícito de aceite após exibição do tamanho em disco/cache (`Cache API` no navegador ou diretório `runtime/models/` com manifesto e **SHA-256** no Windows). Após o cache/instalação, a ferramenta opera **100% offline**.

### 3.2 Seleção de Runtime e Perfis de Modelo
1. **Critério de licença (ADR-008):** somente modelos com licença permissiva aprovada (**Apache-2.0** ou **MIT**, ex.: família `Qwen2.5-0.5B/1.5B-Instruct` Apache-2.0, `SmolLM2-1.7B-Instruct` Apache-2.0 ou equivalente auditado no momento da fixação de versão). Pesos sob licenças restritivas (`Llama Community`, `Gemma Terms` com cláusulas adicionais ou não-comerciais) exigem revisão explícita separada antes de qualquer vínculo oficial.
2. **Perfis por capacidade do dispositivo (Preflight de Hardware):**
   - **WebGPU disponível (`navigator.gpu` + adapter com `maxBufferSize` adequado, ex.: ≥ 2 GB VRAM/unificada):** perfil recomendado em 4-bit (`q4f16` / `q4`), ~400 MB–1,1 GB em cache OPFS/Cache API, executado em **Web Worker dedicado** (`pdf-summarize.worker.ts`) para nunca congelar a UI.
   - **Sem WebGPU no navegador (apenas CPU WASM):** habilitar somente modelo compacto validado (ex.: ≤ 500M parâmetros quantizado) **com aviso honesto de velocidade** e recusa elegante em dispositivos com baixa memória (`deviceMemory < 4 GB` quando informado pelo browser), sugerindo o aplicativo Windows ou recusa clara sem crash da aba.
   - **Desktop Windows (futuro complemento nativo):** integração opcional via Superpoder gerenciado em `capabilities.rs` (mesmo padrão dos modelos de tradução do ADR-011), compartilhando os contratos de UI com o client web.

### 3.3 Pipeline Documental anti-alucinação (Extract → Chunk → Map → Reduce → Grounding)
Resumos jurídicos/corporativos não podem inventar datas, valores ou cláusulas ausentes no PDF:
1. **Extração estruturada com preservação de página:** reutilizar o extrator vetorial do `pdfjs-dist` (ou texto de saída já gerado via `pdf-ocr` quando o usuário encadear OCR → Resumo). Se o PDF for puramente escaneado sem texto e sem OCR prévio, orientar explicitamente para executar OCR antes ou oferecer botão direto de encadeamento para `/ocr-pdf`.
2. **Segmentação consciente por página/seção (`Map-Reduce`):** dividir textos longos em blocos com janela segura ao contexto do modelo (ex.: ~1.500–2.500 tokens por bloco), registrando o intervalo de páginas `[p. X–Y]` de cada bloco.
3. **Modos úteis ao usuário:**
   - **Resumo Executivo** (visão geral + pontos-chave em tópicos)
   - **Pontos de Ação / Obrigações / Datas** (lista estruturada)
   - **Resumo por Seção / Capítulo**
4. **Citações e Rastreabilidade (`Anchors`):** cada tópico ou síntese gerada referencia o intervalo de páginas de origem (ex.: `[p. 3]`), permitindo clique para saltar diretamente à página na prévia lateral do documento (padrão `[data-workspace-panel]`), mitigando risco de alucinação não verificada.
5. **Saídas derivadas imutáveis (ADR-004):** exportação em `.md` (Markdown), `.txt` ou novo `.pdf` formatado contendo cabeçalho de método, modelo local utilizado e aviso claro de revisão humana.

### 3.4 Cancelamento, Memória e Segurança (Lições de `TRADUCAO-WEB.md`)
- O worker deve suportar `AbortController` real: cancelar encerra/termina o worker imediatamente (recriando worker limpo na próxima operação) e libera buffers WebGPU / ONNX (`session.release()` / `dispose()`).
- Timeout explícito de download sem progresso (seguindo o padrão de 60s de inatividade usado no worker de tradução).
- Todo prompt é estruturado separando **instrução de sistema fixa** de **conteúdo documental tratado exclusivamente como dado citado**, prevenindo *prompt injection* embutido no texto de PDFs maliciosos.

---

## 4. Critérios de Aceite para Promoção à Vitrine Ativa

1. Fluxo completo no `[data-workspace-panel]` padrão (prévia navegável do PDF à esquerda + escolha de modo de resumo, medidor de download/progresso do modelo, badge de execução `WebGPU`/`CPU` e resultado copiável/exportável à direita).
2. Simulação determinística nos testes unitários/E2E (incluindo cancelamento no meio do download, falha de rede ao baixar pesos, recusa de PDF sem camada de texto e limpeza de memória do worker).
3. Auditoria de licença do modelo escolhido registrada em `docs/THIRD_PARTY_LICENSES.md` e medição empírica de tempo frio/quente, pico de RAM/VRAM e taxa de falhas em corpus em português brasileiro.

---

## 5. Consequências

- **Positivas:** entrega capacidade de IA moderna mantendo intacta a promessa *"Seus arquivos nunca saem deste dispositivo"*, zero custo de servidor de inferência e reaproveitamento da stack ONNX/`@huggingface/transformers` já existente no projeto.
- **Limitações honestas:** exige hardware compatível e download inicial de centenas de MB; documentos com centenas de páginas têm latência proporcional em CPU e são limitados por orçamento explícito de blocos para preservar estabilidade da aba.
