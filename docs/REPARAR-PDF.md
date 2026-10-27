# Especificação e plano de melhoria: Reparar PDF (`pdf-repair`)

## Estado atual — 26/10/2026

R-C1 implementado e validado localmente, sem commit, push ou deploy. Avaliação de qpdf,
corpus, decisões e limites em [R-C1 — validação](R-C1-VALIDACAO.md). O motor conserva pdf-lib,
remove a reconstrução regex, executa em worker cancelável e verifica a saída antes de oferecer
prévia e download. qpdf não foi integrado. DOC-C2 continua fora do escopo.

Os registros de 25/10 abaixo descrevem a baseline histórica, anterior ao R-C1.

## Estado histórico — 25/10/2026

O motor web está implementado e ativo no catálogo, integrado em `8ed2033`. Os seis testes
do motor cobrem vazio, formato inválido, prefixo antes do cabeçalho, EOF/startxref ausentes
e reabertura de documento íntegro. O E2E integrado verifica download com duas páginas e texto
conhecido em 390/1366 px, na raiz e em `/hub/`. Essas provas não homologam todos os cenários
estruturais descritos abaixo, campos, anexos, assinaturas ou o aplicativo Windows instalado.

O motor usa `pdf-lib`, sanitização de cabeçalho e heurísticas de xref/trailer baseadas em
varredura textual. Esse fallback existente não equivale a parser estrutural robusto; os
limites, worker cancelável e corpus adversarial continuam no R-C1. qpdf não está instalado
nem integrado. Não há fallback nativo ou remoto automático homologado.

Limite reproduzido nesta adequação: uma entrada não PDF contendo a palavra `objetos`
aciona a heurística de `obj` e pode terminar com erro genérico do Tool Runner. O painel
apresenta a falha e não oferece download; classificação mais precisa desse caso permanece
no R-C1. Esta adequação visual não corrige nem certifica o fallback do motor.

## Padronização da mesa — 25/10/2026

**Estado:** concluída e validada no website local. Homologação Windows permanece separada.

> Execução inline com `superpowers:executing-plans`, TDD e revisão independente final.
> Autorizada pelo usuário após a consolidação. Commits locais autorizados; sem push/deploy.

**Objetivo:** aplicar o padrão aprovado em
[Mesas](superpowers/specs/2026-10-24-padrao-mesas-ferramentas-design.md), conservando o motor.
**Arquitetura e stack:** React/TypeScript strict, `ToolWorkspace`, CSS e catálogo pt-BR existentes.
Sem dependências, runtime, infraestrutura ou capacidades novas de recuperação.
**Decisão:** usar o frame compartilhado completo, como no comparador. Manter apenas marcações
na mesa genérica conservaria a duplicação das ações internas e externas; uma mesa independente
duplicaria a infraestrutura já aprovada. Documento mostra a miniatura do original, rotulada
como original; a saída reparada continua disponível por download, sem fingir prévia do resultado.

**Arquivos:** `apps/client/src/features/launcher/PdfRepairPanel.tsx`, `.test.tsx` e novo `.css`;
`DedicatedToolView.tsx`, `src/styles.css`, `src/i18n/pt-BR.ts`; E2E
`pdf-repair-integration.spec.ts`, `tool-workspace-browser-zoom.spec.ts`; este plano, `ROADMAP.md`
e o registro histórico `INTEGRACAO-FERRAMENTAS-MESAS-2026-10-25.md`, para distinguir a
preservação original do painel na integração da adequação visual posterior.
**Interfaces:** conservar entrada de arquivo, relatório, progresso e callbacks existentes;
acrescentar `onBack` ao painel. Renderizar o painel completo após upload, sem o rodapé genérico.
**Foco:** uma ação principal por estado; erros/avisos longos; arquivo com nome longo;
abas móveis sem perda do relatório; estado de execução com ações bloqueadas e progresso nomeado.

- [x] Regressões RED: regiões nomeadas ausentes, progresso sem semântica e ação duplicada
  na tela integrada; preservar testes de download/páginas/texto.
- [x] Implementar documento, diagnóstico e ações no frame compartilhado, com pt-BR e tokens
  dos dois temas; progresso acessível, erros e avisos com rolagem própria, sem botão duplicado.
- [x] Verificar unitários, matriz 390/768/1024/1366/1440, pouca altura, teclado, tema escuro,
  movimento reduzido e zoom real 200%; estados inicial, execução, erro e resultado.
- [x] Reconciliar R-C1 com a implementação atual e registrar evidências, limites e revisão.
- [x] Executar check, unitários e builds/E2E raiz e `/hub/`; registrar commit local.

**Evidências da adequação:** dois novos unitários falharam antes do frame e os dois E2E de
download reproduziram a ação duplicada. Após a correção, oito testes do painel passaram.
A matriz focada com download, cinco larguras nos dois temas, duas janelas baixas, dois erros
e zoom real passou em 17 E2E. A miniatura com nome longo em 390×320 teve regressão própria
RED/GREEN; o diagnóstico e o arquivo baixado não se perdem ao alternar abas. A revisão
independente não encontrou achados materiais; não homologou o motor ampliado nem Windows.
Na inspeção das capturas, a ação desktop foi refinada para ocupar a largura integral da
lateral; a matriz exige mais de 90% da área de ações. O móvel conserva duas colunas para
preservar altura. Os E2E gerais abaixo foram repetidos após esse refinamento.

**Gates finais aprovados:**

| Verificação | Resultado | Log local |
| --- | --- | --- |
| `pnpm check` | Formatter, lint e tipagem aprovados | `check.log` |
| `pnpm test --maxWorkers=2` | 718 aprovados (655 client, 44 domain, 16 SDK, 3 registry) | `unit-full.log` |
| Build da raiz | Aprovado | `build-root-final.log` |
| Suíte E2E completa da raiz | 281 aprovados; cinco exclusivos da subpasta pulados | `root-final.log` |
| Build com `NEXOHUB_BASE_PATH=/hub/` | Aprovado | `build-hub-final.log` |
| E2E oficial de `/hub/` | 170 aprovados | `hub-final.log` |

Logs e registro das rodadas: `.superpowers/sdd/2026-10-25-padronizar-reparo/` neste worktree.
Capturas e medições de zoom real: `captures-root-final/` e `captures-hub-final/` nessa pasta.
Os builds mantêm o aviso existente de chunks acima de 1000 kB. Não foram adicionadas
dependências. O motor manteve o blob Git `eba10ccaa8d8f5cfb0105e345d8af9aca0566bdf`.
Sem push, deploy ou início de OCR-C1/DOC-C2 nesta adequação.

## Contrato da ferramenta

- **Identificador de Ferramenta:** `pdf-repair`
- **Categoria:** Otimizar PDF
- **Superfícies:** Quick e Studio
- **Entrada:** `application/pdf`
- **Saída:** `application/pdf`
- **Capacidades Exigidas:** `documents.read`, `documents.write`, `pdf.transform`
- **Executor atual:** `browser`; runtime nativo permanece sujeito a decisão e homologação.

---

## 1. Objetivo e Princípio de Honestidade Funcional

A ferramenta **Reparar PDF** tem como objetivo recuperar a legibilidade e a estrutura sintática de arquivos PDF danificados, malformados ou corrompidos durante download, transferência ou salvamento incompleto.

Em estrita consonância com o princípio de honestidade técnica do NexoHub:
- Não gera falsas promessas de recuperação quando dados essenciais de páginas foram destruídos.
- Não substitui nem sobrescreve o arquivo original: produz um novo artifact recuperado imutável.
- Em caso de impossibilidade de reconstrução, retorna erros estruturados e explicativos, orientando o usuário.

---

## 2. Cenários originalmente propostos e cobertura atual

1. **Tabela de Referências Cruzadas (`xref`) Danificada ou Dessincronizada:**
   - Sintoma: Erros de parser ("Invalid xref table", "Missing xref table").
   - R-C1: leitura tolerante pelo parser e reserialização; sem reconstrução regex de objetos.
2. **Trailer e Dicionário de Catálogo (`Root`) Ausentes ou Incompletos:**
   - Sintoma: Final do arquivo truncado (ausência de `startxref` ou `%%EOF`).
   - R-C1: só aceita o grafo reconhecido pelo parser; associação ambígua de Info provoca recusa, sem síntese heurística de catálogo/trailer.
3. **Streams de Objetos com Tamanho Declarado Incorreto (`/Length`):**
   - Sintoma: Erro de leitura de streams antes de atingir `endstream`.
   - Não há reparo próprio de `/Length` homologado; streams passam pelo parser e pelos limites documentados no relatório.
4. **Objetos Indiretos Órfãos e Referências Circulares:**
   - Não há purga/reconstrução própria homologada; divergência de contagem ou erro de leitura recusa a operação inteira.

---

## 3. Cenários Não Recuperáveis (Falha Explícita)

- Arquivos criptografados cuja senha/chave de descriptografia é desconhecida.
- Arquivos severamente truncados em que a árvore de páginas (`/Pages`) ou os fluxos de conteúdo das páginas foram totalmente destruídos ou preenchidos por bytes nulos (`0x00`).
- Arquivos que não são do formato PDF (ausência de cabeçalho `%PDF-` e sem objetos válidos identificáveis).

O adapter apresenta erros estruturados com mensagens pt-BR, incluindo documento vazio,
criptografado, corrompido, assinado, acima dos limites, não suportado, timeout e falha de
verificação. Texto contendo `objetos` é recusado como documento corrompido; não recebe
cabeçalho inventado. Não há recuperação de conteúdo fisicamente ausente.

---

## 4. Estratégia de Implementação Técnica

- **Ambiente Web:** parser `pdf-lib` em worker cancelável, serialização do grafo carregado e reabertura independente em PDF.js, com limites e recusas conservadoras descritos no relatório R-C1.
- **Ambiente Desktop (homologação pendente):** eventual reconstrução nativa depende do
  Capability/Document Core Port e de decisão própria. Esta entrega não implementa módulo Rust.

## Complementação do motor — 24/10/2026

### R-C1 — Avaliar qpdf dentro da fase 17 existente

### Execução local autorizada — 26/10/2026

Base `bc3317b`, worktree `fix/auditoria-website` inicialmente limpo. Sem commit, push ou deploy;
DOC-C2 fora do escopo. Sequência: avaliação isolada de qpdf/licenças/distribuições → corpus e
baseline → regressões → motor conservador e worker cancelável → verificação independente,
prévia da saída, gates locais e revisão única. Detalhes de funcionamento ficam na documentação,
sem acrescentar explicações técnicas ao painel do cliente.

Arquivos de apoio reconciliados: `pdf-repair-client.ts`, `pdf-repair.worker.ts`,
`pdf-repair-verify.ts`, testes próximos, corpus `__fixtures__/r-c1/`, script isolado de comparação,
runner/estado do painel e i18n. Conservam Tool Registry e contratos existentes; não criam runtime
nativo/remoto nem instalação automática de qpdf.

**Estado:** implementada e validada localmente em 26/10/2026, com os limites do relatório.
Aplicados Q-C0 e os
[gates comuns](ROADMAP.md#regras-comuns-de-execução-e-aceite).
**Arquivos realizados:** motor, adapter, worker, verificador, runner, painel, i18n, testes,
corpus e controladores isolados de avaliação; contratos e registro existentes conservados.

- [x] Ampliar as fixtures atuais com xref/trailer quebrado, streams com delimitadores aparentes,
  arquivo truncado recuperável e perda irrecuperável. Conferir páginas, conteúdo, campos,
  anexos, metadados e original imutável; distinguir recuperação parcial de completa.
- [x] Comparar leitura tolerante atual com [qpdf](https://github.com/qpdf/qpdf) Apache-2.0;
  avaliar versão, licenças incorporadas, tamanho e manutenção do wrapper WASM separadamente.
  Um wrapper experimental não herda a maturidade do motor C++.
- [x] Substituir ou restringir o fallback atual baseado em regex sobre bytes: streams podem conter
  delimitadores aparentes; exigir parser/motor demonstrado, limites de bytes/páginas/objetos,
  orçamento de expansão e proteção contra loops. Não certificar robustez pela existência do código.
- [x] Se qpdf não demonstrar integração web local robusta, preservar o motor atual com limites
  explícitos. Binário nativo ou execução remota depende de decisão de plataforma/privacidade;
  nenhuma substituição ou fallback oculto está autorizado por este plano.
- [x] Homologar a melhoria com saída reaberta por leitor independente, erros claros para perda
  física de conteúdo, worker cancelável e descarte de resultados atrasados. Acrescentar prévia
  verificável do resultado sem confundi-la com a miniatura original. qpdf não resolve edição textual, OCR ou PDF/A
  por si só; essas capacidades permanecem nos seus planos atuais.

**Evidência:** oito entradas, 24 extrações comparativas, prova qpdf no navegador e controle
nativo isolado. Cinco saídas R-C1 aceitas preservam os dados conferidos pelo leitor independente;
três entradas são recusadas. Regex removida, limites aplicados, cancelamento e descarte testados.
O orçamento após o parser não constitui limite rígido de heap. São 798 unitários aprovados,
300 E2E na raiz (cinco pulados exclusivos de subpasta) e 193 E2E oficiais em `/hub/`;
após corrigir visualmente a legenda da saída, 19 E2E focados repetidos em cada base.
Check, builds e licenças aprovados. Relatório e logs em [R-C1](R-C1-VALIDACAO.md).
