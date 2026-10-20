# ==========================================
# Estágio 1: Build do Frontend (Vite + React)
# ==========================================
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

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
COPY apps/desktop/src-tauri ./apps/desktop/src-tauri

RUN cargo build --release --locked -p nexohub-server

# ==========================================
# Estágio 3: Imagem Final de Execução (Cloud Run)
# ==========================================
FROM debian:bookworm-slim AS runner

# Instala dependências de runtime e OCR (Tesseract com suporte a português e inglês)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libssl3 \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    libgl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Cria usuário não-root por segurança
RUN useradd -m -u 1000 -s /bin/bash appuser

WORKDIR /app

# Copia os arquivos estáticos compilados do frontend e o binário Rust
COPY --from=frontend-builder /app/apps/client/dist /app/dist
COPY --from=rust-builder /app/target/release/nexohub-server /app/nexohub-server

RUN chown -R appuser:appuser /app

USER appuser

ENV HOST=0.0.0.0
ENV PORT=8080
ENV STATIC_DIR=/app/dist
ENV RUST_LOG=info

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/v1/health || exit 1

ENTRYPOINT ["/app/nexohub-server"]
