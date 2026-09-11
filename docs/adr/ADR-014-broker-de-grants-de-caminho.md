# ADR-014 — Broker de concessão de caminhos (Path Grants)

## Contexto

Em arquiteturas baseadas em WebView/Tauri, o renderer (JavaScript/React) não possui privilégios de
acesso direto ao sistema de arquivos. No entanto, comandos IPC que aceitam caminhos arbitrários como
string (`projectPath`, `sourcePath`) criam vetores de ataque em que um renderer comprometido ou um
defeito de lógica poderia instruir o processo nativo a ler, sobrescrever ou corromper arquivos fora
do escopo pretendido pelo usuário (incluindo diretórios do sistema operacional, perfis de usuário ou
outros projetos).

## Decisão

Implementar um **Broker de Grants de Caminho** (`grant_broker`) nativo no processo host Rust /
Tauri.

1. **Seleção Nativa Obrigatória:** Todo caminho acessado pelo Document Core deve originar-se de uma
   ação explícita do usuário através de diálogo nativo de seleção de arquivos/pastas
   (`pick_project_folder`, `pick_document_file`) ou de um projeto previamente confiável e
   registrado.
2. **Registro e Verificação em Memória:** Ao ser selecionado, o caminho é sanitizado, normalizado
   (resolvendo symlinks e reparse points via `dunce::canonicalize`) e registrado no conjunto de
   caminhos expressamente concedidos (`grant_path`).
3. **Bloqueio de Diretórios de Sistema:** Tentativas de registrar caminhos de sistema (`C:\Windows`,
   `C:\Program Files`, raízes brutas como `C:\` ou `/`) são terminantemente rejeitadas com erro
   estruturado `PermissionDenied`.
4. **Verificação de Ancestralidade e Escopo:** Arquivos e pastas dentro de um diretório de projeto
   concedido herdam a permissão por ancestralidade de diretório. Caminhos avulsos exigem concessão
   direta ou estar contidos na raiz do projeto.
5. **Erros IPC Estruturados:** Qualquer tentativa de acessar ou manipular um caminho não concedido
   retorna `ErrorCode::PermissionDenied` com mensagem estruturada, sem expor caminhos sensíveis na
   resposta pública.
6. **Imutabilidade do Core:** O Document Core continua exigindo a validação de grant antes de
   qualquer operação de persistência, importação ou mutação de estado.

## Consequências

- O renderer não consegue forjar caminhos arbitrários para acessar dados fora do espaço autorizado;
- Symlinks maliciosos e travessias de diretório (`..`) são neutralizados na etapa de canonização;
- A separação de responsabilidades (Platform/Capability Port) é preservada: o client React solicita a
  seleção via porta nativa e recebe a estrutura validada pelo host;
- Testes automatizados podem simular concessões ou revogações de forma limpa via `grant_path` e
  `revoke_all()`.
