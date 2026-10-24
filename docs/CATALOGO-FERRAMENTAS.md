# Catálogo Canônico de Ferramentas — NexoHub

Este documento é a fonte de verdade para o inventário, status funcional, plataformas atendidas, executores e limitações operacionais de todas as ferramentas do NexoHub.

Data da última auditoria canônica: 23/10/2026.

---

## 1. Visão Geral do Inventário

- **Total mapeado no ecossistema:** 42 ferramentas
- **Implementadas e operacionais:** 34 ferramentas (28 PDF/Texto + 6 Imagem)
- **Parciais / Em homologação técnica:** 1 ferramenta (DOCX via sidecar na Fase 11)
- **Planejadas / Pendentes de ADR ou implementação:** 8 ferramentas

---

## 2. Matriz Completa de Ferramentas

| ID | Nome | Categoria | Status | Plataformas | Executor | Limitações Conhecidas & Observações |
|---|---|---|---|---|---|---|
| `pdf-organize` | Organizar PDF | Organizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Reordena, gira e remove páginas. Produz novo artifact imutável. |
| `pdf-merge` | Juntar PDF | Organizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Concatena múltiplos PDFs com validação prévia de integridade. |
| `pdf-split` | Dividir PDF | Organizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Modos por página e por intervalo; exporta PDF único ou ZIP. |
| `pdf-remove-pages` | Remover Páginas | Organizar | Implementada | Web, Desktop, HTTP | browser | Remove páginas específicas mantendo a integridade do restante. |
| `pdf-extract-pages` | Extrair Páginas | Organizar | Implementada | Web, Desktop, HTTP | browser | Exporta páginas escolhidas para novo PDF ou pacote ZIP. |
| `pdf-rotate` | Rotacionar PDF | Editar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Rotação em ângulos retos (90°, 180°, 270°). |
| `pdf-crop` | Recortar PDF | Editar | Implementada | Web, Desktop, HTTP | browser | Ajusta CropBox visual. Não elimina irreversivelmente dados externos. |
| `pdf-edit` | Editar PDF | Editar | Implementada | Web, Desktop, HTTP | browser | Edição tipográfica pontual e substituição de textos em sandbox. |
| `pdf-page-numbers` | Inserir Números de Página | Editar | Implementada | Web, Desktop, HTTP | browser | Posições em cabeçalho/rodapé, múltiplos formatos e controle de início. |
| `pdf-watermark` | Inserir Marca d'água | Editar | Implementada | Web, Desktop, HTTP | browser | Carimbo textual com controle de cor, opacidade e rotação. |
| `pdf-form-fill` | Preencher Formulário PDF | Editar | Implementada | Web, Desktop, HTTP | browser | Suporta AcroForm (texto, check, radio, select). Não suporta XFA. |
| `pdf-sign` | Assinar PDF | Segurança | Implementada | Web, Desktop, HTTP | browser | Rubrica visual (desenho/texto/imagem). Não substitui certificado digital ICP-Brasil. |
| `pdf-protect` | Proteger PDF | Segurança | Implementada | Web, Desktop, HTTP | browser | Criptografia com senha de abertura e permissões granulares. |
| `pdf-unlock` | Desbloquear PDF | Segurança | Implementada | Web, Desktop, HTTP | browser | Descriptografa RC4/AES conhecendo a senha do proprietário. |
| `pdf-redact` | Ocultar PDF (Tarja) | Segurança | Implementada | Web, Desktop, HTTP | browser | Aplica tarjas opacas nas coordenadas solicitadas. |
| `pdf-compare` | Comparar PDF | Segurança | Implementada | Web, Desktop, HTTP | browser | Análise estrutural/visual entre duas versões com relatório gerado. |
| `pdf-compress` | Comprimir PDF | Otimizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Perfis de compressão estrutural e reencodagem de imagens. Rejeita PDFs assinados. |
| `pdf-ocr` | OCR em PDF | Otimizar / Texto | Implementada | Web, Desktop, HTTP | browser (fallback native) | Reconhecimento óptico local. Gera texto e PDF pesquisável. |
| `images-to-pdf` | Imagem para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Suporta JPG, PNG e WebP com orientação e margens. |
| `html-to-pdf` | HTML para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Converte títulos, parágrafos, listas e tabelas em layout próprio. Não preserva o layout CSS original nem executa scripts ou carrega recursos externos. |
| `scan-to-pdf` | Digitalizar para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Captura de câmera ou scanner local compilada em PDF. |
| `pdf-to-jpg` | PDF para JPG | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Exporta páginas em 150 DPI empacotadas em arquivo ZIP ou imagem única. |
| `pdf-to-excel` | PDF para Excel | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Extração tabular para OpenXML (.xlsx) ou CSV. Heurística posicional. |
| `pdf-extract-images` | Extrair Imagens | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Extrai objetos de imagem (XObject) nos formatos JPEG ou PNG nativos. |
| `pdf-to-markdown` | PDF para Markdown | PDF Intelligence | Implementada | Web, Desktop, HTTP | browser | Extrai texto formatado, listas e tabelas tabulares heurísticas. |
| `text-translate` | Traduzir Texto/Documento | PDF Intelligence | Implementada | Web, Desktop, HTTP | browser (fallback native) | Tradução neural offline (Transformers.js/Bergamot). Saída estrita em text/plain. |
| `text-compare` | Comparar Textos | Texto | Implementada | Web, Desktop, HTTP | browser | Diff semântico e estrutural de textos com estatísticas. |
| `text-review` | Revisar Texto | Texto | Implementada | Web, Desktop, HTTP | browser (fallback native) | Correção ortográfica e gramatical via LanguageTool/Hunspell offline. |
| `image-compress` | Comprimir Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Otimização de imagens JPG, PNG e WebP no navegador. |
| `image-resize` | Redimensionar Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Redimensionamento proporcional ou por pixels exatos. |
| `image-crop` | Recortar Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Corte retangular com coordenadas visuais. |
| `image-convert` | Converter Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Conversão de formatos entre JPG, PNG e WebP. |
| `image-rotate` | Girar Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Rotações de 90°, 180°, 270° e espelhamento horizontal/vertical. |
| `image-watermark` | Marca d'água em Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Inserção de marca d'água textual ou de logotipo sobre imagem. |

---

## 3. Ferramentas Pendentes e Planejadas

As ferramentas abaixo compõem o catálogo visual planejado ou dependem de decisões arquiteturais explícitas (ADR) antes de iniciarem implementação de código:

| Ferramenta | Identificador Previsto | Categoria | Dependência Arquitetural / Bloqueio |
|---|---|---|---|
| **Reparar PDF** | `pdf-repair` | Otimizar | Especificação dos tipos de corrupção tratáveis (xref reconstruído, streams truncados, trailer ausente) com biblioteca local (`pdf-lib` / `qpdf`). |
| **Word para PDF** | `word-to-pdf` | Converter em PDF | ADR de Motor Office: conversão de DOC/DOCX preservando layout completo. Requer sidecar com motor de renderização (ex: LibreOffice / headless unoconv). |
| **PDF para Word** | `pdf-to-word` | Converter de PDF | ADR de Motor Office: reconstrução de parágrafos, fluxos de texto e tabelas em DOCX. |
| **PowerPoint para PDF** | `powerpoint-to-pdf` | Converter em PDF | Dependente do mesmo ADR de Motor Office (LibreOffice). |
| **Excel para PDF** | `excel-to-pdf` | Converter em PDF | Dependente do mesmo ADR de Motor Office (LibreOffice). |
| **PDF para PowerPoint** | `pdf-to-powerpoint` | Converter de PDF | Dependente do mesmo ADR de Motor Office (LibreOffice). |
| **PDF para PDF/A** | `pdf-to-pdfa` | Converter de PDF | Especificação e motor para conformance ISO 19005 (PDF/A-1b, PDF/A-2b), embutimento obrigatório de fontes e perfis de cor ICC. |
| **Resumir com IA** | `pdf-summarize` | PDF Intelligence | ADR de IA Local vs. Privacidade: obrigatoriedade de modelo local (ONNX / WebLLM) para cumprir a regra de processamento 100% offline no dispositivo sem upload externo. |

---

## 4. Política de Disponibilidade e Plataformas

1. **Fonte Única:** A disponibilidade ativa é governada por `@/platform/tool-availability.ts`, derivado diretamente de `coreToolRegistry`.
2. **Paridade Funcional:** O client desktop (Tauri) e o website (Browser/PWA) compartilham o mesmo catálogo de 34 ferramentas ativas. Nenhuma ferramenta é exibida com selo "Em breve" ou sem executor associado.
3. **Privacidade e Local-First:** Toda operação de transformação executa localmente. Nenhum documento é transmitido para servidores remotos.

## 5. Complementação das ferramentas atuais

Índice dos planos responsáveis, adicionado em 24/10/2026. O estado de cada complemento consta
no roadmap e no responsável; IM-C1–IM-C3, a qualidade de exportação do IM-C4 e os controles PDF do UX-C1 e a prévia de formulários do DOC-C1 foram entregues no website; AVIF segue condicionado. Os complementos não alteram a
contagem de 34 ferramentas nem indicam homologação adicional de desktop/HTTP.
Ordem e critérios comuns: [roadmap](ROADMAP.md#complementação-das-ferramentas-atuais--24102026).
O checklist vive apenas no plano responsável, não nesta matriz.

| Ferramentas / capacidade | Plano responsável e complementos |
| --- | --- |
| As seis ferramentas `image-*` | [PDF/Imagem](superpowers/plans/2026-10-23-unificar-pdf-imagem.md#fase-de-complementação--24102026): IM-C1 lotes, IM-C2 recorte, IM-C3 composição, IM-C4 exportação |
| Mesas PDF e acessibilidade transversal | [Estabilização](superpowers/plans/2026-09-24-estabilizacao-ferramentas-atuais.md#fase-de-complementação--24102026): Q-C0 corpus/licenças, UX-C1 visualização |
| `pdf-redact`, `pdf-protect`, `pdf-unlock` | Mesmo plano de estabilização: SEC-C1 remoção real e regressões de segurança |
| `pdf-ocr`, `pdf-to-excel`, `pdf-to-markdown`, `text-translate` | Mesmo plano de estabilização: OCR-C1, XL-C1, MD-C1 e TR-C1 |
| `pdf-form-fill`, `scan-to-pdf`, `html-to-pdf`, `pdf-remove-pages`, `pdf-extract-pages` | [Quatro ferramentas](superpowers/plans/2026-10-23-corrigir-quatro-ferramentas.md#fase-de-complementação--24102026): DOC-C1 a DOC-C4 |
| `pdf-edit` | [Editar PDF](superpowers/plans/2026-10-23-editar-pdf.md#fase-de-complementação--24102026): ED-C1 compatibilidade, ED-C2 desempenho |
| `pdf-compare` | [Comparar PDF](superpowers/plans/2026-10-23-comparar-pdf.md#fase-de-complementação--24102026): CMP-C1 navegação/relatório |
| `pdf-repair` (continua planejada) | [Especificação existente](REPARAR-PDF.md#complementação-do-motor--24102026): R-C1 prova do motor |

Ferramentas sem complemento específico mantêm seu contrato atual e a regressão em Q-C0;
não ganham nova promessa funcional por associação ao grupo.
