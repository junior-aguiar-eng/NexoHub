# Catálogo Canônico de Ferramentas — NexoHub

Este documento é a fonte de verdade para o inventário, status funcional, plataformas atendidas, executores e limitações operacionais de todas as ferramentas do NexoHub.

Inventário-base de 23/10/2026, reconciliado documentalmente em 16/11/2026 com os agrupamentos da interface, o `coreToolRegistry` (`42` ferramentas) e a versão `0.2.6`. Esta revisão não amplia a homologação universal além dos perfis restritos documentados.

---

## 1. Visão Geral do Inventário

- **Total mapeado no ecossistema:** 42 ferramentas
- **Implementadas e operacionais (`coreToolManifests`):** 42 ferramentas (36 PDF/Texto + 6 Imagem), distribuídas por superfície conforme `apps/client/src/platform/tool-availability.ts`:
  - **38 ferramentas** no navegador 100% offline (`universalBrowserToolIds`)
  - **41 ferramentas** na superfície Web com backend HTTP / Nuvem Híbrida (`httpSupportedToolIds`, incluindo `word-to-pdf`, `excel-to-pdf` e `powerpoint-to-pdf`)
  - **42 ferramentas** no aplicativo Windows Desktop (`tauriSupportedToolIds`, incluindo toda a suíte Office e `pdf-to-powerpoint` via Superpoder `office.suite`)
- **Planejadas / Pendentes de ADR (`plannedToolManifests`):** 0 ferramentas

---

O total implementado não significa homologação universal: o índice [Q-C0](quality/README.md) mantém **41 perfis restritos** em **28 grupos de corpus**, mantendo `pdf-to-word` como única exclusão explícita (`DOC-C2`). A [validação da release](RELEASE-VALIDATION.md) registra os fluxos instalados exercitados. As superfícies compartilham o catálogo; não se presume um endpoint remoto correspondente a cada operação browser.

## 2. Matriz Completa de Ferramentas

| ID | Nome | Categoria | Status | Plataformas | Executor | Limitações Conhecidas & Observações |
|---|---|---|---|---|---|---|
| `pdf-organize` | Organizar PDF | Organizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Reordena, gira e remove páginas. Produz novo artifact imutável. |
| `pdf-merge` | Juntar PDF | Organizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Concatena múltiplos PDFs com validação prévia de integridade. |
| `pdf-split` | Dividir PDF | Organizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Modos por página e por intervalo; exporta PDF único ou ZIP. |
| `pdf-remove-pages` | Remover Páginas | Organizar | Implementada | Web, Desktop, HTTP | browser | Remove páginas específicas mantendo a integridade do restante. |
| `pdf-extract-pages` | Extrair Páginas | Organizar | Implementada | Web, Desktop, HTTP | browser | Exporta páginas escolhidas para novo PDF ou pacote ZIP. |
| `pdf-rotate` | Rotacionar PDF | Organizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Rotação em ângulos retos (90°, 180°, 270°). |
| `pdf-crop` | Recortar PDF | Organizar | Implementada | Web, Desktop, HTTP | browser | Ajusta CropBox visual. Não elimina irreversivelmente dados externos. |
| `pdf-edit` | Editar PDF | Editar | Implementada | Web, Desktop, HTTP | browser | Edição inline de blocos de texto no palco, elementos adicionais e substituição em sandbox. |
| `pdf-page-numbers` | Inserir Números de Página | Organizar | Implementada | Web, Desktop, HTTP | browser | Cabeçalho/rodapé, controle de início e presets forenses (`Fls. X de Y`, `Fls. X (PJe / Tribunais)`). |
| `pdf-watermark` | Inserir Marca d'água | Segurança | Implementada | Web, Desktop, HTTP | browser | Carimbo textual com controle de cor, opacidade e rotação. |
| `pdf-form-fill` | Preencher Formulário PDF | Editar | Implementada | Web, Desktop, HTTP | browser | Suporta AcroForm (texto, check, radio, select). Não suporta XFA. |
| `pdf-sign` | Assinar PDF | Segurança | Implementada | Web, Desktop, HTTP | browser | Rubrica visual (desenho/texto/imagem). Não substitui certificado digital ICP-Brasil. |
| `pdf-protect` | Proteger PDF | Segurança | Implementada | Web, Desktop, HTTP | browser | Criptografia com senha de abertura e permissões granulares. |
| `pdf-unlock` | Desbloquear PDF | Segurança | Implementada | Web, Desktop, HTTP | browser | Descriptografa RC4/AES conhecendo a senha do proprietário. |
| `pdf-redact` | Ocultar PDF (Tarja) | Segurança | Implementada | Web, Desktop, HTTP | browser | Modo imagem padrão; preservação opcional para PDFs simples, com remoção nativa, recusas explícitas e revisão do arquivo gerado. |
| `pdf-compare` | Comparar PDF | Editar | Implementada | Web, Desktop, HTTP | browser | Análise estrutural/visual entre duas versões com relatório gerado. |
| `pdf-compress` | Comprimir PDF | Otimizar | Implementada | Web, Desktop, HTTP | native (fallback browser) | Perfis de compressão estrutural e reencodagem de imagens. Rejeita PDFs assinados. |
| `pdf-repair` | Reparar PDF | Otimizar | Implementada | Web, Desktop, HTTP | browser | Resserializa o grafo reconhecido e verifica a saída; recusa estruturas ambíguas, assinaturas e dados irrecuperáveis. Não faz recuperação parcial página a página. Ver R-C1. |
| `pdf-ocr` | OCR em PDF | Texto e OCR | Implementada | Web, Desktop, HTTP | browser (fallback native) | Reconhecimento óptico local. Gera texto e PDF pesquisável. |
| `images-to-pdf` | Imagem para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Suporta JPG, PNG e WebP com orientação e margens. |
| `html-to-pdf` | HTML para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Converte títulos, parágrafos, listas e tabelas em layout próprio. Não preserva o layout CSS original nem executa scripts ou carrega recursos externos. |
| `scan-to-pdf` | Digitalizar para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Captura da câmera ou importação de imagens locais para PDF. Não declara integração direta com hardware de scanner. |
| `pdf-to-jpg` | PDF para JPG | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Exporta páginas em 150 DPI empacotadas em arquivo ZIP ou imagem única. |
| `pdf-to-excel` | PDF para Excel | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Extração tabular para OpenXML (.xlsx) ou CSV. Heurística posicional. |
| `pdf-to-word` | PDF para Word | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Extração semântica de parágrafos, estilos (negrito/itálico) e quebras de página nativas em DOCX. |
| `pdf-extract-images` | Extrair Imagens | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Extrai objetos de imagem (XObject) nos formatos JPEG ou PNG nativos. |
| `pdf-to-markdown` | PDF para Markdown | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Extrai texto formatado, listas e tabelas tabulares heurísticas. |
| `text-translate` | Traduzir Texto/Documento | Texto e OCR | Implementada | Web, Desktop, HTTP | browser; nativo separado | Tela atual: M2M100 q8 em worker para pt/en/es, com download inicial e cache. Lista explícita preserva nomes; saída text/plain. CTranslate2 nativo é outro caminho. |
| `text-compare` | Comparar Textos | Texto e OCR | Implementada | Web, Desktop, HTTP | browser | Diff textual com estatísticas de adições e remoções; não classifica equivalência de significado. |
| `text-review` | Revisar Texto | Texto e OCR | Implementada | Web, Desktop, HTTP | browser (fallback native) | Hunspell/regras locais no navegador; LanguageTool/Java opcionais no Windows. As capacidades diferem entre os motores. |
| `image-compress` | Comprimir Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Otimização de imagens JPG, PNG e WebP no navegador. |
| `image-resize` | Redimensionar Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Redimensionamento proporcional ou por pixels exatos. |
| `image-crop` | Recortar Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Corte retangular com coordenadas visuais. |
| `image-convert` | Converter Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Conversão de formatos entre JPG, PNG e WebP. |
| `image-rotate` | Girar Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Rotações de 90°, 180°, 270° e espelhamento horizontal/vertical. |
| `image-watermark` | Marca d'água em Imagem | Imagem | Implementada | Web, Desktop, HTTP | browser | Inserção de marca d'água textual ou de logotipo sobre imagem. |
| `pdf-to-pdfa` | PDF para PDF/A | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Conversão e validação ISO 19005 (`PDF/A-1b` e `PDF/A-2b`) com perfil ICC sRGB embutido, metadados XMP e recusa de PDFs criptografados/assinados sem autorização explícita. Ver [PDFA-C1](quality/PDFA-C1.md). |
| `word-to-pdf` | Word para PDF | Converter em PDF | Implementada | Desktop, HTTP (Híbrido) | native (`office.suite` / híbrido) | Converte DOCX, DOC, ODT e RTF preservando layout via LibreOffice headless isolado no Desktop (Superpoder `office.suite`) ou rota híbrida. Limite de entrada de 128 MB (perfil restrito Q-C0 de 64 MB). Ver [OFFICE-C1](quality/OFFICE-C1.md). |
| `excel-to-pdf` | Excel para PDF | Converter em PDF | Implementada | Desktop, HTTP (Híbrido) | native (`office.suite` / híbrido) | Converte XLSX, XLS e ODS para PDF via Superpoder `office.suite` no Desktop ou rota híbrida. Limite de entrada de 128 MB (perfil restrito Q-C0 de 64 MB). Ver [OFFICE-C1](quality/OFFICE-C1.md). |
| `powerpoint-to-pdf` | PowerPoint para PDF | Converter em PDF | Implementada | Desktop, HTTP (Híbrido) | native (`office.suite` / híbrido) | Converte PPTX, PPT e ODP para PDF via Superpoder `office.suite` no Desktop ou rota híbrida. Limite de entrada de 128 MB (perfil restrito Q-C0 de 64 MB). Ver [OFFICE-C1](quality/OFFICE-C1.md). |
| `pdf-to-powerpoint` | PDF para PowerPoint | Converter de PDF | Implementada | Desktop | native (`office.suite`) | Exclusivo do NexoHub Desktop com Superpoder `office.suite` instalado; exporta `.pptx`. Recusa explícita no navegador offline e Web Híbrida. Limite de entrada de 128 MB. Ver [OFFICE-C1](quality/OFFICE-C1.md). |
| `pdf-summarize` | Resumir PDF com IA | Texto e OCR | Implementada | Web, Desktop, HTTP | browser | Síntese local com Qwen2.5 0.5B Instruct ONNX em Web Worker, 3 modos, proteção contra prompt injection e citações verificadas `[p. X]`. Recusa PDFs sem camada de texto (< 40 caracteres). Ver [SUMMARIZE-C1](quality/SUMMARIZE-C1.md). |

---

## 3. Ferramentas Pendentes e Planejadas

Todas as seis ferramentas anteriormente mapeadas nesta seção (`word-to-pdf`, `powerpoint-to-pdf`, `excel-to-pdf`, `pdf-to-powerpoint`, `pdf-to-pdfa` e `pdf-summarize`) tiveram suas decisões arquiteturais aprovadas ([ADR-016](adr/ADR-016-motor-documentos-office.md), [ADR-017](adr/ADR-017-resumo-documental-ia-local.md) e [ADR-021](adr/ADR-021-arquivamento-pdfa-iso19005.md)), foram implementadas e integram o `coreToolManifests` ativo, deixando `plannedToolManifests` vazio (`0` ferramentas pendentes).

---

## 4. Política de Disponibilidade e Plataformas

1. **Fonte Única:** A disponibilidade ativa é governada por `@/platform/tool-availability.ts`, derivado diretamente de `coreToolRegistry`.
2. **Catálogo compartilhado:** O client desktop (Tauri) e o website (Browser/PWA) compartilham o catálogo de **42 ferramentas ativas** neste checkout (`38` no navegador 100% offline, `41` na superfície Web com backend HTTP / Nuvem Híbrida e `42` no Desktop Windows com Superpoderes instaláveis). A existência do executor web não substitui a homologação do aplicativo instalado. Nenhuma ferramenta é exibida com selo "Em breve" ou sem executor associado.
3. **Privacidade e Local-First:** Toda operação de transformação executa localmente. Nenhum documento é transmitido para servidores remotos.

## 5. Complementação das ferramentas atuais

Índice dos planos responsáveis, adicionado em 24/10/2026. O estado de cada complemento consta
no roadmap e no responsável; IM-C1–IM-C3, a qualidade de exportação do IM-C4 e os controles PDF do UX-C1 e a prévia de formulários do DOC-C1 foram entregues no website; AVIF segue condicionado. Os complementos preservam o
catálogo existente; a integração de Reparar PDF elevou a contagem de 34 para 35 ferramentas. Esses
complementos não indicam homologação adicional de desktop/HTTP.
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
| `pdf-repair` (motor web implementado) | [Especificação existente](REPARAR-PDF.md#complementação-do-motor--24102026): avaliação qpdf de R-C1 permanece separada |
| `pdf-to-pdfa` | [PDFA-C1](quality/PDFA-C1.md) e [ADR-021](adr/ADR-021-arquivamento-pdfa-iso19005.md): arquivamento PDF/A-1b/2b e validação estrutural |
| `word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`, `pdf-to-powerpoint` | [OFFICE-C1](quality/OFFICE-C1.md) e [ADR-016](adr/ADR-016-motor-documentos-office.md): motor Office isolado e Superpoder `office.suite` |
| `pdf-summarize` | [SUMMARIZE-C1](quality/SUMMARIZE-C1.md) e [ADR-017](adr/ADR-017-resumo-documental-ia-local.md): SLM local Qwen2.5 ONNX e citações `[p. X]` |

Ferramentas sem complemento específico mantêm seu contrato atual e a regressão em Q-C0;
não ganham nova promessa funcional por associação ao grupo.
