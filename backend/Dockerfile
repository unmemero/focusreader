# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Build the Rust Backend Binary
# -----------------------------------------------------------------------------
FROM rust:bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY Cargo.toml Cargo.lock ./

# Cache cargo dependencies with dummy entrypoints
RUN mkdir -p src && \
    echo 'fn main() {}' > src/main.rs && \
    echo '' > src/lib.rs && \
    cargo build --release || true && \
    rm -rf src

# Copy real source files
COPY src ./src

# Force rebuild of actual sources
RUN touch src/main.rs src/lib.rs && \
    cargo build --release --bin focusreader-backend

# -----------------------------------------------------------------------------
# Stage 2: Minimal Distroless / Debian-Slim Runtime
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runner

# Security updates, CA certificates for HTTPS, and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged service user and data directory
RUN useradd -m -u 10001 -U -s /bin/sh focusreader && \
    mkdir -p /data /app && \
    chown -R focusreader:focusreader /data /app && \
    chmod 777 /data

WORKDIR /app
VOLUME ["/data"]

# Copy compiled binary from builder
COPY --from=builder --chown=focusreader:focusreader /app/target/release/focusreader-backend /usr/local/bin/focusreader-backend

USER focusreader

ENV PORT=3001 \
    HOST=0.0.0.0 \
    DATABASE_URL=file:/data/focusreader.db

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

ENTRYPOINT ["focusreader-backend"]
