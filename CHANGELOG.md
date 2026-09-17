# Changelog

Todas as alterações relevantes serão registradas neste arquivo. O projeto usa versionamento
semântico e os canais `alpha`, `beta`, `rc` e estável.

## [Não lançado]

### Adicionado

- **Telas Dedicadas por Ferramenta**: Interface interativa de 2 colunas para Organizador de PDF (com grade visual e rotação de miniaturas), Compressor de PDF (com estimativas de redução), Scanner OCR animado, Comparador textual e Corretor gramatical.
- **Integração Studio e Superpoderes**: Acesso unificado a partir do Launcher com suporte à promoção de Quick Tools para fluxos estruturados (`NexoFlow`) e ativação de módulos locais no modal de capacidades.
- **Cobertura Playwright E2E**: Validação de ponta a ponta dos 12 cenários canônicos de navegação, persistência imutável e auditoria de linhagem SQLite.
- **Workflow `Pipeline Main`**: Execução sequencial disparada exclusivamente no push para a `main`, contendo estágio de testes da CLI a partir do código-fonte e estágio de build e empacotamento com publicação de artefatos Windows (`app-x64.exe`).
- **Suporte ao `uv` nos runners Windows**: Adoção da action `astral-sh/setup-uv` em todos os jobs dependentes do Python engine para garantia de isolamento hermético do runtime.
- **Auditoria de segurança e dependências transitivas**: Configuração de regras no `deny.toml` para ignorar advisories conhecidos de crates transitivas e validação 100% verde no `cargo-deny`.
- **Auditoria multiplataforma de licenças**: Ajuste no `scripts/audit-licenses.mjs` com modo `--check` resiliente a variações de quebra de linha entre ambientes Linux/Windows.
- **Pipelines reproduzíveis**: Cobertura contínua para TypeScript/Node.js, Rust no Windows, Python 3.14 via `uv`, Playwright E2E, Gitleaks e auditoria de licenças.

### Corrigido

- Compatibilidade de supply-chain com `pnpm 11` via `ignore-scripts=true` no `.npmrc`.
- Atualização da crate `rustls >= 0.23.45` no `Cargo.lock` eliminando advisory de segurança detectado pelo `cargo-deny`.
- Resolução de permissão `pull-requests: read` no Gitleaks do GitHub Actions.

## [0.1.0-alpha.1] - não publicado

- Primeira base versionada para validação de release e estabilização de arquitetura; não constitui release candidate certificada.
