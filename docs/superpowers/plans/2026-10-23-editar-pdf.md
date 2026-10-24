# Editar PDF — plano de implementação

**Goal:** editor web local com elementos novos e substituição real de texto existente.
**Architecture:** adapter PDFium em worker reconstrói revisões a partir do original e comandos;
React apresenta a revisão renderizada pelo mesmo motor que exporta.
**Tech Stack:** TypeScript, React, PDFium WASM; PDF.js/pdf-lib para verificação independente.
**Spec:** ../specs/2026-10-23-editar-pdf-design.md (aprovada com “pode começar”).

## Restrições globais

Website; originais imutáveis; assets locais; pt-BR; sem commit, push ou deploy.
Sem cobertura branca simulando substituição, sem rasterizar o PDF inteiro na exportação.
Dependência fixa, licenças e binários auditados. Casos inseguros recusados explicitamente.
Execução nativa nesta sessão; revisão independente final. Branch de trabalho existente `work`.

## Foco de revisão

Fontes incorporadas/subconjuntos e glifos ausentes: validar ou exigir substituição explícita.
CropBox e rotações: coordenadas da seleção e exportação devem coincidir.
Texto maior que a caixa ou vizinhos: recusar sobreposição detectável.
Troca de documento ou cancelamento: nenhuma resposta antiga altera a sessão nova.
Histórico misto e falha ao salvar: preservar revisão e permitir recuperação.

## Tarefa 1 — motor e prova técnica

Arquivos: `platform/pdf-editor-types.ts`, `pdf-editor-engine.ts`, `pdf-editor-engine.test.ts`.
Interface: `editPdf(bytes, commands): Promise<Uint8Array>`; `inspect/render` em sessão PDFium.
- [x] Instalar versão fixa, inspecionar APIs/licenças e medir assets.
- [x] Testes RED com PDFs reais: substituição/extração, acentos, fontes, rotação/crop, não editados.
- [x] Implementar operações tipadas, limites e limpeza; executar testes GREEN e prova no navegador.

## Tarefa 2 — sessão e histórico

Arquivos: `pdf-editor-client.ts`, `pdf-editor.worker.ts`, `pdf-editor-state.ts` e testes.
Interface: sessão worker recebe original e comandos; retorna revisão com páginas, texto e prévia.
- [x] Testes RED de undo/redo misto, descarte de respostas antigas, falha/cancelamento.
- [x] Implementar comunicação cancelável, snapshots de comandos, render e exportação.
- [x] Verificar testes GREEN; nunca retornar bytes de uma revisão diferente da exibida.

## Tarefa 3 — área de trabalho e integração

Arquivos: `features/launcher/PdfEditorPanel.tsx`, `.css`, `.test.tsx`; registry, rotas, executor,
capabilities web, data, i18n e contagens de catálogo.
- [x] Testes RED de seleção/edição, elementos novos, propriedades, histórico e exportação.
- [x] Implementar miniaturas, canvas central, barra de ferramentas e propriedades contextuais;
  mover/redimensionar/duplicar/excluir/ordenar, texto/imagem/formas/desenho, teclado e responsivo.
- [x] Integrar `pdf-edit` e `/editar-pdf`; executar testes GREEN sem habilitar desktop.

## Tarefa 4 — verificação e revisão

Arquivos: `e2e/pdf-editor.spec.ts`, `docs/EDITAR-PDF-WEB.md`, inventário de licenças.
- [x] E2E real: upload, alteração de texto original e novo, undo/redo, download e extração.
- [x] Verificar quatro larguras, foco, limites, senha, erros e recuperação.
- [x] Executar lint/tipagem, testes, E2E, build e licenças; revisar diff de forma independente.
- [x] Corrigir achados com testes, documentar limites e atualizar as entregas deste plano.

## Registro de execução

Decisão: trabalhar na branch `work` já usada nesta conversa, preservando o diretório compartilhado.
Não criar commits intermediários: a autorização atual é para implementar, não commitar.

## Resultado e evidências

- Instalação: `@embedpdf/pdfium@2.15.1`; WASM local 4,65 MB (2,16 MB gzip no build).
- `pnpm test`: 508 testes aprovados, incluindo 447 no client e 61 nos pacotes.
- E2E Chromium: 86 aprovados no build final, incluindo sete cenários do editor.
- Lint/tipagem, build web, inventário de licenças e `git diff --check` aprovados.
- Quatro capturas conferidas, sem overflow; botões principais com contraste mínimo 4,76:1.
- Revisão independente encontrou cinco problemas, corrigidos com regressões:
  glifos, navegação sem confirmação, quantização de coordenadas, transparência e miniaturas.
- Fontes não padrão usam repertório observado, com fallback explícito e verificação independente
  dos bytes exportados. Recriação de objetos transparentes/com recorte especial é recusada.
- Nenhum achado importante permaneceu aberto. Alterações mantidas no checkout `work`, sem commit,
  push ou deploy. Limites finais em `docs/EDITAR-PDF-WEB.md`.

## Fase de complementação — 24/10/2026

**Estado:** planejada; preserva as quatro tarefas concluídas. Consome Q-C0 e os
[gates comuns](../../ROADMAP.md#regras-comuns-de-execução-e-aceite). Não trocar o motor atual por
um editor visual de imagens: Fabric/Konva não editam o texto existente no conteúdo de um PDF.

### ED-C1 — Compatibilidade textual demonstrada

**Modificar:** `apps/client/src/platform/pdf-editor-engine.ts`, `pdf-editor-types.ts`,
`pdf-editor-verify.ts` e testes; `features/launcher/PdfEditorPanel.tsx` e teste próximo.
**Fixtures:** `platform/__fixtures__/pdf-editor/`; documento técnico `docs/EDITAR-PDF-WEB.md`.

- [ ] Expandir o corpus com fontes incorporadas completas/subconjuntos, ligaduras, acentos,
  transparência, texto transformado, múltiplas colunas e formulários; registrar por classe
  edição suportada ou recusa. Conferir visualmente e por extração independente a saída.
- [ ] Mostrar o motivo de incompatibilidade antes de editar e oferecer troca explícita de
  fonte quando segura. Não usar largura de glifo como prova de suporte nem cobertura branca.
- [ ] Melhorar seleção de objetos e propriedades sem introduzir sobreposição ou reflow
  implícito; texto maior que a caixa continua recusado até existir prova específica de reflow.
- [ ] Verificar original, regiões não editadas e campos após substituições, exclusão e histórico.
  Homologar qualquer expansão do repertório antes de remover restrições do documento técnico.

### ED-C2 — Documentos maiores com orçamento de recursos

**Modificar:** `pdf-editor-engine.ts`, `pdf-editor-client.ts`, `pdf-editor.worker.ts`,
`pdf-editor-state.ts`, `PdfEditorPanel.tsx`/CSS e `e2e/pdf-editor.spec.ts`.

- [ ] Medir parsing, render e histórico próximos aos limites atuais de 20 MiB/30 páginas/3.000
  objetos. Testar página ativa, navegação rápida, cancelamento e saída durante renderização.
- [ ] Implementar renderização/cache sob demanda onde a medição indicar custo, mantendo uma
  revisão canônica e histórico de comandos. Reaproveitar UX-C1 só onde compatível com o editor.
- [ ] Aumentar limites somente depois de comprovar memória, tempo e responsividade em máquina
  modesta. Limites de elementos e exportação continuam explícitos; falha preserva última revisão.
- [ ] Validar preview/download/undo/redo da mesma revisão e fontes locais em `/hub/`.

**Dependências:** manter `@embedpdf/pdfium@2.15.1` enquanto atender ao corpus; avaliar atualização
seletiva da linha estável v2, inventariando WASM e licenças. Não migrar para v3 em desenvolvimento,
nem instalar CloudPDF/server. OCR com reconstrução e edição universal de parágrafos continuam
fora desta complementação até demonstração de viabilidade e escopo próprios.
