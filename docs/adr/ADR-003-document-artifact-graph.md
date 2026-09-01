# ADR-003: Document Artifact Graph

- **Status:** aceito
- **Contexto:** PDF, DOCX e Markdown não cabem com fidelidade em uma representação universal.
- **Decisão:** representar documentos como grafo de artifacts, representações, assets, overlays e
  operações.
- **Consequências:** conversões são explícitas, versões permanecem navegáveis e o NexoFlow é um
  Operation Graph persistente, não event sourcing completo.
