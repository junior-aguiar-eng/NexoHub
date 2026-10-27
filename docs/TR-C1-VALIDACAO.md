# TR-C1 — licença, qualidade e execução local

## Ajuste de apresentação solicitado pelo usuário

Os avisos técnicos foram retirados da interface. O cliente vê somente:
“Para traduzir, é necessário fazer um download no primeiro uso.” Mensagens de preparação e erro
também usam linguagem simples. Modelo, licenças, tokenizer, memória, cache e resultados de
qualidade permanecem neste relatório; as descrições da interface nos gates originais abaixo
registram a primeira implementação, posteriormente corrigida por esta orientação.

Após essa simplificação: 24 testes de interface aprovados, formatter/lint/typecheck aprovados,
builds raiz e `/hub/` concluídos e três E2E de tradução aprovados em cada base. O teste visual
confere o aviso curto em quatro larguras, dois temas e movimento reduzido, além da ausência
dos termos técnicos. Nenhum commit, push ou deploy realizado.

Execução de 26/10/2026, base `3854b68`, worktree `fix/auditoria-website`.
Sem commit, push, deploy ou integração de Camelot/Docling. DOC-C2 fora do escopo.

## Decisão e licença

1. NLLB original e ONNX: CC-BY-NC-4.0 confirmado nas fichas primárias, excluído da seleção.
   Nenhum peso NLLB foi baixado para o ensaio. Não confundir licença do runtime com pesos.
2. M2M100 original: MIT declarada pela ficha Facebook na revisão fixa. A conversão Xenova
   identifica esse original, sem licença própria no front matter. A seleção conserva essa
   proveniência e atribuição; ausência de licença própria não foi classificada como nova permissão.
3. OPUS-MT en-ROMANCE e ROMANCE-en: originais Helsinki-NLP Apache-2.0, conversões identificam
   os originais, sem licença própria. Testados isoladamente e não integrados: o primeiro produziu
   prefixo literal e mistura de idiomas no runtime atual; o segundo só cobre destino inglês.
   A advertência do MarianTokenizer e a saída observada indicam problema de compatibilidade;
   este ensaio não prova que os pesos OPUS tenham qualidade intrinsecamente inferior.

As [fontes primárias com revisão](evidencias/tr-c1/modelos.json) e o
[aviso MIT/atribuição](evidencias/tr-c1/M2M100-NOTICE.md) estão registrados. Consultas com HTTP 401
não foram tratadas como prova de inexistência de modelos. Não houve dependência nova ou pesos
adicionados ao Git. O inventário de dependências do pnpm não audita automaticamente pesos remotos.

## Método reproduzível

Corpus [autoral pt/en/es](../apps/client/src/platform/__fixtures__/tr-c1/corpus.ts), sem dados
pessoais reais: quatro trincas de frases sobre nomes, datas, valores, obrigação e negação;
texto longo de oito sentenças repetido em dois parágrafos. Revisão de conteúdo pelo implementador,
sem avaliador bilíngue independente. Nomes/números recebem também conferência literal;
isso não equivale a uma métrica completa de fidelidade semântica ou jurídica.

O Chromium headless 151, Transformers.js 4.3.1 e ONNX/WASM q8 executaram localmente no Windows,
AMD Ryzen 5 3550H, 32 GB RAM. CPU de entrada de geração anterior, mas não máquina de baixa RAM.
A baseline congelada é a segmentação de `3854b68`, até 400 caracteres por bloco. A repetição usa
sentenças do Intl.Segmenter, mantendo separadores/literais e limite para sentenças extensas.
Não há correção de saída por nome, frase, gabarito ou página do corpus.

Com Node/pnpm do projeto e uv disponível:

```powershell
uv run --no-project --with psutil==7.2.2 --python 3.12 scripts/medir-tr-c1.py
uv run --no-project --with psutil==7.2.2 --python 3.12 scripts/medir-tr-c1.py --segmented
uv run --no-project --with psutil==7.2.2 --python 3.12 scripts/medir-tr-c1.py --cache-probe
uv run --no-project --with psutil==7.2.2 --python 3.12 scripts/medir-tr-c1.py --runtime-probe
```

Cada comando usa perfil temporário persistente curto e servidor exclusivo de ensaio em loopback
4193; requer cerca de 860 MB de pesos para os três perfis, além de tokenizer/runtime, e vários GB
de RAM. Downloads podem se repetir quando o cache não persiste. Saídas
ficam em `.superpowers/sdd/2026-10-26-tr-c1/`, ignorado. Para reutilizar cache entre comandos,
defina `TR_C1_PROFILE` com o mesmo diretório temporário criado pelo Chromium. Não reutilize perfil
pessoal aberto. `--cache-probe` e `--runtime-probe` bloqueiam Hugging Face no segundo worker;
não bloqueiam o servidor local. Para reproduzir especificamente o estado quente publicado,
preencha primeiro o cache desse perfil. O controlador propaga falhas e interrompe após 30 minutos.

A comparação inicial usou M2M100 em contexto privado e OPUS em contextos persistentes; por isso,
tempos e persistência de cache não são diretamente comparáveis. Testes/checagens breves ocorreram
em paralelo à comparação e repetição longa: os tempos são exploratórios, não benchmark dedicado.
RSS amostrado a cada 50 ms soma Node/Vite, Chromium, renderer e worker, incluindo auditoria SHA-256;
pode duplicar páginas compartilhadas e não é heap exclusivo nem mínimo de RAM necessário ao modelo.

## Resultados reais

| Perfil/caminho | Carga inicial observada | Inferência por amostra | Pico RSS da árvore |
| --- | --- | --- | --- |
| M2M100 baseline | 33,35 s, incluindo rede | 2,56–57,21 s | 3,71 GiB |
| OPUS en-ROMANCE baseline | 15,01 s, incluindo rede | 0,94–11,19 s | 1,74 GiB |
| OPUS ROMANCE-en baseline | 14,34 s, incluindo rede | 0,50–9,56 s | 1,78 GiB |
| M2M100 por sentença, seis textos longos | 9,12 s, cache já preenchido | 38,75–67,88 s | 3,08 GiB |
| Worker efetivo do app, dois workers novos | incluída no tempo ao lado | 21,74 / 14,17 s | 3,07 GiB |

- M2M100, 24 frases curtas/seis pares: números e negações preservados na revisão; três casos
  alteraram nomes próprios (`Maria` para `María`, `João` para `Juan`). Não homologar preservação
  literal de nomes. Na baseline longa, pt→en/es→en perderam o título; en→es perdeu as duas últimas
  sentenças por parágrafo, incluindo prazo de 30 dias.
- M2M100 por sentença, seis pares longos: as oito sentenças de cada um dos dois parágrafos
  apareceram nas seis saídas; números e negações foram preservados no corpus. pt→es/en→es
  continuaram alterando `Maria` para `María`. A saída pt incluiu variante europeia (`registos`);
  o seletor passa a indicar Português, sem garantir variante brasileira. Segmentação reduziu as omissões observadas, sem
  garantia fora da amostra ou dentro de sentenças maiores que 400 caracteres.
- OPUS en-ROMANCE, dez amostras: prefixos literais `>>pt<<`/`>>es<<` e mistura de idiomas.
  Reprovado como perfil compatível com o runtime atual, sem comparar velocidade como vitória.
- OPUS ROMANCE-en, dez amostras: conteúdo/negações/números preservados na revisão, mas `João`
  virou `John` em pt→en. Não atende sozinho as seis direções e não foi integrado.

As [56 linhas de qualidade](evidencias/tr-c1/qualidade.csv) distinguem perfil, par, caso, nomes,
números, negação e omissões. Outputs completos e tempos estão em
[M2M100 baseline](evidencias/tr-c1/m2m100.json), [OPUS en-ROMANCE](evidencias/tr-c1/opus-en.json),
[OPUS ROMANCE-en](evidencias/tr-c1/opus-romance.json) e
[M2M100 por sentença](evidencias/tr-c1/m2m100-segmented.json).

## Cache, integridade e caminho efetivo

O primeiro teste M2M100 privado não persistiu os pesos grandes. Um perfil Windows persistente
com caminho longo também falhou ao abrir CacheStorage; caminho curto temporário resolveu o ensaio.
A hipótese de limite de caminho não foi convertida em alteração de configuração do Windows.
O AutoTokenizer 4.x ainda consultava metadados de `main` antes de aplicar revision, quebrando
reabertura offline. O loader explícito constrói M2M100Tokenizer a partir dos dois JSONs fixados,
e mantém AutoModelForSeq2SeqLM para os pesos. Sem alteração em node_modules ou no lockfile.

O [ensaio corrigido de cache](evidencias/tr-c1/m2m100-cache-probe.json) completou duas inferências
em workers novos; no segundo, HF bloqueado. Inicializações 9,70/9,76 s e inferências 5,19/4,29 s,
ambas com recursos previamente presentes. CacheStorage dos pesos conferido por SHA-256:

- Encoder: 287.856.370 bytes, `13a94e354a9140764eb81102d77d3ec6952d796e6f113c651eeb3c3443da0386`.
- Decoder merged: 344.128.178 bytes, `007654bcabb6cea6fd3bde34ce933137b431330b3755781145d7b6906270b45a`.

Os hashes coincidem com os OIDs LFS publicados, mas não são verificação criptográfica de toda
resposta em cada execução do produto. HTTPS e revisão fixa são o caminho de download; SHA-256
foi auditado no ensaio. Quota, navegação privada e remoção de dados continuam impedindo promessa
universal de offline.

O [worker de produção](evidencias/tr-c1/m2m100-runtime-probe.json), sem mock, retornou
`Maria Silva did not authorize the payment of 125 euros on 14/03/2026.` nas duas aberturas,
com motor `transformers.js-m2m100`. Nenhuma requisição externa foi emitida nesse perfil já em cache.
Esse teste inclui o loader/inatividade do app, em vez de somente o harness comparativo.

## Alterações e limites de validação

Perfil M2M100/revisão fixa, códigos pt/en/es, loader compatível com cache de revisão, segmentação
por sentença, cancelamento da última inferência, identidade sem atribuir modelo e aviso PT-BR de
licença/download/revisão. Worker/fila, progresso real e inatividade de 60 s preservados. UI distingue
modelo browser de mecanismo nativo. Nenhum dos candidatos OPUS, Camelot ou Docling foi integrado.

Revisão de código independente concluída; corrigida afirmação de instalação no badge nativo.
Gates locais e evidência final registrados ao término abaixo. Não demonstrados: fidelidade de
qualquer documento jurídico, revisão bilíngue independente, aparelhos de baixa RAM, outros
navegadores, WebGPU, Tauri instalado ou execução em produção.


## Gates locais executados

- Formatter/lint/typecheck: `pnpm check`, aprovado. Auditoria `pnpm licenses:check`, aprovada;
  manifests e lockfile sem alteração. Controlador Python também validado com `py_compile`.
- Unitários: domain 44, tool-sdk 16, registry 3, client 720 = 783 aprovados. O primeiro
  `pnpm test` encontrou expectativa antiga do badge e foi interrompido durante o client;
  a repetição integral do client com `--maxWorkers=2 --reporter=verbose` passou. Os 24 testes
  de interface pertinentes também passaram após o último ajuste de catálogo.
- Raiz: suíte completa com 294 aprovados, cinco ignorados existentes e duas falhas de preparo
  nos testes TR (aviso procurado antes de inserir o texto). Corrigida a ordem, os três TR
  passaram no build final daquele ponto, incluindo o novo caso visual. Cobertura combinada:
  297 casos únicos aprovados e cinco ignorados. As falhas iniciais não foram removidas nem
  mascaradas; repetição focada confirmou cancelamento, erro recuperável e avisos.
- Revisão estática independente concluída e achado P2 do badge nativo corrigido.
  Sem parecer bilíngue independente de qualidade.

- `/hub/`: runner oficial, 190 aprovados, incluindo os três TR. Após o catálogo final,
  builds raiz e `/hub/` e os três testes TR em cada base passaram novamente. Capturas das oito
  combinações de tema/largura preservadas em `.superpowers/sdd/2026-10-26-tr-c1/screens-root/`
  e `screens-hub/`; inspeção visual de 390 px escuro e 1440 px claro confirmou aviso legível.
- `git diff --check` aprovado. HEAD `3854b68`; índice sem staged; checkout principal
  permaneceu limpo em `7b3b926`. Alterações somente locais no worktree, sem commit/push/deploy.
