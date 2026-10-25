# Consolidação das ferramentas e mesas — 25/10/2026

## Escopo autorizado

Consolidar os commits locais, integrar a `main` preservando Reparar PDF e validar o conjunto
antes de retomar OCR-C1/DOC-C2. Sem deploy. Não há push, release ou publicação nesta rodada.

O checkout principal contém alterações não commitadas de PDF→Word, inclusive em arquivos
compartilhados com esta entrega. Elas foram preservadas: a integração ocorre na branch
`fix/auditoria-website`, no worktree `nexohub-editor-compatibilidade/NexoHub`. A referência
da `main` incorporada é `a5aef3f`; o checkout principal não foi alterado por esta execução.

## Commits consolidados

- `dc98bde`: validação integral do orçamento raster antes de alocar canvases, com regressão.
- `e23e652`: mesas adaptadas à janela e melhorias CMP-C1 do comparador, com fonte local,
  prévias sob demanda, acessibilidade, responsividade e regressões de exportação.
- `8153666`: diagnóstico documental das capacidades e limites do editor PDF.

As alterações do comparador e das mesas compartilham componentes e testes; foram mantidas
em uma única unidade para evitar um estado intermediário sem o frame correspondente.

## Integração de Reparar PDF

Os conflitos foram resolvidos em `DedicatedToolView.tsx`, `launcher-tool-runner.ts` e
`styles.css`, preservando fila de prévias, revisões de formulário, ocultação qualificada,
comparador, gestão de imagens e pontos de entrada de Reparar PDF.

O motor e o painel de reparo são idênticos aos de `a5aef3f`, conferidos pelos blobs Git:

- `pdf-repair-engine.ts`: `eba10ccaa8d8f5cfb0105e345d8af9aca0566bdf`.
- `PdfRepairPanel.tsx`: `b7189d014978c7c40a93a5a25e3b10df620e639c`.

O E2E adicional usa PDF sintético com duas páginas e texto conhecido, prefixo inválido antes
do cabeçalho e download real. Confere as páginas e o texto com leitores independentes, em
390 e 1366 px, sem rolagem do body. O mesmo teste integra o executor oficial de `/hub/`.

## Validação

Antes da integração: `pnpm check` aprovado e 704 testes aprovados com
`pnpm test --maxWorkers=2`. O check do código mesclado também foi aprovado.

- Base integrada: 714 unitários aprovados com dois workers (651 client, 44 domain,
  16 SDK e 3 registry).
- Auditoria de licenças aprovada.
- Build de produção da raiz aprovado.
- Suíte E2E completa da raiz: 267 aprovados e cinco exclusivos de `/hub/` pulados.
- Primeira rodada E2E: cinco casos reprovados pela expectativa antiga de 28 cartões PDF.
  A contagem passou a 29, com verificação adicional de um único cartão Reparar PDF;
  os cinco casos e a suíte completa passaram após a atualização. Geometria e contraste
  continuam verificados. A primeira rodada está preservada em `e2e-root.log`.
- Build de produção com `NEXOHUB_BASE_PATH=/hub/` aprovado.
- Executor oficial de `/hub/`: 156 E2E aprovados, incluindo os dois novos casos de reparo.
  A primeira rodada teve 155 aprovados e uma falha na mesma contagem antiga do catálogo;
  ambas as expectativas desse cenário foram atualizadas para 29, com presença explícita de
  Reparar PDF. Os cinco cenários de subpasta e a suíte oficial completa passaram depois.
  A rodada anterior está preservada em `e2e-hub.log`.

### Evidências finais

Todos os comandos abaixo terminaram com código de saída zero. Caminhos relativos à pasta
local de logs indicada abaixo:

| Gate | Log |
| --- | --- |
| `pnpm check` | `final-check.log` |
| `pnpm test --maxWorkers=2` | `merged-unit.log` |
| `pnpm licenses:check` | `licenses.log` |
| Build da raiz | `build-root.log` |
| E2E completo da raiz, dois workers | `e2e-root-final.log` |
| Build com base `/hub/` | `build-hub.log` |
| E2E oficial de `/hub/`, dois workers | `e2e-hub-final.log` |

Os builds mantêm o aviso existente sobre chunks maiores que 1000 kB. As capturas e métricas
do zoom real estão em `captures-root/` e `captures-hub/`.

Logs locais: `.superpowers/sdd/2026-10-25-consolidacao/` neste worktree.
Esta validação web não homologa o aplicativo Windows instalado nem a publicação em produção.
OCR-C1/DOC-C2 permanece sem implementação nesta rodada.

## Estado de integração

A `main` local em `a5aef3f` foi incorporada na branch das melhorias, preservando o histórico
das duas linhas de trabalho. O checkout principal com PDF→Word não foi promovido nem limpo.
O trabalho consolidado permanece no worktree e na branch indicados acima, sem push ou deploy.
