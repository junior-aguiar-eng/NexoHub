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

Hub de ferramentas de PDF e documentos **open source**, gratuito e **local-first**. O catálogo exibido depende dos executores disponíveis na plataforma. Na web, as operações expostas são organização, junção, divisão, rotação e compressão de PDF e comparação de textos; os arquivos são processados localmente.

> **Estado**: `0.1.0-alpha.1` em preparação e validação contínua. Build automatizado para Windows x64 ativo via GitHub Actions.

---

## 🖥️ Visão Geral e Experiência

O NexoHub combina a simplicidade e agilidade visual do **iLovePDF** com a força do processamento nativo e seguro:

### Superfícies do Produto

1. **Hub de Ferramentas (Tauri v2 + React 19)**:
   - Vitrine categorizada conforme a disponibilidade do executor no client. Conversão, proteção, OCR de PDF, revisão, tradução e extração de imagens não são anunciados como ferramentas web executáveis nesta versão.
   - **Telas dedicadas:** seleção de arquivo, opções da operação e download do resultado. O navegador mantém os artifacts do Document Core em memória; não há reabertura de projeto web após fechar a sessão.
   - Histórico recente local de operações concluídas. O histórico não substitui a persistência dos arquivos de saída.
2. **Engines Especializados de Alta Performance**:
   - **Rust Core (`crates/`)**: armazenamento local com blobs endereçados por BLAKE3, controle de integridade e escrita atômica.
   - **Python Engine (`engines/python`)**: Sidecar local para funções como OCR, extração, tradução e revisão; a presença no core não prova integração de cada função na tela dedicada ou no aplicativo instalado.
   - **LanguageTool Community**: Módulo opcional de revisão local quando instalado e integrado ao fluxo nativo.

### Disponibilidade na tela dedicada

| Ferramenta | Web | Windows desktop | Entrada → saída | Executor atual |
| --- | --- | --- | --- | --- |
| Organizar PDF | Disponível; artifact em memória | Implementado com artifact persistido; QA do aplicativo instalado pendente | PDF → PDF | `pdf-lib` na web; Rust no desktop |
| Comprimir PDF | Disponível; artifact em memória | Implementado com artifact persistido; QA do aplicativo instalado pendente | PDF → PDF | `pdf-lib` na web; Rust no desktop |
| Juntar, dividir e rotacionar PDF | Disponível | Processamento no client; resultado e linhagem persistidos no Document Core nativo; QA do aplicativo instalado pendente | PDF → PDF ou ZIP | `pdf-lib` no client; persistência Rust no desktop |
| Comparar textos | Disponível | Processamento no client; originais, relatório e linhagem persistidos no Document Core nativo; QA do aplicativo instalado pendente | texto → relatório de diferenças | domínio TypeScript; persistência Rust no desktop |
| OCR de PDF, revisão, tradução e extração de imagens | Indisponível na tela dedicada | Indisponível na tela dedicada | Conforme o comando do core | Engines existentes ainda sem fluxo de UI validado |
| Conversão e proteção de PDF | Indisponível | Indisponível | Conforme a ferramenta | Sem executor integrado |

No desktop, a importação pela tela dedicada de compressão e organização solicita uma pasta e cria
`NexoHub.nexohub` nela. As outras quatro ferramentas usam a mesma pasta para registrar entradas e
resultado. A ponte IPC da tela dedicada limita cada importação, resultado e download a 64 MiB. A
organização nativa expõe reordenação e exclusão de páginas; a rotação por página fica oculta nessa
superfície até que o core aceite esse parâmetro. A execução do aplicativo instalado ainda requer
validação específica, distinta dos testes do core, do client e da janela Tauri em desenvolvimento.

---

## 🔒 Princípios de Privacidade e Modelo Local-First

- **Gratuito:** sem planos pagos ou filas de processamento remoto. Os engines aplicam limites técnicos de tamanho e páginas.
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
- **Instalador Windows**: `pnpm build:windows` gera um único instalador Inno Setup em `target/release/installer`. A distribuição por tag exige os gates de CI e segurança do workflow de release.
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
