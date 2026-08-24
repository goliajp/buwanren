#!/usr/bin/env bash
# unmei dev 一键准备:起 PG18 容器并等它健康。
#
# migrations 与 seed **不在这里跑** —— unmei-api / unmei-admin-api 启动时
# 自己 sqlx::migrate! + 灌 seed/seed.sql(幂等 ON CONFLICT DO NOTHING)。
#
# 用法:bash scripts/setup-dev.sh

set -euo pipefail
cd "$(dirname "$0")/.."

PG_PORT="${POSTGRES_PORT:-6032}"
PG_USER="${POSTGRES_USER:-unmei}"
PG_DB="${POSTGRES_DB:-unmei}"

if [ ! -f .env ]; then
  echo "==> 没有 .env，从 .env.example 复制一份"
  cp .env.example .env
fi

echo "==> 起 postgres18 容器"
docker compose up -d postgres

echo "==> 等健康检查通过"
for i in $(seq 1 40); do
  status=$(docker inspect -f '{{.State.Health.Status}}' unmei-postgres 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "    ✓ postgres healthy"
    break
  fi
  if [ "$i" = "40" ]; then
    echo "    ✗ 等了 80s 仍未健康，当前状态： $status" >&2
    docker compose logs --tail 30 postgres >&2
    exit 1
  fi
  sleep 2
done

echo ""
echo "✓ 完成。"
PG_PASSWORD="${POSTGRES_PASSWORD:-unmei_dev_pwd}"
echo "  DATABASE_URL=postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}"
echo ""
echo "  下一步："
echo "    cd backend && cargo run -p unmei-api          # :6028 · 首次启动自动跑 migrations + seed"
echo "    cd backend && cargo run -p unmei-admin-api    # :6029"
echo "  或整栈一把梭：  docker compose up -d --build"
echo ""
echo "  · 默认管理员：admin@unmei.local / admin123"
