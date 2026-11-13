# SUMMARIZE-C1 — Auditoria de Modelo SLM Local e Pipeline Anti-Alucinação (`pdf-summarize`)

- **Data:** 13/11/2026
- **ADRs relacionados:** `ADR-017`, `ADR-008`, `ADR-011`, `ADR-004`
- **Status:** Implementado e auditado no nível unitário/contrato e E2E determinístico em Chrome (`C1`).

---

## 1. Modelo Fixado e Auditoria de Licença (`ADR-008`)

- **Repositório fixado:** `onnx-community/Qwen2.5-0.5B-Instruct` (`revision: "main"`)
- **Licença:** `Apache-2.0` (sem restrições proprietárias, comerciais ou de redistribuição).
- **Motor no navegador:** `@huggingface/transformers@^4.3.1` (`Apache-2.0`) rodando exclusivamente em Web Worker dedicado (`pdf-summarize.worker.ts`) com:
  - `env.allowLocalModels = false` e `env.useBrowserCache = true` (armazenamento local persistente em `Cache API` do navegador após o primeiro opt-in).
  - Timeout de inatividade em download (`60.000 ms`) reutilizando `createInactivityFetch` (`translation-runtime.ts`).
  - Cancelamento destrutivo imediato via `worker.terminate()` (`terminateSummarizeWorker()`).
- **Perfis de execução:**
  - **WebGPU (`q4f16`):** ~410 MB de download único, habilitado apenas quando `navigator.gpu.requestAdapter()` confirma adapter válido (`maxBufferSize >= 256 MiB`).
  - **Fallback CPU (`WASM SIMD`, `q4`):** ~390 MB de download único, exibindo aviso honesto de latência superior e alerta quando `navigator.deviceMemory < 4 GB`.

---

## 2. Pipeline Extract → Chunk → Map-Reduce → Grounding

1. **Extração por página (`extractPdfPagesText` em `pdf-engine.ts`):**
   - Preserva o número exato de cada página (`pageNumber`) via `pdfjs-dist`.
   - Documentos vazios ou com menos de `40` caracteres úteis são recusados com `SUMMARIZE_SCANNED_PDF_NO_TEXT` e exibem atalho direto **"Abrir OCR PDF"** para `/ocr-pdf`.
2. **Segmentação segura e proteção contra Prompt Injection (`chunkPagesForSummarization`):**
   - Delimita blocos de até `3.600` caracteres (`overlap` de `240`) com limite explícito de `18` blocos / `120` páginas para estabilidade da aba.
   - Neutraliza marcadores de fechamento (`</documento_fonte>`, `<sistema>`, `<system>`) dentro do texto do PDF e envolve o conteúdo como DADO PASSIVO na instrução de sistema.
3. **Modos suportados (`SummarizeMode`):**
   - `executive`: Resumo executivo em tópicos objetivos com citações `[p. X]`.
   - `obligations-dates`: Lista de obrigações, valores financeiros, responsabilidades e prazos.
   - `by-section`: Síntese sequencial organizada na ordem das páginas.
4. **Ancoragem e validação (`extractAndValidateCitations`):**
   - Remove referências `[p. X]` fora dos limites reais (`1..totalPages`) do documento.
   - Na mesa `[data-workspace-panel]` (`PdfSummarizePanel.tsx`), cada citação válida é renderizada como botão interativo que navega a prévia lateral do PDF para a página `X`.
5. **Saídas derivadas imutáveis (`ADR-004`):**
   - Exportação local em `.md`, `.txt` e novo `.pdf` gerado via `pdf-lib` com proveniência explícita e aviso de revisão humana. O PDF original nunca é alterado.

---

## 3. Evidências de Teste e Limites Honestos

- **Unitários/Contrato:** `apps/client/src/platform/pdf-summarizer.test.ts` e `apps/client/src/features/launcher/PdfSummarizePanel.test.tsx`.
- **E2E Chrome (worker determinístico):** `apps/client/e2e/pdf-summarize-quality.spec.ts` valida:
  - Extração real de PDF multi-página pelo `PDF.js` no navegador, progresso de download em worker mockado, clique em citação `[p. 2]` saltando a prévia lateral, exportações `.md`/`.txt`/`.pdf` e zero overflow em `390x844` e `1366x768`.
  - Recusa real de PDF gráfico sem texto selecionável com encadeamento para `/ocr-pdf`.
- **Limite declarado no CI:** Testes automatizados de CI não baixam os ~390–410 MB de pesos do Hugging Face Hub; usam injeção determinística de worker na etapa neural mantendo real todo o parsing `PDF.js`, chunking, neutralização, prévia e exportação.
