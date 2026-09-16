# NexoHub Community

<p align="center">
  <a href="https://github.com/junior-aguiar-eng/NexoHub/actions/workflows/main.yml">
    <img src="https://github.com/junior-aguiar-eng/NexoHub/actions/workflows/main.yml/badge.svg?branch=main" alt="Pipeline Main" />
  </a>
  <a href="https://github.com/junior-aguiar-eng/NexoHub/actions/workflows/ci.yml">
    <img src="https://github.com/junior-aguiar-eng/NexoHub/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI Status" />
  </a>
  <a href="https://github.com/junior-aguiar-eng/NexoHub/actions/workflows/security.yml">
    <img src="https://github.com/junior-aguiar-eng/NexoHub/actions/workflows/security.yml/badge.svg?branch=main" alt="Segurança e Licenças" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="Licença MPL-2.0" />
  </a>
</p>

Hub de ferramentas práticas de PDF e documentos **open source**, **100% gratuito**, **local-first** e de **alta performance**. Junte, divida, comprima, reconheça texto (OCR), revise e converta seus arquivos diretamente no seu computador, com total privacidade e sem filas.

> **Estado**: `0.1.0-alpha.1` em preparação e validação contínua. Build automatizado para Windows x64 ativo via GitHub Actions.

---

## 🖥️ Visão Geral e Experiência

O NexoHub combina a simplicidade e agilidade visual do **iLovePDF** com a força do processamento nativo e seguro:

### Superfícies do Produto

1. **Hub de Ferramentas (Tauri v2 + React 19)**:
   - Vitrine limpa e categorizada de ferramentas essenciais: **Juntar PDF**, **Dividir PDF**, **Comprimir**, **Reconhecer Texto (OCR)**, **Corretor de Texto**, **Traduzir**, **Comparar** e **Extrair Imagens**.
   - **Telas Dedicadas por Ferramenta**: Selecione ou arraste seus arquivos, ajuste opções com facilidade e processe instantaneamente.
   - Histórico local de operações sem envio para a nuvem.
2. **Engines Especializados de Alta Performance**:
   - **Rust Core (`crates/`)**: I/O seguro de alta performance, verificação SHA-256 e cancelamento atômico.
   - **Python Engine (`engines/python`)**: Sidecar gerenciado por `uv` provendo OCR (Tesseract) e manipulação avançada com PyMuPDF.
   - **LanguageTool Community**: Correção sintática e gramatical avançada em ambiente local.

---

## 🔒 Princípios de Privacidade e Modelo Local-First

- **100% Gratuito e Sem Limites**: Sem planos pagos artificiais, limites de páginas ou filas de espera.
- **Seus Arquivos Ficam no seu PC**: Processamento local em memória ou disco nativo, sem telemetria e sem servidores remotos obrigatórios.
- **Imutabilidade**: O arquivo original jamais é sobrescrito; toda operação gera um novo arquivo resultante.

---

## 🚀 Instalação e Desenvolvimento

O alvo nativo principal de distribuição é **Windows x64**.

### Pré-requisitos
- **Node.js**: `24.x` (ou LTS equivalente)
- **pnpm**: `11.x`
- **Rust**: `1.88+` (com target `x86_64-pc-windows-msvc`)
- **Python / uv**: Python gerenciado pelo `uv`
- **WebView2**: Runtime do Windows (já incluído no Windows 10/11)

### Configuração do Ambiente Local

```powershell
# 1. Instalar dependências JavaScript / TypeScript
pnpm install --frozen-lockfile

# 2. Sincronizar o ambiente isolado do Python sidecar via uv
uv sync --locked --project engines/python

# 3. Executar o aplicativo desktop em modo de desenvolvimento (Tauri + Vite)
pnpm --filter @nexohub/desktop dev
```

### LanguageTool (Opcional para Revisão Gramatical)

```powershell
./scripts/install-languagetool.ps1 -InstallRoot "C:\NexoHub\LanguageTool"
$env:NEXOHUB_LANGUAGETOOL_DIR = "C:\NexoHub\LanguageTool"
```

---

## 🧪 Qualidade, Testes e CI/CD

O repositório mantém verificação contínua e estrita de qualidade em todos os pipelines:

```powershell
# Verificação de tipos e linter no ecossistema Web/Node
pnpm check
pnpm test
pnpm test:cli
pnpm build:web
pnpm test:e2e

# Verificação e testes do ecossistema Rust
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked

# Verificação e testes do ecossistema Python
uv run --locked --project engines/python ruff check .
uv run --locked --project engines/python pytest

# Auditoria estrita de licenças de dependências
pnpm licenses:check
```

### Workflows do GitHub Actions
- **Pipeline Main**: Executado em push para a `main` em dois estágios sequenciais — validação da CLI diretamente do código e empacotamento do executável Windows (`app-x64.exe`).
- **CI**: Execução cruzada de testes de JavaScript/Playwright, Python 3.14 e compilação completa do Rust no Windows.
- **Segurança e Licenças**: Varredura de segredos (Gitleaks), auditoria de vulnerabilidades (`cargo-deny`) e conformidade de licenças (`audit-licenses.mjs`).

---

## 📚 Documentação e Arquitetura

- [Arquitetura Geral](docs/ARCHITECTURE.md)
- [Critérios de Conclusão (Definition of Done)](docs/DEFINITION-OF-DONE.md)
- [Roadmap de Desenvolvimento](docs/ROADMAP.md)
- [Guia de Contribuição](CONTRIBUTING.md)
- [Histórico de Mudanças (Changelog)](CHANGELOG.md)
- [Licenças de Terceiros](THIRD_PARTY_LICENSES.md)

---

## 📄 Licença

Distribuído sob a licença **MPL-2.0** (Mozilla Public License 2.0). Veja [LICENSE](LICENSE) para mais detalhes.
