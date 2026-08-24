# unmei backend · 多阶段 build
# - cargo-chef stage:把 deps 预 build 进可缓存层(workspace 一次 build,两个 binary 复用)
# - runtime stage:精简 debian:slim + 两个 binary,通过 command 选 entrypoint
#
# build 上下文 = `backend`
# 输出 image:`unmei/backend:dev`(docker-compose 两个 service 共用)

# ═══════════════════════════ Stage 1: cargo-chef plan ═══════════════════════════
FROM rust:1.83-slim-bookworm AS chef
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /work
RUN cargo install cargo-chef --version 0.1.71 --locked

# ═══════════════════════════ Stage 2: plan recipe ═══════════════════════════
FROM chef AS planner
COPY . .
# kevy-embedded 是 path-deps 在 backend 外,需要单独 copy
# docker-compose build context 已包含 backend/ 整个目录;path-deps 要在 build 之外解决,这里把 path 改成 git/vendor 处理
RUN cargo chef prepare --recipe-path recipe.json

# ═══════════════════════════ Stage 3: build deps + bins ═══════════════════════════
FROM chef AS builder
COPY --from=planner /work/recipe.json recipe.json
# 编 deps 缓存层
RUN cargo chef cook --release --recipe-path recipe.json
# 编实际代码
COPY . .
RUN cargo build --release --bin unmei-api --bin unmei-admin-api

# ═══════════════════════════ Stage 4: runtime ═══════════════════════════
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Asia/Shanghai
WORKDIR /app

COPY --from=builder /work/target/release/unmei-api       /app/unmei-api
COPY --from=builder /work/target/release/unmei-admin-api /app/unmei-admin-api

# 默认 entrypoint = unmei-api;docker-compose 给 unmei-admin-api 用 command 切换
CMD ["/app/unmei-api"]
