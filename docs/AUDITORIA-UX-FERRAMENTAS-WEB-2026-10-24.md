# Auditoria das ferramentas do website — 24/10/2026

## Resultado

Foram confirmados um defeito P1 de resultado e oito grupos P2 de interface/prévia. Os problemas
observados pelo usuário são reproduzíveis. Há também limitações de produto que precisam ser
tratadas como evolução de capacidade, sem prometer que uma correção de CSS as resolverá.

Base: `origin/main` / `7de5a3544e616937e2e5fe5df25ea0e54f1fac27`, sem alterações funcionais.
Reprodução em build de produção local com `NEXOHUB_BASE_PATH=/hub/`, Chromium headless.
O levantamento inicial abaixo preserva as reproduções anteriores às correções. A seção final
registra os ajustes implementados e sua validação, sem publicação de outra versão.

## Cobertura e limites da evidência

- 32 ferramentas com arquivos carregados, nas larguras 390, 768, 1024 e 1440 px: 128 estados.
- HTML para PDF e Digitalizar PDF: telas iniciais nas mesmas quatro larguras, mais oito estados.
- PDF sintético de três páginas, com texto, imagem, campo de texto e checkbox; imagem de 1200 × 800 px;
  texto sintético; PDF de 50 páginas para testar a grade além da página 48.
- Interações adicionais: recorte e leitura das dimensões do PNG exportado; troca de texto por logo;
  clique na paleta de cores; comparação PDF executada; numeração sem capa; grade de 50 páginas.
- Não apareceram exceções JavaScript não tratadas na varredura inicial. Isso não certifica todos
  os executores: a auditoria priorizou layout, estado e alguns fluxos reais de resultado.
- Câmera física, navegação por toque em aparelho real, todo o fluxo de teclado e tradução/OCR com
  download inicial de modelos não foram homologados nesta rodada. Nenhum documento real foi usado.

Evidências locais: `/workspace/artifacts/auditoria-ferramentas-2026-10-24/`.
`resultados.json` contém medidas da varredura; `interacoes.json` e `extras.json`, reproduções dirigidas.
As capturas correspondem ao build local do mesmo commit publicado, não a uma sessão remota do site.

## F01 — P1 — Recorte exportado diverge das dimensões e da proporção selecionadas

**Reprodução:** abrir Recortar imagem, selecionar a imagem de 1200 × 800 px, escolher `1:1`,
alterar X para 700 e executar. A interface mantém `1:1 (Quadrado)`, largura 800, altura 800 e
`Recorte: 800 × 800 px`. O PNG baixado tem **500 × 800 px**.

**Causa:** `ImageCropPanel.tsx:150` / `:180` validam largura e X separadamente contra a dimensão
original, sem garantir `X + largura <= larguraOriginal`. O preset também não é reconciliado ao
editar números. `image-engine.ts:529` limita silenciosamente a área no processamento; o estado
mostrado ao usuário não recebe essa limitação.

**Impacto:** o arquivo derivado não corresponde ao que foi configurado. O original permanece
preservado, mas o usuário pode entregar um recorte incorreto acreditando que ele é quadrado.

**Correção:** normalizar ou recusar a combinação no formulário; manter proporção e limites
coerentes; mostrar a região sobre a imagem e suas dimensões efetivas. Preservar a defesa no motor,
sem usá-la para corrigir silenciosamente uma configuração que a tela continua anunciando.
Verificar as dimensões reais do download, inclusive em lotes com tamanhos diferentes.

Evidências: `recorte-fora-limite.png`, `recorte-exportado.png`, `interacoes.json`.

## F02 — P2 — O slider de opacidade impede selecionar uma cor da marca d'água

**Reprodução:** Marca d'água em imagem, arquivo carregado, largura 1024 ou 1440 px. Tentar
clicar no centro de `Vermelho`. O alvo real é o input `#wm-opacity`; a tentativa de clique
pelo navegador falhou porque esse input intercepta os eventos.

**Causa:** `ImageWatermarkPanel.tsx:208` divide cores/opacidade em duas colunas. A paleta tem
quatro botões em uma linha, mas `styles.css:9554` impõe largura mínima de 44 px a todos os botões.
A paleta excede sua meia coluna dentro da lateral de 360 px e invade o slider.

**Correção:** reorganizar a paleta e a opacidade com base na largura disponível, usando quebra
ou empilhamento. Manter alvos de 44 px; diminuir os alvos para esconder a sobreposição seria regressão.

Evidências: `marca-dagua-imagem-1440.png`; `extras.json` registra `hitId=wm-opacity` e o clique recusado.

## F03 — P2 — Grades de opções usam a largura da janela em vez da largura da lateral

**Reprodução:** Recortar imagem e Converter imagem em 1024/1440 px. As descrições das proporções
se sobrepõem; badges e títulos dos formatos ultrapassam seus cartões. Houve overflow horizontal
até 14 px em Recortar imagem e 20 px em Converter imagem, dependendo da largura.

**Causa:** `styles.css:9980` reserva uma lateral de 360 px. Dentro dela,
`ImageCropPanel.tsx:120` usa `sm:grid-cols-5`, e `ImageConvertPanel.tsx:94` usa `sm:grid-cols-3`.
O breakpoint considera a janela, embora o espaço real do componente continue estreito.
O cabeçalho título + badge dos formatos também não quebra de forma suficiente.

**Correção:** grades orientadas pela largura do painel, com uma/duas colunas na lateral e mais
colunas somente quando houver espaço real. Garantir que títulos, descrições e badges caibam
sem abreviações incompreensíveis nem cortes.

Evidências: `recortar-imagem-1440.png`, `converter-imagem-1440.png`, `resultados.json`.

## F04 — P2 — Três ferramentas transbordam a página no celular

| Ferramenta / 390 px | Largura real do documento | Evidência da causa |
|---|---:|---|
| Traduzir texto | 423 px | Grupo interno dos idiomas sem quebra; a toolbar de copiar/baixar também excede o painel. `TranslateDocumentPanel.tsx:89`. |
| Comparar textos | 456 px | Estatísticas e badge de similaridade não acomodam a soma das larguras. `styles.css:6973` e `.doc-compare-similarity-badge`. |
| Preencher formulário | 490 px | Coluna com mínimo intrínseco; cabeçalho reúne arquivo + progresso sem quebra. `FormFillPdfPanel.tsx:403` e `:424`. |

**Impacto:** elementos saem da tela e passam a exigir rolagem horizontal; a leitura e os controles
ficam desalinhados. Isso ocorreu com nomes comuns, sem precisar de um nome de arquivo extremo.

**Correção:** usar trilhas `minmax(0, 1fr)`, limitar os filhos, quebrar cabeçalhos/estatísticas e
reorganizar os grupos de idiomas e ações. Conferir também nomes longos e valores preenchidos.
Ocultar o overflow do body não corrige a causa e pode tornar os controles inacessíveis.

Evidências: `traduzir-texto-390.png`, `comparar-textos-390.png`, `preencher-formulario-390.png`.

## F05 — P2 — A prévia de marca d'água com logotipo continua mostrando texto

**Reprodução:** Marca d'água em imagem → Logotipo / Imagem → escolher um PNG. A seleção mostra
que o logo foi escolhido, mas a prévia continua com o texto `NexoHub`. Há somente um `<img>` no
quadro de prévia: a imagem original.

**Causa:** `ImageWatermarkPanel.tsx:72` desenha sempre spans de texto. O overlay não usa
`watermarkType` e `watermarkFile` para renderizar o logo, embora eles sejam enviados ao executor.

**Correção:** mostrar o arquivo escolhido com escala, posição, rotação e repetição correspondentes
à operação real. Conferir texto e imagem; não anunciar uma prévia fiel enquanto ela é apenas decorativa.

Evidências: `marca-logo-previa.png`, `interacoes.json` (`previewImages=1`).

## F06 — P2 — A grade deixa de mostrar conteúdo real após a página 48

**Reprodução:** carregar um PDF de 50 páginas em Organizar PDF e rolar até o final. A página 1
usa miniatura JPEG real; a 49 usa `data:image/svg+xml`, um desenho genérico de página, mesmo
após entrar na área visível.

**Causa:** `DedicatedToolView.tsx:529` limita o carregamento inicial da grade a 48 páginas.
`PdfPageGridPanel.tsx:224` usa o placeholder quando falta miniatura, mas não solicita a página
visível. Remover páginas e Extrair páginas recebem o mesmo conjunto limitado e possuem fallback.

**Impacto:** o usuário consegue operar pelo número, mas não identificar visualmente conteúdo
nas páginas posteriores. A ferramenta parece suportar visualmente todo o documento.

**Correção:** manter um orçamento de renderização e carregar incrementalmente páginas visíveis,
com cache/cancelamento e indicação de carregamento. Não renderizar um documento inteiro grande
antecipadamente como solução, pois isso aumentaria consumo de memória.

Evidências: `organizar-pagina49.png`, `extras.json`.

## F07 — P2 — Prévia de imagem ainda ocupa uma pequena fração da mesa

Em 1440 px, Marca d'água mantém um quadro de 256 × 256 px dentro de uma área com cerca de
1012 px de largura; Girar imagem mantém 224 × 224 px. O conteúdo real é ainda menor quando a
imagem precisa ser contida no quadrado. Isso confirma a limitação de aproveitamento da tela.

**Causa:** `ImageWatermarkPanel.tsx:65` usa `w-64 h-64`; `ImageRotatePanel.tsx:49` usa `w-56 h-56`.
Esses quadros não seguem a prévia responsiva utilizada em outras ferramentas de imagem.

**Correção:** uma área de trabalho proporcional ao espaço real, ajuste à tela e zoom, mantendo
escala e origem corretas ao girar/espelhar. A ampliação não deve recortar os cantos da imagem.

Evidências: `girar-imagem-1440.png`, `marca-dagua-imagem-1440.png`.

## F08 — P2 — Numeração mostra número na capa que a própria opção diz pular

**Reprodução:** carregar o PDF de três páginas em Números de página, escolher `Página 2 (Pular
Capa)`. A miniatura continua sendo da página 1, mas recebe `Página 2 de 3` sobre ela.

**Causa:** `PageNumbersPdfPanel.tsx:48` troca o rótulo para 2 quando `startPage > 1`, enquanto
`DedicatedToolView.tsx:1739` continua passando a miniatura inicial. O motor pula a primeira página
corretamente; é a prévia que informa a operação errada.

**Correção:** mostrar a página efetivamente numerada ou manter a capa sem estampa, com navegação
coerente. A escolha de início limitada a página 1 ou 2 é uma restrição adicional de produto.

Evidências: `numeracao-sem-capa.png`, `extras.json` (`numberPreview=Página 2 de 3`).

## F09 — P2 — A base visual dos painéis de imagem está parcialmente desconectada dos tokens

A folha compilada não contém as classes `.bg-surface`, `.border-border` e `.text-text-secondary`
utilizadas pelos componentes. Nos elementos examinados, os cartões ficaram transparentes, com
borda na cor do texto, em vez de superfícies e bordas semânticas do projeto.

Há ainda `button, input { font: inherit }` e `button { color: inherit }` fora de camadas em
`styles.css:264`. Esses resets têm precedência sobre utilities do Tailwind em camadas. Um botão
com `text-xs` foi medido com fonte de 16 px; o botão ativo azul manteve texto escuro apesar de
`text-white`. A regra universal de largura mínima de botões participa da sobreposição em F02.

**Correção:** integrar os tokens existentes ao tema Tailwind ou adotar classes de componente que
os consumam explicitamente; manter resets na camada base ou limitá-los ao escopo apropriado.
Depois revisar os seis painéis como conjunto. Adicionar mais overrides locais sem resolver essa
base tende a corrigir uma tela e desalinhar outra.

Evidências: `interacoes.json` e `extras.json` (CSS compilado, estilo computado e regras correspondentes).

## Limitações de produto e pendências de qualidade

Estas não são apresentadas como novos defeitos de processamento confirmados:

| Área | Limitação atual / pendência | Encaminhamento |
|---|---|---|
| Recortar imagem | O levantamento inicial não tinha seleção visual. | Resolvido junto de F01: região visível e movível; medidas coerentes com a exportação. |
| Imagens em lote | Os seis painéis recebem nome, tamanho e prévia de `files[0]`; faltam lista visível do lote, seleção de item e remoção individual na mesa. | Exibir o conjunto real e permitir inspecionar cada arquivo antes de aplicar opções compartilhadas. |
| Seleção de opções | Botões de preset/formato em imagem frequentemente comunicam seleção apenas por classes, sem `aria-pressed` ou semântica de rádio. | Expor estado selecionado e homologar teclado/leitor de tela. |
| Formulários | A prévia permanece no original, com aviso explícito; os novos valores não aparecem sobre os campos na prévia. | Prévia atualizada e navegação por campo, preservando o formulário no download. |
| Editar PDF | Limites documentados: 20 MiB, 30 páginas, 3.000 objetos; sem reflow de parágrafos, OCR com reconstrução ou edição de todo tipo de fonte. | Homologar corpus real e estabelecer escopo comercial; não prometer equivalência total com um editor maduro. |
| PDF para Excel | Extração baseada em texto/coordenadas; não oferece OCR de planilhas digitalizadas nem reconstrução universal de tabelas complexas. | Corpus de tabelas e avisos por tipo de documento antes de expandir o motor. |
| Ocultar PDF | Reconstrói o PDF como imagens, inclusive perdendo texto selecionável, links e campos; há aviso na própria mesa. | Decidir evolução do motor com remoção verdadeira de conteúdo. Não trocar por retângulos sobre o texto. |
| HTML para PDF | Escopo de captura local limitado, sem fidelidade universal de impressão/paginação web. | Tratar como capacidade restrita e não como conversor completo de sites. |
| Documentação | `ARCHITECTURE.md` ainda menciona 24 ferramentas em trecho cujo catálogo atual tem 34; declarações de paridade desktop não equivalem a homologação nesta auditoria web. | Sincronizar documentação e manter escopo website explícito. |

## Ordem recomendada de correção

1. Corrigir F01 com teste de download e validação de dimensões; confirmar original imutável.
2. Corrigir a base de tokens/cascata (F09) e as grades/paleta (F02/F03), preservando alvos de toque.
3. Corrigir os três transbordamentos móveis (F04), em 390/768/1024/1440 px e com arquivos carregados.
4. Fazer as prévias corresponderem às opções reais (F05/F08) e ampliar as mesas pequenas (F07).
5. Carregar as páginas posteriores incrementalmente (F06) e melhorar a visibilidade de lotes.
6. Evoluir capacidade dos motores em entregas próprias, com corpus e critérios de qualidade.

Critérios de aceite: ausência de rolagem horizontal externa; nenhuma ação coberta por outro
controle; nomes/opções legíveis; estado selecionado acessível; prévia e exportação coerentes;
miniatura real para páginas visíveis; tamanhos de toque preservados. Acrescentar verificações de
layout e resultado exportado: a CI existente passou, mas seus testes de presença/navegação não
cobriram essas combinações de conteúdo, sidebar e viewport.

## Correções implementadas — 24/10/2026

| Achado | Ajuste e evidência de regressão |
|---|---|
| F01 | Coordenadas e proporções limitadas à imagem; motor rejeita área inválida em vez de truncá-la. Seleção visível, movível por ponteiro/setas. PNG baixado de 800×800 corresponde às medidas exibidas. Acrescentar imagem ao lote preserva o recorte. |
| F02 | Paleta com quebra de linha, alvos de 44px e range em linha própria. Clique real na cor vermelha em 1024/1440px. |
| F03 | Grades de proporção, coordenadas e formatos usam a largura disponível na lateral. Teste mede os retângulos de texto, além da largura externa. |
| F04 | Controles de idiomas, estatísticas e formulário quebram sem transbordar. Testes em quatro larguras aguardam texto/campos carregados e incluem nomes longos. |
| F05 | Prévia usa o mesmo motor de marca d'água da exportação. Pixels do logotipo e posição conferidos no navegador. Debounce, cancelamento e descarte de URLs temporárias; pausa durante exportação. |
| F06 | Miniaturas reais posteriores à página 48 solicitadas ao entrar na área visível, com cache e fila serial. Página 49 verificada nas três grades. Teste com renderização pendente confirma descarte da fila ao desmontar. |
| F07 | Prévias de rotação e marca d'água ampliadas, preservando proporção. Testes conferem tamanho e enquadramento, inclusive após rotação de 90°. |
| F08 | Numeração solicita e mostra a página efetivamente numerada ao pular a capa. Testes unitário e de navegador conferem a troca da imagem, além do rótulo. |
| F09 | Tokens registrados no tema Tailwind e resets na camada base. Estilos computados conferem fundo branco, fonte de 12px e texto branco na opção ativa; tema escuro coberto pela suíte existente. |

As limitações dos motores e a inspeção individual de lotes continuam como evolução de produto,
separadas dos nove defeitos corrigidos. Não houve alteração em APIs, dependências ou desktop.
O trecho obsoleto de 24 ferramentas em `ARCHITECTURE.md` foi sincronizado com o catálogo de 34.

### Validação final

- Lint e tipagem aprovados; builds de produção na raiz e em `/hub/` concluídos.
- 584 testes unitários aprovados: 521 no client, 44 no domínio, 16 no SDK e 3 no registro.
- Suíte geral E2E: 160 aprovados e 5 cenários específicos de subpasta ignorados nessa execução.
  Após os ajustes finais, as 26 regressões das mesas passaram novamente na raiz. A execução
  completa de subpasta aprovou 31 cenários, incluindo essas regressões e os cinco de publicação.
- Nova varredura: 128 estados de ferramentas carregadas, nas quatro larguras, sem rolagem
  horizontal externa ou exceções JavaScript. As únicas oclusões sinalizadas pelo coletor são os
  inputs de arquivo deliberadamente ocultos; controles visíveis foram conferidos por interação.
- Capturas e medições: `/workspace/artifacts/correcoes-ferramentas-2026-10-24/index.html` e
  `resultados.json`; evidências de testes em `/tmp/nexohub-ux-fixes/`.
- Revisão independente concluída; fila de miniaturas após desmontagem corrigida e coberta por
  regressão. Sem commit, push ou deploy nesta etapa.
