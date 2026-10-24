# Processamento de imagens no website

## Motor e limites

As seis operações são locais. O processamento usa worker com OffscreenCanvas quando disponível;
sem esse recurso, usa Canvas no navegador. Não há envio das imagens para servidores.
Os codecs são carregados apenas durante operações que os exigem.

- Entrada: JPEG, PNG e WebP estáticos; MIME identificado pelos bytes, não pela extensão.
- GIF, APNG e WebP animado são recusados explicitamente para não perder quadros.
- Limites conservadores: 24 megapixels, 16.384px por lado, 64 MiB por arquivo; até 20 imagens
  e 128 MiB de entrada/saída no lote. PNGs acima do limite são recusados pelo cabeçalho.
- JPEG/WebP são decodificados pelo navegador antes da verificação das dimensões; o limite de
  bytes não elimina todo risco de memória no decode. Os testes não certificam todos os celulares.
- Lote sequencial gera ZIP, com nomes únicos inclusive para arquivos de mesmo nome.
- Cancelar encerra o worker. Prazo máximo de 120s por arquivo. Canvas, bitmaps e URLs são liberados.
- Falhas de decode/exportação nunca viram bytes fictícios. MIME não suportado não é renomeado
  silenciosamente como se o formato solicitado tivesse sido gerado.
- Compressão mantém formato e dimensões; PNG usa otimização sem perdas. Se a saída não diminui
  e nenhuma transformação de dimensões foi solicitada, devolve o original sem recomprimir.
- JPEG não tem transparência: conversão usa fundo branco explicitamente. EXIF de orientação é
  aplicado na decodificação; não há promessa de preservar metadados, perfis ICC, HDR ou EXIF.

## Dependências escolhidas

| Biblioteca | Versão | Licença | Uso |
| --- | --- | --- | --- |
| Pica | 10.0.3 | MIT | Redimensionamento com filtro mks2013 no worker |
| @jsquash/jpeg | 1.6.0 | Apache-2.0 | MozJPEG para compressão/conversão |
| @jsquash/webp | 1.5.0 | Apache-2.0 | Codificação WebP |
| @jsquash/oxipng | 2.3.0 | Apache-2.0 | Otimização PNG |
| Cropper.js | 2.3.1 | MIT | Interação de recorte, alças e seleção; exportação permanece no motor atual |
| Fabric.js | 7.4.0 | MIT | Interação geométrica no modo avançado da marca d’água; carregamento sob demanda |

Canvas permanece para exportação do recorte, rotação, composição e marca d'água. Cropper.js 2.3.1
foi adicionado no IM-C2 apenas para interação: seleção visual, alças e controles de visualização.
Campos numéricos, proporções e validação do motor continuam sendo a referência em pixels do original.
Nenhum runtime ou modelo de IA novo foi incluído. Pica não garante cor de pré-impressão/HDR;
as limitações de gamma/8 bits constam na documentação oficial.

Os complementos (lotes, recorte com alças, composição e formatos) pertencem ao
[plano principal de PDF/Imagem](superpowers/plans/2026-10-23-unificar-pdf-imagem.md#fase-de-complementação--24102026).
Esta página descreve o motor entregue; candidatos pesquisados não contam como capacidade instalada.

## Complementação IM-C3 — composição por objetos

O modo **Composição avançada** integra a ferramenta de marca d’água existente. O fluxo rápido
permanece disponível com seus ajustes anteriores. Não foi criado outro card ou executor paralelo.

- Texto em uma linha (até 200 caracteres), fonte Inter local, retângulo, elipse e imagens JPG/PNG/WebP
  estáticas. Textos e imagens são ajustados à caixa de largura/altura informada; não é rich text.
  Objetos possuem seleção visual, posição, tamanho, opacidade, exclusão e ordem; campos/lista são
  a alternativa acessível por teclado. A prévia atualiza ao soltar o gesto, conforme aviso da tela.
- `ImageCompositionSnapshot` usa pixels do original e referências a Blobs locais. O histórico
  mantém até 100 pares de comandos inversos, sem cópias de bitmaps. Comandos antigos são retirados
  quando os assets retidos excederiam 32 MiB; o snapshot corrente admite até 16 MiB de assets.
- Limites exclusivos do modo avançado: 8 megapixels na imagem base, 20 objetos, 16 MiB de imagens
  adicionadas; saída PNG. Os limites e formatos do fluxo rápido, Pica e jSquash foram preservados.
  Sem filtros fotográficos, PSD, persistência automática, metadados/ICC/HDR ou animação.
- As posições se aplicam ao lote inteiro, sem escala proporcional implícita. Prévia selecionada
  não restringe o lote. UI e runner verificam se a composição cabe em **todas** as imagens antes
  de processar; o ZIP continua sequencial, com nomes únicos e limites existentes.
- `renderImageComposition(source, snapshot, signal?)` é o único renderizador de prévia e download.
  Executa no worker de imagens existente, com alternativa local quando Worker/OffscreenCanvas não
  estão disponíveis. Fonte carregada localmente por FontFace; bitmaps temporários são fechados.
- Fabric.js controla apenas caixas de interação, com importação dinâmica no modo avançado.
  O raster final vem do renderizador compartilhado, evitando divergência de fonte/layout entre
  Fabric e Canvas. As alças têm área de toque de 44px e marcador visual de 10px.
- Com um editor de recorte/composição aberto, o documento usa rolagem imediata. O rastreamento
  confirmou que o scroll suave de foco podia mudar a posição da imagem durante o arraste.
- Prévias identificam arquivo e objetos de origem: uma resposta antiga nunca substitui a atual;
  cancelamento encerra o worker e URLs são revogadas. Importações de assets têm ticket de geração.
  Exportar fica bloqueado enquanto o asset carrega; trocar fonte ou sair do modo cancela a espera.

### Evidências, custo e licença do IM-C3

Corpus sintético no gerador de `e2e/image-composition.spec.ts`: PNG 600×400 com faixa verde e
área transparente; logo 40×40 azul com metade transparente. SHA-256 de cada arquivo gerado
registrado no anexo `corpus-composicao` do E2E. Sem imagens de terceiros. Expectativas
literais para pixels vermelhos/azuis/transparentes, centro/borda da elipse e texto com acentos
realmente rasterizado. O teste compara os bytes PNG da prévia com o download, além de verificar
histórico, movimento por mouse/toque, quatro larguras, lote completo e importação atrasada.

A revisão independente encontrou exportação possível durante o decode de um asset, omitindo-o.
Os testes com decoder real atrasado falharam antes e passaram depois: execução bloqueada durante
importação, liberada ao concluir/cancelar, sem publicar asset de uma sessão encerrada.

Fabric 7.4.0 publicado declara MIT. `fabric` é o único pacote novo nesta fatia; seus opcionais
Node `canvas`/`jsdom` são removidos por overrides específicos da versão no workspace. O client
usa o export de navegador, compatível com Vite/React atuais, sem wrapper React adicional.
Prova descartável externa: `/tmp/nexohub-composition-proof`, com transparência, pixels conhecidos,
exportação estável e `dispose()`. Arquivo ESM publicado: 298.818 bytes; no ensaio local após o
import, inicialização/render de três objetos levou 65,2ms e 100 renders simples 13,1ms. Não são
medidas de abertura do produto nem estimativa universal para celulares.

Bundle de produção raiz: principal 1.046,82kB (287,44kB gzip), acréscimo de 6,20kB (1,98kB gzip)
sobre IM-C2. Chunks sob demanda: Fabric 280,12kB (87,10kB gzip), painel 9,64kB (3,32kB gzip),
renderizador 1,71kB (0,91kB gzip), além da variante do worker. Aviso de chunk principal grande
preexistente. Não foi certificado pico de memória do navegador inteiro em dispositivos reais.

Ensaio de produção em Chromium local, PNG sintético de 1200×800: abrir o modo e aguardar
primeira prévia/interação levou 1.130ms; primeira prévia com texto/fonte, 466ms; editar cor e
gerar nova prévia, 228ms. Incluem interação automatizada, debounce e startup do worker; não
representam apenas CPU do renderizador nem garantem tempos em celulares. O chunk Fabric teve
zero requisições antes de abrir o modo e uma após a abertura. Não há CDN ou envio da imagem.

Verificação: 593 testes unitários (530 client + 63 pacotes), lint/tipagem e builds raiz/`/hub/`
aprovados. E2E geral: 189 aprovados, 5 de subpasta ignorados na raiz. Após os ajustes de mensagem
e rolagem, os 18 casos de recorte/composição foram repetidos no build raiz final; subpasta: 59
aprovados, com confirmação no build final. Estado vazio conferido: zero alertas e exportação
desabilitada. Capturas em 390/768/1024/1440px sem overflow externo, mais tema escuro; artefatos
em `/workspace/artifacts/complementacao-composicao-2026-10-24`.

O encerramento incluiu rastreamento dos gestos: cinco ensaios sob CPU reduzida reproduziram
scroll do documento durante o arraste; com rolagem imediata, os cinco produziram as dimensões
exatas. No CDP de toque, o alvo calculado podia ficar sob o cabeçalho fixo: o teste agora centraliza
a área e confere o elemento atingido antes do gesto. Sem ampliar as tolerâncias existentes, dez
repetições de cada gesto (20 casos) foram aprovadas; nenhuma modificação especulativa no Fabric
ou no cálculo de geometria foi necessária.

Licenças MIT e OFL originais acompanham o build em `public/licenses/image-composition/`.
SHA-256 Fabric: `eda412692b7398293a049ecf913319da26eb8f7fe27f10709821dd187b517e0b`;
Inter OFL: `3b0a5fca3d17942cde889069889dedbbbd075e9b599968c82a95f4d944e9b345`.
Auditoria de vulnerabilidades de produção: zero ocorrências. A checagem global de licenças foi
novamente tentada e não concluiu pelo índice ausente de `@playwright/test@1.63.0`; Cargo também
permanece indisponível. Inventário incremental conferido, sem alegar gate global aprovado.

## Complementação IM-C2 — interação de recorte

O adaptador `ImageCropCanvas.tsx` incorpora Cropper.js 2.3.1, com importação dinâmica somente
após carregar uma imagem para recorte. A alternativa react-easy-crop 6.2.4 foi avaliada: integra
React e zoom, mas não fornece as mesmas alças livres de seleção. Não foi instalada.

- Oito alças de 44px; área movível e campos numéricos preservados. Setas movem/redimensionam
  um pixel do original; Shift usa dez. Eventos ficam restritos ao controle com foco, sem capturar
  setas dos campos ou do slider. A seleção respeita proporção e limites do arquivo selecionado.
- Zoom de 100–300% relativo ao ajuste na área; pan por arraste/rolagem ou setas no modo de
  visualização. Zoom, pan e resize da janela reprojetam a seleção, sem alterar o recorte exportado.
- Imagem e seleção usam o mesmo canvas exibido. As permissões de escala/translação do elemento
  de imagem são ativadas só durante a projeção programática; gestos não transformam o original.
- Trocar a imagem encerra a instância anterior; o cleanup desconecta observador, eventos e frame
  pendente, chamando `destroy()`. Falha ao carregar o editor oferece prévia simples e mantém os
  campos numéricos/exportação operacionais, com aviso explícito.
- O runner e os codecs não mudaram. Preflight de lotes e rejeição de área inválida continuam
  ativos; a prévia não normaliza silenciosamente o recorte compartilhado para uma imagem menor.

### Evidência e licença do IM-C2

O E2E `image-crop-editor.spec.ts` verifica delta do gesto contra escala real da imagem, dimensão
do download após arrastar, pixels conhecidos, alpha, orientação EXIF, proporção, teclado, toque,
troca de arquivo, carregamento sob demanda e fallback. A geometria imagem/canvas é confrontada
em quatro larguras e zoom de 100/200%; verificar só campos e download não bastava para detectá-la.
O teste com 30 eventos de arraste também exige erro máximo de um pixel do original: o adaptador
preserva as frações da seleção durante o gesto para evitar arredondamento acumulado.

Verificação final: 526 testes unitários do client, lint, tipagem e builds raiz/`/hub/` aprovados.
E2E de produção na raiz: 180 aprovados (execução interrompida retomada nos três arquivos restantes), 5 de subpasta ignorados. Subpasta `/hub/`: 50 aprovados, incluindo os nove testes novos de recorte.
Capturas em 390/768/1024/1440px com zoom 100/200%, sem overflow externo; tema escuro
conferido. Diferença máxima medida entre imagem e canvas: 0,016px. Artefatos em
`/workspace/artifacts/complementacao-recorte-2026-10-24`.

Bundle raiz: principal 1.040,62kB (285,46kB gzip), aumento de 6,79kB (2,49kB gzip) sobre
IM-C1. Chunk de recorte sob demanda: 47,78kB (14,09kB gzip). O aviso de chunk principal
grande já existia; essa medição não certifica pico de memória nem aparelhos reais.

Cropper e seus 11 componentes transitivos estão fixados em 2.3.1 no lockfile. Os 12 textos
`LICENSE` instalados são MIT e possuem SHA-256 idêntico:
`eb917650781dcf06a60b97cba9b05bf583931ec2d311d8a5548a8dca90a57e0f`.
Texto e aviso de componentes acompanham o build em `public/licenses/image-cropper/`; inventário
JavaScript acrescentado em `THIRD_PARTY_LICENSES.md`. A conferência foi feita diretamente nos
pacotes instalados, sem apresentar o inventário global como regenerado integralmente.

`pnpm audit --prod --json` retornou zero vulnerabilidades. `licenses:check` global não concluiu:
o store preexistente não tem o índice de `@playwright/test@1.63.0`; Cargo também não está disponível.
Essa limitação do ambiente permanece declarada e a CI deve executar o gate global antes de publicar.

## Complementação IM-C1 — gestão de lotes

O lote possui lista com nome/dimensões, seleção para inspeção, adição e remoção individual nas
seis ferramentas. Seleção altera a prévia; todas as imagens restantes recebem as opções
compartilhadas. Não há ajustes independentes por arquivo nesta entrega.

A inspeção de metadados é sequencial e libera cada bitmap; resultados são guardados por
identidade `File`, sem confundir nomes iguais. Só a prévia selecionada mantém object URL.
Trocar seleção, remover e sair revogam URLs; inspeções obsoletas não publicam seus resultados.
Os limites de 20 imagens/128 MiB e 24MP/64 MiB por arquivo não foram ampliados.

O recorte faz preflight em todos os arquivos antes de processar e lista os incompatíveis; área
inválida nunca é reduzida silenciosamente. A previsão de redimensionamento usa a mesma geometria
do motor, respeitando proporção e limite de ampliação do item selecionado. A exportação mantém
o ZIP sequencial e nomes únicos, inclusive quando nomes de entrada se repetem.

### Corpus e aceite Q-C0 desta fatia

| Cenário | Origem / evidência | Resultado exigido |
| --- | --- | --- |
| 1200×800, 640×960 e 320×240; dois nomes `foto.png` | Canvas sintético em `e2e/image-batch.spec.ts`, sem conteúdo de terceiros | Dimensões da prévia correspondem ao item; seleção não elimina arquivos do ZIP |
| Recorte comum de 1200×800 em lote de tamanhos diferentes | Mesmo gerador | Identificar itens incompatíveis antes de executar; opções preservadas ao trocar prévia |
| Caixa 1200×800 aplicada ao retrato 640×960 | Mesmo gerador e leitura real do ZIP | Prévia informa 533×800; bytes exportados decodificam em 533×800 |
| Alpha, EXIF, animação, 48MP, MIME/extensão e cancelamento | Corpus sintético/licenciado já descrito em `e2e/image-mode-quality.spec.ts` | Preservar regressões anteriores; recusa antecipada anuncia o motivo específico |
| Remoção, teclado e recursos | E2E e `useImageBatch.test.tsx` | Seleção válida, foco seguinte/retorno ao upload, URLs revogadas e inspeção interrompida |

O teste anexa `corpus-lote` em JSON com nome, MIME, bytes e SHA-256 das entradas geradas em cada
execução. Isso evita fixar um hash dependente de versão do encoder Canvas como contrato universal.
O teste do runner demonstra que um segundo arquivo incompatível impede o processamento do primeiro.
Nenhuma nova biblioteca, peso de IA ou formato foi instalado. Logo, não há benchmark de motor
candidato nesta fatia; formatos adicionais continuam em IM-C4; composição foi entregue em IM-C3. As medições de
23/10 acima são históricas e não são apresentadas como nova medição de desempenho ou memória.

Medição de build desta fatia, no mesmo ambiente: chunk principal de 1.027,45 para 1.033,83 kB
(gzip 280,95 para 282,97 kB), acréscimo observado de 6,38 kB / 2,02 kB gzip. O motor de imagens
permanece em importação dinâmica, assim como os codecs. Persistem os avisos anteriores de chunks
grandes; isso não certifica desempenho em celular nem elimina a necessidade de otimizar o bundle.

No build observado, Pica ocupa aproximadamente 53kB de JS (17kB gzip); os WASM opcionais dos
codecs variam de 164 a 346kB por arquivo. Algumas variantes alternativas de codec integram o
dist, mas não são todas baixadas por operação. Não integram a carga inicial do catálogo.

## Medição local, 23/10/2026

Chromium Linux nesta workspace; uma imagem sintética de 4000×3000, gradiente e linhas finas,
JPEG de 986.569 bytes. Uma execução, sem rigor de benchmark estatístico ou certificação de
qualidade fotográfica. Esses resultados indicam custo/benefício, não superioridade universal.

| Operação | Tempo observado | Bytes de saída |
| --- | ---: | ---: |
| Canvas JPEG qualidade 0,72 | 139ms | 584.137 |
| MozJPEG recomendado | 2.754ms | 565.354 |
| Canvas resize 50% | 150ms | 323.151 |
| Pica resize 50% | 735ms | 389.900 |

MozJPEG economizou aproximadamente 3% adicionais neste caso, ao custo de mais CPU. Pica usa
filtragem própria e produziu saída maior; tamanho não mede fidelidade. Os motores especializados
foram escolhidos por controle de codificação e filtro, não por promessa de serem mais rápidos.
Lote de 20 redimensionamentos dessa imagem: 19,3s. A thread principal continuou atendendo o
intervalo de 16ms durante o ensaio. Não foi medido pico confiável de memória do navegador inteiro.
Reavaliar os limites em dispositivos reais antes de ampliar formatos ou resolução.

## Evidências e licenças

`e2e/image-mode-quality.spec.ts` decodifica as saídas reais das seis operações, verifica
alpha, orientação EXIF, extensão/MIME, nomes repetidos em ZIP e erros de formato/48MP.
Testes unitários verificam erros de exportação, opções, limites e encerramento de worker;
os testes de interface cobrem cancelamento seguido de nova execução.

O inventário JavaScript de `THIRD_PARTY_LICENSES.md` foi atualizado com `pnpm licenses list
--json --prod` usando o store da workspace. `pnpm audit --prod` não encontrou vulnerabilidades.
A auditoria global `licenses:check` também exige Cargo/Python; Cargo não está disponível nesta
workspace, portanto não se declara essa verificação global aprovada.
Avisos das bibliotecas e fontes dos codecs estão em `public/licenses/image-codecs/`.
