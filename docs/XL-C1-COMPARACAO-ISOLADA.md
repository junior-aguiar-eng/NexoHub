# XL-C1 — Comparação local isolada: Camelot, Docling e PDF.js

Ensaio executado em 26/10/2026, autorizado pelo usuário após a entrega funcional de XL-C1.
Worktree `nexohub-editor-compatibilidade`, branch `fix/auditoria-website`, HEAD `f44071d`.
Ensaio sem integração ao aplicativo, push ou deploy. Commit de XL-C1 e da comparação
isolada autorizado posteriormente pelo usuário em 26/10/2026. DOC-C2 e MD-C1 permanecem fora do escopo.
A comparação foi executada; somente a integração de runtimes continua condicionada a decisão
arquitetural. O antigo registro de bloqueio da própria comparação foi corrigido.

## Insumos e isolamento

Os mesmos PDFs fixos do XL-C1, sem regeneração nem modificação:

- `tabela-sem-bordas.pdf`: SHA-256 `7ce31d7e3fdb7484fa95a585fa74abfb03779dc663b529e4f8fd24efc0105f50`.
- `tabela-com-bordas.pdf`: SHA-256 `7fb564485212afb02fa4f70e315a02cad3b354a149b895e5499e3cf465865ee2`.

Origem sintética autoral MPL-2.0, duas páginas por PDF, nove células-alvo por página, conforme
[manifesto](../apps/client/src/platform/__fixtures__/xl-c1/manifest.json). Há códigos com zeros,
identificador curto `123`, números pt-BR, vazios, título abrangente/visualmente mesclado e rodapé.
É uma amostra de dois documentos pequenos, com o mesmo conteúdo e geometria; as repetições não
ampliam a diversidade do corpus. Não mede OCR de documentos escaneados.

Venv exclusivo em `.superpowers/sdd/2026-10-26-xl-c1/isolated/.venv`, Python 3.12.14. Nenhum
pacote foi instalado no runtime do aplicativo. Antes/depois foram comparados hashes de 306
arquivos de `apps/client/src`, `e2e`, manifests e lockfile: todos preservados em relação ao início
deste ensaio, incluindo as mudanças locais preexistentes de XL-C1.

Perfis: Camelot 2.0.0 (Lattice, Stream, Network e Stream com seleção); Docling 2.142.1,
docling-core 2.104.0, docling-ibm-models 4.0.4, PyTorch 2.14.1; PDF.js 6.3.289 do projeto,
Node 24.19.0 e Chromium 151.0.7922.34. Os 108 pacotes Python estão fixados em
[requirements-xl-c1-isolado.txt](../scripts/requirements-xl-c1-isolado.txt).

Docling usa CPU, dois threads, OCR desativado, TableFormer Accurate com cell matching e
`enable_remote_services=False`. Pesos previamente baixados de repositórios públicos, sem token;
HF/Transformers em modo offline durante a medição. Layout Heron fixado no commit
`8f39ad3c0b4c58e9c2d2c84a38465abf757272d8`; TableFormer/docling-models v2.3.0 no commit
`fc0f2d45e2218ea24bce5045f58a389aed16dc23`. Arquivos dos modelos e hashes estão no JSON do ensaio.
Não foi usado serviço remoto de conversão, inferência paga ou upload de documentos.

## Protocolo

14 casos (sete perfis × dois PDFs), três extrações sequenciais por caso: **42 extrações**.
Um processo novo por caso; inicialização/imports/modelos medidos separadamente. As passagens
2 e 3 reutilizam o processo e os modelos, mas extraem novamente o PDF. O cache de arquivos do
Windows não foi esvaziado; “primeira” não significa máquina/cache de disco frios. Nenhuma suíte
pesada foi executada simultaneamente ao lote. As diferenças entre passagens mostram a variação
local; três amostras não sustentam extrapolação estatística.

- Automático: ambos os PDFs originais completos, sem fornecer regiões, colunas ou gabarito ao
  motor. Lattice, Stream e Network foram executados separadamente; não houve escolha automática
  do parser pelo resultado esperado.
- Seleção: página 2, região lógica topo 10%, altura 20%, largura 100%, separadores X=30% e 62%,
  exatamente como XL-C1. Camelot Stream recebe `pages="2"`, `table_areas=["0,720,600,560"]` e
  `columns=["180,372"]`, convertendo as mesmas coordenadas para origem inferior esquerda.
  PDF.js recebe as mesmas opções já existentes. Docling foi avaliado no perfil automático;
  este ensaio não implementa adaptador de região/colunas para ele nem modifica os PDFs para isso.
- O tempo de extração inclui parsing/construção das tabelas e sua matriz textual; exclui
  instalação, download, inicialização e serialização XLSX. Não deve ser comparado diretamente
  com a medição inicial de XL-C1, que incluía duas extrações e serialização.
- PDF.js usa uma página mínima de teste, sem UI, em Vite temporário restrito a localhost:4193;
  servidor e navegador encerrados em `finally`. Os três workers registrados por caso pertencem
  às três extrações; os contadores JSON são capturados antes do fechamento final do navegador.
  Este ensaio não homologa o comportamento de toda a UI nem a aplicação instalada.

Qualidade: comparação textual exata de cada célula com o manifesto, sem converter números,
normalizar acentos, aparar valores, inserir colunas ou corrigir dados. O primeiro candidato por
página é avaliado, com quantidade de tabelas adicionais registrada. Para comparar a tabela-alvo,
um cabeçalho **exatamente igual** a `Código | Produto | Valor` pode alinhar a primeira linha;
o offset e todas as células fora dessa matriz continuam contabilizados. Não se procuram os
códigos do gabarito para reconstruir uma tabela. Ausência de tabela gera nove células ausentes
por página, inclusive a posição cujo valor esperado é vazio.

“Bruta” é a coincidência nas posições da matriz sem alinhar o cabeçalho. Um título legítimo
antes do cabeçalho desloca a matriz bruta e reduz esse número, mesmo com os dados preservados.
“Extras” inclui posições vazias; são diferenças em relação à matriz-alvo da região, não uma
avaliação de que o título deva ser descartado em qualquer uso.

Memória: pico da **soma de RSS da árvore do processo do ensaio**, amostrado a cada 20 ms durante
inicialização e três passagens. É um pico observado, não um limite superior; picos muito curtos
podem escapar. Somar RSS pode contar páginas compartilhadas mais de uma vez. No browser inclui
Node/Vite, Chromium, renderers e workers; não é memória exclusiva de PDF.js nem perfil de um
build de produção. O pico do PID lançado também é salvo: no venv Windows ele é um launcher
pequeno, por isso não representa o engine Python. A tabela usa a árvore, incluindo o Python real.
Não equivale a pico de heap JS nem a memória física exclusiva. Não foi medido GPU.

## Resultados por documento

A coluna “Células” usa o alinhamento descrito; todas as matrizes e resultados por célula, incluindo
a comparação bruta, estão em [comparacao-isolada-2026-10-26.json](xl-c1/comparacao-isolada-2026-10-26.json).
Estrutura e valores foram idênticos nas três passagens de cada caso.

| Perfil | PDF | Células | Bruta | Extras | Inicialização (s) | Primeira extração (ms) | Mediana passagens 2–3 (ms) | Pico RSS da árvore (MiB) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Camelot Lattice | Sem bordas | 0/18 | 0/18 | 0 | 2.23 | 1197.4 | 1198.9 | 232.8 |
| Camelot Lattice | Com bordas | 18/18 | 0/18 | 6 | 2.61 | 1181.9 | 1511.0 | 234.3 |
| Camelot Stream | Sem bordas | 18/18 | 0/18 | 12 | 2.61 | 51.8 | 32.5 | 91.0 |
| Camelot Stream | Com bordas | 18/18 | 0/18 | 12 | 3.72 | 34.2 | 30.0 | 90.8 |
| Camelot Network | Sem bordas | 18/18 | 18/18 | 0 | 3.17 | 30.4 | 33.3 | 91.4 |
| Camelot Network | Com bordas | 18/18 | 18/18 | 0 | 2.20 | 26.6 | 27.4 | 91.4 |
| Camelot Stream + seleção | Sem bordas | 9/9 | 9/9 | 0 | 2.23 | 15.8 | 9.1 | 90.9 |
| Camelot Stream + seleção | Com bordas | 9/9 | 9/9 | 0 | 1.85 | 14.7 | 10.2 | 91.5 |
| Docling Accurate | Sem bordas | 0/18 | 0/18 | 0 | 24.34 | 8085.9 | 14247.0 | 1037.5 |
| Docling Accurate | Com bordas | 18/18 | 0/18 | 6 | 28.10 | 21286.7 | 17785.3 | 1119.5 |
| PDF.js automático | Sem bordas | 18/18 | 0/18 | 12 | 8.80 | 907.1 | 438.2 | 912.2 |
| PDF.js automático | Com bordas | 18/18 | 0/18 | 12 | 8.98 | 852.0 | 503.6 | 914.3 |
| PDF.js + seleção | Sem bordas | 9/9 | 9/9 | 0 | 8.36 | 621.6 | 495.2 | 943.4 |
| PDF.js + seleção | Com bordas | 9/9 | 9/9 | 0 | 9.54 | 760.0 | 425.6 | 949.0 |

O processamento de um documento no primeiro uso também paga a inicialização: por exemplo,
Camelot Network sem bordas somou aproximadamente 3,20 s até a primeira extração; Docling sem
bordas, 32,43 s. O preparo de modelos já havia ocorrido e não entra nessas somas.

Observações verificadas:

- Camelot Network entregou as três linhas e três colunas-alvo das duas páginas em ambos os PDFs,
  com zeros, `123`, `1.234,56`, `2.000,00`, `0,50` e vazios exatos, sem região/colunas fornecidas.
  O título abrangente não faz parte dessa matriz retornada. É evidência favorável para esse
  parser nesta amostra; não demonstra fidelidade de todo o documento ou de tabelas arbitrárias.
- Lattice não detectou tabela no PDF sem bordas. Com bordas preservou as células-alvo e a linha
  do título abrangente: quatro linhas × três colunas por página.
- Stream e PDF.js automáticos preservaram todas as células-alvo, mas incluíram título e rodapé:
  cinco linhas × três colunas por página. A seleção existente removeu essas linhas nos dois,
  mantendo as nove células da página 2 e sem alterar os originais.
- Docling Accurate não retornou tabelas no PDF sem bordas, nas três passagens. Os 0/18 indicam
  tabela ausente; não significam que retornou 18 valores incorretos nem que nenhum texto do
  documento possa ter sido lido. Com bordas retornou os dados e o título abrangente; seus dados
  nativos registraram `col_span=3` nesse título. Não foi aplicado ajuste posterior de modelo,
  OCR, detecção ou região para tentar recuperar o caso sem bordas.
- A memória observada dos perfis Python variou de cerca de 91 MiB (Stream/Network) a 234 MiB
  (Lattice) e 1.038–1.120 MiB (Docling). Para o browser, 912–949 MiB correspondem ao ambiente
  inteiro de benchmark descrito; não autorizam concluir que a UI consuma esse valor.

As matrizes foram exportadas por um serializador **compartilhado openpyxl**, fora do tempo de
extração, sempre como texto. Cada XLSX foi reaberto e os valores/tipos conferidos, incluindo
`123` como texto e zeros preservados. Nos dois casos sem tabelas, o arquivo diagnóstico contém
apenas a aba vazia `Sem tabelas` e não é contado como conversão bem-sucedida. O exportador comum
não reproduz mesclagens; spans nativos do Docling ficam preservados no JSON. Essa verificação
prova o caminho matriz→XLSX do ensaio, não os exportadores XLSX nativos de cada biblioteca.

## Custo de preparo, licenças e reprodução

Windows x64, AMD Ryzen 5 3550H, oito CPUs lógicas, 32 GB RAM. O lote limitou OpenMP/MKL/OpenBLAS
a dois threads e Camelot/OpenCV a dois; Docling foi configurado para CPU/dois threads. A mesma
restrição não foi imposta ao Chromium, cujos processos são gerenciados pelo próprio navegador.

A instalação resolveu 108 pacotes em 2,53 s, preparou 51 pacotes em 91 s e instalou em 121 s;
parte dos pacotes já estava no cache de uv. O venv ocupa 1.185.337.471 bytes (~1.130 MiB), sem
contar cache global de uv. Download e hashing dos modelos levaram 15,35 s nesta máquina/rede;
14 arquivos totalizaram 530.000.694 bytes (~505,45 MiB), separados do tempo de conversão. Não
foi estimado custo monetário nem usado recurso pago.

Fontes primárias consultadas para APIs/licenças:

- [Camelot — instalação](https://camelot-py.readthedocs.io/en/stable/user/install.html),
  [áreas e separadores](https://camelot-py.readthedocs.io/en/latest/user/advanced.html) e
  [código/licença MIT](https://github.com/camelot-dev/camelot).
- [Docling — opções locais, modelos e tabelas](https://docling-project.github.io/docling/usage/advanced_options/)
  e [código/licença MIT](https://github.com/docling-project/docling).
- [Layout Heron, revisão medida](https://huggingface.co/docling-project/docling-layout-heron/tree/8f39ad3c0b4c58e9c2d2c84a38465abf757272d8),
  licença declarada Apache-2.0; [docling-models, revisão medida](https://huggingface.co/docling-project/docling-models/tree/fc0f2d45e2218ea24bce5045f58a389aed16dc23),
  licença declarada CDLA-Permissive-2.0.

O JSON registra metadados de licença dos pacotes e hashes dos modelos. Não há GPL/LGPL declarada
nesses metadados instalados; isso não é auditoria jurídica de todas as dependências transitivas
ou dos componentes binários. Não se transferem essas dependências/modelos para o produto.

Reprodução no diretório do worktree (PowerShell), em ambiente isolado novo:

```powershell
uv venv --python 3.12 .superpowers/sdd/2026-10-26-xl-c1/isolated/.venv
uv pip install --python .superpowers/sdd/2026-10-26-xl-c1/isolated/.venv/Scripts/python.exe -r scripts/requirements-xl-c1-isolado.txt
& .superpowers/sdd/2026-10-26-xl-c1/isolated/.venv/Scripts/python.exe scripts/preparar-xl-c1-isolado.py
& .superpowers/sdd/2026-10-26-xl-c1/isolated/.venv/Scripts/python.exe scripts/comparar-xl-c1-isolado.py
python scripts/test_comparar_xl_c1.py
```

A preparação requer rede para downloads públicos. A medição roda com modelos locais e flags
offline; o baseline browser usa somente o servidor temporário em loopback e os pacotes já
instalados do projeto. Resultados brutos, 14 XLSX diagnósticos, logs e o ambiente ficam no diretório
ignorado `isolated/`; scripts, versões e JSON de evidência são revisáveis sem incluir o venv.

## Validação e decisão de escopo

Cinco controles do avaliador passaram: acerto literal, ausência de tabela/vazio não fabricado,
zeros/decimais não corrigidos, título extra explicitado e coluna ausente sem deslocamento.
As 42 extrações concluíram; qualidade estável, hashes dos originais preservados e XLSX reabertos.
Ruff check/format dos três scripts Python, compilação sintática e `pnpm check`
(formatter/lint/tipagem) aprovados.
Não foram repetidos os E2E do aplicativo porque seus arquivos e dependências foram preservados
por hash; os 750 unitários/290 E2E raiz/181 E2E `/hub/` pertencem à entrega anterior de XL-C1.

A avaliação isolada está concluída para este corpus. Network justifica investigação futura com
amostras maiores, distintas e licenciadas antes de uma decisão de runtime. Os resultados deste
ensaio não autorizam integrar Python/Docling/Camelot ao website, substituir o engine, instalar
sidecar, abrir DOC-C2/MD-C1 ou declarar homologação de produção.
