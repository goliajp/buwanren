#!/usr/bin/env bash
# 起 vite（它把 /admin 代理到 :6029），逐页走一遍，收工。
#
# 跟 web/run-verify.sh 同一个套路：CI 与本机跑的是【同一串命令】，
# 塞进 yml 里本机就得手敲一遍，敲得不一样时一边绿一边红，那种不一致最难查。
#
# 需要后台 API 起着（:6029）。没起就直说，不假装跑过。
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${WEBADMIN_PORT:-6030}"
API="${ADMIN_API:-http://127.0.0.1:6029}"

if ! curl -sf "$API/admin/health" >/dev/null 2>&1; then
  echo "✗ 后台 API（${API}）没起，这一轮没法验。"
  echo "  起它：cd backend && DATABASE_URL=… UNMEI_ADMIN_API_BIND=127.0.0.1:6029 cargo run -p unmei-admin-api"
  exit 1
fi

[ -d webadmin/node_modules ] || (cd webadmin && npm ci --no-audit --no-fund)

# --strictPort:端口被占就【失败】,不要顺延。
# vite 的 --port 只是偏好 —— 顺延之后,脚本 curl 的那个端口上是【别人】,
# 而它照样答 200,于是这一轮验的是另一个服务。(2026-08-18 真踩到:
# 上一次遗留的 vite 占着 6030,新起的挪到 6031,把移动网页版的服务器挤掉了。)
(cd webadmin && npx vite --port "$PORT" --strictPort --host 127.0.0.1 >/tmp/webadmin-vite.log 2>&1 &
 echo $! > /tmp/webadmin-vite.pid)
trap 'kill "$(cat /tmp/webadmin-vite.pid)" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break
  sleep 0.5
done
curl -sf "http://127.0.0.1:$PORT/" >/dev/null || { echo "✗ vite 没起来"; tail -20 /tmp/webadmin-vite.log; exit 1; }

bun scripts/webadmin-verify.mjs --base="http://127.0.0.1:$PORT" "$@"

# 通知条那一支也在这里跑 —— vite 就在上面起着，而它此前**只在本机门禁里**，
# CI 一次都没跑过（2026-08-19 普查 41 项门禁时查出来的）。
# 它要写库：给了 PSQL_URL 就直连，没给就退回本机那个容器。
bun scripts/browser-smoke.mjs --base="http://127.0.0.1:$PORT"
