# Correção das quatro ferramentas auditadas

> Execução: superpowers:executing-plans, nesta sessão. Plano autorizado pelo pedido de corrigir todos os achados da auditoria do commit a44c5ec.

**Objetivo:** corrigir privacidade, captura, preservação de conteúdo, seleções e integração das ferramentas HTML, scanner, remover e extrair páginas.

**Arquitetura:** manter processamento local com React, PDF.js e pdf-lib existentes. HTML usa leitura inerte e composição documental paginada; a prévia precisa bloquear recursos remotos. Operações de páginas preservam o documento e a estrutura de formulário restante.

**Limites:** somente website; sem dependências novas, commit, push ou deploy nesta etapa. Originais imutáveis. Textos novos em pt-BR no catálogo de i18n.

## 1. Regressões

- [x] Cobrir no Chromium: recursos HTML externos, conteúdo integral de tabelas/parágrafos/textos mistos/Unicode, câmera e troca/encerramento, WebP, limpeza de imagens, seleção vazia, reinício, rotas e larguras móveis.
- [x] Cobrir no motor: formulários após remover/extrair, incluindo campos em páginas descartadas e ZIP.
- [x] Observar falhas antes de alterar os respectivos comportamentos.

## 2. HTML

- [x] Isolar prévia com CSP sem rede e sandbox sem origem compartilhada; remover recursos ativos do documento analisado.
- [x] Preservar nós de texto e quebras; paginar dentro de blocos, quebrar palavras longas e células, sem truncar código ou tabela.
- [x] Suportar Unicode com representação fiel dos caracteres que as fontes padrão não codificam, preservando o texto restante selecionável.
- [x] Verificar saída com PDF.js, marcadores no fim dos conteúdos e limites físicos das páginas.

## 3. Scanner

- [x] Conectar fluxo ao vídeo montado, passar facingMode explicitamente e invalidar solicitações tardias; parar tracks em falhas, troca e saída.
- [x] Normalizar WebP no Canvas; liberar ImageBitmap e URLs no ciclo de vida apropriado.
- [x] Verificar captura, exportação e liberação de recursos.

## 4. Páginas e integração

- [x] Validar intervalos integralmente; limpar seleção vazia e impedir execução de intervalo inválido.
- [x] Limpar estado por novo arquivo/reinício; registrar as quatro rotas e ajustar controles para 390px.
- [x] Preservar campos restantes ao remover e extrair; validar campos e valores em PDF combinado e ZIP.
- [x] Executar lint, tipagem, testes unitários, E2E e build; documentar limitações reais de conversão HTML.

## Atenção na revisão

Pedidos de câmera resolvidos após sair da tela; formulários com campos em várias páginas; HTML malformado e recursos CSS externos; conteúdos maiores que uma página/célula; caracteres Unicode e nomes de arquivos longos. As regressões devem cobrir essas classes.

## Evidências e decisões de execução

- Regressões iniciais: 14 falhas no Chromium e três falhas de preservação de formulário, observadas antes das correções. Reproduções complementares da auditoria cobriram seleção vazia, estado entre arquivos e URLs não liberadas.
- Formulários: um copiador compartilhado preserva referências de páginas, campos e widgets; os widgets de páginas descartadas são removidos da árvore antes da cópia. Evita regravar diretamente o contexto completo do original.
- Unicode: somente linhas fora da codificação padrão são renderizadas com Canvas; a camada selecionável é inserida junto a cada linha, com fonte reutilizada por documento. A aparência depende das fontes disponíveis no navegador.
- Revisão independente identificou reordenação do Unicode na extração. O teste `HTML mantém a ordem de linhas Unicode entre linhas vetoriais` falhou antes da correção e passou depois. O caminho padrão de OCR continua acrescentando stream separado para preservar documentos já serializados.
- Verificação final: `pnpm check`, `pnpm test` (541 testes) e build do website aprovados; Playwright completo com 113 testes aprovados. Captura adicional com câmera de teste do Chromium: vídeo 1920×1080 e PDF de uma página.
- Sem novas dependências, commit, push ou deploy nesta entrega.

## Fase de complementação — 24/10/2026

**Estado:** DOC-C1 concluído e validado no website; demais complementos planejados, adicionais às correções concluídas. O formulário compartilha a preservação
de campos já tratada neste plano, por isso seu complemento permanece aqui. Aplicar Q-C0 e os
[gates comuns](../../ROADMAP.md#regras-comuns-de-execução-e-aceite); dependências da nova fase
exigem avaliação própria, sem alterar o histórico da entrega sem dependências.

### DOC-C1 — Formulário com prévia dos valores atuais

**Modificar:** `apps/client/src/platform/pdf-form.ts`, `pdf-form.test.ts`,
`features/launcher/FormFillPdfPanel.tsx`, teste próximo, `DedicatedToolView.tsx` e i18n.
**Criar:** `features/launcher/useFormPreview.ts` e teste próximo.
**Testar:** `e2e/new-tools-quality.spec.ts`, `tool-workspace-regressions.spec.ts`.

- [x] Testar texto, checkbox, rádio e lista em várias páginas: hoje a prévia mostra o original;
  ao mudar valor, deve mostrar a revisão correspondente. Cobrir fonte/acentos e achatar ou não.
- [x] Reutilizar `fillPdfForm` para gerar bytes efêmeros e renderizar a página da revisão,
  com debounce, cancelamento e geração de sessão. O download usa o mesmo snapshot validado.
  Valores não suportados devem gerar erro, nunca desaparecer silenciosamente.
- [x] Navegar do campo à página correspondente; consumir UX-C1 sem reconstruir outro viewer.
  Preservar widgets/valores na saída editável e removê-los somente quando achatar for escolhido.
- [x] Testar troca de arquivo/saída durante renderização e nomes longos em 390px; revogar URLs
  e descartar resultados antigos. Registrar cobertura em `docs/TOOL-SPEC.md`.

### DOC-C2 — Digitalização com perspectiva e revisão por página

**Modificar:** `features/launcher/ScanToPdfPanel.tsx`, teste próximo,
`platform/scan-to-pdf-engine.ts`, teste próximo e `e2e/four-tools-regression.spec.ts`.
**Consome:** `prepareDocumentImage` de OCR-C1, sem segundo pipeline de OpenCV.

- [ ] Testar foto inclinada com quatro marcadores conhecidos, documento sobre fundo e baixa
  iluminação; após correção, todos os marcadores devem permanecer e as bordas formar retângulo.
- [ ] Oferecer ajuste manual dos quatro cantos e comparação original/corrigido antes de aceitar.
  Aplicar alinhamento/contraste só à cópia, com desfazer e escolha por página.
- [ ] Compor páginas corrigidas na ordem indicada; testar cancelar, câmera recusada, tracks
  encerradas e remoção/reordenação. Não confundir melhoria de imagem com reconhecimento OCR.
- [ ] Integrar o pré-processador somente se OCR-C1 comprovar ganho e custo aceitável; sem essa
  prova, manter captura original e ajustes atuais. Registrar limites e resultado no plano.

### DOC-C3 — HTML: fidelidade dentro do escopo local

**Execução local — 26/10/2026:** concluída após commit R-C1 `eba09c8`, árvore inicialmente limpa,
no worktree `fix/auditoria-website`. Sem novo commit, push, deploy ou integração desktop.
DOC-C2 continua fora do escopo. Sem novos motores, dependências, serviços ou rasterização
integral. Sequência: regressões de paginação → implementação incremental → conferência do
PDF exportado, Unicode e limites → gates raiz/subpasta e revisão única.
Detalhes, métricas, corpus e limites em [DOC-C3](../../DOC-C3.md).

**Modificar:** `platform/html-local-document.ts`, `html-to-pdf-converter.ts`, teste próximo,
`features/launcher/HtmlToPdfPanel.tsx`, teste próximo e `e2e/four-tools-regression.spec.ts`.

- [x] Acrescentar casos de tabelas longas, cabeçalhos repetidos, colunas largas, Unicode e
  quebras explícitas; conferir presença do último texto e ausência de conteúdo fora da página.
- [x] Implementar paginação/cabeçalhos mantendo leitura inerte, CSP sem rede e sandbox.
  Preservar texto selecionável quando suportado e avisar quais estilos não são reproduzidos.
- [x] Não instalar html2canvas/html2pdf.js como solução automática de impressão fiel: rasterizar
  a página muda seleção/acessibilidade e não resolve todo CSS. Conversão de sites arbitrários
  via Chromium/servidor permanece condicionada à decisão arquitetural e de privacidade.

**Registro de aceite:** cabeçalhos repetidos inclusive na divisão de linha, recusa de cabeçalho
excessivo, quebras inline de blocos/listas/linhas do corpo, erros simples e aviso sobre diferenças
visuais. Mantido o fallback Unicode existente, com conferência real no Chromium. Parser inerte
e painel reutilizados sem alteração estrutural; seus testes e o catálogo pt-BR receberam os
controles necessários. Fixture autoral e mensagens no runner são os arquivos de apoio adicionados
ao escopo previsto, sem novas dependências. Revisão única: P2 li/tr corrigido com dois testes
RED→GREEN e provas do download. 806 unitários aprovados, 312 E2E na raiz/5 pulados, 223 em
`/hub/`, mais 30 E2E focados finais em cada base após a correção. Check, licenças e builds
aprovados. Sem novo commit/push/deploy; DOC-C2 não iniciado. Layout CSS arbitrário, tabelas
mescladas/aninhadas e Windows instalado permanecem sem homologação.

### DOC-C4 — Remover e extrair páginas: preservação e uso em documentos grandes

**Modificar:** `PdfPageGridPanel.tsx`, `RemovePagesPanel.tsx`, `ExtractPagesPanel.tsx`,
`LazyPageThumbnail.tsx`, `DedicatedToolView.tsx`, `platform/pdf-form.ts` e testes relacionados.

- [ ] Ampliar corpus com campos em páginas mantidas/descartadas, CropBox e rotações; conferir
  ordem, valores e quantidade de páginas no PDF e ZIP, inclusive seleção descontínua.
- [ ] Medir grade e seleção em documento grande; virtualizar elementos somente se necessário,
  preservando seleção global, foco e navegação por teclado. As miniaturas além de 48 páginas
  já foram corrigidas em `43f9c1a`; não reimplementar esse carregamento.
- [ ] Preservar cancelamento da fila ao sair e não exigir renderizar o PDF inteiro para
  selecionar/extrair um intervalo. Rodar os gates comuns antes de ampliar limites atuais.

### Registro complementar — DOC-C1 (24/10/2026)

- Base `e0d30ea`, após commit do UX-C1 autorizado pelo usuário; somente website. Esta entrega
  permanece local, sem commit/push/deploy e sem novas dependências.
- Inspeção mapeia páginas dos widgets por anotações e `/P`, incluindo campos repetidos e rádio
  com opções em páginas diferentes. Entradas e seletores preservam foco e valores ao navegar.
- Hook `useFormPreview` usa o preenchimento existente, com debounce de 300ms, sessão e
  cancelamento. Uma revisão opaca conserva os bytes validados e a identidade da origem;
  o runner rejeita revisão incompatível com arquivo/valores/achatamento e exporta os mesmos bytes.
- Texto com acentos portugueses, checkbox, rádio, dropdown, multiseleção, readonly e modo
  editável/achatado cobertos. Fonte padrão WinAnsi mantida; glyph incompatível gera erro explícito.
  A etapa atômica do pdf-lib não é interrompida internamente, mas não publica resultado obsoleto;
  PDF.js cancela o render ativo. Não foram introduzidas URLs de objeto para as prévias.
- Achatamento do pdf-lib deixava referências de widgets já apagados em `Annots`; testes
  reproduziram referências sem objeto. Captura/remoção seletiva das referências corrige a saída
  sem apagar links ou demais anotações. Aparências e campos da saída editável permanecem.
- Revisão independente única encontrou carregamento infinito ao arrastar arquivo não PDF.
  Reproduzido e corrigido: recusa no upload, erro também no encaminhamento inicial e troca por
  seletor visível. PDF malformado encerra o carregamento e permite recuperação.
- A suíte geral revelou perda da prévia para PDFs sem campos. Restabelecida a visualização do
  original, explicitamente identificada, usando a fila limitada existente; exportação desabilitada.
  A assertion original de legibilidade da mesa foi preservada e passou após a correção.
- Corpus, limites e cobertura em `docs/TOOL-SPEC.md`. Capturas 390/768/1024/1440px e tema escuro,
  sem overflow externo, em `/workspace/artifacts/complementacao-formularios-2026-10-24`.
  Observação neste host Chromium sob verificações concorrentes: 1034ms até primeira revisão e
  843ms na edição, incluindo debounce. Não é benchmark isolado nem promessa para outros PDFs.

- Validação final: 620 testes unitários (557 client), 76 E2E focados na raiz mais o caso adicional
  de PDF sem campos, 91 E2E em `/hub/`, formatter/lint, tipagem de todos os pacotes e builds
  aprovados. A rodada geral anterior teve 217 aprovados/5 restritos à subpasta e falhou em
  `mesa /preencher-formulario usa a tela larga e apresenta página legível`; esse caso foi corrigido
  e passou na rodada final de 76 testes, com a assertion anterior preservada.
- Bundle `/hub/` principal: 1061,50kB / 292,13kB gzip, acréscimo de 7,21kB / 2,20kB gzip sobre
  UX-C1 no mesmo modo de build. Não houve mudança no inventário de dependências.
- Revisão única: um achado importante corrigido e verificado; nenhuma pendência concreta de
  revisão. DOC-C1 permanece local, sem commit/push/deploy. DOC-C2 e demais complementos não
  foram iniciados nesta entrega.
