# Checklist de release

## Preparação

- Confirmar versão idêntica nos manifests e lockfiles com `pnpm release:verify`.
- Confirmar a versão numérica MSI/WiX: `alpha=1000+n`, `beta=2000+n`, `rc=3000+n` e estável `4000`.
- Confirmar `pnpm-lock.yaml`, `Cargo.lock` e `engines/python/uv.lock` versionados e imutáveis.
- Gerar `THIRD_PARTY_LICENSES.md` e executar auditorias de dependências e licenças.
- Obter sidecars exclusivamente pelo manifesto versionado e validar SHA-256, tamanho, componentes
  extraídos e avisos de licença.
- Atualizar `CHANGELOG.md` e revisar política técnica de privacidade.

## Gates

- `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build:web` e Playwright verdes.
- `cargo fmt --check`, `cargo clippy`, `cargo test` e `cargo build --release --locked` verdes.
- `uv sync --locked`, Ruff, pytest, `uv audit --locked` e wheel Python verdes.
- `pnpm audit`, `cargo deny` e `pnpm licenses:check` verdes.
- MSI e NSIS construídos no Windows com sidecars verificados; instalação, abertura, desinstalação e
  checksums validados em máquina limpa.

## Publicação

- Não criar `alpha`, `beta`, `rc` ou versão estável com gate vermelho ou ignorado.
- Certificar somente Windows até existir validação expressa de outra plataforma.
- Criar tag anotada apenas após aprovação; comparar os artifacts publicados com os checksums.
- Registrar limitações conhecidas sem declarar capacidades não testadas.
