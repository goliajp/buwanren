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
# vite 的 --port 只是偏好 —— 顺延之后，脚本 curl 的那个端口上是【别人】,
# 而它照样答 200,于是这一轮验的是另一个服务。(2026-08-18 真踩到：
# 上一次遗留的 vite 占着 6030,新起的挪到 6031,把移动网页版的服务器挤掉了。)
# 先清掉 vite 的依赖预打包缓存。换过依赖之后它不一定自己失效 ——
# 2026-08-25 升 react-router 时就撞上：类型过、构建过，页面却整片空白，
# 控制台报「Invalid hook call · 装了两份 React」,而 node_modules 里
# 只有一份。清掉 .vite 就好了。
# 一支【结论取决于隐藏陈旧状态】的门禁早晚要骗人：那一次它报的红看着像产品坏了。
# 代价是每轮多一次预打包(一秒上下),换的是这个红永远指向真问题。

# 【先看这个端口上有没有别人】。2026-09-03 踩到：开发用的 dev server 一直
# 占着 6030，`--strictPort` 让这里起的 vite 当场退出，而下面那个探针问的是
# 「6030 上有没有人应答」—— 别人答了 200，于是这一轮**拿别人的服务器**
# 跑完了 21 条断言。更糟的是上面那句 `rm -rf .vite` 同时删掉了那个
# dev server 的预打包缓存，它随即报「Invalid hook call · 两份 React」，
# 于是 19 页全红 —— 红的看着像产品坏了，实际是这支门禁自己撞的。
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ $PORT 上已经有人在听了 —— 这一支要自己起 vite，先把那个停掉："
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN | sed 1d | awk '{print "     pid "$2" "$1}'
  exit 1
fi

rm -rf webadmin/node_modules/.vite
# 【直接起 vite，不经 npx】。npx 会 fork 出真正的 vite 进程，`$!` 记下的是
# npx 自己 —— 退出时 trap 杀的是父，监听 6030 的那个子进程活了下来。
# 于是每跑一轮就在 6030 上留一个孤儿，【下一轮的这支必红】，而红的看着
# 像「有人占了端口」，不像「上一轮没收干净」。2026-09-04 连撞两轮才认出来：
# 孤儿的启动时间正好是上一轮跑到这支的时刻。
(cd webadmin && ./node_modules/.bin/vite --port "$PORT" --strictPort --host 127.0.0.1 >/tmp/webadmin-vite.log 2>&1 &
 echo $! > /tmp/webadmin-vite.pid)
# 收尾两道:先杀记下的那个,再【按端口兜底】—— 记下的 pid 万一不是真身,
# 端口这一道仍然收得干净。兜底只杀这个端口上的,不误伤别人。
cleanup_vite() {
  kill "$(cat /tmp/webadmin-vite.pid 2>/dev/null)" 2>/dev/null || true
  local leftover
  leftover="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  [ -n "$leftover" ] && kill $leftover 2>/dev/null || true
  return 0
}
trap cleanup_vite EXIT

VITE_PID="$(cat /tmp/webadmin-vite.pid)"
for _ in $(seq 1 60); do
  # 【两个条件都要】。端口答话说明「有人在」，进程还活着才说明「是我起的那个」。
  # 这是与被测量无关的那个旁证 —— 只问端口的话，测量装置的失效
  # 跟数据长得一模一样。
  kill -0 "$VITE_PID" 2>/dev/null || break
  curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break
  sleep 0.5
done
if ! kill -0 "$VITE_PID" 2>/dev/null; then
  echo "✗ 我起的那个 vite 已经死了（pid $VITE_PID）"; tail -20 /tmp/webadmin-vite.log; exit 1
fi
curl -sf "http://127.0.0.1:$PORT/" >/dev/null || { echo "✗ vite 没起来"; tail -20 /tmp/webadmin-vite.log; exit 1; }

# `"$@"` 把 `--shots=…` 一路透传下去 —— 25 计划的后台逐页走靠它留图
bun scripts/webadmin-verify.mjs --base="http://127.0.0.1:$PORT" "$@"

# 通知条那一支也在这里跑 —— vite 就在上面起着，而它此前**只在本机门禁里**，
# CI 一次都没跑过（2026-08-19 普查 41 项门禁时查出来的）。
# 它要写库：给了 PSQL_URL 就直连，没给就退回本机那个容器。
bun scripts/browser-smoke.mjs --base="http://127.0.0.1:$PORT"
