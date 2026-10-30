# Checklist de release

## Referência atual

Release publicada: [0.2.4](https://github.com/junior-aguiar-eng/NexoHub/releases/tag/v0.2.4), em 30/10/2026. A [validação](RELEASE-VALIDATION.md) registra hashes, instalação limpa, upgrade e verificações no aplicativo instalado. Este checklist continua aplicável às próximas releases; não substitui evidência de execução.

## Preparação

- Confirmar versão idêntica nos manifests e lockfiles com `pnpm release:verify`.
- Confirmar versão do produto e nome do instalador Inno Setup em `target/release/installer`.
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
- Instalador Inno Setup único construído no Windows com sidecars verificados; instalação, abertura,
  atualização, desinstalação, requisito WebView2 e checksum validados em máquina limpa.

## Publicação

- Não criar `alpha`, `beta`, `rc` ou versão estável com gate vermelho ou ignorado.
- Certificar somente Windows até existir validação expressa de outra plataforma.
- Criar tag anotada apenas após aprovação; comparar os artifacts publicados com os checksums.
- Registrar limitações conhecidas sem declarar capacidades não testadas.
- Conferir o arquivo instalado e a versão registrada no Windows, além da tag e do nome do instalador.
- Conferir o campo de nomes no tradutor e testar reutilização do modelo depois de fechar/reabrir, com perfil fixo e offline explicitamente delimitado.
- Registrar o estado Authenticode: a 0.2.4 permanece `NotSigned`; checksum não equivale a assinatura do publicador.
