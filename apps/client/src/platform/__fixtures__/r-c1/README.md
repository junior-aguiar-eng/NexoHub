# Corpus R-C1

PDFs autorais, MPL-2.0, gerados por `corpus.ts` com dados fictícios e datas fixas.
`expected.json` fixa SHA-256, tamanho e resultado esperado por arquivo. Nenhum binário qpdf
ou wrapper WASM é incluído neste diretório ou no aplicativo.

O original contém duas páginas com texto, CropBox, um campo `nome=Maria Silva`, um anexo
`nota.txt` com `Anexo autoral preservado` e metadados em Unicode. Um stream adicional contém
delimitadores falsos de objeto, catálogo e trailer, que não devem virar estrutura do PDF.

Variantes: íntegro, prefixo inválido, EOF ausente, startxref ausente, apontador xref incorreto,
remoção de xref/trailer, truncamento com perda física e texto não PDF contendo `objetos`.

O perfil local aceita as cinco primeiras sem perder os itens esperados. A ausência de trailer
destrói a associação do Info: o conteúdo e campos ainda são legíveis, mas metadados ficam
órfãos. O perfil recusa esse caso em vez de adivinhar a associação ou omitir dados. Truncamento
físico e texto não PDF também são recusados. Esses resultados não certificam qualquer PDF danificado.

Reprodução e medidas: `scripts/avaliar-r-c1*.{mjs,py}` e `scripts/validar-r-c1.py`, conforme
`docs/R-C1-VALIDACAO.md`. A geração grava as novas entradas na pasta ignorada do ensaio;
o validador compara seus hashes com este manifesto sem reescrevê-lo.
