# Licenças de terceiros

Este inventário será atualizado a partir dos lockfiles em cada alteração de dependências.

| Componente | Finalidade | Licença |
| --- | --- | --- |
| React / React DOM | Client compartilhado | MIT |
| Vite e plugin React | Build do client | MIT |
| TypeScript | Typecheck | Apache-2.0 |
| Biome | Lint e formatação | MIT ou Apache-2.0 |
| Vitest | Testes unitários | MIT |
| Playwright | Testes E2E | Apache-2.0 |
| Tauri | Shell desktop | Apache-2.0 ou MIT |
| rusqlite | Persistência SQLite do Document Core | MIT |
| SQLite | Banco local compilado no core Rust | Domínio público |
| BLAKE3 | Endereçamento e integridade de blobs | CC0-1.0 ou Apache-2.0 |
| serde / serde_json | Contratos e JSON estruturado | Apache-2.0 ou MIT |
| uuid | Identificadores persistentes | Apache-2.0 ou MIT |
| lopdf | Parsing e transformação local de PDF | MIT |
| RapidOCR | Detecção e reconhecimento óptico local | Apache-2.0 |
| ONNX Runtime | Inferência local dos modelos OCR | MIT |
| pypdfium2 / PDFium | Renderização local de páginas PDF | Apache-2.0 ou BSD-3-Clause e licenças transitivas |
| Pillow | Decodificação de imagens para OCR | HPND |
| python-docx-ng | Leitura e criação local de documentos DOCX | MIT |
| lxml | Parsing XML transitivo do suporte DOCX | BSD-3-Clause |
| Ruff | Lint Python | MIT |
| pytest | Testes Python | MIT |

Versões e dependências transitivas são determinadas por `pnpm-lock.yaml`, `Cargo.lock` e
`engines/python/uv.lock`.
