# NexoHub Document Engine

Motor documental local executado como sidecar permitido pelo core nativo. O protocolo usa JSON
Lines por stdin/stdout; não abre servidor nem recebe caminhos arbitrários.

O método `ocr` aceita conteúdo em Base64 de PNG, JPEG, TIFF, WebP ou PDF. PDFs são renderizados
localmente e limitados a 500 páginas; cada página é limitada a 50 megapixels e a entrada completa a
64 MiB. A resposta contém texto, confiança e caixas normalizadas por página.

Os métodos `docx.inspect` e `docx.create` leem conteúdo estruturado e produzem um novo DOCX em
Base64. O sidecar não recebe caminhos nem salva sobre o original. Arquivos importados passam por
limites de tamanho, quantidade de itens, expansão e taxa de compressão antes do parsing.

O método `translate` usa somente modelos CTranslate2 instalados sob
`NEXOHUB_TRANSLATION_MODELS_DIR`. Cada modelo ocupa uma pasta identificada por `modelId` e declara
em `nexohub-model.json` os idiomas, licença, artifact principal, SHA-256 e configuração do
tokenizer. `t5-shared` usa um SentencePiece compartilhado, prefixo de idioma e EOS para MADLAD;
`sentencepiece-pair` usa tokenizers separados e prefixo opcional para OPUS-MT. Sem um modelo
compatível, o protocolo retorna `TRANSLATION_UNAVAILABLE` e não produz texto fictício.

O engine nativo é separado dos executores do client. A tela de tradução web/Windows usa M2M100 em worker no navegador/WebView2; não exige instalar os modelos CTranslate2 descritos acima. A revisão textual Windows com LanguageTool/Java também é uma instalação opcional separada, não implica que este pacote Python esteja incluído no instalador Community. Consulte a [arquitetura](../../docs/ARCHITECTURE.md) e o [ADR-019](../../docs/adr/ADR-019-distribuicao-runtime-languagetool.md).

Execução de desenvolvimento:

```powershell
uv run --project engines/python python -m nexohub_document_engine
```
