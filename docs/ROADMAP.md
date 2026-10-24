# Roadmap

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 | Monorepo, client compartilhado, Tauri Windows, Rust, Python/uv, qualidade e CI | Concluída |
| 1 | Design system contemporâneo e Launcher ergonômico com parallax dinâmico | Concluída |
| 2 | Document Core e persistência local com blobs BLAKE3 e SQLite | Concluída |
| 3 | Tool SDK, Registry, Runner e Capability Layer unificados | Concluída |
| 4 | Quick Tools PDF reais (Organizar, Juntar, Dividir, Rotacionar, Comprimir, Marca d'água, Numeração, Imagem↔PDF) | Concluída |
| 5 | Studio sobre o Document Core (árvore documental, âncoras e histórico SQLite) | Concluída |
| 6 | Nexo Layers, NexoFlow e promoção Quick → Studio | Concluída |
| 7 | Texto e revisões UTF-8 imutáveis (Comparador semântico de textos) | Concluída |
| 8 | Overlay PDF | Concluída |
| 9 | OCR (Reconhecimento óptico local integrado à tela dedicada e sidecar nativo) | Concluída |
| 10 | Anchors (localizadores independentes para texto, PDF e OCR) | Concluída |
| 11 | DOCX (Inspeção e criação no sidecar Python; conversão complexa de layout em homologação) | Parcial |
| 12 | Tradução (Tradução multilíngue offline integrada ao Tool Runner) | Concluída |
| 13 | Revisão (Corretor contextual e morfológico integrado com achados estruturados) | Concluída |
| 14 | Receitas NexoFlow (DAG visual, presets e runner topológico integrados) | Concluída |
| 15 | Hardening orientado a falhas, limites de segurança e mitigação de vulnerabilidades | Concluída |
| 16 | Release engineering (Instalador Windows Inno Setup Authenticode, CI multi-job e Deploy Cloud Run contínuo) | Concluída |
| 17 | Recuperação Estrutural de PDF (`pdf-repair` local-first para reconstrução de xref e trailers corrompidos) | Planejada |
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
| 0 | Q-C0: corpus, licenças e critérios de qualidade comercial | [Estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#fase-de-complementação--24102026) | Parcial: aplicado às fatias IM-C1/IM-C2/IM-C3; demais ferramentas/motores pendentes |
| 1 | IM-C1: gestão e inspeção dos lotes nas seis ferramentas de imagem | [PDF e Imagem](superpowers/plans/2026-10-23-unificar-pdf-imagem.md#fase-de-complementação--24102026) | Concluído no website; motores e limites preservados |
| 2 | IM-C2: recorte com alças, zoom e teclado | Mesmo plano de PDF e Imagem | Concluído no website; Cropper.js 2.3.1, exportação e preflight preservados |
| 3 | UX-C1: controles de visualização PDF reutilizáveis | [Estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#fase-de-complementação--24102026) | Planejado; preservar as coordenadas de cada ferramenta |
| 4 | DOC-C1: valores de formulário na prévia e navegação por campo | [Quatro ferramentas](superpowers/plans/2026-10-23-corrigir-quatro-ferramentas.md#fase-de-complementação--24102026) | Planejado; consome UX-C1 |
| 5 | SEC-C1: ocultação com remoção de conteúdo e preservação fora da área | [Estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#fase-de-complementação--24102026) | Prova técnica; não substituir o modo seguro atual antes de homologar |
| 6 | IM-C3: composição de imagem com objetos e histórico | Plano de PDF e Imagem | Prova técnica; consome IM-C1/IM-C2/IM-C3; Fabric.js candidato |
| 7 | ED-C1/ED-C2: compatibilidade e desempenho do editor PDF | [Editar PDF](superpowers/plans/2026-10-23-editar-pdf.md#fase-de-complementação--24102026) | Planejado; não ampliar limites sem medições |
| 8 | CMP-C1: comparação e relatório mais legíveis | [Comparar PDF](superpowers/plans/2026-10-23-comparar-pdf.md#fase-de-complementação--24102026) | Planejado; consome UX-C1, mantém motor atual |
| 9 | OCR-C1/DOC-C2: preparação de digitalizações para OCR | Estabilização / Quatro ferramentas | Prova técnica; um único pré-processador compartilhado |
| 10 | XL-C1/MD-C1: tabelas e ordem de leitura mais controláveis | Estabilização | Planejado para web local; Camelot/Docling condicionados a decisão de runtime |
| 11 | IM-C4: AVIF; DOC-C3: paginação HTML; TR-C1: tradução | Respectivos planos acima | Opcionais/condicionados; TR-C1 deve anteceder qualquer declaração de licença comercial do tradutor |
| 12 | R-C1: avaliar qpdf para Reparar PDF | [Reparar PDF](REPARAR-PDF.md#complementação-do-motor--24102026) | Prova técnica dentro da fase 17 já existente; ferramenta continua planejada |

### Regras comuns de execução e aceite

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

As fases cobrem o aplicativo Windows x64 nativo e o client web moderno compartilhado. Linux, Android, iOS e
demais sistemas nativos estão congelados por prazo indeterminado e não integram este roadmap ativo: não
possuem funcionalidades em desenvolvimento, pipelines de release, critérios de aceite ou compromisso de
entrega. A estrutura preservada no repositório representa apenas possibilidade técnica para decisões futuras
do mantenedor.
