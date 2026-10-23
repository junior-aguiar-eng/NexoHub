# Fixtures sintéticas de desbloqueio

PDFs criados para os testes do NexoHub, sem documentos ou senhas reais. Regeneração opcional:
`python generate-fixtures.py` com pypdf 6.10.0 e PyMuPDF 1.26.6. Os testes Vitest não executam
Python nem dependem dessas ferramentas.

Senha de usuário: ` senha com espacos ` (inclui os espaços inicial/final). Senha de
proprietário: `dono`. `permissions-only.pdf` abre com senha vazia e restringe permissões.

Cada documento contém texto vetorial, fonte Helvetica, formulário editável `nome`, link URI,
marcador, metadados Info/XMP e anexo `anexo.txt`. As variantes cobrem RC4 40/128 bits,
AES 128/256 bits, revisões 5/6, xref stream/objetos compactados, atualização incremental,
metadados não cifrados e PDF 2.0. A fixture `signed-placeholder.pdf` contém um ByteRange
sintético para a guarda contra regravação; não contém assinatura criptográfica válida.

A implementação usa o parser, a criptografia e o writer existentes do PDF.js 6.3.289,
licença Apache-2.0. O plugin Vite expõe somente os símbolos necessários em um módulo lazy
separado. Nenhum algoritmo criptográfico foi copiado ou criado. Atualizações do PDF.js devem
revalidar essa ponte interna e executar as fixtures antes de trocar a versão homologada.

O novo arquivo mantém os números/referências e o catálogo do original, serializando strings
e streams já decriptados e reconstruindo xref sem `/Encrypt` ou revisões anteriores. Streams
mantêm seus filtros e os bytes após decriptação. PDFs com ByteRange ou filtros `/Crypt`
explícitos são recusados até que exista uma transformação homologada que preserve seu
significado; o original nunca é alterado. Não há rasterização, upload ou remoção de campos.
