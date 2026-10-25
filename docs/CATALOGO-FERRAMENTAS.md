# Catálogo Canônico de Ferramentas — NexoHub

Este documento é a fonte de verdade para o inventário, status funcional, plataformas atendidas, executores e limitações operacionais de todas as ferramentas do NexoHub.

Data da última auditoria canônica: 23/10/2026.

---

## 1. Visão Geral do Inventário

- **Total mapeado no ecossistema:** 42 ferramentas
- **Implementadas e operacionais:** 36 ferramentas (30 PDF/Texto + 6 Imagem)
- **Planejadas / Pendentes de ADR ou implementação:** 6 ferramentas

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
| `pdf-repair` | Reparar PDF | Otimizar | Implementada | Web, Desktop, HTTP | browser | Reconstrução de xref/trailer, resgate resiliente de páginas legíveis e relatório diagnóstico. |
| `pdf-ocr` | OCR em PDF | Otimizar / Texto | Implementada | Web, Desktop, HTTP | browser (fallback native) | Reconhecimento óptico local. Gera texto e PDF pesquisável. |
| `images-to-pdf` | Imagem para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Suporta JPG, PNG e WebP com orientação e margens. |
| `html-to-pdf` | HTML para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Converte títulos, parágrafos, listas e tabelas em layout próprio. Não preserva o layout CSS original nem executa scripts ou carrega recursos externos. |
| `scan-to-pdf` | Digitalizar para PDF | Converter em PDF | Implementada | Web, Desktop, HTTP | browser | Captura de câmera ou scanner local compilada em PDF. |
| `pdf-to-jpg` | PDF para JPG | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Exporta páginas em 150 DPI empacotadas em arquivo ZIP ou imagem única. |
| `pdf-to-excel` | PDF para Excel | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Extração tabular para OpenXML (.xlsx) ou CSV. Heurística posicional. |
| `pdf-to-word` | PDF para Word | Converter de PDF | Implementada | Web, Desktop, HTTP | browser | Extração semântica de parágrafos, estilos (negrito/itálico) e quebras de página nativas em DOCX. |
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
| **Word para PDF** | `word-to-pdf` | Converter em PDF | ADR de Motor Office: conversão de DOC/DOCX preservando layout completo. Requer sidecar com motor de renderização (ex: LibreOffice / headless unoconv). |
| **PowerPoint para PDF** | `powerpoint-to-pdf` | Converter em PDF | Dependente do mesmo ADR de Motor Office (LibreOffice). |
| **Excel para PDF** | `excel-to-pdf` | Converter em PDF | Dependente do mesmo ADR de Motor Office (LibreOffice). |
| **PDF para PowerPoint** | `pdf-to-powerpoint` | Converter de PDF | Dependente do mesmo ADR de Motor Office (LibreOffice). |
| **PDF para PDF/A** | `pdf-to-pdfa` | Converter de PDF | Especificação e motor para conformance ISO 19005 (PDF/A-1b, PDF/A-2b), embutimento obrigatório de fontes e perfis de cor ICC. |
| **Resumir com IA** | `pdf-summarize` | PDF Intelligence | ADR de IA Local vs. Privacidade: obrigatoriedade de modelo local (ONNX / WebLLM) para cumprir a regra de processamento 100% offline no dispositivo sem upload externo. |

---

## 4. Política de Disponibilidade e Plataformas

1. **Fonte Única:** A disponibilidade ativa é governada por `@/platform/tool-availability.ts`, derivado diretamente de `coreToolRegistry`.
2. **Paridade Funcional:** O client desktop (Tauri) e o website (Browser/PWA) compartilham o mesmo catálogo de 36 ferramentas ativas. Nenhuma ferramenta é exibida com selo "Em breve" ou sem executor associado.
3. **Privacidade e Local-First:** Toda operação de transformação executa localmente. Nenhum documento é transmitido para servidores remotos.
