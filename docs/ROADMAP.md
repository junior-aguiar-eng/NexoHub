# Roadmap

Estado em 30/10/2026: Windows **0.2.4 publicado e instalado**, com [validação de release](RELEASE-VALIDATION.md). A lista explícita de nomes integra o tradutor e o cache foi exercitado após reiniciar, inclusive offline no WebView2. Continuam abertos a assinatura Authenticode, a leitura da fotografia privada pelo OCR e a causa dos resets intermitentes no download. As fases “Concluída” abaixo descrevem implementação no escopo entregue, não homologação irrestrita de qualidade.

## Evolução híbrida — implementação autorizada em 30/10/2026

O [plano de nuvem opcional](superpowers/plans/2026-10-30-nuvem-hibrida-300.md) e o [ADR-020](adr/ADR-020-nuvem-opcional-cotas.md) preservam uso local gratuito e sem login. Início com contratos e política desativada, sem provisionamento, publicação ou alteração da versão instalada. Os motores remotos só serão ativados após identidade, ledger persistente, limites, consentimento e homologação. As pendências de OCR/reset/Office anteriores continuam independentes; DOC-C2 permanece fora deste escopo.

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 | Monorepo, client compartilhado, Tauri Windows, Rust, Python/uv, qualidade e CI | Concluída |
| 1 | Design system contemporâneo e Launcher ergonômico com parallax dinâmico | Concluída |
| 2 | Document Core e persistência local com blobs BLAKE3 e SQLite | Concluída |
| 3 | Tool SDK, Registry, Runner e Capability Layer unificados | Concluída |
| 4 | Quick Tools PDF reais (Organizar, Juntar, Dividir, Rotacionar, Comprimir, Marca d'água, Numeração, Imagem↔PDF) | Concluída |
| 5 | Studio sobre o Document Core (árvore documental, âncoras e histórico SQLite) | Concluída |
| 6 | Nexo Layers, NexoFlow e promoção Quick → Studio | Concluída |
| 7 | Texto e revisões UTF-8 imutáveis (Comparador textual) | Concluída |
| 8 | Overlay PDF | Concluída |
| 9 | OCR (Reconhecimento óptico local integrado à tela dedicada e sidecar nativo) | Concluída |
| 10 | Anchors (localizadores independentes para texto, PDF e OCR) | Concluída |
| 11 | DOCX (Inspeção e criação no sidecar Python; conversão complexa de layout em homologação) | Parcial |
| 12 | Tradução (Tradução multilíngue offline integrada ao Tool Runner) | Concluída |
| 13 | Revisão (Corretor contextual e morfológico integrado com achados estruturados) | Concluída |
| 14 | Receitas NexoFlow (DAG visual, presets e runner topológico integrados) | Concluída |
| 15 | Hardening orientado a falhas, limites de segurança e mitigação de vulnerabilidades | Concluída |
| 16 | Release engineering (instalador Windows, CI multi-job e deploy Cloud Run) | Pipeline existente; assinatura Authenticode do instalador ainda pendente |
| 17 | Recuperação Estrutural de PDF (`pdf-repair` local-first para reconstrução de xref e trailers corrompidos) | Motor web usado no desktop; perfis e limites em [R-C1](R-C1-VALIDACAO.md), sem homologação universal |
| 18 | Motor de Documentos Office (ADR e sidecar para conversão fiel bidirecional Word, PowerPoint e Excel) | Planejada |
| 19 | Arquivamento Padronizado PDF/A (Conversão com conformidade ISO 19005-1/2 e validação estrita) | Planejada |
| 20 | PDF Intelligence Local (Resumo documental via modelos neurais estritamente locais em WebGPU/ONNX) | Planejada |

O detalhamento de cada ferramenta e seus requisitos técnicos estão registrados no [Catálogo de Ferramentas](CATALOGO-FERRAMENTAS.md). Cada fase exige seus próprios gates de qualidade, formatação e cobertura de testes. Commit, publicação e release são decisões separadas.

## Complementação das ferramentas atuais — 24/10/2026

Esta é uma fase adicional das entregas existentes, não uma nova trilha ou um novo catálogo.
As fases concluídas acima preservam seu histórico; o estado de cada complemento aparece no índice.
O adendo organiza a implementação autorizada por etapas; não autoriza ampliar plataformas ou
publicar. Dependências novas continuam sujeitas aos gates abaixo. Cada item tem um único plano responsável; este
índice apenas ordena e aponta para ele. Atualizar o checkbox no responsável, sem copiar tarefas
para relatórios de auditoria ou planos novos.

| Ordem | Complemento | Plano responsável | Estado / dependência |
| --- | --- | --- | --- |
| 0 | Q-C0: corpus, licenças e critérios de qualidade comercial | [Estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#q-c0--homologação-antes-de-ampliar-promessas-comerciais) | Fechamento técnico dos 35 perfis restritos: [evidências e limites](quality/Q-C0-FECHAMENTO.md), corpus fotográfico, scanner, auditorias e Windows Sandbox de 4 GB. Instalação opcional separada no ADR-019; fontes do pacote completo na issue #12247; foto privada reprovada no OCR; DOC-C2 excluído |
| 1 | IM-C1: gestão e inspeção dos lotes nas seis ferramentas de imagem | [PDF e Imagem](superpowers/plans/2026-10-23-unificar-pdf-imagem.md#fase-de-complementação--24102026) | Concluído no website; motores e limites preservados |
| 2 | IM-C2: recorte com alças, zoom e teclado | Mesmo plano de PDF e Imagem | Concluído no website; Cropper.js 2.3.1, exportação e preflight preservados |
| 3 | UX-C1: controles de visualização PDF reutilizáveis | [Estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#fase-de-complementação--24102026) | Concluído no website; oito mesas, zoom e navegação independentes da exportação |
| 4 | DOC-C1: valores de formulário na prévia e navegação por campo | [Quatro ferramentas](superpowers/plans/2026-10-23-corrigir-quatro-ferramentas.md#fase-de-complementação--24102026) | Concluído no website; revisão atual, snapshot validado e navegação por campo |
| 5 | SEC-C1: ocultação com remoção de conteúdo e preservação fora da área | [Estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#fase-de-complementação--24102026) | Concluído no website para perfil restrito; modo imagem padrão, revisão aplicada e recusas explícitas |
| 6 | IM-C3: composição de imagem com objetos e histórico | Plano de PDF e Imagem | Concluído no website; modo avançado na marca d’água, Fabric.js 7.4.0 e renderizador compartilhado |
| 7 | ED-C1/ED-C2: compatibilidade e desempenho do editor PDF | [Editar PDF](superpowers/plans/2026-10-23-editar-pdf.md#fase-de-complementação--24102026) | Concluídos no website: corpus, recusas, render por página e orçamentos; limites mantidos |
| 8 | CMP-C1: comparação e relatório mais legíveis | [Comparar PDF](superpowers/plans/2026-10-23-comparar-pdf.md#fase-de-complementação--24102026) | Concluído no website: corpus, navegação, fonte TTF incorporada e prévias sob demanda; motor mantido |
| 9 | OCR-C1: OCR medido e preparação de digitalizações | [Estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#ocr-c1--ocr-medido-e-preparação-compartilhada-com-o-scanner) | Entrega local: corpus, cancelamento e PDF misto; candidato OpenCV reprovado para integração. DOC-C2 não iniciado, fora do escopo desta entrega |
| 10 | XL-C1/MD-C1: tabelas e ordem de leitura mais controláveis | [XL-C1](XL-C1.md), [MD-C1](MD-C1.md) e Estabilização | XL-C1 entregue localmente; MD-C1 entregue localmente: leitura revisável, tabelas, relatório por página e OCR explícito. Comparação Camelot/Docling concluída isoladamente; integração condicionada a decisão de runtime |
| 11 | IM-C4: qualidade de exportação e AVIF; DOC-C3: paginação HTML; TR-C1: tradução | Respectivos planos acima | Qualidade de exportação IM-C4 entregue; [AVIF avaliado isoladamente](IM-C4-AVIF.md), integração condicionada; [DOC-C3](DOC-C3.md) entregue localmente com paginação e cabeçalhos; TR-C1 deve anteceder qualquer declaração de licença comercial do tradutor |
| 12 | R-C1: avaliar qpdf para Reparar PDF | [Reparar PDF](REPARAR-PDF.md#complementação-do-motor--24102026) | Entrega local validada: qpdf avaliado sem integração, regex removida, worker cancelável e saída verificada; limites em [R-C1](R-C1-VALIDACAO.md). Teste no Windows não implica recuperação de todo PDF danificado |
| 13 | DOC-C4: preservar campos ao remover/extrair páginas e medir grade grande | [Quatro ferramentas](superpowers/plans/2026-10-23-corrigir-quatro-ferramentas.md#doc-c4--remover-e-extrair-páginas-preservação-e-uso-em-documentos-grandes) | [Entrega local validada](DOC-C4.md): campos e geometria em PDF/ZIP, fila cancelável e ensaio de 500 páginas; grade mantida sem virtualização. DOC-C2 fora do escopo |

### Regras comuns de execução e aceite

**Proposta transversal de interface (24/10/2026):** o usuário solicitou definir, em etapa
separada, um padrão comum de mesas que ocupe a janela, com documento em rolagem interna e
ferramentas/ação principal sempre visíveis. A [proposta de design](superpowers/specs/2026-10-24-padrao-mesas-ferramentas-design.md)
e sua simulação tiveram a direção visual confirmada em 25/10/2026. A migração foi implementada
localmente conforme o [plano das mesas](superpowers/plans/2026-10-25-refatorar-mesas.md),
com a tarefa 4 concluída no website local: check, 704 unitários com dois workers, builds raiz e
`/hub/`, 264 E2E na raiz e 154 na subpasta, além de zoom real a 200% e revisão independente.
Homologação nativa Windows e publicação permanecem separadas; a migração não foi publicada. Todos os recursos atuais
continuam gratuitos; um futuro editor avançado pago é uma hipótese comercial em avaliação.
Essa proposta não muda o escopo das complementações funcionais abaixo.

**Consolidação local (25/10/2026):** as melhorias e as mesas foram integradas com a `main`
em `a5aef3f`, preservando Reparar PDF. A base web integrada passou em 714 unitários com dois
workers, 267 E2E na raiz (cinco exclusivos da subpasta pulados) e 156 em `/hub/`, além de
check, builds e licenças. [Registro da integração](INTEGRACAO-FERRAMENTAS-MESAS-2026-10-25.md).
O checkout principal com alterações locais de PDF→Word foi preservado; não houve publicação.
OCR-C1/DOC-C2 continua sendo o próximo complemento, sem implementação nesta consolidação.

**Adequação de Reparar PDF (25/10/2026):** antes de retomar OCR-C1/DOC-C2, o usuário autorizou
aplicar o padrão de mesas também a Reparar PDF e reconciliar seu [plano próprio](REPARAR-PDF.md#padronização-da-mesa--25102026).
A adequação foi concluída no website local: frame compartilhado, ações sem duplicação, pt-BR,
diagnóstico e prévia original identificados. Check, 718 unitários com dois workers, builds,
281 E2E na raiz (cinco exclusivos da subpasta pulados) e 170 em `/hub/` foram aprovados.
A avaliação de qpdf, o worker cancelável e a ampliação do corpus continuam no R-C1, sem alteração
do motor nesta adequação.

- **Uma tarefa por vez:** reprovar o cenário antes da correção, implementar, validar o resultado
  exportado e registrar evidências no plano responsável antes de marcar concluído.
- **Base:** as correções F01–F09 estão no commit `43f9c1a`; não são pendências a reimplementar.
  A auditoria de UX é evidência histórica, não outro backlog de execução.
- **Plataforma:** esta complementação é web local, React 19.2.8 e Vite, usando os ports,
  Tool Registry e executores atuais. Cloud Run hospedar o website não autoriza enviar documentos.
  Python, Node, serviço remoto ou nova distribuição desktop exigem decisão específica; ADR-015
  não dispensa revisar a promessa de privacidade da ferramenta afetada.
- **Dependências:** versões publicadas fixas, licença do pacote e componentes incorporados,
  manutenção, advisories e custo de JS/WASM/modelos conferidos conforme ADR-008. Não instalar
  Fabric e Konva juntos, nem Cropper.js e react-easy-crop juntos. Não adotar beta por ser `latest`.
- **Interface:** pt-BR via i18n, mesma geometria/temas, 44px nos controles, foco visível e teclado.
  Capturas com arquivos carregados em 390/768/1024/1440px, tema escuro e movimento reduzido.
- **Integridade:** original imutável; download corresponde à revisão mostrada; cancelar, trocar
  arquivo ou sair libera workers, Canvas e URLs e impede resultados atrasados.
- **Verificação por entrega:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:web`,
  `pnpm test:e2e:ci`; repetir build com `NEXOHUB_BASE_PATH=/hub/` e
  `pnpm --filter @nexohub/client exec node e2e/executar-subpasta.mjs`. Havendo dependências novas,
  executar `pnpm audit --prod` e `pnpm licenses:check`, declarando gates indisponíveis.
- **Conclusão:** registrar tamanhos de recursos, tempos frio/quente, dispositivo e limitações;
  revisão final antes de publicação. Funcionar em um PDF sintético não certifica equivalência
  com iLovePDF/Smallpdf. Commit, push e deploy somente quando solicitados.

## Escopo de plataforma

**OCR-C1 (26/10/2026):** resultado e limites em [OCR-C1](OCR-C1.md). O adaptador compartilhado
continua condicionado a ganho demonstrado; o candidato avaliado não foi integrado. DOC-C2
permanece no plano de Quatro ferramentas, sem implementação. Alterações locais no worktree
`nexohub-editor-compatibilidade`; commit local autorizado em 26/10/2026, sem integração na principal,
push ou deploy.

As fases cobrem o aplicativo Windows x64 nativo e o client web moderno compartilhado. Linux, Android, iOS e
demais sistemas nativos estão congelados por prazo indeterminado e não integram este roadmap ativo: não
possuem funcionalidades em desenvolvimento, pipelines de release, critérios de aceite ou compromisso de
entrega. A estrutura preservada no repositório representa apenas possibilidade técnica para decisões futuras
do mantenedor.
