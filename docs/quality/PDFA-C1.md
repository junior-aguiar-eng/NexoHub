# PDFA-C1 — Evidência e Limites de Arquivamento PDF/A (ISO 19005)

## Escopo medido

- Ferramenta: `pdf-to-pdfa` (`apps/client/src/platform/pdfa-converter.ts`,
  `apps/client/src/platform/pdfa-client.ts`, `apps/client/src/platform/pdfa.worker.ts`)
- Perfis suportados: **PDF/A-2b** (`GTS_PDFA2`, padrão recomendado) e **PDF/A-1b** (`GTS_PDFA1`).
- Recursos embarcados: perfil ICC sRGB v2.1 (`apps/client/public/icc/sRGB-v2-micro.icc`, CC0 1.0) e
  fonte `LiberationSans-Regular.ttf` para reconstrução com camada de texto invisível pesquisável.

## Casos cobertos e verificados nos testes automatizados

1. Diagnóstico prévio de fontes padrão não incorporadas, transparências, ações proibidas e assinaturas digitais.
2. Conversão PDF/A-2b preservando páginas 100% vetoriais quando todas as fontes já estão embutidas.
3. Reconstrução de páginas com fontes padrão/não embutidas em imagem opaca + camada de texto invisível pesquisável.
4. Remoção de ações proibidas (`/JavaScript`, `/OpenAction`, `/AA`, `/Launch`, `/RichMedia`, etc.).
5. Achatação/eliminação de transparências e `/SMask` em PDF/A-1b e recusa explícita de ICC inválido (`PDFA_INVALID_ICC_PROFILE`).
6. Recusa por padrão de PDFs assinados digitalmente (`PDFA_SIGNED_REFUSED`) com opção explícita de gerar cópia sem assinatura (`allowDiscardSignatures`), e recusa de PDF criptografado (`PDFA_ENCRYPTED_REFUSED`).
7. Cancelamento cooperativo via `AbortSignal` com término imediato do Web Worker e não-mutação da entrada.

## Limites honestos

- Não há certificação completa externa veraPDF em todas as entradas deste host (o validador externo `verapdf` não está instalado por padrão no ambiente Windows de desenvolvimento); a conformidade estrutural é verificada internamente por `verifyPdfaStructure` quanto a `OutputIntents`, perfil ICC, pacote XMP UTF-8, trailer `/ID`, fontes incorporadas, ações proibidas e regras de transparência `1b`/`2b`.
- Formulários XFA dinâmicos e fontes CJK ausentes dependem da reconstrução raster + texto extraído ou renderização local disponível no navegador/WebView2.
