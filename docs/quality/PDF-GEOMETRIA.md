# Q-C0 — recorte e sobreposições PDF

Fatia local sobre `82db4d1`, após commit autorizado do PDF básico. Reutiliza as quatro
páginas estáticas com CropBox/Rotate, texto e JPEG autorais do [corpus anterior](PDF-BASICO.md).
Acrescenta referências explícitas para recorte e controles fictícios de carimbo, numeração
e assinatura visual. Não altera código do aplicativo, dependências, interface ou arquitetura.
DOC-C2 continua excluído.

## Corpus e expectativas

O [índice](q-c0.json) referencia os grupos `pdf-static` e `pdf-overlay`, com origem/licença
e SHA-256 de geradores e testes. Os hashes identificam esses arquivos, não os PDFs gerados.
`__fixtures__/q-c0-pdf/overlay.ts` contém nome/data fictícios, PNG autoral e caixas esperadas.

Margens visuais: superior 10%, inferior 20%, esquerda 5%, direita 15%.

| Página / rotação | CropBox e MediaBox após recorte (x/y/largura/altura, pt) |
| --- | --- |
| A / 0° | 24,5 / 102 / 232 / 287 |
| B / 90° | 41 / 41,5 / 217 / 344 |
| C / 180° | 59,5 / 65 / 264 / 315 |
| D / 270° | 80 / 90,5 / 245 / 376 |

- **Recorte:** aplicar em todas ou somente B/D; caixas e rotação corretas, páginas não
  selecionadas intactas, streams e JPEG originais conservados. Recortar é ocultar visualmente:
  o conteúdo fora da caixa permanece no documento e não equivale a uma tarja definitiva.
- **Marca d’água:** carimbo horizontal longo, fonte solicitada de 200 pt reduzida pelo motor
  para caber na área visível; exatamente um carimbo por página, horizontal após cada rotação.
- **Numeração:** seis posições, início na página 2; A não recebe número, B–D contêm o número
  correspondente e o total quatro, sem perder texto/imagem nem sair da caixa visível.
- **Assinatura visual:** PNG 4:1 fictício, nome e data em primeira/última/todas/página 2;
  somente as páginas escolhidas recebem os textos. Não é assinatura digital criptográfica.

Os 17 testes novos reabrem a saída em pdf-lib para verificar caixas, streams decodificados e
bytes JPEG; usam PDF.js para conferir textos, orientação e limites das linhas acrescentadas.
Comparam também os bytes originais antes/depois. Controles negativos demonstram que os
oráculos recusam o original sem carimbo, uma alteração de CropBox não esperada e numeração
correta colocada na posição errada. O alinhamento horizontal admite 0,5 pt: o cálculo de
largura do pdf-lib inclui kerning e difere do avanço extraído pelo PDF.js (até 0,4 pt nos
controles de numeração). Isso não certifica centralização tipográfica exata; coordenadas
verticais e caixas são verificadas separadamente. A tolerância não permite trocar topo/rodapé
ou esquerda/direita. Nenhuma mudança no motor foi feita para encobrir essa diferença.

Os testes existentes de recorte/assinatura acrescentam posições inválidas, seleção e margens
inválidas, proporção da imagem e orientação. E2E existentes verificam pixels de PDF→JPG,
posicionamento da numeração, carimbo longo, recorte/assinatura após zoom, navegação e download.
`tool-quality.spec.ts` agora aceita a base `/hub/` e integra o executor normal da subpasta.

## Limites

Perfil estático restrito; não certifica formulários, assinaturas criptográficas, anexos, links,
metadados globais, fontes arbitrárias ou remoção definitiva de conteúdo pelo recorte.
Não houve medição de grandes lotes/pouca RAM nem comparação pixel a pixel de todas as
saídas. Os textos são conferidos por conteúdo e geometria, sem avaliação tipográfica universal.
Marca inclinada e proporção da imagem assinada se apoiam nos testes existentes; esta fatia
não amplia a cobertura para todos os ângulos/posições possíveis. Q-C0 global continua parcial.

## Validação

- `pnpm check`: formatter/lint e typecheck aprovados.
- `pdf-overlay-quality`, `pdf-crop-sign` e `pdf-engine`: 70 testes aprovados, incluindo 17 novos.
- Suíte completa do Tool Registry: 10 testes aprovados, incluindo o índice real e os hashes.
- Builds web da raiz e de `/hub/`: aprovados.
- E2E `tool-quality` e `pdf-viewport`: 23 aprovados na raiz e 23 em `/hub/`, com downloads reais.

A revisão independente identificou uma lacuna do novo oráculo de seleção da assinatura.
Agora cada página selecionada exige uma chamada de desenho do PNG 40×10, além do JPEG
original 2×1; páginas não selecionadas não podem desenhar esse PNG. A verificação resolve
as chamadas `Do` contra os XObjects de imagem. Dois controles negativos, com imagem ausente
ou na página errada e textos corretos, falharam antes da correção do oráculo e passaram
depois. Isso comprova os objetos/chamadas de desenho neste corpus, sem equivaler a comparação
pixel a pixel da pintura. Não houve alteração do executor de assinatura.

Não foram repetidas as suítes completas do cliente/E2E nesta fatia de testes/documentação:
os executores do aplicativo não foram alterados. A suíte ampla da entrega anterior permanece
registrada em [PDF-BASICO.md](PDF-BASICO.md), sem ser apresentada como nova execução.
Sem teste instalado Windows. Commit local desta fatia autorizado posteriormente pelo usuário,
sem push, deploy ou integração no checkout principal.
