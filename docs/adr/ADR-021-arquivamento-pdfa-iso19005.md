# ADR-021: Motor local para conversão e validação PDF/A (`pdf-to-pdfa`, ISO 19005-2b)

- **Estado:** aceito para planejamento em 13/11/2026; implementação e ativação na vitrine condicionadas à auditoria de perfil ICC/fontes (ADR-008) e homologação independente contra validador ISO 19005 (veraPDF).
- **Relação:** [ADR-001 (Local-first)](ADR-001-local-first.md), [ADR-004 (Originais imutáveis)](ADR-004-immutable-originals.md), [ADR-005 (Tool Registry)](ADR-005-tool-registry.md), [ADR-008 (Licenças)](ADR-008-license-policy.md) e [ADR-016 (Motor Office)](ADR-016-motor-documentos-office.md).

---

## 1. Contexto

A ferramenta **PDF para PDF/A** (`pdf-to-pdfa`) compõe o backlog estratégico da Onda 3 (`docs/CATALOGO-FERRAMENTAS.md` §3 e `docs/ROADMAP.md` Fase 19) e conversa diretamente com o público brasileiro de tribunais/PJe, contabilidade e arquivamento institucional (onde já existem, por exemplo, predefinições de numeração forense PJe no produto).

Diferente do rascunho inicial do ADR-016 — que agrupava `pdf-to-pdfa` junto à dependência de LibreOffice — a análise técnica da plataforma atual (`pdf-lib`, `@pdf-lib/fontkit`, `@embedpdf/pdfium`, `pdfjs-dist` e fontes livres OFL já empacotadas em `apps/client/public/`) mostra que a conversão para **PDF/A-2b (ISO 19005-2, nível B)** pode operar **100% localmente tanto no navegador Web quanto no desktop Windows**, sem exigir download de suíte Office de ~200 MB nem envio para nuvem.

Entretanto, declarar que um PDF é "PDF/A" exige **rigor normativo absoluto**: apenas adicionar uma tag XMP sem satisfazer as restrições estruturais da norma ISO 19005 faz o arquivo ser rejeitado por validadores oficiais (como veraPDF e sistemas de peticionamento eletrônico).

---

## 2. Escolha do Perfil Normativo Alvo: PDF/A-2b (com caminho claro de compatibilidade)

1. **Por que PDF/A-2b (ISO 19005-2) como padrão principal e não apenas PDF/A-1b (ISO 19005-1)?**
   - **Transparências e camadas modernas:** PDF/A-1b **proíbe** transparências (`SMask`, alpha `< 1.0`, blend modes != `Normal`). PDFs reais modernos gerados por Word, navegadores e editores PDF usam transparência extensivamente; em PDF/A-1b, isso força achatamento rasterizado pesado de páginas inteiras, destruindo texto selecionável ou elevando muito o tamanho do arquivo. **PDF/A-2b permite transparência** (contanto que o espaço de cores de mistura e o `/OutputIntent` estejam corretamente definidos) e permite compressão JPEG2000/object streams (`PDF 1.7`).
   - **Aceitação institucional:** tribunais modernos (PJe, e-SAJ, SEI, órgãos públicos) aceitam PDF/A-2b amplamente; opcionalmente podemos oferecer um modo **PDF/A-1b Estreito (Rasterizado/Achatado)** apenas quando o usuário solicitar explicitamente compatibilidade legada com sistemas antigos que só aceitem 1b.

---

## 3. Decisão Arquitetural — Pipeline Local de Normalização ISO 19005-2b

O executor `pdf-to-pdfa-engine` rodará em Web Worker dedicado (`@nexohub/client` compartilhado por Web e Windows), seguindo estritamente o princípio de original imutável (ADR-004) e nunca mentindo sobre conformidade.

### 3.1 Requisitos Estruturais Obrigatórios Implementados no Motor

1. **Cabeçalho e Trailer do PDF:**
   - Versão PDF compatível com ISO 19005-2 (`%PDF-1.7` com marcador binário de 4 bytes > 127 na segunda linha).
   - Presença obrigatória de `/ID` no trailer (dois strings hexadecimais de 16 bytes gerados de forma determinística ou via WebCrypto).
   - Proibição estrita de criptografia (`/Encrypt` ausente): PDFs protegidos por senha exigem desbloqueio prévio explícito ou recusa clara com código estruturado.
   - **Recusa explícita de PDFs assinados digitalmente (PAdES / `/ByteRange`):** modificar o documento para convertê-lo em PDF/A quebraria a assinatura criptográfica; o usuário deve ser avisado com recusa explícita (seguindo a política já usada em `pdf-compress` e `pdf-repair`), ou optar explicitamente por gerar cópia arquivável achatada sem validade de assinatura anterior.

2. **Espaço de Cores e `/OutputIntents` (ISO 19005-2 §6.2):**
   - Embutir perfil ICC **sRGB v2/v4 conforme e auditado por licença** (ex.: perfil ICC sob domínio público/MIT/Apache/Zlib, como o perfil sRGB do ColorHug/Ghostscript-free/sauce-audited **compact-icc** ou equivalente devidamente inventariado em `THIRD_PARTY_LICENSES.md` sob ADR-008 — nunca usar perfil ICC proprietário da Adobe/Microsoft sem licença explícita).
   - Inserir entrada `/OutputIntents` no `/Catalog` com `/S /GTS_PDFA2`, `/OutputConditionIdentifier (sRGB IEC61966-2.1)`, `/RegistryName (http://www.color.org)` e `/DestOutputProfile` apontando para o stream ICC (`N = 3`).
   - Normalizar/converter páginas ou grupos de transparência que não possuam `/Group << /S /Transparency /CS /DeviceRGB ... >>` consistente ou que misturem espaços não calibrados conflitantes.

3. **Fontes 100% Incorporadas e `/ToUnicode` (ISO 19005-2 §6.2.11):**
   - PDF/A exige que **toda fonte usada em conteúdo visível esteja incorporada** no arquivo (`FontDescriptor` com `FontFile`, `FontFile2` ou `FontFile3`). As 14 fontes padrão do PDF (`Helvetica`, `Times-Roman`, `Courier`, etc.) **não podem** ficar referenciadas sem incorporação!
   - **Estratégia em 2 níveis sem perda silenciosa:**
     - *Nível A (Normalização vetorial preservando texto):* inspecionar cada dicionário de fonte via `pdf-lib`. Se todas as fontes já estiverem incorporadas (ou forem fontes padrão substituíveis por equivalentes métricas livres já presentes no bundle, como `LiberationSans`/`SourceSans3` via `@pdf-lib/fontkit` em recursos simples), incorporar/normalizar preservando texto vetorial selecionável.
     - *Nível B (Fallback explícito para fontes ausentes ou recursos incompatíveis complexos):* quando o PDF de entrada contiver fonte proprietária **não incorporada** cujo arquivo `.ttf` não exista no documento (ou espaços de cor/recursos `XObject`/transparência complexos impossíveis de sanear apenas manipulando objetos `pdf-lib`), utilizar `@embedpdf/pdfium` / `pdfjs-dist` para renderizar as páginas problemáticas com fonte de sistema/substituição em alta resolução (ex.: 200–300 DPI configurável) + camada de texto pesquisável com fonte TrueType **incorporada** (`LiberationSans`), registrando claramente no relatório da operação se o arquivo foi convertido **100% vetorialmente** ou se páginas específicas passaram por **reconstrução segura para garantir conformidade PDF/A**.

4. **Remoção/Neutralização de Elementos Proibidos (ISO 19005-2 §6.4–§6.6):**
   - Remover qualquer ação ou gatilho `/JS`, `/JavaScript`, `/Launch`, `/Sound`, `/Movie`, `/RichMedia`, `/3D`, `/EmbeddedFiles` não-PDF/A, `/OpenAction` não conforme e `/AA` (Additional Actions) no catálogo, páginas e anotações.
   - Normalizar anotações permitidas garantindo flags adequadas (`/F` com bit `Print` ligado e proibição de `Hidden`/`Invisible`/`NoView`) ou achatamento opcional em aparência visual (`/AP`).
   - Remover dicionários `/LZWDecode` se houver em streams regravados (preferir `FlateDecode` / `DCTDecode`).

5. **Metadados XMP Sincronizados (`/Metadata` XML Packet — ISO 19005-2 §6.7):**
   - Criar/atualizar o stream `/Metadata` no `/Catalog` com `/Type /Metadata`, `/Subtype /XML` (sem compressão opcional ou conforme padrão UTF-8) contendo:
     - Schema `pdfaid`: `<pdfaid:part>2</pdfaid:part>` e `<pdfaid:conformance>B</pdfaid:conformance>`.
     - Sincronização estrita entre dicionário `/Info` clássico (`Title`, `Author`, `Subject`, `Creator`, `Producer`, `CreationDate`, `ModDate`) e propriedades equivalentes em XMP (`dc:title`, `dc:creator`, `dc:description`, `xmp:CreatorTool`, `pdf:Producer`, `xmp:CreateDate`, `xmp:ModifyDate`), evitando divergência que reprova em validadores ISO 19005!

---

## 4. Verificação Independente Obrigatória (Gate veraPDF / ISO 19005)

Nenhum motor de PDF/A será promovido para a vitrine ativa com testes apenas baseados na própria biblioteca geradora (`pdf-lib` lendo `pdf-lib`):

1. **Suite de Validação Externa no Desenvolvimento/CI:** integrar execução de teste com **veraPDF CLI** (licença dual GPLv3/MPLv2 — usado **apenas em suite de validação de qualidade/CI**, nunca embutido no binário ou bundle distribuído pelo NexoHub, em estrita conformidade com o ADR-008!).
2. **Corpus obrigatório de validação (aprovação 100% no veraPDF `-f 2b`):**
   - PDF com fontes padrão não incorporadas (`Helvetica`/`Times` criados por ferramentas simples).
   - PDF moderno com transparências, imagens PNG com canal alpha e vetores coloridos.
   - PDF contendo JavaScript em `/OpenAction` ou anotações inválidas (que devem ser neutralizados sem quebrar o arquivo).
   - PDF escaneado com OCR prévio (verificando preservação da camada de texto pesquisável com fonte incorporada).
   - PDF multi-página com metadados acentuados em `pt-BR` (testando sincronização UTF-8 entre `/Info` e XMP).
3. **Verificação estrutural rápida no próprio cliente:** antes de entregar o download ao usuário, executar checagem rápida interna (presença de `/OutputIntents`, `/Metadata` XMP `pdfaid:part="2"`, ausência de `/Encrypt` e `/JavaScript`, e renderização limpa via PDFium) garantindo falha honesta antes do download em caso de anomalia inesperada.

---

## 5. Experiência na Interface (`[data-workspace-panel]`)

- Rota dedicada sugerida: `/pdf-para-pdfa` (`id: "pdf-to-pdfa"`), usando o mesmo `[data-workspace-panel]` de prévia única centralizada à esquerda e sidebar clara (`320px`) à direita.
- Controles enxutos e úteis na sidebar:
  - **Perfil de conformidade:** `PDF/A-2b (Recomendado — preserva transparências)` | `PDF/A-1b (Compatibilidade legada — achata páginas se necessário)`.
  - **Estratégia quando houver fontes não embutidas:** `Preservar vetores quando possível (reconstruir apenas o necessário)` | `Máxima compatibilidade visual`.
  - **Pré-diagnóstico automático imediato** ao carregar o PDF (sem esperar conversão): exibe se o documento possui fontes não incorporadas, transparências, ações JavaScript ou assinaturas digitais bloqueantes.
- Na tela de conclusão (`.dedicated-tool-page--success`): exibir relatório estruturado dos ajustes aplicados (XMP ISO 19005-2b adicionado, perfil sRGB embutido, ações removidas, páginas reconstruídas vs. vetoriais).

---

## 6. Consequências

- **Positivas:** entrega uma das ferramentas mais requisitadas no ecossistema profissional/jurídico brasileiro **100% offline**, zero custo de nuvem, funcionando igualmente no Web e no Windows desktop desde o dia 1.
- **Limitações honestas documentadas:** PDFs com assinaturas digitais prévias não são convertidos silenciosamente (porque perderiam validade jurídica sem aviso explícito); documentos sem fontes incorporadas podem exigir reconstrução visual controlada das páginas afetadas para cumprir a regra ISO 19005 sem inventar métricas tipográficas inexistentes.
