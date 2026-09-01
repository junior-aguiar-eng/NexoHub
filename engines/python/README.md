# NexoHub Document Engine

Motor documental local executado como sidecar permitido pelo core nativo. O protocolo usa JSON
Lines por stdin/stdout; não abre servidor nem recebe caminhos arbitrários.

O método `ocr` aceita conteúdo em Base64 de PNG, JPEG, TIFF, WebP ou PDF. PDFs são renderizados
localmente e limitados a 500 páginas; cada página é limitada a 50 megapixels e a entrada completa a
64 MiB. A resposta contém texto, confiança e caixas normalizadas por página.

Os métodos `docx.inspect` e `docx.create` leem conteúdo estruturado e produzem um novo DOCX em
Base64. O sidecar não recebe caminhos nem salva sobre o original. Arquivos importados passam por
limites de tamanho, quantidade de itens, expansão e taxa de compressão antes do parsing.

Execução de desenvolvimento:

```powershell
uv run --project engines/python python -m nexohub_document_engine
```
