#!/usr/bin/env bash
# unmei dev 一键准备:建库 + migrations + seed + sqlx prepare
# 用法:cd backend && bash ../scripts/setup-dev.sh

set -euo pipefail
cd "$(dirname "$0")/../backend"

DB="${DATABASE_URL:-sqlite:./unmei-api/unmei.db?mode=rwc}"
DB_FILE="$(echo "$DB" | sed -E 's|^sqlite:||; s|\?.*$||')"

echo "==> 数据库文件: $DB_FILE"
mkdir -p "$(dirname "$DB_FILE")"

# 检查 sqlite3
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "✗ 缺少 sqlite3 命令" >&2
  exit 1
fi

# migrations
echo "==> 跑 migrations"
sqlite3 "$DB_FILE" < migrations/20260625_initial.sql

# seed(只在表为空时)
N=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM quote;")
if [ "$N" = "0" ]; then
  echo "==> 写 seed 数据"
  sqlite3 "$DB_FILE" < seed/seed.sql
else
  echo "==> 已有 $N 条 quote,跳过 seed"
fi

# sqlx prepare(需 sqlx-cli)
if command -v cargo-sqlx >/dev/null 2>&1 || cargo sqlx --version >/dev/null 2>&1; then
  export DATABASE_URL="$DB"
  echo "==> 跑 cargo sqlx prepare(unmei-api)"
  (cd unmei-api && cargo sqlx prepare --workspace -- --bin unmei-api)
  echo "==> 跑 cargo sqlx prepare(unmei-admin-api)"
  (cd unmei-admin-api && cargo sqlx prepare --workspace -- --bin unmei-admin-api)
else
  echo "! sqlx-cli 未安装,跳过 prepare"
  echo "! 请运行: cargo install sqlx-cli --no-default-features --features rustls,sqlite"
  echo "! 或:在 backend/ 设 SQLX_OFFLINE=false 让 cargo 在线检查"
fi

echo ""
echo "✓ 完成。数据库:$DB_FILE"
echo "  · 默认管理员:admin@unmei.local / admin123"
echo "  · 默认演示用户:u_demo(1987-09-17 长沙男)"
