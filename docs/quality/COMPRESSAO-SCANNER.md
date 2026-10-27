# Q-C0 — compressão de PDF e scanner

Registro histórico desta fatia. A continuação autorizada, com commits, câmera física,
Windows Sandbox de 4 GB e resultados negativos de OCR, está em
[Q-C0-FECHAMENTO.md](Q-C0-FECHAMENTO.md). DOC-C2 permanece excluído.

Etapa local sobre `b345b62`, após commit autorizado da comparação/revisão de texto.
DOC-C2 excluído. Sem dependência nova, integração de candidatos, commit desta nova etapa,
push, deploy ou alteração do checkout principal. Motores e algoritmos de imagem mantidos.

## Corpus e referência

O [gerador autoral MPL-2.0](../../apps/client/src/platform/__fixtures__/q-c0-compress-scan/corpus.ts)
reutiliza o documento rico de acesso PDF: quatro páginas, caixas/rotações diferentes,
texto, campos/widgets, metadados Info e anexo. Adiciona um JPEG RGB de 3000×1800 com três
faixas e ruído determinístico. O scanner usa as mesmas faixas em 192×96, PNG/JPEG/WebP.
Não há fotografia externa nem documento de cliente. O índice registra SHA-256 do gerador,
não dos PDFs/imagens produzidos pelo navegador. A codificação pode variar entre navegadores.

Expectativas fixas: as fontes permanecem imutáveis; ambas as operações geram derivados.
Compressão deve manter texto, caixas, rotação, campos/widgets e anexo no snapshot PDF.js.
O JPEG deve ter as dimensões do perfil e PSNR ≥25 dB contra o original redimensionado ao
mesmo tamanho. Esse limiar pertence somente ao corpus, sem garantir legibilidade universal.
Pixels dos filtros PNG são conferidos em dados de imagem decodificados do PDF; JPEG/WebP
admitem diferença de até 8 por canal nos pontos centrais das faixas.

## Compressão

Os três perfis foram executados pelo aplicativo no Chromium, com download reaberto.
As imagens finais são 2800×1680 (`less`), 2000×1200 (`recommended`) e 1400×840 (`extreme`).
O texto não é rasterizado por essa operação. O motor mantém os bytes originais quando a
regravação não reduz o tamanho. Testes negativos recusam PDF inválido, cifrado e com ByteRange;
isso não equivale a validar criptograficamente uma assinatura real.

Amostra local do primeiro ensaio completo na raiz, registrada pelo E2E, entrada de 3.709.933 bytes:

| Perfil | Bytes de saída | Tempo UI/download (ms) | PSNR (dB) | MAE RGB |
| --- | --- | --- | --- | --- |
| less | 720.679 | 1.331 | 35,42 | 3,31 |
| recommended | 168.941 | 1.278 | 33,63 | 4,15 |
| extreme | 56.865 | 932 | 32,14 | 4,84 |

O tempo inclui clique, execução, atualização da UI e leitura do download; exclui geração
do corpus e inspeção posterior. Uma amostra por perfil, com dois workers e outros testes
locais concorrentes, não é benchmark frio/quente nem SLA. A referência de PSNR usa Canvas
para redimensionar a imagem original e decodificar JPEG; não compara renders integrais PDF.
O snapshot de estrutura/texto usa PDF.js, separado do escritor pdf-lib; widgets também
permanecem nas regressões existentes, mas esse corpus não certifica todos os recursos PDF.

`performance.memory.usedJSHeapSize` retornou 44.700.000 bytes antes e depois nos três casos.
É uma amostra pontual/coarse de heap JS: não demonstra ausência de alocação, pico, memória
total do navegador, Canvas/GPU ou RSS. Esses valores não são orçamento de pouca RAM.

## Scanner

| Caso | Resultado conferido |
| --- | --- |
| PNG original | RGB das três faixas preservado |
| Cinza | RGB de referência: (86,86,86), (127,127,127), (68,68,68) |
| P&B | Faixas preta, branca, preta |
| Contraste | RGB de referência: (255,0,0), (0,255,52), (0,0,255) |
| Páginas | Quatro páginas no download, filtros associados à ordem após mover uma página, rotação 90° preservada, fit 192×96 sem margem |
| JPEG/WebP | Faixas preservadas no limite definido, Letter automático 792×612, imagem 192×96 centralizada em (300,258), sem ampliar a foto |
| Falha de filtro | Decoder/encoder/Canvas indisponível não devolve original como resultado filtrado; sem PDF de sucesso, recuperação escolhendo Original |

O motor antes devolvia a imagem original silenciosamente quando um filtro falhava. Dois
testes falharam antes da correção. Agora a operação recusa o resultado, libera o bitmap em
`finally` e o runner retorna código `TOOL_UNAVAILABLE` com mensagem pt-BR simples. Falha do
encoder também deixa de usar callback assíncrono que poderia deixar a promessa pendente.
Não foi alterada a matemática dos filtros nem adicionada preparação de digitalizações.

O teste anterior em jsdom que compilava `bw` sem Canvas só comprovava a rotação do PDF:
dependia do fallback silencioso. Ele mantém a verificação de composição/rotação em modo
Original; filtros têm agora pixels positivos no Chromium e recusas explícitas em unidade.

## Validação e limites

- `pnpm check`: formatter/lint e typecheck aprovados.
- `pnpm quality:check`: 7 testes aprovados, incluindo índice/hashes das 35 ferramentas.
- Testes pertinentes: 96 aprovados em 7 arquivos.
- Suíte completa final do cliente: 817 testes em 113 arquivos aprovados.
- Suíte completa do Tool Registry: 10 testes aprovados.
- Builds web raiz e `/hub/` aprovados.
- Nove E2E pertinentes aprovados em cada base (18 execuções): 8 do corpus e a regressão
  de seleção/tema/quatro larguras da compressão).
- Revisão final única sem achados materiais; nenhum código alterado pelo revisor.

`git diff --check` aprovado. Não foi executado E2E integral nem instalação Windows.

Uma expectativa antiga de `DedicatedToolView.test.tsx` ainda buscava a frase removida na
etapa de texto. A falha foi observada na suíte completa e corrigida: o teste de contrato
agora aguarda execução, verifica o texto enviado ao port e a mensagem neutra. O dicionário
real continua validado por `text-quality.spec.ts`; o teste de UI não mede qualidade linguística.
Na repetição final, todos os 817 testes passaram; a falha inicial não foi omitida.

Uma primeira execução E2E excedeu 30 s com arrays numéricos da imagem transferidos pelo
protocolo de automação; a referência passou a usar base64, sem mudar seus pixels. O seletor
de margem do teste também foi corrigido para o ID existente. Essas falhas do ensaio não
foram tratadas como falhas dos motores nem ocultadas aumentando o timeout.

Não homologados: fotos/câmera física, perspectiva/iluminação real, EXIF/ICC/transparência,
fidelidade de documentos arbitrários, pouca RAM, pico de memória e aplicativo Windows instalado.
A matriz de interface do scanner recebeu a complementação abaixo. A compressão tem perdas
de imagem e não promete ganho de bytes em qualquer PDF. As miniaturas do scanner mostram
a captura original, não uma prévia pixel a pixel do filtro. Câmera e encerramento de tracks
continuam apenas nos testes simulados existentes. DOC-C2 continua fora do escopo.

Com estes dois perfis, o índice cobre 35 ferramentas com perfil restrito e 25 grupos de
corpus. Isso encerra os registros classificados apenas como regressão, **não o Q-C0 global**:
corpus representativo, medições comparáveis por dispositivo e homologação instalada continuam
pendentes. Nenhum checkbox global é marcado com base apenas nesta consolidação.

## Complementação — matriz de interface do scanner (27/10/2026)

Continuação local no mesmo worktree/base `b345b62`, preservando as alterações anteriores.
DOC-C2 permanece excluído. Sem commit, push, deploy ou dependência nova.

`scan-interface-quality.spec.ts` percorre a mesa com Tab, Enter e teclas dos selects, sem
usar `focus()`, cliques ou `selectOption()` para operar controles. A seleção abre o evento
`filechooser` por teclado; a automação fornece cinco imagens PNG autorais ao seletor.
Remove uma página, escolhe os quatro filtros, gira a segunda e move a quarta para a esquerda.
Seleciona fit, retrato e margem zero, provoca uma falha transitória de encoder e verifica
erro, ausência de download e histórico; repete e baixa o PDF. A saída é reaberta e confere
quatro páginas 192×96, rotação `[0,90,0,0]` e pixels das faixas na ordem dos filtros.

Matriz: 390, 768, 1024 e 1366 px, altura 844 px, temas claro/escuro, Chromium na raiz e
em `/hub/`. Nas larguras móveis, alterna Documento/Opções por teclado. Verifica ausência
de overflow horizontal no documento e nas regiões da mesa, numeração em uma linha e botões
dentro dos cartões. No móvel, o alerta ocupa a largura disponível acima do botão de ação.
Captura documento, opções, erro e resultado por cenário em
`apps/client/test-results/scan-root/` e `scan-hub/` (artefatos locais ignorados pelo Git,
regerados pelos testes). A captura do documento mostra as imagens originais, sem afirmar
prévia dos filtros.

Falhas reproduzidas antes da correção:

- O upload usava label com input oculto, sem controle alcançável por Tab. Agora usa Button
  nativo com a mesma chave pt-BR e o mesmo input de arquivos.
- Em 1024 px, a grade de quatro colunas baseada no viewport excedia a região do documento
  em 61 px. O espaço menor também quebrava a numeração letra por letra. A galeria agora
  adapta colunas à largura disponível, preserva a numeração e permite quebra do cabeçalho.
- Em 390 px, a barra de ações deixava o alerta com apenas 83,84 px de largura, ao lado do
  botão. A regra móvel específica do scanner empilha aviso e ação; a regressão exige pelo
  menos 350 px para o aviso nesse viewport e botão abaixo dele.

Essas mudanças se limitam à apresentação/acesso por teclado. Não alteram filtros, motor,
captura de câmera ou composição PDF. A matriz não mede leitor de tela, contraste WCAG,
outros navegadores, dispositivos físicos ou perspectiva/iluminação real. Os gates globais
de Q-C0 permanecem parciais.

Reprodução dos E2E pertinentes, a partir da raiz do worktree:

```powershell
pnpm build:web
pnpm --filter @nexohub/client exec node e2e/executar.mjs scan-interface-quality.spec.ts compression-scan-quality.spec.ts compression-selection.spec.ts --workers=2 --output=test-results/scan-root
$env:NEXOHUB_BASE_PATH='/hub/'
pnpm build:web
pnpm --filter @nexohub/client exec node e2e/executar.mjs scan-interface-quality.spec.ts compression-scan-quality.spec.ts compression-selection.spec.ts --workers=2 --output=test-results/scan-hub
Remove-Item Env:NEXOHUB_BASE_PATH
```

O runner oficial `executar-subpasta.mjs` também inclui a nova matriz, para as próximas
execuções integrais. Os comandos acima selecionam somente os três arquivos desta fatia.

Validação desta complementação:

- Builds web raiz e `/hub/` aprovados.
- 17 E2E pertinentes em cada base, 34 execuções aprovadas: oito cenários novos da matriz,
  oito do corpus de compressão/scanner e a regressão da seleção da compressão por base.
- 35 testes unitários pertinentes em cinco arquivos aprovados.
- Suíte completa do cliente: 816 aprovados e um timeout de 15 s em
  `pdf-access-quality.test.ts`, caso AES-256 com documento rico. O arquivo repetido
  isoladamente passou com 12 testes, sem alterar código, timeout ou expectativas. Isso
  não converte a execução integral em 817 aprovados nem demonstra a causa do timeout.
  Uma tentativa integral anterior foi interrompida após vários minutos sem resumo; a
  repetição com `--reporter=verbose` produziu o resultado 816/817 acima.
- `pnpm check` aprovado; dois avisos preexistentes de `noTemplateCurlyInString` no corpus
  textual com placeholders literais. Sem erros de formatter/lint ou typecheck.
- `pnpm quality:check`: sete testes aprovados, incluindo hash do novo E2E no corpus existente.
- `git diff --check` aprovado. Capturas amostrais conferidas em 390 e 1024 px, incluindo o
  aviso móvel em escuro nas duas bases.

Não foi executado E2E integral nem instalação Windows nesta complementação.

## Retomada para fechamento — 27/10/2026

O usuário autorizou commit e execução das pendências do Q-C0 após a entrega acima.
Os registros anteriores de ausência de commit são históricos. DOC-C2 continua excluído.

A repetição integral do cliente, sem builds/E2E concorrentes, passou: 817 testes em
113 arquivos (`pnpm --filter @nexohub/client test --maxWorkers=2 --reporter=verbose`).
Isso acrescenta uma execução integral aprovada; preserva o registro anterior 816/817 e
não demonstra por si só a causa daquele timeout. Revisão independente da entrega por
leitura sem achados materiais. O Q-C0 global ainda depende dos demais critérios.
