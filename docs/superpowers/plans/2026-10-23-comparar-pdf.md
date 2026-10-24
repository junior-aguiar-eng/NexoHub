# Comparar PDF — plano de implementação

> Para execução: aplicar desenvolvimento orientado a testes e revisão independente.

**Objetivo:** comparar dois PDFs no navegador com texto, imagens e relatório exportável.
**Arquitetura:** motor isolado em worker; executor compartilhado retorna relatório e resultado tipado;
componente dedicado apresenta pares alinhados e modos de análise.
**Stack:** React/TypeScript, PDF.js, motor textual existente, pixelmatch e pdf-lib.
**Spec:** ../specs/2026-10-23-comparar-pdf-design.md

## Restrições

Website, originais imutáveis, processamento local; pt-BR; sem commit/push/deploy.
Dependência nova deve ter licença permissiva e inventário atualizado.

## Foco de revisão

PDFs idênticos, páginas inseridas/removidas, digitalizações, CropBox/rotação/tamanhos distintos,
falhas e cancelamento/troca de arquivo com descarte de resultados atrasados.

## Entregas

- [x] Motor: `platform/pdf-comparison.ts` e testes reais. Contrato em `pdf-comparison-types.ts`.
  `comparePdfDocuments(left, right, options): Promise<PdfComparisonResult>`; extrair/renderizar,
  alinhar, comparar pixels/texto e devolver regiões normalizadas e imagens. Testar igualdade,
  mudança textual/visual, inserção/remoção, documentos sem texto, rotação/crop e limites.
- [x] Interface: `features/launcher/PdfComparePanel.tsx`, CSS e testes. Recebe `documentCore`, `onBack`,
  `initialFiles`; chama executor `pdf-compare` com `comparisonSignal` e `onComparisonProgress`.
  Testar troca de arquivos/cancelamento, modos, zoom, lista, busca, sincronização e downloads.
- [x] Integração: registry, capabilities web, rotas/catalogo, worker/proxy, executor e relatório.
  O output retorna `comparison`, PDF principal e JSON secundário. Sem habilitação nativa indevida.
- [x] Verificar lint/tipagem, testes unitários, E2E reais, quatro larguras, build e licenças.
  Revisar resultados e documentar limites antes de concluir. Sem commits nesta entrega.

## Evidências finais

- `pnpm check`: lint e tipagem aprovados.
- `pnpm test`: 469 testes aprovados (408 client, 61 pacotes).
- E2E Chromium no build de produção: 79 aprovados; após ajuste da margem do relatório,
  os cinco E2E do comparador foram repetidos e aprovados.
- `pnpm build:web`, `pnpm licenses:check` e `git diff --check`: aprovados.
- Capturas em 390, 768, 1024 e 1440 px, sem rolagem horizontal; foco por teclado verificado.
- Revisão independente identificou amostras largas saindo da margem do PDF; corrigido com
  medição da fonte e teste real de extração do relatório (falhou antes, passou depois).
- Limites finais documentados em `docs/COMPARAR-PDF-WEB.md`. Sem commit, push ou deploy.

## Fase de complementação — 24/10/2026

### CMP-C1 — Navegação e relatório mais legíveis, mantendo o motor atual

**Estado:** planejado. Consome Q-C0/UX-C1 e os
[gates comuns](../../ROADMAP.md#regras-comuns-de-execução-e-aceite).
**Modificar:** `apps/client/src/features/launcher/PdfComparePanel.tsx`/CSS e testes,
`platform/pdf-comparison.ts`, `pdf-comparison-report.ts` e testes,
`e2e/pdf-compare.spec.ts`, `docs/COMPARAR-PDF-WEB.md`.

- [ ] Acrescentar corpus com páginas quase iguais, repetidas/reordenadas, branco inserido,
  documentos mistos e Unicode fora das fontes padrão; conferir alinhamento e relatório exportado.
- [ ] Melhorar ajuste à largura, zoom e salto para alteração, preservando sincronização e
  contexto da página; reaproveitar controles de UX-C1 somente se mantiverem a semântica dos pares.
- [ ] Evitar `?` em caracteres do relatório mediante fonte local licenciada e incorporada;
  provar extração/visualização, paginação e margens. JSON continua completo, sem perda silenciosa.
- [ ] Apresentar limites do alinhamento heurístico e páginas sem texto. Não rotular diferenças
  como prova de autenticidade, plágio ou interpretação semântica; OCR só após OCR-C1 e escolha
  explícita por documento/página, preservando os resultados originais separadamente.
- [ ] Medir renderizações e memória; carregar detalhes sob demanda sem enfraquecer detecção de
  páginas inseridas/removidas. Testar cancelar/trocar arquivos durante cálculo e geração do relatório.

Não adicionar outro diff/viewer por padrão. PDF.js, pixelmatch e o comparador textual existentes
permanecem até que uma comparação com o corpus demonstre necessidade de substituição.
