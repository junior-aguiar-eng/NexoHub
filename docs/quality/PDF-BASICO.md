# Q-C0 — operações básicas PDF estático

Fatia local sobre `f50a1c0`, após o commit autorizado da consolidação Q-C0. Cobre juntar,
dividir, organizar e girar no website existente. Sem nova dependência, integração de candidato,
mudança de arquitetura ou interface. DOC-C2 permanece excluído.

## Corpus e referências

O gerador `apps/client/src/platform/__fixtures__/q-c0-pdf/corpus.ts` cria quatro páginas
autorais com datas fixas, texto Latin-1, JPEG de controle e geometrias distintas. A origem,
licença e SHA-256 do gerador, testes e JPEG estão no [índice](q-c0.json), grupo `pdf-static`.
São hashes dos arquivos referenciados, não hashes dos PDFs gerados.

| Página | Texto esperado | MediaBox (pt) | CropBox x/y/largura/altura (pt) | Rotação |
| --- | --- | --- | --- | --- |
| A | Página A - ação 00123 | 320×460 | 10/20/290/410 | 0° |
| B | Página B - valor 1.234,56 | 340×480 | 10/20/310/430 | 90° |
| C | Página C - certidão | 360×500 | 10/20/330/450 | 180° |
| D | Página D - fim | 380×520 | 10/20/350/470 | 270° |

O corpus usa Helvetica como fonte PDF padrão, sem incorporar arquivo de fonte. O JPEG
autoral de 2×1 pixels já pertence aos controles de extração do projeto.

## Resultado exigido

- Juntar: documentos C–D e A–B nessa ordem produzem C–D–A–B, com texto, imagem e geometria.
- Dividir: intervalo 2–3 produz B–C; seleção 4,2 produz D–B.
- Organizar: seleção 4,2 com acréscimos de 90° e 180° produz D (0°) e B (270°).
- Girar: -90°, 90°, 180° e 270° são somados às rotações existentes sem perder conteúdo.

O teste abre o resultado com PDF.js para conferir o texto de cada página e com pdf-lib para
conferir MediaBox, CropBox, rotação e os bytes exatos do stream JPEG. Compara os bytes das
entradas antes/depois para demonstrar que o original não foi modificado.

A seleção vazia em `reorganizePdfDocument` gerava um PDF em branco; agora é recusada antes
de criar o destino. Índices fracionários/fora da faixa e rotações não finitas ou fora dos
múltiplos de 90 também retornam `SELECAO_DE_PAGINAS_INVALIDA`, evitando erros internos da
biblioteca. O teste observou essas falhas antes da correção. Duplicação de páginas não foi
proibida por esta alteração.

Os E2E usam as telas e downloads reais das quatro ferramentas e conferem conteúdo textual,
CropBox e rotação do arquivo baixado. Os testes incluem a base `/hub/` no executor de subpasta.

## Limites

Perfil restrito a PDF estático deste corpus. Não certifica formulários, assinaturas, anexos,
links internos, fontes arbitrárias, metadados globais ou fidelidade visual pixel a pixel.
Não houve medição de grandes lotes, pouca RAM ou hardware físico. Q-C0 global permanece
parcial e a instalação Windows continua um gate separado.

## Validação

- `pnpm check`: formatter/lint e typecheck dos pacotes e cliente aprovados.
- Suíte completa do cliente, com dois workers: 106 arquivos, 766 testes aprovados.
- Testes específicos deste corpus: 15 aprovados, incluindo o RED→GREEN das recusas.
- Tool Registry: 10 testes aprovados; `pnpm quality:check`: 7 aprovados, com hashes atuais.
- Builds web da raiz e com `NEXOHUB_BASE_PATH=/hub/`: aprovados.
- E2E das quatro ferramentas na raiz: 4 aprovados; suíte completa de `/hub/`: 248 aprovados,
  incluindo os quatro cenários novos.
- Revisão independente, somente leitura: sem achados materiais.

A suíte E2E inteira da raiz não foi repetida nesta fatia; o fluxo das quatro ferramentas foi
conferido nas duas bases e a regressão ampla foi executada em `/hub/`. Sem instalação Windows,
push ou deploy. Commit local autorizado posteriormente pelo usuário.
