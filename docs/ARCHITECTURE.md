# Arquitetura

O NexoHub adota monólito modular, ports and adapters e módulos verticais. O client React/TypeScript
é compartilhado pela web e pelo shell Tauri; não existe um segundo frontend desktop.

```text
React UI (Launcher / Studio)
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
estruturado por stdin/stdout, nunca servidor HTTP local por padrão.

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

O shell Tauri expõe somente os comandos estruturados `create_project`, `open_project`,
`import_document`, `list_documents`, `get_document` e `list_artifacts`. Caminhos, argumentos e
integridade são validados no core Rust; erros retornam códigos estáveis sem SQL ou conteúdo do
documento.

O Tool Registry descreve ferramentas, superfícies, entradas, saídas, capacidades e executor. A
Capability Layer escolhe adapters de navegador, nativos ou Python sem vazar detalhes para a UI.
O `@nexohub/tool-registry` é o catálogo canônico consumido pelas superfícies; o
`@nexohub/tool-sdk` valida manifestos, antecipa indisponibilidade e encaminha execuções canceláveis
ao adapter declarado. O registro dos manifestos não implica que seus executores já estejam
implementados.

O primeiro executor da Fase 4 é `pdf-compress`, implementado no core Rust e exposto pelo comando
Tauri `compress_pdf`. O executor lê o blob do artifact informado, limita a descompressão de streams
durante o parsing, gera um novo PDF e persiste o resultado como artifact derivado ligado à operação.
O original e o caminho externo de importação não são alterados.

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

A tradução documental usa CTranslate2 em CPU com modelos instalados explicitamente em uma raiz
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
