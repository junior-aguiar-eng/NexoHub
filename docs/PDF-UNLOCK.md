# Desbloqueio PDF no navegador

O desbloqueador usa o parser, os algoritmos criptográficos e o writer já presentes no
`pdfjs-dist` **6.3.289**, licença Apache-2.0. Não adiciona dependências, uploads ou rasterização.
O original é copiado antes do processamento e nunca é transferido a um worker nem alterado.

`src/platform/pdf-unlock.ts` importa sob demanda uma ponte interna do bundle legacy do PDF.js.
O plugin Vite `pdfjs-unlock-internals` expõe `LocalPdfManager`, `Ref`, `RefMap`,
`incrementalUpdate`, `BaseStream`, `Dict` e `Name` exclusivamente para essa importação.
As declarações TypeScript ficam em `pdf-unlock-internals.d.ts`. O build gera um chunk
separado para evitar carregar o motor interno antes do uso da ferramenta.

Essa ponte **não é uma API pública estável do PDF.js**. Qualquer atualização dessa dependência
exige revisar os símbolos e executar novamente os testes e a validação no navegador antes
de considerar a nova versão homologada. A versão está fixada no manifesto e no lockfile; sua atualização exige essa revisão.

O parser autentica a senha exata, incluindo espaços, e fornece strings e streams decriptados.
O writer regrava os objetos mantendo referências e catálogo, substitui os índices e remove
criptografia e revisões anteriores. Formulários continuam editáveis; fontes, links, anexos,
marcadores, Info/XMP, filtros de compressão e versão PDF são preservados nas fixtures homologadas.
Não basta apagar `/Encrypt`: isso deixaria os streams cifrados e geraria um arquivo corrompido.

Documentos com `ByteRange` são recusados porque a regravação invalidaria sua assinatura.
Filtros `/Crypt` explícitos também são recusados até que exista normalização homologada.
Erros de autenticação, sintaxe ou variante não suportada não produzem um falso arquivo
“desbloqueado”. Nenhuma dessas recusas modifica o original.

Validação de referência em 23/10/2026: regressões reais em
`apps/client/src/platform/pdf-unlock.test.ts` abrangem RC4 40/128, AES 128, AES 256 R5/R6,
restrições sem senha de abertura, senha com espaços, senha incorreta, objeto compactado/xref
stream, atualização incremental, XMP não cifrado e PDF 2.0. Fixtures sintéticas e seu gerador
opcional estão em `apps/client/src/platform/__fixtures__/pdf-unlock`.

Também foram geradas saídas pelo Chromium real e abertas por dois motores independentes,
pypdf 6.10.0 e MuPDF 1.26.6: texto extraível, campo editável, anexo, marcador e XMP foram
verificados. A renderização MuPDF das dez variantes liberadas foi idêntica, pixel a pixel,
à dos originais autenticados. Essa validação cobre as fixtures indicadas; não afirma suporte
a todos os documentos ou extensões do formato PDF.
