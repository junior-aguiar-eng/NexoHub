# Q-C0 — fechamento dos critérios técnicos

Retomada autorizada em 27/10/2026: concluir os critérios e criar commits, sem push/deploy.
DOC-C2 permanece fora do escopo. Worktree `fix/auditoria-website`, base inicial `b345b62`.

## Evidências já encerradas nesta retomada

- `fedebc5`: correções de filtros e interface do scanner, corpus de compressão/scanner,
  35 perfis/25 corpora. Revisão independente sem achados materiais. A execução integral
  anterior de 816/817 permanece registrada; nova execução passou com 817/817.
- Auditoria estrutural do índice: 35 ferramentas, 25 corpora; nenhuma origem/licença ausente
  nos corpora e nenhuma entrada sem teste, documento, suportados ou recusados.
- `pnpm audit --json`: inicialmente cinco advisories (quatro moderados, um alto), em
  `@vitest/mocker` e `undici`. Vitest 4.1.11 → 4.1.12 nos quatro pacotes; piso de undici
  8.11.2 → 8.12.2, resolvido como 8.12.3 no lockfile. Auditoria repetida: zero advisories.
  Os pacotes declaram MIT; Node 24.19.0 satisfaz os engines consultados no registro npm.
- `uv audit --locked --project engines/python`: encontrou
  [GHSA-xmj3-9gf7-h52w](https://github.com/pypa/setuptools/security/advisories/GHSA-xmj3-9gf7-h52w)
  em setuptools 84.0.0. Atualização pontual do lock para 84.1.0; sync aprovado e auditoria
  repetida sem vulnerabilidades conhecidas em 34 pacotes.
- O gerador de licenças dizia incluir build/teste, mas usava `pnpm licenses list --prod`.
  Removida essa restrição: inventário regenerado com 796 componentes no ambiente Windows,
  incluindo Vitest/mocker/undici, e auditoria de famílias aprovada. Componentes opcionais
  dependem da plataforma instalada; o inventário não representa todos os sistemas possíveis.
- Após as atualizações: `pnpm --recursive --workspace-concurrency=1 --if-present test
  --maxWorkers=2 --reporter=verbose`: domain 44, tool-sdk 16, tool-registry 10 e client 817
  aprovados (887 no total). `uv run --locked --project engines/python pytest
  engines/python/tests -q`: 35 aprovados, com avisos Swig de depreciação.

## Câmera física

Ensaio autorizado pelo usuário, sem dispositivo de vídeo simulado. Windows 11 Pro x64
10.0.26300, Acer Nitro AN515-43, 32.147.910.656 bytes de RAM, câmera `HD User Facing`,
Chromium 151.0.7922.34. `scripts/capturar-q-c0-camera.mjs` exige autorização atual por
argumento; para uso humano, executar com `--camera-autorizada --com-janela --captura-manual`.

O modo sem janela falhou com `NotSupportedError`, sem quadros (`readyState=0`, dimensões
zero). O mesmo fluxo com navegador visível capturou 1280×720, gerou PDF de uma página,
reabriu o documento e conferiu dimensões da imagem JPEG incorporada e track `ended` após
Parar Câmera. A primeira imagem estava obstruída pelo tampão, informado depois pelo usuário.
Uma captura posterior mostrou ambiente, e a captura manual também não continha página
textual legível. As imagens não são um corpus de documentos de campo nem prova de OCR.

Os arquivos ficam somente em `.superpowers/q-c0-2026-10-27/camera/`, fora do Git; nenhuma
licença de redistribuição foi presumida. Não publicar essas fotografias. A captura manual
de 17:59:20 UTC produziu PDF de 199.703 bytes, SHA-256
`2dbfa185ea7abd1e322071bf565fd794814f54bb4da17dd905270438567e099c`.
Esse hash identifica o artefato local; não comprova fidelidade de um documento textual.

O usuário depois forneceu uma foto de livro com texto, capturada manualmente às 18:02:44
UTC: 1280×720, PDF com uma página e 222.732 bytes, SHA-256
`fc4a0d26eaaf9008f3f650f75ad37fa32f197b94a9baf652df657701c5617fa3`.
JPEG incorporado: `9d9d2ecd318aff4b9e39b29cc65eec21da640037d1260938d6f0ba33fa206b76`.
Imagem/PDF ficam privados. A inspeção visual confirmou texto e duas páginas curvas/inclinadas
no enquadramento; não houve correção de perspectiva, recorte ou outro recurso de DOC-C2.

OCR real do PDF no aplicativo, idioma português: com realce padrão, 165 caracteres em
7.269 ms; sem realce, 168 caracteres em 7.467 ms. Nenhum dos quatro trechos de referência
visuais (dois subtítulos e dois números de artigo) apareceu literalmente em qualquer saída.
As saídas completas e requisições estão nos artefatos locais; só foram observados GETs
dos três recursos públicos Tesseract/core/idioma, sem POST do documento. A leitura dessa
amostra **não foi aprovada**. Essas contagens não são CER/WER de página inteira e não provam
a causa isolada da falha. Desativar o realce não resolveu o caso. Não mudar os algoritmos
nem marcar homologação documental com base apenas no sucesso da captura/exportação.

## Reprodução do runtime Windows

O manifesto anterior fixava LanguageTool `6.9-SNAPSHOT-20260901`, mas seu URL oficial respondeu
404 nesta execução. Não foi encontrada cópia nos diretórios de runtime deste worktree ou
do checkout principal. O JRE Temurin fixado continua disponível, com tamanho/hashes conferidos.

Prova isolada, sem adoção: [LanguageTool 6.6 oficial](https://languagetool.org/download/LanguageTool-6.6.zip),
251.998.221 bytes, SHA-256 `53600506b399bb5ffe1e4c8dec794fd378212f14aaf38ccef9b6f89314d11631`;
JAR `7e652a409245a7c9ffce517c891cb6cc27eee00abbb32a3427995abd6f9096ac`.
COPYING declara LGPL-2.1 e remete às licenças transitivas. Os avisos estão presentes, mas
isso não é aprovação de toda a distribuição. Dois processos CLI pt-BR responderam ao contrato
JSON e apontaram os três problemas do texto autoral: 22.082 e 26.459 ms, com outros ensaios
concorrentes; esses tempos não constituem benchmark comparável frio/quente. A versão 6.6 é
anterior ao snapshot e não teve sua qualidade comparada com ele. Não substituir o manifesto
sem decisão fundamentada e concluir a avaliação das dependências transitivas do candidato.

## Validação integral e aplicação Windows

Após as atualizações de dependências, o E2E completo na raiz terminou com 370 testes
aprovados e cinco ignorados, exclusivos de `/hub/`. O runner oficial de subpasta terminou
com 286 aprovados. O build web da raiz foi restaurado após o ensaio de subpasta.

O build Tauri release terminou em 33 min 29 s e gerou `nexohub-desktop.exe` de
27.348.480 bytes. Foi usado override local apenas para não reconstruir o frontend durante
os E2E. Isso comprova compilação, não instalação nem funcionamento dos sidecars ausentes.

No ensaio UI do executável, a foto textual foi importada e a geração chegou ao estado
de sucesso. A miniatura apareceu quebrada: o scanner usa URL `blob:` e a diretiva
`img-src` do desktop não permitia esse esquema. Um E2E com a diretiva real reproduziu
`naturalWidth=0`; permitir `blob:` somente em `img-src` fez o mesmo teste passar com
192 pixels. Revisão independente sem achados materiais. Commit `fb00631`.
A reconstrução normal do desktop terminou em 5 min 05 s. No executável reconstruído,
a mesma foto foi importada, a miniatura apareceu, o PDF foi gerado e salvo pelo diálogo
nativo. Reabertura confirmou uma página, JPEG 1280×720 com bytes idênticos ao original;
222.732 bytes, SHA-256 `81a3678dc9bcc9190ef94b2a5db8407b3ebb42a728b5d99ac395704126d489a5`.
Isso valida esse fluxo no WebView2 local, sem comprovar instalação limpa ou OCR correto.

## Dependências nativas: limites da triagem

O snapshot LanguageTool oficial `20261027` foi avaliado isoladamente, sem adoção:
263.225.695 bytes, SHA-256 `d5aa893ca8a86506af6ab0eac81473e86f1b563bfb1fab6fc1d9622552bb9814`.
Posteriormente, o usuário autorizou explicitamente adoção e instalação local, incluindo os
recursos GPL isolados no sidecar, conforme ADR-018. O manifesto foi atualizado; a autorização
não encerra a qualificação para redistribuição. Inventário detalhado em
`LANGUAGETOOL-LICENCAS-20261027.md`.
Dois ensaios CLI atenderam ao contrato. A inspeção inicial de 122 coordenadas foi ampliada
para 155 JARs e 170 coordenadas/versões, incluindo componentes embutidos. Foram identificadas
as versões e declarações de licença de todos os JARs; 50 têm hash idêntico ao artefato
MavenCentral. A auditoria ampliada mantém oito coordenadas afetadas e 19 avisos únicos,
sem novos IDs nem paginação restante. Correspondência de versão não prova exploração;
avisos e declarações de licença não comprovam cumprimento integral para redistribuição.

O instalador conferiu tamanho e SHA-256 dos dois ZIPs, os hashes do JAR CLI e do Java e
os avisos obrigatórios. O runtime foi instalado nos recursos do worktree e copiado ao
diretório release pelo build normal Tauri, concluído em 4 min 56 s. Dois testes Rust do
parser passaram; o teste antes ignorado `executes_installed_pt_br_snapshot` foi executado
explicitamente contra a instalação e passou em 9,99 s.

Na UI nativa, o texto autoral com concordância e dois erros ortográficos produziu três
sugestões. A aplicação explícita gerou o texto esperado, com 59 caracteres. Foi observado
o processo Java do runtime release; durante outra execução, a busca abriu com esse
processo ainda ativo. Esse ensaio demonstra interação observada, não um benchmark de latência.
O rótulo foi ajustado de “Correção no Navegador” para “Correção local”; os 20 testes da
mesa passaram após essa alteração textual.

`node scripts/verificar-inventario-languagetool.mjs` conferiu os 155 JARs, por tamanho,
SHA-256 e cobertura exata, tanto na origem instalada quanto no diretório release.
Um inventário de controle com SHA-256 adulterado foi recusado; os arquivos reais permaneceram
intactos. O inventário público está em `languagetool-20261027-jars.json`, e a auditoria
ampliada em `languagetool-20261027-osv.json`.

O grafo Rust Windows contém 314 pacotes de registro e oito coordenadas com alertas.
A revisão independente não demonstrou vulnerabilidade alcançável nos caminhos examinados:

- O [aviso RustCrypto](https://github.com/RustCrypto/utils/security/advisories/GHSA-qwgh-2vcv-g2f7)
  afeta `>=0.11.0,<0.12.1`, divergindo da correspondência OSV para `block-buffer 0.10.4`.
- O consumidor `plist` de `quick-xml 0.38.4` usa `Reader`, sem os caminhos afetados por
  [RUSTSEC-2026-0194](https://rustsec.org/advisories/RUSTSEC-2026-0194.html) e
  [RUSTSEC-2026-0195](https://rustsec.org/advisories/RUSTSEC-2026-0195.html).
- `AsyncFd` de [RUSTSEC-2026-0386](https://rustsec.org/advisories/RUSTSEC-2026-0386.html)
  é condicionado a Unix e não é compilado neste alvo Windows.
- Os cinco `unic-* 0.9.0` têm avisos de manutenção e uso efetivo por `urlpattern`/Tauri.
  Não foram classificados como dependências apenas de build nem substituídos automaticamente.

Isso não equivale a grafo sem alertas. Artefatos em `.superpowers/q-c0-2026-10-27/`;
a análise é específica às versões e ao alvo observados, com manutenção upstream pendente.

## Instalação limpa: ensaio restrito do scanner

Instalador local de ensaio SHA-256
`eb7f98974e3d6aff5bbb671e2a1859e98b67adf433b968f80b885c01aae84850`, criado antes
da instalação do novo LanguageTool e sem esse runtime. Não é candidato completo para distribuição.
Windows Sandbox via CLI oficial: guest Windows 11 Enterprise `10.0.26100`, memória visível
4.193.220 KiB, câmera/áudio desabilitados, entrada compartilhada somente para leitura e
saída de evidências separada. Instalação retornou zero, sem instalação anterior nem reinício.

Aplicativo instalado abriu, importou a foto e exportou pelo diálogo nativo. Reabertura do
PDF: uma página, 222.731 bytes, JPEG 1280×720 com bytes idênticos à foto; SHA-256
`9ad74cfdee6e7bd74fda8ce090660e34103c6bd49ff9c14d2963b4c2c33db603`.
O ensaio cobre esse fluxo nessa VM de 4 GB, não todos os motores nem hardware físico de
pouca RAM. A coleta após a operação somou 867.291.136 bytes de working set em 13 processos
com nomes NexoHub/WebView2; não identifica exclusivamente descendentes do aplicativo,
não é pico simultâneo de memória nem comparação fria/quente.

## Medição e instalação do pacote com LanguageTool

O [benchmark reproduzível](../benchmarks/2026-10-27-languagetool-q-c0.json) fixa o corpus
autoral por SHA-256, Windows 11 Enterprise 10.0.26100, VM nova com 4.193.220 KiB visíveis,
oito processadores lógicos do Ryzen 5 3550H. Sem builds/E2E concorrentes: primeira chamada
15.182 ms; repetições 15.612 e 14.524 ms. Todas retornaram saída zero e as três regras
esperadas; picos observados do Java de 482.930.688, 503.959.552 e 502.386.688 bytes.

Fria significa primeira chamada da sessão; cada chamada inicia JVM nova, e o cache do SO
não foi esvaziado. Não houve ganho de velocidade demonstrado nas repetições. São
312.224.836 bytes de ZIPs e 571.817.453 bytes no runtime, sem nova biblioteca/WASM do cliente
para LanguageTool. Bytes de arquivo não são medição do overhead TLS ou do tráfego geral.
Heap limitado pelo executor a 768 MiB; o texto curto medido não certifica latência em 4 MiB.

O baseline operacional foi exercitado em outra VM com a mesma configuração e corpus:
instalador anterior sem runtime, com revisão indisponível. O candidato restaura essa
capacidade. O snapshot antigo continua indisponível: não há comparação de qualidade,
memória ou desempenho entre os dois motores. A decisão local do ADR-018 preserva esse limite.

O pacote com runtime foi instalado, abriu e revisou o mesmo arquivo pela UI. Aplicar as
três sugestões produziu a referência exata; o download UTF-8 tem 61 bytes/59 caracteres,
SHA-256 `e843332970a9a373556a712900232a9c9b43c5652684789b94b8b16218aeb60c`.
A coleta foi corrigida após reproduzir o ExitCode nulo de Start-Process/Refresh no
PowerShell 5.1; manter o handle preserva o código real. A medição final foi refeita em VM nova.

Build normal Tauri anterior à correção de concorrência abaixo, com subsistema PE gráfico 2 e bootstrapper WebView2
com assinatura Microsoft válida. Esse instalador tem SHA-256
`63acd382332f552cea3a0bbfe4e1b78e4382cb44a8c19ca78bac55aa6344c0e2`.
Upgrade concluído com saída zero, sem reinício; aplicativo reaberto, um registro
`NexoHub 0.1.0` e um atalho. Os 155 JARs instalados foram reconferidos por tamanho/hash.
Executável instalado idêntico ao build:
`15711250ef8f4b5abf971215356f61afe894cc2b2554dc2b47ec9a5cf29d2add`.
A mudança dessa revisão retirou a promessa de sugestões instantâneas; não mudou o runtime medido.

## Revisão pendente e edição concorrente

O critério de não publicar resultado antigo foi novamente exercitado na mesa de revisão.
Uma promessa controlada reproduziu sobrescrita do texto atual e publicação de histórico
depois de editar a entrada. A correção invalida a geração ao mudar arquivo/aba/texto,
editar a saída, aplicar ou ignorar sugestões, adicionar ao dicionário, limpar ou sair.
Resultado, erro e progresso atrasados são descartados. Isso não mata o processo nativo:
ele termina ou alcança seu timeout e executa a limpeza já existente.

Os 26 testes da mesa passaram, incluindo sucesso/erro obsoletos, desmontagem e aplicação
total/individual ou edição manual durante a execução. A revisão independente encontrou
os caminhos de aplicação inicialmente ausentes; após incluí-los, não apontou achados
materiais restantes. Os seis E2E focados de texto/política do scanner passaram na raiz.
Os mesmos seis E2E passaram em `/hub/` após build específico da subpasta; o build da
raiz foi restaurado em seguida. O snapshot, JRE e os hashes dos JARs medidos permanecem inalterados.

A suíte integral posterior passou: domain 44, tool-sdk 16, tool-registry 10 e client
823 testes em 113 arquivos, totalizando **893 JS/TS**. `pnpm check` passou com os dois
avisos já existentes de placeholders literais no corpus sintético. `quality:check` passou
com sete testes, `licenses:check` aprovou o inventário e `release:verify` conferiu a versão
0.1.0. O build normal Tauri terminou em 7 min 26 s; a mensagem do linker informa a criação
dos arquivos de importação, sem erro de compilação.

O pacote final (292.166.743 bytes) tem SHA-256
`6dbb0adc3dad2417b5ad2fc99bd6436710bff074aaa34f8fcc19b22aec2b803a`;
executável `a9ef899ac53a24c4b049697ad2c58e4600feec868910a15064dcded9ef4e50a0`.
Em outra sessão limpa do Sandbox de 4 GB, a instalação base e o upgrade final retornaram
zero, sem reinício, mantendo um registro e um atalho. Os 155 JARs instalados coincidem
em tamanho/hash com o inventário. PE gráfico 2 e assinatura Microsoft do bootstrapper
WebView2 reconferidos. A revisão real voltou a apresentar os três achados esperados.
Em nova execução, a UI mostrava processamento em 40% quando as sugestões anteriores
foram aplicadas. O texto corrigido permaneceu depois do término da JVM; o download
voltou a coincidir com a referência UTF-8 de 61 bytes/59 caracteres e SHA-256 `e843332970a9a373556a712900232a9c9b43c5652684789b94b8b16218aeb60c`.
Nenhum processo Java permaneceu na conferência final. O Sandbox de ensaio foi encerrado.

## Fechamento e limites preservados

Commits adicionais: `7a360e8` protege a revisão contra publicação obsoleta; `69fe634`
fixa o snapshot local e registra inventário, custo, advisories e condições de fontes.

Os cinco critérios do plano são atendidos nos perfis explicitamente documentados:
corpus/proveniência e grandes arquivos vinculados em [Q-C0-MATRIZ-CORPUS.md](Q-C0-MATRIZ-CORPUS.md);
35 ferramentas com suportados/recusados/não medidos; candidatos e dependências avaliados;
custo/limites do runtime recém-adotado medidos; resultados por tipo confrontados com referência.
As duas fotos CC0 foram exercitadas nas seis ferramentas ativas, com 12 casos na raiz
e 12 em `/hub/`, além da inspeção visual dos downloads. Método em
[IMAGENS-FOTOGRAFICAS.md](IMAGENS-FOTOGRAFICAS.md).

O fechamento não amplia os 35 perfis restritos para precisão universal nem certifica o
NexoHub 1.0 inteiro. A foto privada do livro permanece reprovada para leitura OCR (0/4);
o perfil OCR aprovado usa seus próprios CER/WER e corpus. Nova foto de campo é extensão
de cobertura, sem reabrir DOC-C2. O índice web não vira certificação de todos os motores Windows.

A redistribuição do pacote LanguageTool continua condicionada às fontes e obrigações
registradas no ADR-018 e em [LANGUAGETOOL-FONTES-20261027.md](LANGUAGETOOL-FONTES-20261027.md).
Foi autorizada e validada a instalação local. Sem push, deploy, release ou alteração do checkout principal.
