# Arquitetura

## Evolução híbrida aprovada, ainda sem ativação

O [ADR-020](adr/ADR-020-nuvem-opcional-cotas.md) autoriza implementar nuvem opcional para até 300 participantes, preservando o processamento local gratuito e sem conta. A base contém contratos, política desativada, verificador de identidade, adapter browser e ledger persistente com precondições atômicas no Firestore. Identidade e reservas foram testadas com fixtures/emulador, sem ligação à UI ou rotas públicas. Fluxo Windows, orçamentos/upload, workers, proteção de rotas, homologação e deploy continuam nas etapas seguintes. A descrição abaixo continua sendo a arquitetura local padrão. A autorização remota limitada do ADR-015 e a evolução do ADR-020 delimitam as exceções às restrições locais descritas neste documento.

O NexoHub adota monólito modular, ports and adapters e módulos verticais. O client React/TypeScript
é compartilhado pela web e pelo shell Tauri; não existe um segundo frontend desktop.

```text
React UI (Hub de Ferramentas / Telas Dedicadas / Studio Avançado)
        |
Application Core — Document Domain — Tool Registry
        |
Platform / Capability Ports
        |-----------------------------|
Browser adapters         Tauri IPC — Windows
                                  |
                         Rust native core
                      SQLite / blobs / jobs
                         sidecars permitidos
```

Componentes React não inferem capacidades pelo sistema operacional e não acessam filesystem,
SQLite, shell ou sidecars. O Rust valida comandos, argumentos e caminhos. Sidecars usam protocolo
estruturado por stdin/stdout, nunca servidor HTTP local por padrão. O projeto é estritamente
local-first: não são admitidos microserviços, servidores de background com portas de rede abertas,
uploads para servidores remotos ou autenticação externa em nuvem.

O domínio é um Document Artifact Graph: `Project` contém `Document`; documentos possuem `Artifact`,
`Representation`, `Asset`, `Overlay` e operações ligando inputs a outputs. Blobs persistentes usam
endereçamento BLAKE3; cache é reconstruível. Undo e redo movem ponteiros entre artifacts existentes.

## Document Core e persistência

`packages/domain` define o grafo tipado compartilhado e suas invariantes; `packages/contracts`
define requests, responses e códigos de erro estáveis entre runtimes. O `nexohub-core` implementa a
persistência nativa sem expor SQL ao client.

Cada projeto local usa a estrutura:

```text
Projeto.nexohub/
├── project.sqlite3
├── blobs/<prefixo>/<hash-blake3>
├── cache/
├── previews/
└── exports/
```

O SQLite mantém migrations versionadas, metadados e arestas do Operation Graph. O blob store grava
por arquivo temporário no mesmo diretório e publica por renomeação; blobs iguais são deduplicados.
Originals importados são copiados para o store e não possuem operação de atualização. Toda
transformação cria outro artifact e registra arestas de entrada e saída.

O shell Tauri expõe somente comandos estruturados próprios: projeto, importação, consulta de
documentos e artifacts, compressão PDF, revisão textual, revisão linguística, overlays, anchors e extração.
Não há permissão genérica Tauri de filesystem, shell ou `core:*`. Caminhos, argumentos, limites e
integridade são validados no core Rust; erros retornam códigos estáveis sem SQL ou conteúdo do
documento. Todo acesso a caminhos passa pelo broker de concessões nativas (`grant_broker`), conforme
especificado no ADR-014, garantindo que o renderer só acesse caminhos expressamente autorizados
por diálogo do usuário.

O Tool Registry descreve ferramentas, superfícies, entradas, saídas, capacidades e executor. A
Capability Layer escolhe adapters de navegador, nativos ou Python sem vazar detalhes para a UI.
O `@nexohub/tool-registry` é o catálogo canônico consumido pelas superfícies; o
`@nexohub/tool-sdk` valida manifestos, antecipa indisponibilidade e encaminha execuções canceláveis
ao adapter declarado.

O ecossistema conta com 36 ferramentas implementadas no catálogo deste checkout, descritas no
[catálogo canônico](CATALOGO-FERRAMENTAS.md). Entre seus grupos estão:
- **Manipulação documental de PDF:** `pdf-organize`, `pdf-merge`, `pdf-split`, `pdf-rotate`, `pdf-compress`,
  `images-to-pdf`, `pdf-to-jpg`, `pdf-watermark` e `pdf-page-numbers` (executores em `pdf-lib` no
  navegador e motor nativo Rust no desktop com persistência e controle de integridade).
- **Análise e inteligência textual:** `text-compare` (diff textual), `text-review` (revisão ortográfica e
  morfológica contextual), `pdf-ocr` (extração óptica local de texto) e `text-translate` (tradução offline entre múltiplos idiomas).

As seis adições web são `pdf-to-markdown`, `pdf-crop`, `pdf-sign`, `pdf-extract-images`,
`pdf-form-fill` e `pdf-unlock`. Seus módulos locais se integram ao executor compartilhado;
`pdf-engine` reexporta as operações para manter os consumidores existentes. O desbloqueio usa
uma ponte interna versionada do PDF.js, descrita em [PDF-UNLOCK.md](PDF-UNLOCK.md).
O registro desta entrega web não homologa, por si só, o desktop.

A proteção web usa AES-256 por padrão. Ocultar PDF reconstrói páginas rasterizadas para não
manter conteúdo recuperável sob as tarjas. A conversão para Excel usa texto local e coordenadas,
com prévia real e exportação XLSX/CSV. Limitações e evidências estão em
[AUDITORIA-PROTECAO-TARJA-EXCEL-WEB-2026-10-23.md](AUDITORIA-PROTECAO-TARJA-EXCEL-WEB-2026-10-23.md).

Comparar PDF (`pdf-compare`) executa PDF.js, alinhamento de páginas, diff textual e pixelmatch
em um worker dedicado. Oferece texto, comparação visual, sobreposição e relatórios PDF/JSON,
sem enviar arquivos ao servidor. Contratos e limites estão em [COMPARAR-PDF-WEB.md](COMPARAR-PDF-WEB.md).

O editor web (`pdf-edit`) usa PDFium WASM em worker, snapshots de comandos e validação textual
independente por PDF.js antes de publicar uma revisão. O guard da ferramenta ativa protege
navegação interna com edições pendentes. Consulte [EDITAR-PDF-WEB.md](EDITAR-PDF-WEB.md).

O Studio inicia como uma superfície do mesmo client, composta por árvore documental, abas, canvas e
Inspector. O client depende de `DocumentCorePort`, tipada pelos contratos compartilhados; adapters
de plataforma implementam a invocação sem permitir que componentes acessem Tauri, filesystem ou
SQLite diretamente.

Nexo Layers projeta originals, artifacts derivados e overlays como camadas independentes, com
visibilidade controlada sem mutação das entidades de origem. NexoFlow representa sequências
imutáveis de ferramentas, valida dependências entre etapas e mantém estados explícitos. Uma Quick
Tool pode ser promovida a rascunho `QUICK` no Studio; essa transição transfere o identificador da
ferramenta e o contexto operacional, mas não simula nem dispara execução.

A edição textual usa uma representação UTF-8 local. `create_text_revision` aceita somente artifacts
`text/plain` ou `text/markdown`, limita cada revisão a 16 MiB e persiste o conteúdo como novo
artifact derivado ligado à operação `text-edit`. O editor mantém rascunho local e só habilita a
persistência quando recebe contexto de projeto e artifact por `DocumentCorePort`.

Overlays PDF são registros independentes vinculados a um artifact `application/pdf`. Destaques,
notas e desenhos usam página iniciada em 1 e geometria normalizada no intervalo da página. Criar ou
listar overlays não materializa nem regrava o PDF; uma eventual exportação visual será outra
operação derivada. O Studio mantém a edição desabilitada enquanto não houver contexto persistível.

O OCR executa no sidecar Python por JSON Lines em stdin/stdout, sem servidor HTTP e sem aceitar
caminhos arbitrários. RapidOCR com ONNX Runtime reconhece texto localmente; PDFium renderiza PDFs
antes da inferência. A entrada é limitada a 64 MiB, PDFs a 500 páginas e cada página a 50
megapixels. A resposta mantém página, confiança e caixas normalizadas para uso futuro por anchors.

Anchors persistem localizadores independentes do viewer para intervalos textuais, regiões PDF e
linhas OCR. Cada seletor é validado contra o MIME type do artifact e usa offsets ou coordenadas
normalizadas. Uma citação textual opcional, limitada a 4 KiB, auxilia a recuperação sem substituir
o seletor. Anchors não alteram blobs, overlays ou artifacts.

O suporte DOCX fica isolado no sidecar Python e opera exclusivamente sobre bytes recebidos pelo
protocolo estruturado. `docx.inspect` extrai parágrafos, estilos, tabelas e título; `docx.create`
materializa um novo documento a partir de conteúdo validado. O original importado nunca é salvo
novamente. Antes do parsing, o engine rejeita caminhos internos inseguros, links simbólicos,
criptografia e arquivos que excedam os limites de tamanho, itens ou compressão.

No website, a tradução usa M2M100 q8 com Transformers.js em um worker dedicado e reutilizável.
O texto permanece no navegador/WebView2; apenas os recursos do modelo são baixados. A tela atual usa esse mesmo caminho no aplicativo Windows distribuído. A lista explícita de nomes é propagada por executor e worker e preserva as correspondências na segmentação. Cancelamento encerra
o worker e downloads sem atividade possuem prazo de 60 segundos. O fluxo está descrito em
[TRADUCAO-WEB.md](TRADUCAO-WEB.md).

A tradução documental nativa usa CTranslate2 em CPU com modelos instalados explicitamente em uma raiz
configurada pelo runtime. A UI nunca escolhe caminhos: solicita um `modelId`, e o sidecar valida que
o diretório resolvido permaneça dentro da raiz permitida, contenha modelo válido, tokenizers e
licença declarada. O pipeline segmenta entradas limitadas, protege placeholders e preserva quebras
de linha. Ausência ou incompatibilidade de modelo é indisponibilidade explícita, não tradução
simulada nem fallback de rede. O texto traduzido deve ser persistido como artifact derivado.

O perfil avançado recomendado é MADLAD-400-3B-MT convertido para CTranslate2 e quantizado em INT8;
o perfil leve usa um modelo OPUS-MT TC Big compatível com o par linguístico. Nenhum peso integra o
Git ou o bundle-base. Cada instalação registra manifesto, licença e SHA-256 do artifact principal.
MADLAD usa SentencePiece compartilhado no padrão T5, com prefixo do idioma de destino e EOS; OPUS-MT
mantém tokenizers SentencePiece separados e eventual prefixo de destino declarado pelo modelo.

A revisão textual usa obrigatoriamente o LanguageTool Community pt-BR como sidecar Java local. O
core nativo inicia somente o JRE e o JAR fixados, confere SHA-256 dos executáveis e exige os avisos de
licença. O snapshot e o Temurin JRE são instalados separadamente e não integram o Git. Não há chamada
à API pública do LanguageTool nem fallback silencioso para outro revisor.

O ciclo de edição conserva os offsets UTF-16 devolvidos pelo engine, invalida achados quando o texto
muda e aplica sugestões do fim para o início, rejeitando sobreposição ou trecho obsoleto. Ao salvar,
`create_text_revision` cria um artifact derivado e seu identificador passa a ser a origem do próximo
ciclo. O original importado permanece inalterado.

Receitas NexoFlow são snapshots declarativos de grafos acíclicos visuais. O `RecipeRunner` realiza um
preflight completo pelo Tool Registry e pela Capability Layer e delega cada etapa ao `ToolRunner`.
As dependências determinam a ordem topológica; ciclos são rejeitados e não há linguagem de script.
O progresso preserva artifacts intermediários para
inspeção, e cada executor mantém o registro normal da etapa no Operation Graph.

## Plataformas e runtime

| Superfície | Estado atual | Runtime e gate |
| --- | --- | --- |
| Windows desktop | Produtiva | Tauri 2, Wry, WebView2 e Rust; build e testes em Windows MSVC |
| Web | Suportada | Client React compartilhado; build e E2E em navegador |
| Linux desktop | Congelada por prazo indeterminado | Sem roadmap, build, teste, release ou suporte |
| Android e iOS | Congeladas por prazo indeterminado | Sem roadmap, desenvolvimento ou validação |
| Demais sistemas nativos | Congelados por prazo indeterminado | Fora do roadmap e sem compromisso de avaliação ou implementação |

O Windows é o único alvo desktop produtivo. O Tauri permanece como shell nativo e usa a cadeia
WebView2 no Windows; o client React é o mesmo entregue na web. A UI continua consultando Capability
Ports e não contém ramificações por sistema operacional.

No Linux, a resolução condicional atual do Tauri/Wry ainda usa GTK3 e WebKitGTK, incluindo
`glib 0.18.5`. Essa cadeia não integra o grafo compilado para `x86_64-pc-windows-msvc`, não bloqueia
o desenvolvimento Windows e não cria obrigação de migração. GTK4 é apenas uma dependência técnica
eventual caso o mantenedor decida, expressamente, avaliar suporte Linux.

O congelamento preserva `mobile_entry_point`, assets e dependências condicionais apenas como
possibilidade técnica. Isso não constitui intenção de retomada, suporte, compatibilidade verificada,
planejamento ou autorização para implementar funcionalidades específicas dessas plataformas. Uma
eventual retomada somente ocorrerá se e quando decidida pelo mantenedor.

## Idioma e internacionalização

Português brasileiro é a fonte de verdade linguística do projeto. Textos de interface pertencem a
uma porta de internacionalização e não aos componentes React. O catálogo base usa `pt-BR`; catálogos
adicionais implementam a mesma coleção de chaves e podem ser carregados sem alterar o domínio, o
Tool Registry ou os contratos nativos. Dados documentais do usuário nunca são traduzidos
implicitamente pela camada de interface.

Identificadores de código, formatos e protocolos podem seguir convenções técnicas em inglês. ADRs,
documentação normativa, mensagens ao usuário e critérios de aceite permanecem em português
brasileiro.
