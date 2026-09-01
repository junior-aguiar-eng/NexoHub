# Arquitetura

O NexoHub adota monólito modular, ports and adapters e módulos verticais. O client React/TypeScript
é compartilhado pela web e pelo shell Tauri; não existe um segundo frontend desktop.

```text
React UI (Launcher / Studio)
        |
Application Core — Document Domain — Tool Registry
        |
Platform / Capability Ports
        |----------------------|
Browser adapters         Tauri IPC
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

O Tool Registry descreve ferramentas, superfícies, entradas, saídas, capacidades e executor. A
Capability Layer escolhe adapters de navegador, nativos ou Python sem vazar detalhes para a UI.

## Idioma e internacionalização

Português brasileiro é a fonte de verdade linguística do projeto. Textos de interface pertencem a
uma porta de internacionalização e não aos componentes React. O catálogo base usa `pt-BR`; catálogos
adicionais implementam a mesma coleção de chaves e podem ser carregados sem alterar o domínio, o
Tool Registry ou os contratos nativos. Dados documentais do usuário nunca são traduzidos
implicitamente pela camada de interface.

Identificadores de código, formatos e protocolos podem seguir convenções técnicas em inglês. ADRs,
documentação normativa, mensagens ao usuário e critérios de aceite permanecem em português
brasileiro.
