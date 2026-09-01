# NexoHub Document Engine

Motor documental local executado como sidecar permitido pelo core nativo. O protocolo usa JSON
Lines por stdin/stdout; não abre servidor nem recebe caminhos arbitrários.

O método `ocr` aceita conteúdo em Base64 de PNG, JPEG, TIFF, WebP ou PDF. PDFs são renderizados
localmente e limitados a 500 páginas; cada página é limitada a 50 megapixels e a entrada completa a
64 MiB. A resposta contém texto, confiança e caixas normalizadas por página.

Execução de desenvolvimento:

```powershell
uv run --project engines/python python -m nexohub_document_engine
```
