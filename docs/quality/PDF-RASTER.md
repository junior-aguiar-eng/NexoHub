# Q-C0 — conversão e extração de imagens PDF

Fatia local sobre `d18ae56`, após commit autorizado da geometria. Cobre imagens→PDF,
PDF→JPG e extração de imagens nos motores atuais. Corrige o mapeamento do aviso de ausência
de imagens elegíveis para o catálogo pt-BR existente, sem nova dependência, mudança de
arquitetura ou geometria de interface. DOC-C2 permanece excluído.

## Corpus e oráculos

Grupo `pdf-raster` no [índice](q-c0.json): origem/licença e SHA-256 dos geradores, testes e
JPEG de controle. Conteúdo sintético autoral MPL-2.0, sem fotografia externa. Hash do código
gerador não é hash do PDF ou do PNG/WebP codificado em cada execução no Chromium.

| Caso | Referência explícita |
| --- | --- |
| Imagens→PDF | PNG 120×60 e WebP 96×48 com bandas transparentes/alpha 128/azul opaco; JPEG RGB 144×72; reordenação para JPEG–PNG–WebP; fit sem margem |
| PDF→JPG | Página RGB 144×72 pt; três páginas com CropBox 24/12/96/48 pt, rotações 90/180/270; resolução 150 DPI |
| Extração | Flate RGB 32×16 com SMask 0/128/255 nas páginas 1 e 3; mesmo recurso reutilizado; JPEG original 2×1 na página 2 |

As imagens são geradas em Canvas, processadas pela mesa de conversão e baixadas como PDF.
As páginas fit resultantes medem 144×72, 120×60 e 96×48 pt, na ordem escolhida. Em seguida,
o PDF é convertido pela mesa PDF→JPG, com saídas de 300×150, 250×125 e 200×100 pixels.
As amostras centrais das bandas devem ser RGB opaco no JPEG original e branco/verde claro/
azul na composição PNG/WebP sobre branco. A tolerância é de 8 níveis por canal, devido
à codificação com perdas; não é comparação de todos os pixels do JPEG.

Um PDF vetorial independente evita usar somente o round-trip como prova da rasterização.
O ZIP deve conter quatro páginas em ordem, nas dimensões 300×150, 100×200, 200×100 e
100×200 pixels. Páginas 0°/90° mostram vermelho antes do azul (esquerda→direita ou topo→base);
180°/270° invertem essa ordem. Um controle negativo troca as cores esperadas e deve ser recusado.

Na extração, os PNGs devem manter resolução 32×16 e alpha 0/128/255 nos **512 pixels**.
Canvas descarta RGB oculto quando alpha é zero: nesse caso apenas o alpha é aferido; as
cores visíveis são comparadas sem tolerância. Um controle negativo torna o alpha opaco e
deve ser recusado. JPEG compatível é comparado byte a byte com o original, sem recompressão.
O ZIP deve conter somente as imagens elegíveis, sem exportar a máscara como imagem separada.
O recurso repetido é esperado uma vez por página, com IDs distintos.

O filtro padrão exclui o JPEG 2×1, mas mantém os dois PNGs 32×16. Desativar o filtro permite
três imagens no ZIP; selecionar apenas a página 2 produz um JPEG único. Um PDF contendo
somente a imagem pequena, sob o filtro padrão, exibe aviso legível e nenhum download fictício.

Os testes Node conferem JPEG incorporado e dimensões fit com margens 0/20/40 pt, seleção,
filtro, IDs e imutabilidade dos buffers. Entradas vazias, inválidas ou lote misto incompatível
não retornam PDF parcial. A renderização de PDF→JPG é aferida no Chromium real: o caminho
`NODE_ENV=test` usa JPEG sintético e **não** é aceito aqui como prova de fidelidade.

## Correção do aviso sem imagens elegíveis

O motor retornava `NO_IMAGES_FOUND`, mas o Tool Runner normalizava o erro antes de ele
chegar à mesa. A condição aparecia como “Falha ao executar a ferramenta.”. A entrada
`NO_IMAGES_FOUND` agora usa a chave existente `dedicated.noImagesFound` e o código
estruturado `INVALID_INPUT`. Não foi introduzido texto novo no componente.
O teste do runner e o E2E observaram a falha antes da correção; o resultado esperado é
“Nenhuma imagem incorporada foi encontrada neste PDF.”, sem download fictício.

## Limites

Perfil restrito a estes insumos. Não certifica PDF arbitrário, fontes/tipografia, ICC/HDR,
CMYK/16 bits, animação, todos os filtros, imagens inline ou máscaras dependentes da pintura.
As configurações A4/orientação de imagens→PDF permanecem sob regressões anteriores; esta
fatia não acrescenta matriz completa de opções. Não há medição de grandes lotes, pouca RAM,
hardware físico ou aplicativo Windows instalado. Q-C0 global continua parcial.

## Validação

- `pnpm check`: formatter/lint e typecheck aprovados.
- Suíte completa do cliente com dois workers: 108 arquivos, **790 testes aprovados**.
- Antes da correção do aviso, os três arquivos pertinentes de raster/extração/PDF tiveram
  40 testes aprovados; a regressão do aviso foi observada separadamente (runner e E2E),
  corrigida e aprovada na suíte completa e no navegador.
- Suíte completa do Tool Registry: 10 testes aprovados, incluindo cobertura ativa e hashes.
- Builds web da raiz e de `/hub/`: aprovados.
- E2E `pdf-raster-quality` e `tool-quality`: **13 aprovados na raiz e 13 em `/hub/`**;
  seis cenários novos e sete regressões existentes, com downloads reais.
- Revisão independente, somente leitura: sem achados materiais.

Não foram repetidas as suítes E2E completas nem a instalação Windows. Os testes do Chromium
demonstram somente o perfil documentado; não são homologação de todos os dispositivos.
Commit local desta fatia autorizado posteriormente pelo usuário, sem push, deploy ou
integração no checkout principal.
