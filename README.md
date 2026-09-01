# NexoHub

Estação documental open source, local-first, Windows-first e com client web compartilhado.

## Estado

O repositório contém a fundação do monorepo e o Launcher responsivo do NexoHub. As ferramentas
documentais e o Studio permanecem indisponíveis e são identificados explicitamente como futuros.

## Requisitos

- Node.js 24 e pnpm 11;
- Windows com WebView2 e requisitos nativos do Tauri 2 para o aplicativo desktop;
- Rust 1.88 ou superior para o shell desktop;
- Python 3.14 gerenciado por uv.

## Desenvolvimento

```powershell
pnpm install
pnpm check
pnpm test
pnpm build

cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

uv sync --project engines/python
uv run --project engines/python ruff check .
uv run --project engines/python pytest
```

O client web inicia com `pnpm --filter @nexohub/client dev`. O shell desktop inicia com
`pnpm --filter @nexohub/desktop dev` e reutiliza exatamente esse client.

O desenvolvimento produtivo cobre Windows desktop e web. Linux, Android, iOS e demais sistemas
nativos estão congelados por prazo indeterminado, fora do roadmap e sem compromisso de retomada.
Sua estrutura Tauri permanece apenas como possibilidade técnica. Para validar superfícies
suportadas separadamente, use `pnpm build:web` e `pnpm build:windows`.

## Arquitetura

As decisões vigentes estão em `docs/ARCHITECTURE.md` e `docs/adr/`; os fundamentos visuais estão em
`docs/DESIGN-SYSTEM.md`. O projeto é distribuído sob MPL-2.0.
