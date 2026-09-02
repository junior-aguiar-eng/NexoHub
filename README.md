# NexoHub Community

Estação documental open source e local-first para organizar projetos, preservar originals
imutáveis e produzir novos artifacts por Quick Tools, Studio e fluxos visuais. O client React é
compartilhado pelo aplicativo Tauri; persistência, filesystem e sidecars passam exclusivamente
pelas portas nativas tipadas.

> Estado: `0.1.0-alpha.1` em preparação. Ainda não existe release candidate certificada nem
> instalador publicado para uso geral.

## Visão do produto

![Launcher do NexoHub](docs/images/launcher.png)

![Studio do NexoHub](docs/images/studio.png)

O projeto inclui Launcher, Document Core persistente, Artifact Graph, Tool Registry, Studio,
NexoFlow e operações documentais em diferentes graus de integração. O estado verificável de cada
critério do 1.0 está em [`docs/DEFINITION-OF-DONE.md`](docs/DEFINITION-OF-DONE.md); capacidades
parciais não são apresentadas como prontas.

## Instalação e plataformas

O primeiro alvo nativo é **Windows x64**. MSI e NSIS serão publicados somente depois de todos os
gates e da instalação em máquina limpa. Linux, macOS e plataformas móveis não são suportados nem
certificados. A arquitetura Tauri permanece portável, sem promessa de binaries para esses alvos.

Para desenvolvimento no Windows:

```powershell
pnpm install --frozen-lockfile
uv sync --locked --project engines/python
pnpm --filter @nexohub/desktop dev
```

Requisitos fixados pelos pipelines: Node.js 24.19.0, pnpm 11.19.0, Rust 1.88 e Python 3.14 por
`uv`. WebView2 e os pré-requisitos de build do Tauri 2 são necessários no Windows.

O LanguageTool Community e o Temurin JRE não são armazenados no Git. O build de release obtém as
versões fixadas em `runtime/languagetool-community.json`, verifica SHA-256, tamanho, componentes e
avisos de licença antes de incluí-los no bundle. Para desenvolvimento:

```powershell
./scripts/install-languagetool.ps1 -InstallRoot "C:\NexoHub\LanguageTool"
$env:NEXOHUB_LANGUAGETOOL_DIR = "C:\NexoHub\LanguageTool"
```

## Privacidade e modelo local-first

Documentos, projects, originals, artifacts, cache e bancos de dados permanecem no dispositivo.
Não há conta, telemetria própria, upload automático ou dependência de servidor NexoHub para funções
locais. A política completa está em [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Qualidade e release

```powershell
pnpm check
pnpm test
pnpm build:web
pnpm test:e2e

cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked

uv run --locked --project engines/python ruff check .
uv run --locked --project engines/python pytest
pnpm licenses:check
```

Os workflows cobrem JavaScript, Playwright, Rust no Windows, Python, auditorias e artifacts MSI,
NSIS, web e wheel. Veja [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md) e
[`CHANGELOG.md`](CHANGELOG.md).

## Arquitetura e contribuição

A arquitetura está em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), as decisões em
[`docs/adr/`](docs/adr/) e as regras de evolução em [`docs/EVOLUTION.md`](docs/EVOLUTION.md).
Contribuições devem seguir [`CONTRIBUTING.md`](CONTRIBUTING.md). Licença: MPL-2.0; dependências e
sidecars constam de [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
