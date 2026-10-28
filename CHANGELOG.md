# Changelog

## [0.2.0] - 2026-10-27

### Entrega

- Consolidação das ferramentas documentais e de imagem, com revisão das mesas,
  prévias e exportações; Q-C0 mantém 35 perfis restritos documentados.
- Instalador Windows com o logo atual do camaleão, incluindo atualização dos
  ícones de atalhos em upgrades.
- LanguageTool e Java fora do instalador: preparo opcional por download oficial,
  com hashes e revisão textual local, conforme ADR-019.
- Atualização do Tokio para 1.53.3 para corrigir RUSTSEC-2026-0386 e reconciliação
  dos E2E com o catálogo integrado e capturas portáveis.

### Limites

- Os perfis de qualidade têm os limites descritos em `docs/quality`; esta versão
  não amplia a homologação para todos os documentos ou ambientes.
- DOC-C2 permanece fora da homologação desta entrega. PDF para Word já integra
  o catálogo e não recebe certificação de qualidade por esta publicação.
- O instalador é destinado ao Windows x64. O runtime opcional exige download;
  não se declara suporte desktop a outras plataformas.

## Histórico de desenvolvimento

- CMP-C1: navegação por alterações filtradas, ajuste de escala, prévias por demanda e relatório
  de comparação com fonte local incorporada, texto completo paginado e glifos ausentes explícitos.

Todas as alterações relevantes serão registradas neste arquivo. O projeto usa versionamento
semântico e os canais `alpha`, `beta`, `rc` e estável.

## [Não publicado] - 2026-10-23

### Adicionado

- **PDF para Word (`pdf-to-word`)**:
  - Implementação do motor de conversão real `pdf-to-word-converter.ts` combinando a extração estruturada de texto via `pdfjs-dist` com a reconstrução semântica de parágrafos, estilos tipográficos (negrito/itálico) e quebras de página nativas gerando arquivos OpenXML binários `.docx` válidos e editáveis através da biblioteca `docx` (MIT).
  - Tela dedicada `PdfToWordPanel` com progresso de conversão, painel analítico com contagem de páginas processadas, palavras e parágrafos estruturados, comparação de tamanho, prévia dos blocos extraídos, botão de download do `.docx` e banner preventivo com link para OCR caso o PDF seja digitalizado sem texto vetorial.
  - Testes unitários do motor e da interface gráfica no Vitest e teste de ponta a ponta no Playwright.
  - Expansão do catálogo de ferramentas ativas para 36 ferramentas operacionais.

- **Reparar PDF (`pdf-repair`)**:
  - Implementação do motor de recuperação resiliente `pdf-repair-engine.ts` capaz de higienizar cabeçalhos corrompidos (`%PDF-`), remover lixo inicial/BOM, restaurar marcadores truncados no rodapé (`%%EOF`, `startxref`), reconectar referências a Cross-Reference Streams (`/Type /XRef`) e resgatar páginas íntegras página a página.
  - Tela dedicada `PdfRepairPanel` exibindo diagnóstico detalhado de reparo (Xref, Trailer, EOF, Cabeçalho, contagem de páginas salvas e comparação de bytes recuperados vs. originais) com pré-visualização de página e botão de download.
  - Cobertura integral com 6 testes unitários no motor e testes de interface no Vitest, além de cenário de qualidade ponta a ponta no Playwright.

### Modificado

- Editor PDF navega na revisão validada por renderização isolada e cache LRU de páginas;
  download e histórico permanecem canônicos. Payloads do histórico têm orçamento com aviso de
  truncamento; a marca de salvamento não mantém imagens já descartadas.

- Editor PDF com motivos de incompatibilidade por objeto e pré-verificação de caracteres antes
  de aplicar a edição. Corpus de fontes completa/subconjunto, preservação de campos e histórico;
  objetos com recorte interno ou mapeamento ambíguo ficam somente para consulta.

- Ocultar PDF com preservação opcional em perfil restrito via PDFium existente, remoção nativa,
  limpeza de metadados e recusa de recursos não homologados. Modo imagem permanece padrão.
  Revisão renderiza o arquivo do download; cancelamento, retorno às tarjas e ações responsivas.

- Formulários PDF com prévia dos valores atuais, atualização com debounce, cancelamento de
  renders obsoletos e navegação do campo às suas páginas. Download usa os bytes da revisão
  validada. Erros de fonte bloqueiam a saída; achatamento elimina referências de widgets
  preservando anotações independentes. Entrada incompatível é recusada e há opção de trocar PDF.

- Mesas de PDF com navegação, salto de página, zoom de 50–300% e ajuste à largura compartilhados
  em oito ferramentas. Prévias limitadas e canceláveis; zoom preserva opções e coordenadas de
  exportação. Corrigida a oclusão de controles na mesa de PDF para Markdown.

- Resultados de imagem com antes/depois, dimensões, formatos e bytes reais por arquivo; totais do
  lote separados do ZIP. Perfis PNG descrevem esforço sem perdas e JPEG informa fundo branco.
  AVIF avaliado externamente, ainda condicionado à homologação e sem nova dependência de runtime.
- Composição avançada dentro da marca d’água de imagens, com textos, formas, imagens, ordem e
  desfazer/refazer. Prévia e PNG exportado usam o mesmo renderizador local; importações pendentes
  bloqueiam a execução. Fluxo rápido e codecs existentes preservados.
- Recorte de imagens com alças, zoom, pan e teclado por Cropper.js 2.3.1 carregado sob demanda;
  campos numéricos e motor de exportação preservados. Projeção da imagem e da seleção verificada
  em diferentes larguras, com transparência, EXIF e fallback se o editor visual não carregar.
- Complementação integrada aos planos existentes de PDF/Imagem, edição, comparação, estabilização
  e conversões, com responsáveis e dependências no roadmap. Primeira etapa web: inspeção e remoção
  de imagens do lote nas seis ferramentas, recorte validado antes do processamento e previsão de
  redimensionamento coerente com a saída de cada item. Sem novos motores ou dependências.
- Website publicado em `/hub/`, com base configurável no build, navegação e recursos compatíveis com subpasta e testes nos dois modos de publicação. O subdomínio antigo redireciona com 301, preservando caminhos e parâmetros.
- Deploy do website direcionado ao serviço `nexohub-hub` no projeto do balanceador, com build `/hub/`, publicação por digest após a CI e conferência automática do website, API e redirecionamentos. Falha na conferência restaura o tráfego anterior.

- **Fonte Única de Disponibilidade (`tool-availability.ts`)**: Eliminação de duplicações de listas de ferramentas entre Runner, Launcher e adaptadores de Document Core (Browser, Tauri e HTTP), garantindo consistência estrita e paridade funcional completa de 34 ferramentas operacionais.
- **Saneamento de Contratos de Ferramentas**:
  - Rebaixamento de `word-to-pdf` e `pdf-to-word` do registro ativo para `plannedToolManifests`, aguardando ADR formal de motor de renderização Office.
  - Correção do contrato de saída de `text-translate` de `["text/plain", "application/pdf"]` para estritamente `["text/plain"]`.
  - Documentação da semântica de executor preferencial vs. fallback resiliente no `docs/TOOL-SPEC.md`.
- **Catálogo Canônico de Ferramentas**: Criação de `docs/CATALOGO-FERRAMENTAS.md` mapeando as 34 ferramentas ativas e as 8 ferramentas planejadas/pendentes de especificação ou ADR.
- **Alinhamento do Roadmap**: Expansão do `docs/ROADMAP.md` com as fases 17 a 20 (Reparação de PDF, Motor Office, PDF/A e PDF Intelligence Local).

### Corrigido

- **Mesas de ferramentas web:** correção de recorte fora dos limites, opções sobrepostas nos
  painéis de imagem e transbordamentos móveis em tradução, comparação textual e formulários.
  Tokens e resets do Tailwind passam a preservar superfícies, bordas, tipografia e estados ativos.
- **Prévias coerentes e legíveis:** marca d'água de imagem renderizada pelo motor de exportação,
  áreas maiores para rotação/marca d'água, página correta ao pular capa na numeração e
  carregamento incremental de miniaturas PDF além da página 48.
- **Regressões de interface:** cenários de navegador verificam layout com arquivos carregados,
  pixels da prévia e dimensões do download na raiz e em `/hub/`.
- **Responsividade e Transbordo Mobile (390px)**: Ocultação dos rótulos visuais do alternador PDF/Imagem em telas menores que 480px, preservando os nomes acessíveis e os alvos de toque.
- **Compatibilidade Windows em Testes E2E**: Passagem de caminho local com separador final a `standardFontDataUrl` nos testes Playwright, usando `fileURLToPath` para suportar caminhos Windows e POSIX sem falha de carregamento de fontes.
- **Suíte E2E**: Restauração da aprovação integral de 100% dos testes Playwright (97 aprovados).

## [0.1.1] - 2026-10-22

### Adicionado

- **Catálogo Expandido com 13 Ferramentas Reais**: Ativação e consolidação de executores no client e no core para Imagem para PDF (`images-to-pdf`), PDF para JPG (`pdf-to-jpg`), Marca d'Água (`pdf-watermark`), Numeração de Páginas (`pdf-page-numbers`), Reconhecimento Óptico de Caracteres (`pdf-ocr`), Revisão Textual (`text-review`) e Tradução Rápida Offline (`text-translate`).
- **Plano de Fundo Parallax Elegante (`ParallaxBackground`)**: Tipografia flutuante discreta com nomes reais das ferramentas em 3 camadas de profundidade, suavizada por interpolação LERP em `requestAnimationFrame` e com respeito a `prefers-reduced-motion`.
- **Reset de Rolagem Ergonômico**: Posicionamento automático da viewport no topo da tela (`window.scrollTo`) ao selecionar ferramentas da grade ou navegar pelo histórico do navegador.

### Modificado

- **Uniformização Visual & Design System**: Alinhamento estético entre cabeçalho e rodapé com a identidade oficial do NexoHub (preto/coral `#e11d48`), eliminando resquícios de paletas legadas.
- **Ergonomia Ampliada**: Cabeçalho elevado para 74px e blocos de ferramentas ampliados para largura mínima de 270px, padding de 1.75rem e ícones destacados de 48px.
- **Sincronização Integral da Documentação**: Atualização profunda de `README.md`, `docs/PRODUCT.md`, `docs/DESIGN-SYSTEM.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` e `docs/TOOL-SPEC.md`, eliminando status obsoletos e refletindo fielmente a capacidade operacional real da plataforma.

## [0.1.0] - 2026-09-30

### Adicionado

- **Telas Dedicadas por Ferramenta**: Interface interativa de 2 colunas para Organizador de PDF (com grade visual e rotação de miniaturas), Compressor de PDF (com estimativas de redução), Scanner OCR animado, Comparador textual e Corretor gramatical.
- **Integração Studio e Superpoderes**: Acesso unificado a partir do Launcher com suporte à promoção de Quick Tools para fluxos estruturados (`NexoFlow`) e ativação de módulos locais no modal de capacidades.
- **Cobertura Playwright E2E**: Validação de ponta a ponta de 23 cenários canônicos de navegação, transformação documental, persistência imutável e auditoria de linhagem SQLite.
- **Estabilização de Ferramentas Nativas e Web**: Executores de Organizar, Juntar, Dividir, Rotacionar, Comprimir PDF e Comparar Textos integrados ao Tool Runner, com cálculo honesto de compressão e gravação de artifacts derivados.
- **Empacotador Inno Setup Unificado**: Instalador desktop Windows único com verificação de subsistema GUI (sem terminal fantasma) e bootstrapper WebView2 Authenticode.
- **Auditoria multiplataforma de licenças**: Ajuste no `scripts/audit-licenses.mjs` com modo `--check` resiliente a variações de quebra de linha entre ambientes Linux/Windows.
- **Pipelines reproduzíveis**: Cobertura contínua para TypeScript/Node.js, Rust no Windows, Python 3.14 via `uv`, Playwright E2E, Gitleaks e auditoria de licenças.

### Removido

- **Extirpação de microserviço remoto e containers**: Remoção definitiva de `services/engine-api` (FastAPI/Celery/Redis) e `docker-compose.yml`, eliminando riscos de licença AGPLv3 (Ghostscript) e restaurando a garantia de processamento 100% offline.
- **Expurgo do subsistema Supabase Auth**: Desinstalação da dependência `@supabase/supabase-js` e exclusão do módulo `features/account`, eliminando telemetria e contas em nuvem em estrita aderência ao `docs/PRODUCT.md`.

### Corrigido

- **Desacoplamento e conformidade de `DedicatedToolView`**: Canalização da execução de ferramentas estritamente através do `documentCore` canônico, eliminando requisições HTTP e fallbacks com caminhos não concedidos pelo `grant_broker`.
- **Internacionalização canônica pt-BR**: Normalização das saudações na interface sem termos pessoais fixados.
- **Divisão de chunks no Vite**: Configuração de `manualChunks` desacoplando `pdfjs-dist` e `pdf-lib` para carregamento otimizado.
- Compatibilidade de supply-chain com `pnpm 11` via `ignore-scripts=true` no `.npmrc`.
- Atualização da crate `rustls >= 0.23.45` no `Cargo.lock` eliminando advisory de segurança detectado pelo `cargo-deny`.
- Resolução de permissão `pull-requests: read` no Gitleaks do GitHub Actions.
