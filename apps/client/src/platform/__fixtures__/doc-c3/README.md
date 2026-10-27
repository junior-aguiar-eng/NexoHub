# Corpus DOC-C3

HTML autoral MPL-2.0, determinístico e sem dados pessoais. Geradores em `corpus.ts`.

- Tabela longa: 110 registros e linha final, duas colunas com cabeçalho.
- Tabela larga: oito colunas, 12 linhas, acentos, travessão, CJK, símbolo e palavras longas.
- Quebras: modernas e legadas inline antes/depois de blocos, inclusive extremidades vazias.
- Recusa: cabeçalho maior que a área útil de uma página.

`four-tools-regression.spec.ts` usa as mesmas entradas em duas conversões por cenário,
reabre os PDFs com PDF.js, confere conteúdo e caixas dentro da página. As duas conversões
registram tempo de fluxo com download, bytes e páginas; não isolam CPU ou pico de memória.
Cada execução anexa PDF e JSON de métricas aos artefatos Playwright ignorados.
Unitários próximos ao conversor também conferem paginação e cabeçalho; não simulam Canvas
como prova visual de Unicode. A prova Unicode efetiva ocorre no Chromium.
