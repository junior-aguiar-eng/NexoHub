# NexoHub

Local-first open-source document workstation for creating, transforming, editing and finishing
documents.

## Estado

O repositório contém a fundação do monorepo e o Launcher responsivo do NexoHub. As ferramentas
documentais e o Studio permanecem indisponíveis e são identificados explicitamente como futuros.

## Requisitos

- Node.js 24 e pnpm 11;
- Rust estável e requisitos nativos do Tauri 2;
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

## Arquitetura

As decisões vigentes estão em `docs/ARCHITECTURE.md` e `docs/adr/`; os fundamentos visuais estão em
`docs/DESIGN-SYSTEM.md`. O projeto é distribuído sob MPL-2.0.
