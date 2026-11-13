# OFFICE-C1 — Evidência e Limites da Suíte Office (Word, Excel, PowerPoint ↔ PDF)

## Escopo medido

- Ferramentas:
  - `word-to-pdf` (DOCX, DOC, ODT, RTF → PDF)
  - `excel-to-pdf` (XLSX, XLS, ODS → PDF)
  - `powerpoint-to-pdf` (PPTX, PPT, ODP → PDF)
  - `pdf-to-powerpoint` (PDF → PPTX, exclusivo NexoHub Desktop)
- Motor nativo (`crates/nexohub-core/src/office_engine.rs`), comando IPC (`apps/desktop/src-tauri/src/lib.rs`), adaptador cliente (`apps/client/src/platform/office-client.ts`) e painel dedicado (`apps/client/src/features/launcher/OfficeConvertPanel.tsx`).

## Casos cobertos e verificados nos testes automatizados

1. Inspeção pura em Rust de contêineres OOXML/ODF contra Zip-Bomb (`<= 100x` expansão, `<= 512 MiB` descomprimido, `<= 10.000` entradas) e Path Traversal (`..`, caminho absoluto, caractere nulo).
2. Validação rigorosa de extensão × assinatura mágica (`PK\x03\x04`, OLE2, `{\rtf`, `%PDF-`), limite de entrada de `64 MB` e validação de saída (`%PDF-`/estrutura PDF e contêiner ZIP PPTX).
3. Políticas honestas de disponibilidade por superfície (`apps/client/src/platform/tool-availability.test.ts` e `apps/client/src/features/launcher/data.test.ts`):
   - Navegador Web Offline: não promete nem exibe ferramentas Office como conversão local offline; rotas diretas exibem orientação honesta.
   - Web Híbrida (`HttpDocumentCorePort`): habilita apenas `word-to-pdf`, `excel-to-pdf` e `powerpoint-to-pdf` via fluxo explícito de Nuvem Opcional (ADR-020).
   - NexoHub Desktop (`TauriDocumentCorePort`): habilita todas as 4 ferramentas usando o Superpoder instalável sob demanda `"office.suite"`.

## Limites honestos

- O runtime portátil do LibreOffice (`office.suite`) é uma capacidade opcional baixada separadamente (`scripts/install-office-runtime.ps1` ou instalação de Superpoder) e não é executado durante os testes unitários Web/CI sem `soffice` presente no host.
- Na ausência do runtime `soffice` no Desktop ou sem servidor NexoHub Cloud habilitado na Web Híbrida, a interface e o adaptador recusam a execução com código estruturado (`TOOL_UNAVAILABLE` / `CAPABILITY_NOT_FOUND`), sem simular resultados.
