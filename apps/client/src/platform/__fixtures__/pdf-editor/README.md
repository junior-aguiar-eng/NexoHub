# Fixture do editor

`embedded-subset.pdf` é um documento sintético gerado pelo script deste diretório com ReportLab.
Inclui subconjunto da fonte Liberation Sans já distribuída em `public/standard_fonts`.
A licença e os créditos da fonte estão em `public/standard_fonts/LICENSE_LIBERATION`.
Não contém documentos ou dados de terceiros. ReportLab é necessário apenas para regenerar a fixture.

## Corpus de compatibilidade ED-C1

`embedded-full.pdf` é gerado por `generate-compatibility.mjs` com PDFium 2.15.1 e pdf-lib,
dependências já utilizadas pelo projeto. Inclui o arquivo completo Liberation Sans, acentos,
duas colunas, transparência, texto inclinado, ligadura e campo de formulário. A suíte confere
que o hash do stream descomprimido da fonte corresponde ao TTF distribuído pelo projeto.
A licença existente é GPL-2.0 com exceção expressa para incorporação documental (§1(a) de
`LICENSE_LIBERATION`). O TTF é incorporado sem alteração; nenhuma fonte ou dependência nova
foi adicionada ao runtime.

`corpus.json` registra origem, licença, hash da fonte e SHA-256 dos dois PDFs. Esses hashes
identificam as entradas; a fidelidade da edição é conferida separadamente por PDF.js,
preservação do campo e comparação dos pixels fora da região editada.

| Classe | Resultado esperado neste perfil |
| --- | --- |
| Fonte padrão latina | Substituição com acentos; caracteres fora do repertório são recusados |
| Fonte completa ou em subconjunto | Reutilizar somente caracteres observados; troca de fonte explícita quando permitida |
| Ligadura com código privado ou mapeamento ambíguo | Objeto somente para consulta, com motivo de recusa |
| Transparência | Substituição no mesmo objeto; fonte/tamanho preservados |
| Inclinação, espelhamento, recorte interno ou fora da página | Recusa antes da edição |
| Coluna vizinha e formulário | Texto, pixels não editados e valor do campo preservados |

Gerar a fixture completa e atualizar seus hashes, a partir da raiz:

```powershell
node apps/client/src/platform/__fixtures__/pdf-editor/generate-compatibility.mjs
```

O corpus é sintético e licenciado; não representa todos os PDFs encontrados em produção.
