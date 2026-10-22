# ==========================================
# Estágio 1: Build do Frontend (Vite + React)
# ==========================================
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml biome.json ./
COPY packages ./packages
COPY apps/client ./apps/client

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @nexohub/client build

# ==========================================
# Estágio 2: Compilação do Servidor Rust (Axum)
# ==========================================
FROM rust:bookworm AS rust-builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY runtime ./runtime
COPY apps/desktop/src-tauri ./apps/desktop/src-tauri

RUN cargo build --release --locked -p nexohub-server

# ==========================================
# Estágio 3: Imagem Final de Execução (Cloud Run)
# ==========================================
FROM debian:bookworm-slim AS runner

# Instala runtime Python 3 e dependências nativas para OCR e processamento documental
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libssl3 \
    python3 \
    python3-pip \
    python3-venv \
    libgl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Cria usuário não-root por segurança
RUN useradd -m -u 1000 -s /bin/bash appuser

WORKDIR /app

# Copia os arquivos estáticos compilados do frontend, o binário Rust e o sidecar Python
COPY --from=frontend-builder /app/apps/client/dist /app/dist
COPY --from=rust-builder /app/target/release/nexohub-server /app/nexohub-server
COPY engines/python /app/engines/python

# Configura ambiente virtual Python com dependências do sidecar
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir /app/engines/python

RUN chown -R appuser:appuser /app

USER appuser

ENV PATH="/app/.venv/bin:$PATH"
ENV HOST=0.0.0.0
ENV PORT=8080
ENV STATIC_DIR=/app/dist
ENV RUST_LOG=info

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/v1/health || exit 1

ENTRYPOINT ["/app/nexohub-server"]
