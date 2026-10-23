# ADR-016: Arquitetura do motor para conversões de documentos Office e PDF/A

- **Status:** Proposto
- **Contexto:**
  O catálogo visual do NexoHub e a demanda de usuários incluem ferramentas de conversão de formatos de escritório: Word para PDF (`word-to-pdf`), PDF para Word (`pdf-to-word`), PowerPoint para PDF (`powerpoint-to-pdf`), Excel para PDF (`excel-to-pdf`), PDF para PowerPoint (`pdf-to-powerpoint`) e conversão para arquivo de preservação histórica PDF/A (`pdf-to-pdfa`).
  Diferente de manipulações de PDF (onde o layout já está compilado em coordenadas geométricas fixas), conversões de formatos com layout fluído (como DOCX, PPTX e XLSX) exigem um motor de diagramação tipográfica complexo (layout engine) capaz de calcular quebra de linhas, fontes, parágrafos, tabelas aninhadas e renderização de formas.
  A regra número 3 do `AGENTS.md` veda microserviços remotos ou uploads externos. A regra número 7 exige verificação estrita de licenças (MIT, Apache-2.0, BSD, MPL-2.0; GPL/AGPL exige decisão explícita) e impacto no instalador.

- **Alternativas Avaliadas:**
  1. **Parsers Leves Puros em JavaScript/Python (`docx`, `openpyxl`, `python-pptx`):**
     - *Vantagens:* Leves e executáveis em browser ou sidecar Python pequeno.
     - *Desvantagens:* Incapazes de converter DOCX/XLSX em PDF com fidelidade visual, pois não contêm motor de layout/font-metric. Apenas extraem texto e tabelas brutas (como já fazemos em `pdf-to-excel`).
  2. **LibreOffice Headless via Sidecar Nativo (Desktop) e WebAssembly (Web):**
     - *Vantagens:* Fidelidade máxima da indústria, suporte a todos os formatos (Word, Excel, PowerPoint, PDF/A), licença MPL-2.0 / LGPLv3 compatível.
     - *Desvantagens:* No desktop, adiciona aproximadamente 150-200 MB ao instalador ou exige download sob demanda via Superpoder; no browser, compilações WebAssembly completas excedem dezenas de megabytes.
  3. **Pandoc + Typst / Weasyprint:**
     - *Vantagens:* Excelente qualidade de PDF para documentos textuais.
     - *Desvantagens:* Não suporta layouts avançados de PowerPoint e planilhas dinâmicas complexas de Excel.

- **Decisão Proposta:**
  1. As ferramentas de conversão Office completas permanecem rebaixadas em `plannedToolManifests` e fora do catálogo ativo até a implementação do provedor unificado de motor Office.
  2. No **Desktop Windows**, a integração do LibreOffice em modo headless como um **Superpoder sob demanda** gerenciado pelo `grant_broker` e `Capability Layer`, garantindo que o instalador base continue leve e rápido para quem necessita apenas de ferramentas PDF essenciais.
  3. No **Browser Web**, manter a honestidade funcional: ferramentas de conversão Office de alta fidelidade permanecem inativas até que um worker WebAssembly dedicado com cache via Cache API esteja homologado com garantias de desempenho e memória (evitando travamentos em dispositivos móveis).

- **Consequências:**
  - O código do produto permanece limpo de stubs incompletos ou mocks sem capacidade de conversão real.
  - A garantia local-first é preservada sem envio de documentos para nuvens terceiras.
