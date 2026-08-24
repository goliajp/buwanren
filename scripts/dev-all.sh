#!/usr/bin/env bash
# 一键起本机那几支：api 6028 + admin 6029 + webadmin 6030
# mingli-api :6027 假设已在跑(参见 mingli 主项目)
#
# `--lan` 让 unmei-api 绑 0.0.0.0 而不是回环 —— 手机连不上回环，
# 而那时的报错长得像「登录失败」。真机验收（工序单第 11 步）要用它，
# 步骤见 docs/ACCEPTANCE-11.md。

set -e
cd "$(dirname "$0")/.."

DB_URL="${DATABASE_URL:-postgres://${POSTGRES_USER:-unmei}:${POSTGRES_PASSWORD:-unmei_dev_pwd}@localhost:${POSTGRES_PORT:-6032}/${POSTGRES_DB:-unmei}}"

# 检查 mingli-api
if ! curl -fsS http://localhost:6027/api/health > /dev/null; then
  echo "✗ mingli-api :6027 未就绪。请先 cd .. && cargo run -p mingli-api"
  exit 1
fi

# 检查 pg(migrations / seed 由 binary 启动时自己跑)
if ! nc -z localhost "${POSTGRES_PORT:-6032}" 2>/dev/null; then
  echo "✗ postgres :${POSTGRES_PORT:-6032} 未就绪。请先 bash scripts/setup-dev.sh"
  exit 1
fi

# `--lan`：绑 0.0.0.0，手机才连得上（默认仍是回环）
BIND="127.0.0.1:6028"
LAN_IP=""
if [ "${1:-}" = "--lan" ]; then
  BIND="0.0.0.0:6028"
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
fi

# 启 unmei-api
( cd backend && DATABASE_URL="$DB_URL" UNMEI_API_BIND="$BIND" cargo run -p unmei-api ) &
API_PID=$!
echo "✓ unmei-api PID=$API_PID :6028"

# 启 unmei-admin-api
( cd backend && DATABASE_URL="$DB_URL" cargo run -p unmei-admin-api ) &
ADMIN_PID=$!
echo "✓ unmei-admin-api PID=$ADMIN_PID :6029"

# 启 webadmin
( cd webadmin && npm run dev ) &
WEB_PID=$!
echo "✓ webadmin PID=$WEB_PID :6030"

echo ""
echo "全部启动 ↓"
echo "  · 算力 mingli-api  http://localhost:6027/api/health"
echo "  · 业务 unmei-api   http://localhost:6028/v1/health"
echo "  · 后台 admin-api   http://localhost:6029/admin/health"
echo "  · 后台 webadmin    http://localhost:6030  (admin@unmei.local / admin123)"
if [ -n "$LAN_IP" ]; then
  echo ""
  echo "手机连这台机器："
  echo "  · 先自己验一下通不通：curl http://$LAN_IP:6028/v1/health"
  echo "  · 再把 mini/miniprogram/config/index.ts 的 dev 那行改成 http://$LAN_IP:6028"
  echo "    （手机上的 localhost 是手机自己；验完记得改回来，别提交那一行）"
  echo "  · 发一张能扫的御守：python3 scripts/dev-omamori.py"
  echo "  · 整套步骤：docs/ACCEPTANCE-11.md"
fi

echo ""
echo "Ctrl-C 退出"
trap 'kill $API_PID $ADMIN_PID $WEB_PID 2>/dev/null' INT TERM
wait
