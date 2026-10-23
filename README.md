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
| **Organizar PDF** | Reordenar, girar e excluir páginas visualmente | ✅ Disponível | ✅ Instalado | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Juntar PDF** | Combinar múltiplos documentos em um só | ✅ Disponível | ✅ Instalado | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Dividir PDF** | Extrair páginas específicas ou separar intervalos | ✅ Disponível | ✅ Instalado | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Rotacionar PDF** | Girar páginas em 90°, 180° ou 270° | ✅ Disponível | ✅ Instalado | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Comprimir PDF** | Reduzir tamanho com perfis reais de compressão | ✅ Disponível | ✅ Instalado | `pdf-lib` (Web) / Rust BLAKE3 (Desktop) |
| **Imagem para PDF** | Consolidar fotos JPG, PNG e WebP em documento PDF | ✅ Disponível | ✅ Instalado | `pdf-lib` / Canvas local |
| **PDF para JPG** | Converter páginas de PDF em imagens JPG de alta qualidade | ✅ Disponível (ZIP) | ✅ Instalado | PDF.js + ZIP em memória |
| **Inserir Marca d'Água** | Carimbo de texto customizável com ângulo e opacidade | ✅ Disponível | ✅ Instalado | `pdf-lib` / Motor Rust |
| **Número de Páginas** | Numeração automática de rodapé e cabeçalho | ✅ Disponível | ✅ Instalado | `pdf-lib` / Motor Rust |
| **Reconhecer Texto (OCR)** | Converter digitalizações e PDFs em texto pesquisável | ✅ Disponível | ✅ Instalado | Tesseract.js (Web) / RapidOCR (Desktop) |
| **Comparar Textos** | Identificar adições, remoções e diff textual | ✅ Disponível | ✅ Instalado | Diff textual TypeScript / Rust Core |
| **Revisar Texto** | Revisão ortográfica e sugestões morfológicas | ✅ Disponível | ✅ Instalado | Motor contextual / Hunspell / LanguageTool |
| **Traduzir Texto** | Tradução local após obtenção do modelo | ✅ Disponível | ✅ Instalado | NLLB-200 no navegador / CTranslate2 |
| **PDF para Markdown** | Extrair texto com estrutura de títulos, listas e tabelas heurísticas | ✅ Disponível | Não auditado nesta entrega | PDF.js |
| **Recortar PDF** | Ajustar margens na orientação visual sem rasterizar páginas | ✅ Disponível | Não auditado nesta entrega | `pdf-lib` |
| **Assinar PDF** | Aplicar assinatura visual por desenho, texto ou imagem | ✅ Disponível | Não auditado nesta entrega | Canvas / `pdf-lib` |
| **Extrair Imagens** | Exportar imagens embutidas em JPEG/PNG com resolução nativa | ✅ Disponível | Não auditado nesta entrega | PDF.js / `pdf-lib` |
| **Preencher Formulário** | Editar campos AcroForm e opcionalmente achatá-los | ✅ Disponível | Não auditado nesta entrega | `pdf-lib` |
| **Desbloquear PDF** | Descriptografar PDFs compatíveis com a senha de abertura quando exigida | ✅ Disponível | Não auditado nesta entrega | PDF.js |

O website oferece 19 ferramentas. Conversões de/para Word e proteção com senha permanecem ocultas
sem executor disponível. A auditoria das seis novas ferramentas e seus limites estão em
[Auditoria das novas ferramentas](docs/AUDITORIA-NOVAS-FERRAMENTAS-WEB-2026-10-23.md).
Assinatura visual não é assinatura digital criptográfica; a qualidade da tradução ainda requer
avaliação linguística representativa.

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
