# OCR-C1 — medição e ciclo de vida do OCR web

Entrega local de 26/10/2026 sobre `fix/auditoria-website`, base `130d0bf`.
O plano responsável continua sendo a seção OCR-C1 da
[estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#ocr-c1--ocr-medido-e-preparação-compartilhada-com-o-scanner).
DOC-C2 não foi iniciado. A entrega foi validada antes do registro em Git; o commit local foi
autorizado posteriormente em 26/10/2026. Não houve integração na principal, publicação ou homologação Windows.

## Comportamento implementado

- O PDF é classificado por página. Páginas com texto extraível preservam sua camada e usam esse
  texto no TXT; somente páginas sem texto passam pelo reconhecimento. Fragmentos contíguos não
  recebem espaços artificiais, preservando códigos como `000123` entre mudanças de fonte.
- Tesseract.js 7.0.0 e seu core 7.0.0 existentes continuam sendo o motor. Um worker de plataforma
  controla a inicialização e o worker dedicado filho: cancelar, substituir o arquivo ou sair encerra
  o proprietário mesmo durante download/inicialização. Trabalhos atrasados não publicam resultado.
  Inatividade de 60 segundos gera falha explícita; não há texto substituto nem sucesso fictício.
- PDF.js, renderização, bitmaps, canvases, URLs e worker têm descarte associado à operação.
  O fetch da fonte da camada pesquisável recebe o sinal de cancelamento. Os limites web desta
  operação são 64 MiB por arquivo, 500 páginas por PDF e 20 milhões de pixels por página rasterizada.
- A imagem original é usada na exportação. O contraste só altera a imagem temporária reconhecida;
  as coordenadas mantêm a mesma escala. A camada Unicode invisível usa as caixas reais e recusa
  caixas não finitas, invertidas ou fora da imagem. CropBox e rotação continuam cobertos por testes.
- O painel mostra origem por página e indicador de OCR, com aviso de que confiança não garante
  acerto. Configurações ficam bloqueadas durante a execução. Alterar idioma, formato, contraste ou
  texto invalida o download anterior. O TXT editado pode ser baixado pelo botão próprio; é necessário
  reconhecer novamente para gerar outro PDF. Textos novos usam o catálogo pt-BR.
- As cores do painel OCR usam os tokens existentes, incluindo tema escuro; a ação principal e o
  resultado permanecem na mesa existente. Não houve migração de layout de outras ferramentas.

## Corpus e método

O corpus versionado está em
[`apps/client/src/platform/__fixtures__/ocr-c1`](../apps/client/src/platform/__fixtures__/ocr-c1/manifest.json).
São quatro PNGs sintéticos de 1600 × 550, com conteúdo criado no projeto (MPL-2.0), renderizados
com a Liberation Sans já distribuída: acentos e números, baixo contraste, inclinação de 5° e
transformação afim que simula perspectiva. As duas últimas imagens **não são fotografias de campo**.
O manifesto contém texto esperado, origem e SHA-256 de cada arquivo.

[`scripts/medir-ocr-c1.mjs`](../scripts/medir-ocr-c1.mjs) executa Tesseract real no Chromium, em
24 reconhecimentos: quatro entradas × três preparos × duas repetições. CER usa distância de
edição entre caracteres; WER, entre palavras. Só NFC e espaços são normalizados; acentos,
pontuação, maiúsculas e números contam como erros. Não se usa confiança do motor como métrica
de qualidade. O JSON registra também os textos efetivamente reconhecidos.

Os rótulos `cold` e `warm` indicam primeira chamada e repetição de cada par; **cada chamada cria
um worker novo**. Apenas a primeira chamada da sessão começa com IndexedDB vazio. Não são 24
downloads frios independentes. O harness intermedeia somente recursos públicos do runtime;
nenhum documento é transmitido. A rota interceptada não representa o cache HTTP de produção.

Dispositivo: Windows x64, Ryzen 5 3550H, 8 CPUs lógicas, aproximadamente 32 GB de RAM, Node 24.19.0;
versão do Chromium e dados brutos em [medições](ocr-c1/medicoes-2026-10-26.json).
São medições descritivas de uma execução, sem promessa de latência em outros equipamentos.
O snapshot de heap JS não é pico de memória e não mede workers nem heap WASM.

## Resultado e decisão sobre OpenCV

O candidato isolado foi `@techstark/opencv-js@4.12.0-release.1`, build identificado como
OpenCV 4.12.0. O teste aplicou conversão RGBA→cinza e limiar adaptativo gaussiano
(`blockSize=31`, `C=15`) em worker, sem recorte, rotação ou detecção automática de bordas.
Essa avaliação não representa todas as combinações possíveis de OpenCV.

| Entrada | Original CER / WER | Linear 1,35 CER / WER | OpenCV adaptativo CER / WER |
| --- | --- | --- | --- |
| Acentos e números | 0% / 0% | 0% / 0% | 0% / 0% |
| Baixo contraste | 0% / 0% | 0% / 0% | 0% / 0% |
| Inclinação de 5° | 2,6144% / 20% | 1,9608% / 15% | 2,6144% / 20% |
| Perspectiva simulada | 0% / 0% | 0% / 0% | 0,6536% / 5% |

As duas repetições tiveram os mesmos erros. O candidato acrescentou 10.872.779 bytes de JS/WASM
incorporado; inicialização medida de 789 ms. Seu kernel consumiu aproximadamente 319–392 ms por
imagem; o caminho completo, incluindo cópias/PNG e OCR, ficou entre 1,49 e 1,62 s. Os caminhos
original/linear ficaram geralmente entre 0,96 e 1,09 s após a primeira chamada (1,71 s).

**Decisão:** reprovar a integração desse candidato. Não acrescentou qualidade sobre o preparo
atual e introduziu custo. A opção de reconhecer o original continua disponível desativando o
contraste; o ganho existente é linear, não “adaptativo”. Não foi criado `prepareDocumentImage`,
pois o plano condiciona esse adaptador à demonstração de ganho. DOC-C2 não recebeu outro pipeline.
Nenhuma correção geométrica automática que possa cortar conteúdo foi habilitada.

A distribuição consultada declara Apache-2.0, assim como
[OpenCV ≥ 4.5](https://opencv.org/license/). A
[release oficial 4.12.0](https://github.com/opencv/opencv/releases/tag/4.12.0) e os metadados do
[wrapper](https://github.com/TechStark/opencv-js) foram consultados; o tarball não declara dependências
de runtime. O binário ficou isolado em `.superpowers`, não no produto, package.json ou lockfile.
Não há aprovação para redistribuí-lo: inventário completo dos componentes incorporados, advisories
e licenças deve ser refeito se outro candidato vier a ser aceito. PaddleOCR/Docling não foram
instalados nem anunciados; dependem de decisão separada de runtime e dos pesos.

## Exportação real e limites probatórios

Além dos PNGs, o script cria um PDF com página textual e página contendo a imagem sintética.
O resultado preservou os bytes dos streams de imagem e o texto nativo uma única vez. A primeira
linha OCR tinha caixa `(60,74)-(837,120)` no raster: a extração independente por PDF.js confirmou
origem `(60,120)` e extensão horizontal de 777 pixels na escala 2. O arquivo de entrada manteve
o hash. Esses valores e os hashes de entrada/saída estão no JSON, sem confundir hash com prova
visual. Os PDFs de evidência ficam em `.superpowers/sdd/2026-10-25-ocr-c1/`.

Páginas que combinam texto extraível e imagem usam a camada existente inteira: o texto dentro
das imagens dessa página não é reconhecido. Essa política aparece no painel. Não se promete
recuperar texto de codificação defeituosa, manuscritos, fotos reais com sombras/ruído, colunas ou
perspectiva arbitrária. O corpus pequeno não certifica equivalência com produtos comerciais.
As caixas são de linhas; a camada não fornece alinhamento tipográfico individual por palavra.

Na primeira execução o Tesseract existente baixa recursos públicos: script de worker de
111.307 bytes, core com WASM incorporado de 3.905.767 bytes e modelo pt-BR comprimido de
1.392.239 bytes no dispositivo medido. URLs, hashes e número de requisições estão nas medições.
OCR continua local; operação integralmente offline sem esses recursos previamente disponíveis
não foi homologada.

## Reprodução e validação

Para repetir a prova, obtenha o tarball exato do registro npm indicado pelo `pnpm view
@techstark/opencv-js@4.12.0-release.1 dist.tarball`, extraia-o em uma pasta temporária e execute
`node scripts/medir-ocr-c1.mjs <caminho-absoluto-para-dist/opencv.js>` na raiz do worktree.
O script abre um Vite de teste em loopback na porta 4192 e Chromium headless; ambos são encerrados
ao final. Não instala pacotes no workspace. A saída local contém PNGs, PDF misto e `measurement.json`.

As evidências de execução estão em `.superpowers/sdd/2026-10-25-ocr-c1/`.

- `pnpm check`: formatter, lint e typecheck aprovados.
- `pnpm --recursive --if-present test --maxWorkers=2`: 728 unitários aprovados;
  depois dos ajustes visuais, os 24 testes dos painéis afetados passaram novamente.
- Builds web na raiz e com `NEXOHUB_BASE_PATH=/hub/` aprovados. O worker proprietário novo
  ficou em aproximadamente 19,15 kB; o build manteve avisos de chunks acima do limite configurado.
- `pnpm test:e2e:ci --workers=2`: 284 aprovados, cinco exclusivos de `/hub/` pulados.
- Executor oficial `e2e/executar-subpasta.mjs`: 175 aprovados, incluindo OCR. Cancelar, trocar
  arquivo e sair fecharam os workers sem download nem histórico tardio nos cenários de teste.
- `pnpm licenses:check`: aprovado, sem dependências de produção novas.
- Capturas locais em quatro larguras, tema escuro e movimento reduzido inspecionadas; ajustes
  de contraste ficaram restritos ao painel OCR. Raiz e `/hub/` têm conjuntos preservados separados.

Houve revisão independente antes do fechamento. Seus dois achados materiais foram corrigidos:
espaços artificiais na extração e inicialização sem handle cancelável. Não foram executados
build/instalador Windows ou validação em máquina limpa. O registro local foi autorizado separadamente;
integração na principal, push e deploy continuam fora desta entrega.
