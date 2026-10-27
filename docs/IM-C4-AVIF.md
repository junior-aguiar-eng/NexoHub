# IM-C4 — ampliação da avaliação AVIF

Iniciada em 26/10 e concluída localmente em 27/10/2026, base `fc24a3b` após commit autorizado
do DOC-C4 e árvore limpa. Worktree `fix/auditoria-website`. Sem novo commit, push, deploy,
dependência no aplicativo, novo formato anunciado ou distribuição desktop. DOC-C2 excluído.

Plano responsável: [IM-C4](superpowers/plans/2026-10-23-unificar-pdf-imagem.md#im-c4--formatos-e-qualidade-de-exportação-depois-da-interação).
Esta entrega implementa controladores reproduzíveis de avaliação; não integra um codec ao app.
JPG/PNG/WebP e seus limites permanecem iguais. A homologação integral de AVIF continua pendente.

## Corpus e método

Oito entradas: fotos CC0 `chelsea` e `coffee` da mesma revisão scikit-image v0.19.3 da
baseline; rampas alpha, bordas de alto contraste, texto autoral em português, gradiente,
imagem transparente 31×17 e ampliação de `coffee` para 3000×2000 (6 MP). A ampliação não
representa uma terceira foto nem uma imagem original de sensor de 6 MP. Fontes de texto
dependem do navegador/host; os hashes RGBA registram a entrada efetivamente comparada.
Créditos fotográficos: Stefan van der Walt e Rachel Michetti/Pikolo Espresso Bar, conforme
[a fonte primária do corpus](https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/_fetchers.py).

Mesmos pixels por perfil: JPEG75, WebP75 e AVIF50/70. Duas execuções por caso/perfil,
**64 saídas comparativas**, com reabertura pelo decoder WASM e pelo Chromium nativo.
Qualidade 75 não significa a mesma fidelidade entre codecs. AVIF usa speed 6, 8 bits, subsample 1
e **qualityAlpha: 100 explicitamente**; isso não é prova do alpha do preset padrão -1.
JPEG é composto sobre branco antes de codificar, como a operação atual do app.

PSNR/MSE usam RGB composto sobre branco; cores ocultas por alpha zero não contam como erro.
O canal alpha é medido separadamente. Geometria, hashes de cada saída e original imutável
também são conferidos. PSNR não substitui avaliação perceptual, fidelidade de texto ou
adequação de um formato para qualquer imagem. O codec e o decoder nativo apresentam pequenas
diferenças RGB em alguns casos AVIF; ambas as medidas estão registradas.

`run 0` usa worker novo por caso/perfil e inclui import/init até terminar encode; `run 1`
reutiliza o worker. O navegador pode manter cache HTTP/compilação entre casos: não são
medições de início frio absoluto. Tempos não incluem toda a fila/interface do aplicativo.
Ensaio sequencial em Windows/Ryzen 5 3550H/32 GB RAM, Node 24.19 e Chromium 151, sem emulação
de celular ou CPU apresentada como dispositivo físico. `crossOriginIsolated=false`: variante
single-thread avaliada; a variante multi-thread não foi carregada nem homologada.

## Resultados observados

Primeira execução por perfil; PSNR calculado sobre a saída decodificada pelo Chromium:

| Entrada / perfil | Bytes | Import/init + encode | PSNR RGB sobre branco |
| --- | ---: | ---: | ---: |
| coffee JPEG75 | 33.174 | 90ms | 31,78dB |
| coffee WebP75 | 31.288 | 91ms | 33,50dB |
| coffee AVIF50 | 18.309 | 781ms | 32,89dB |
| coffee AVIF70 | 36.770 | 879ms | 35,90dB |
| coffee ampliada 6 MP JPEG75 | 295.335 | 838ms | 43,92dB |
| coffee ampliada 6 MP WebP75 | 179.092 | 813ms | 41,01dB |
| coffee ampliada 6 MP AVIF50 | 76.814 | 7.259ms | 40,88dB |
| coffee ampliada 6 MP AVIF70 | 140.451 | 8.333ms | 43,94dB |

Nos controles alpha, AVIF com qualityAlpha: 100 e WebP tiveram erro máximo zero no canal alpha,
nos dois decoders e nas duas execuções. Isso não equivale a RGB sem perdas: no caso 31×17,
a pequena região azul muda de cor com AVIF 4:2:0, e WebP usa menos bytes (222 contra 546/550).
Na rampa alpha, WebP também é menor (376 contra 725/799). AVIF não ganha em todos os insumos.
A prancha local `comparison-sheet.png` foi inspecionada por amostra: fotos, bordas, texto e
transparência. É uma comparação redimensionada, não certificação perceptual ou de glifos.

Dados completos: [64 medições e perfis](benchmarks/2026-10-27-imc4-avif.json),
[CSV de qualidade](evidencias/im-c4-avif/quality.csv),
[pacotes, integridade, arquivos e fontes](evidencias/im-c4-avif/sources.json).
Saídas e prancha ficam em `.superpowers/sdd/2026-10-26-im-c4-avif/`, ignorado pelo Git.

## Memória, recursos e cancelamento

O instrumento soma os buffers WebAssembly.Memory observados em construção/instanciação,
retidos durante o worker. São alocações lineares observadas, **não** pico físico/RSS ou
memória total de navegador/Canvas. A retenção pelo instrumento também impede usar a soma
como memória viva mínima. No ensaio de 6 MP, encoder+decoder somaram cerca de 143 MB em JPEG,
99 MB em WebP e 325 MB em AVIF. Não houve medição física confiável de pico.

O aplicativo aceita até 24 MP no caminho de imagens atual; testar 6 MP nesta máquina não fecha
esse limite, lotes nem hardware com pouca RAM. A avaliação antiga de 24 MP em Linux permanece
histórica e não foi transportada como homologação Windows ou de outro dispositivo.

AVIF 2.1.1 distribui encoder ST de 3.485.872 bytes, decoder de 1.170.930 bytes e encoder MT de
3.534.665 bytes. ST+decoder somam 4.656.802 bytes WASM brutos, além de JS. Não são bytes gzip
nem acréscimo ao bundle atual: o pacote não foi instalado no app. Nenhum WASM foi solicitado
antes de iniciar a operação no ensaio isolado. Isso não implementa seleção AVIF na UI.

No controle adicional, a tarefa de 6 MP foi encerrada cerca de 10,4 ms após o aviso de entrada na
codificação, sem resultado tardio nos 200 ms observados. Novo worker codificou `coffee` e
produziu o mesmo SHA-256 da saída AVIF50 anterior. Entrada inválida curta foi recusada.
Esses controles não são fuzzing, prova de sandbox universal ou medição de RAM liberada.

## Licenças, manutenção e segurança

Pacotes fixos: `@jsquash/avif@2.1.1`, `@jsquash/jpeg@1.6.0`, `@jsquash/webp@1.5.0` e
`wasm-feature-detect@1.8.0`. Tarballs conferidos pela integridade npm antes de extrair,
com limites de tamanho e recusa de paths fora da pasta isolada. O SHA-256 do tarball AVIF
coincide com a baseline de 24/10. Nenhum desses downloads altera package.json ou lockfile.

A licença declarada do wrapper AVIF é Apache-2.0. A
[receita na revisão declarada pelo npm](https://github.com/jamsinclair/jSquash/blob/b7fa9ac9ec02f224847ad23d19d115f9e296a368/packages/avif/codec/Makefile)
aponta libavif 1.0.1, libaom 3.7.0 e um commit fixo de libwebp/libsharpyuv. A cadeia de fontes
e avisos foi ampliada com hashes: [libavif](https://github.com/AOMediaCodec/libavif/blob/v1.0.1/LICENSE),
[libaom](https://aomedia.googlesource.com/aom/+/refs/tags/v3.7.0/LICENSE) e
[libwebp](https://chromium.googlesource.com/webm/libwebp/+/e2c85878f6a33f29948b43d3492d9cdaf801aa54/COPYING),
incluindo seus textos de patente disponíveis. A licença agregada de libavif contém avisos de
arquivos de aplicações; não se presumiu que todos esses arquivos integram o WASM.

O tarball AVIF contém o LICENSE do wrapper, mas não um `codec/LICENSE.codec.md` como os
tarballs JPEG/WebP. Antes de redistribuir AVIF, é necessário reunir os avisos efetivamente
exigidos pelo build distribuído. `gitHead`/Makefile ajudam a rastrear fontes, mas não são
atestado independente da composição exata do binário. A URL PATENTS de libavif 1.0.1 retornou
404; isso é registrado como ausência desse arquivo, sem inferir ausência de licença ou de
obrigações de patente. Os outros textos identificados foram preservados no ensaio.

AVIF 2.1.1 foi publicado em 20/05/2025 e continuava `latest` na consulta. O snapshot do repositório
do wrapper não estava arquivado, com último push observado em 05/01/2026. Não foram encontrados
advisories publicados na [página do wrapper](https://github.com/jamsinclair/jSquash/security/advisories);
isso não certifica segurança dos componentes nativos. O
[changelog posterior de libaom](https://aomedia.googlesource.com/aom/+/refs/tags/v3.9.1/CHANGELOG)
registra correções, inclusive de segurança. Não se atribuiu automaticamente uma CVE ao WASM,
nem se declarou inexistência de vulnerabilidades. Uma eventual adoção exige conferir o
build usado, os avisos e a revisão de segurança correspondente ao binário.

## Decisão e verificações

**Avaliação local ampliada concluída; AVIF ainda não homologado para integração.** Há ganho
de bytes em certos casos e custo maior de CPU/alocação; gráficos pequenos podem favorecer
WebP. Mantido o caminho atual, sem anúncios ou dependência inativa. O custo dessa decisão é
adiar a opção AVIF até fechar dispositivos/limites e a distribuição dos avisos do build.
Não se marcou o checkbox integral do IM-C4 como concluído.

Executados: 64 saídas com decode duplo, validação de hashes/dimensões/alpha/originais,
cancelamento/retomada/entrada inválida, dois testes do cálculo de métricas, Ruff/compilação
Python e formatter/lint/typecheck do projeto. Logs no diretório ignorado do ensaio.
Não se repetiram as suítes integrais da aplicação nem builds/E2E: nenhum código do runtime,
catálogo ou dependência do app foi alterado nesta avaliação. `pnpm licenses:check` aprovou
o inventário atual do app, sem AVIF; não é aprovação da distribuição candidata. Revisão
independente única sem achado material. O revisor não certificou pico físico de RAM,
outros dispositivos, CVEs, composição exata do build ou cumprimento jurídico integral.
Esses limites permanecem fora da promessa. DOC-C2 não foi iniciado.

Reprodução, na raiz do worktree:

```powershell
python scripts/avaliar-avif-fontes.py
node --test scripts/avif/metrics.test.mjs
node scripts/avaliar-avif-browser.mjs
node scripts/validar-avif.mjs
```

O servidor do ensaio escuta apenas loopback e é encerrado com o navegador ao terminar;
requisições fora dessa origem são bloqueadas. Não é um novo servidor do aplicativo.
