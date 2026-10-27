# Corpus DOC-C4

Geradores autorais MPL-2.0 em `corpus.ts`; sem dados pessoais ou documentos de terceiros.

O PDF de quatro páginas tem CropBox/rotação distintos, rotação herdada de Parent, texto
marcador por página, campo textual hierárquico em duas páginas, outro exclusivo de página
descartada, checkbox marcado e rádio cujas opções ficam em páginas diferentes.

As provas removem páginas, extraem seleção descontínua/reordenada e geram ZIP. Conferem
quantidade, ordem, valores, nomes/opções de rádio, P dos widgets e geometria. PDF.js reabre
as saídas reais do navegador e confere texto, campo textual, CropBox e rotação. Originais
são comparados byte a byte antes/depois das operações, sem exigir hash idêntico da saída.

O PDF de 500 páginas tem texto simples em cada página; serve para medir grade, seleção,
teclado e prévias parciais. Não representa um PDF pesado de digitalizações. Controles
ByteRange/XFA são marcadores estruturais sintéticos de recusa, não assinaturas
criptograficamente válidas nem um corpus universal de formulários dinâmicos.
