# <p align="center"><img src="apps/client/src/assets/nexohub-icon.png" width="48" height="48" alt="NexoHub Logo" style="vertical-align: middle; margin-right: 8px;" /> NexoHub Community</p>

<p align="center">
  <strong>Hub de ferramentas práticas para PDFs e documentos — 100% gratuito, moderno e local-first.</strong>
</p>

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
  <a href="https://github.com/junior-aguiar-eng/NexoHub/actions/workflows/deploy-cloudrun.yml">
    <img src="https://github.com/junior-aguiar-eng/NexoHub/actions/workflows/deploy-cloudrun.yml/badge.svg?branch=main" alt="Deploy Cloud Run" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/Licen%C3%A7a-MPL--2.0-blue.svg" alt="Licença MPL-2.0" />
  </a>
  <img src="https://img.shields.io/badge/Privacidade-Local--First-emerald.svg" alt="Local-First" />
  <img src="https://img.shields.io/badge/Idioma-pt--BR-rose.svg" alt="Português do Brasil" />
</p>

---

## 🌐 Experimente Agora na Web

Acesse a aplicação em produção diretamente do seu navegador, sem necessidade de instalação nem cadastro:

> 🚀 **Aplicação Web:** [**nexohub-moe3oe6lva-rj.a.run.app**](https://nexohub-moe3oe6lva-rj.a.run.app)  
> 🔗 *Domínio principal:* [**nexohub.nexojuris.ia.br**](https://nexohub.nexojuris.ia.br)

> [!NOTE]
> Na versão web, todas as transformações de arquivos ocorrem **diretamente na memória do seu navegador via WebAssembly / JavaScript local**. Nenhum documento é enviado para servidores externos.

---

## 🎯 O que é o NexoHub?

O **NexoHub** combina a agilidade, elegância e foco operacional do **iLovePDF** com a segurança inegociável do processamento **offline e local-first**. Projetado para profissionais, escritórios e usuários que lidam diariamente com documentos confidenciais e exigem privacidade absoluta.

### ✨ Pilares Fundamentais

* 🛡️ **Privacidade Absoluta (Local-First):** Os arquivos permanecem no seu computador. Sem telemetria oculta, sem rastreamento e sem upload para a nuvem.
* 💸 **100% Gratuito e Livre:** Sem assinaturas, sem cobranças disfarçadas, sem paywalls e sem limites artificiais de páginas.
* 🔒 **Imutabilidade Estrita:** O arquivo original importado jamais é sobrescrito. Qualquer operação gera um novo artefato derivado com histórico auditável.
* ⚡ **Design Ultra-Clean & Ergonômico:** Interface minimalista e contemporânea com plano de fundo parallax sutil e dinâmico, navegação por atalhos (`Ctrl+K`) e telas dedicadas para cada fluxo de trabalho.

---

## 🛠️ Catálogo de Ferramentas e Disponibilidade

| Ferramenta | Descrição | Web | Windows Desktop | Motor / Executor |
| :--- | :--- | :---: | :---: | :--- |
| **Organizar PDF** | Reordenar, girar e excluir páginas visualmente | ✅ Em memória | ✅ Nativo (Rust Core) | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Juntar PDF** | Combinar múltiplos documentos em um só | ✅ Em memória | ✅ Nativo (Rust Core) | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Dividir PDF** | Extrair páginas específicas ou separar intervalos | ✅ Em memória | ✅ Nativo (Rust Core) | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Rotacionar PDF** | Girar páginas em 90°, 180° ou 270° | ✅ Em memória | ✅ Nativo (Rust Core) | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Comprimir PDF** | Reduzir tamanho com perfis reais de compressão | ✅ Em memória | ✅ Nativo (Rust Core) | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Comparar Textos** | Identificar adições, remoções e diff semântico | ✅ Em memória | ✅ Nativo (Rust Core) | Motor semântico TypeScript / Rust Core |
| **Imagem para PDF** | Consolidar imagens JPG, PNG e WEBP em PDF | 🔄 Em breve | 🔄 Próxima fase | Motor de imagens nativo |
| **PDF para JPG** | Converter páginas de PDF em imagens de alta definição | 🔄 Em breve | 🔄 Próxima fase | Motor de renderização nativo |
| **Marca d'Água** | Carimbo de texto personalizável, opacidade e rotação | 🔄 Em breve | 🔄 Próxima fase | `pdf-lib` / Motor Rust |
| **Número de Páginas** | Numeração automática de rodapé e cabeçalho | 🔄 Em breve | 🔄 Próxima fase | `pdf-lib` / Motor Rust |
| **Reconhecer Texto (OCR)** | Converter digitalizações em texto pesquisável | 🔄 Em breve | 🔄 Sidecar Python | Tesseract OCR / Sidecar isolado |
| **Revisar Texto** | Revisão ortográfica e sugestões morfológicas | 🔄 Em breve | 🔄 Sidecar Local | Motor contextual / Hunspell / LanguageTool |
| **Traduzir Texto** | Tradução rápida entre idiomas de forma offline | 🔄 Em breve | 🔄 Sidecar Local | Modelos locais quantizados |

---

## 🏗️ Arquitetura do Repositório

O NexoHub é estruturado como um monorepo modular e estritamente desacoplado:

```text
NexoHub/
├── apps/
│   ├── client/              # Frontend React 19 + TypeScript + Vite + Design System
│   └── desktop/             # Invólucro nativo Windows x64 com Tauri v2
├── crates/                  # Módulos de infraestrutura e computação em Rust
│   ├── nexohub-core/        # Motor central: blobs BLAKE3, SQLite, linhagem e auditoria
│   ├── nexohub-cli/         # Interface de linha de comando com comandos determinísticos
│   └── nexohub-server/      # Servidor de testes e desenvolvimento isolado
├── packages/                # Pacotes TypeScript compartilhados
│   ├── domain/              # Tipos canônicos, contratos de dados e i18n (pt-BR)
│   ├── contracts/           # Interfaces de portas (Platform & Capability Ports)
│   ├── tool-sdk/            # SDK para criação e execução segura de ferramentas
│   └── tool-registry/       # Registro central e metadados de ferramentas disponíveis
├── engines/                 # Motores especializados externos
│   └── python/              # Sidecar Python (OCR, NLP e tradução) gerenciado via uv
└── docs/                    # Documentação de arquitetura, ADRs e guias de design
```

---

## 💻 Instalação e Desenvolvimento Local

### Pré-requisitos
* **Node.js**: `24.x` (LTS)
* **pnpm**: `11.x`
* **Rust**: `1.88+` (com target `x86_64-pc-windows-msvc` no Windows)
* **uv / Python**: [Astral uv](https://docs.astral.sh/uv/) instalado
* **WebView2**: Runtime do Windows (padrão no Windows 10/11)

### Passo a Passo

1. **Clonar o Repositório:**
   ```powershell
   git clone https://github.com/junior-aguiar-eng/NexoHub.git
   cd NexoHub
   ```

2. **Instalar Dependências TypeScript/JavaScript:**
   ```powershell
   pnpm install --frozen-lockfile
   ```

3. **Sincronizar o Sidecar Python (via uv):**
   ```powershell
   uv sync --locked --project engines/python
   ```

4. **Executar em Modo de Desenvolvimento:**
   * **Modo Web:**
     ```powershell
     pnpm --filter @nexohub/client dev
     ```
   * **Modo Desktop Windows (Tauri):**
     ```powershell
     pnpm --filter @nexohub/desktop dev
     ```

---

## 🧪 Qualidade, Testes e CI/CD

O projeto adota uma política de tolerância zero com quebras de teste ou regressões:

```powershell
# Verificação estrita de formatação (Biome) e tipagem (TypeScript)
pnpm check

# Testes unitários do Client (Vitest)
pnpm --filter @nexohub/client test

# Testes de ponta a ponta reais no navegador (Playwright E2E)
pnpm --filter @nexohub/client test:e2e:ci

# Verificação e testes do Core nativo (Rust)
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked

# Verificação do Sidecar Python
uv run --locked --project engines/python ruff check .
uv run --locked --project engines/python pytest

# Auditoria de Licenças de Dependências
pnpm licenses:check
```

---

## 📚 Documentação Complementar

* 📐 [**Arquitetura do Sistema**](docs/ARCHITECTURE.md) — Visão técnica, fluxo de dados e portas.
* 📦 [**Definição de Conclusão (Definition of Done)**](docs/DEFINITION-OF-DONE.md) — Critérios de qualidade e entrega.
* 🎨 [**Design System & Diretrizes de UI**](docs/DESIGN-SYSTEM.md) — Tipografia, cores, layout e componentes.
* 🔐 [**Hardening e Segurança**](docs/HARDENING.md) — Medidas de proteção, sandboxing e sanitização.
* 🛡️ [**Política de Privacidade**](docs/PRIVACY.md) — Diretrizes do modelo local-first e proteção de dados.
* 📜 [**Registro de Decisões de Arquitetura (ADRs)**](docs/adr/) — Histórico técnico de decisões consolidadas.

---

## 📄 Licença

Distribuído sob a licença **MPL-2.0** (Mozilla Public License 2.0). Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
