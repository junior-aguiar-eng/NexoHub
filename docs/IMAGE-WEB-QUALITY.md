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

Canvas permanece para recorte, rotação, composição e marca d'água. Cropper.js não foi adicionado:
o recorte atual mantém região visual movível, controles numéricos/proporções, sem duplicar o motor.
Nenhum runtime ou modelo de IA novo foi incluído. Pica não garante cor de pré-impressão/HDR;
as limitações de gamma/8 bits constam na documentação oficial.

Complementos planejados (lotes, recorte com alças, composição e formatos) pertencem ao
[plano principal de PDF/Imagem](superpowers/plans/2026-10-23-unificar-pdf-imagem.md#fase-de-complementação--24102026).
Esta página descreve o motor entregue; candidatos pesquisados não contam como capacidade instalada.

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
candidato nesta fatia; custos e formatos adicionais continuam em IM-C2–IM-C4. As medições de
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
