# Q-C0 — fotografias nas seis ferramentas de imagem

Corpus versionado: `apps/client/src/platform/__fixtures__/q-c0-photos/`, com as fotografias
CC0 chelsea (451×300) e coffee (600×400), origem, créditos e SHA-256 no README local.
As imagens são os mesmos bytes do ensaio isolado de codecs; a presente prova usa os
executores e downloads das seis ferramentas ativas, sem integrar AVIF ou outro motor.

| Ferramenta | Entrada/ação | Resultado conferido |
| --- | --- | --- |
| Comprimir | PNG original | Dimensões e pixels, alpha opaco e saída não maior que a fonte |
| Converter | JPEG padrão, qualidade 0,92 | Dimensões, alpha opaco e PSNR ≥30 dB contra a fonte decodificada |
| Redimensionar | 50%, arredondamento de dimensões | Tamanho esperado e PSNR ≥30 dB contra referência Canvas de alta qualidade |
| Recortar | x=10, y=20, largura=200, altura=100 | Região 200×100 e pixels contra a região da fonte |
| Girar | 90° | Dimensões invertidas e pixels na orientação esperada |
| Marca d'água | Texto Q-C0 central | Região alterada não vazia, menor que 25% da imagem; borda de oito pixels preservada |

O redimensionador ativo usa Pica no worker. Canvas e Pica têm filtros diferentes:
igualdade pixel a pixel não é o oráculo desse caso. PSNR não é probabilidade de correção
nem prova de preferência visual universal. Nas operações sem perda ou interpolação,
o limite de MSE RGB é 1; o conteúdo exportado deve continuar opaco.

O E2E `image-photo-quality.spec.ts` reabre todos os downloads, anexa imagens exportadas,
hashes e métricas por caso. São 12 casos por base. A integridade da entrada é conferida
contra os hashes fixados antes de cada execução. A leitura visual das saídas complementa
as asserções; não se presume que um gráfico sintético chamado foto.png seja uma fotografia.

Execução confirmada: 12 aprovados na raiz; os mesmos 12 no conjunto final de 18 aprovados
em `/hub/`, junto de regressões de texto e CSP. Uma nova execução na raiz preservou as
12 saídas em `apps/client/test-results/q-c0-photos-evidence/`, todas inspecionadas visualmente.
Nenhum motor de imagem foi alterado. A hipótese inicial de igualdade com Canvas para
redimensionamento foi corrigida após conferir o uso existente de Pica; os limites acima
expressam o oráculo adotado para filtros distintos, sem modificar o executor.

Limites: duas fotografias opacas de tamanho moderado, nessas operações/configurações;
sem promessa sobre RAW/HDR, perfis de cor arbitrários, todas as fotografias ou dispositivos.
Os testes gráficos/alpha/EXIF, lote, composição e recusas anteriores permanecem separados.
