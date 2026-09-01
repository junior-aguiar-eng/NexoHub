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
