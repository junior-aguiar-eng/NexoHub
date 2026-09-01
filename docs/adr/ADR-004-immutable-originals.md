# ADR-004: Originals imutáveis

- **Status:** aceito
- **Contexto:** mutação silenciosa compromete integridade, auditoria e recuperação.
- **Decisão:** bytes importados nunca são alterados; cada transformação gera novo artifact.
- **Consequências:** undo/redo move ponteiros; remoção física limita-se a cache, temporários e
  exportações explicitamente substituídas.
