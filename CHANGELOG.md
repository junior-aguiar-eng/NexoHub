# Changelog

Todas as alterações relevantes serão registradas neste arquivo. O projeto usa versionamento
semântico e os canais `alpha`, `beta`, `rc` e estável.

## [Não lançado]

### Adicionado

- **Workflow `Pipeline Main`**: Execução sequencial disparada exclusivamente no push para a `main`, contendo estágio de testes da CLI a partir do código-fonte e estágio de build e empacotamento com publicação de artefatos Windows (`app-x64.exe`).
- **Suporte ao `uv` nos runners Windows**: Adoção da action `astral-sh/setup-uv` em todos os jobs dependentes do Python engine para garantia de isolamento hermético do runtime.
- **Auditoria de segurança e dependências transitivas**: Configuração de regras no `deny.toml` para ignorar advisories conhecidos de crates transitivas e validação 100% verde no `cargo-deny`.
- **Auditoria multiplataforma de licenças**: Ajuste no `scripts/audit-licenses.mjs` com modo `--check` resiliente a variações de quebra de linha entre ambientes Linux/Windows.
- **Pipelines reproduzíveis**: Cobertura contínua para TypeScript/Node.js, Rust no Windows, Python 3.14 via `uv`, Playwright E2E, Gitleaks e auditoria de licenças.

### Corrigido

- Padrões de código e avisos do `clippy` em `crates/desktop` na função de download de arquivos com hash SHA-256.
- Dependência de pacotes ausentes (`uv`) no ambiente de CI do GitHub Actions em runners Windows.

## [0.1.0-alpha.1] - não publicado

- Primeira base versionada para validação de release e estabilização de arquitetura; não constitui release candidate certificada.
