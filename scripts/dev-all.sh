#!/usr/bin/env bash
# 一键起 4 服务(api 6028 + admin 6029 + webadmin 6030 + proto 6031)
# mingli-api :6027 假设已在跑(参见 mingli 主项目)

set -e
cd "$(dirname "$0")/.."

# 检查 mingli-api
if ! curl -fsS http://localhost:6027/api/health > /dev/null; then
  echo "✗ mingli-api :6027 未就绪。请先 cd .. && cargo run -p mingli-api"
  exit 1
fi

# 启 unmei-api
( cd backend && DATABASE_URL="sqlite:./unmei-api/unmei.db?mode=rwc" cargo run -p unmei-api ) &
API_PID=$!
echo "✓ unmei-api PID=$API_PID :6028"

# 启 unmei-admin-api
( cd backend && DATABASE_URL="sqlite:./unmei-api/unmei.db?mode=rwc" cargo run -p unmei-admin-api ) &
ADMIN_PID=$!
echo "✓ unmei-admin-api PID=$ADMIN_PID :6029"

# 启 webadmin
( cd webadmin && npm run dev ) &
WEB_PID=$!
echo "✓ webadmin PID=$WEB_PID :6030"

# 启 proto
( cd proto && npm run dev ) &
PROTO_PID=$!
echo "✓ proto PID=$PROTO_PID :6031"

echo ""
echo "全部启动 ↓"
echo "  · 算力 mingli-api  http://localhost:6027/api/health"
echo "  · 业务 unmei-api   http://localhost:6028/v1/health"
echo "  · 后台 admin-api   http://localhost:6029/admin/health"
echo "  · 后台 webadmin    http://localhost:6030  (admin@unmei.local / admin123)"
echo "  · 客户 proto       http://localhost:6031"
echo ""
echo "Ctrl-C 退出"
trap 'kill $API_PID $ADMIN_PID $WEB_PID $PROTO_PID 2>/dev/null' INT TERM
wait
