#!/usr/bin/env bash
# 起一个静态服务,跑一遍动线,收工。
#
# 单独一支脚本而不是把这几行塞进 workflow:CI 与本机要跑的是【同一串命令】,
# 塞进 yml 里本机就得手敲一遍,敲得不一样时,CI 绿而本机红(或者反过来),
# 而那种不一致最难查。
set -euo pipefail
cd "$(dirname "$0")/.."

# 先组装,再起服务。这一步以前在【调用方】那边(workflow 里一步、本机手敲一步),
# 于是本机改完 runtime 直接跑这支脚本,量到的是【上一次构建】的结果 ——
# 而那种失效长得跟数据一模一样:一整轮绿,说的却是旧代码的事。
# (2026-08-18 真踩到:picker 改完连跑三轮,拿的都是改之前的产物。)
bun web/build.mjs >/dev/null

PORT="${WEB_PORT:-6031}"

# 端口得是空的。被别人占着的话,下面的 http.server 绑不上就退了,
# 而后面那圈 curl 照样能连上【那个别人】—— 于是这一轮验的是别人的服务器,
# 结果看着像数据。(2026-08-18 真踩到:一个跑偏的 vite 占了 6031。)
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ 端口 $PORT 被占着，这一轮不能验 —— 占着它的是："
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN | tail -n +2 | sed 's/^/   /'
  echo "  换个端口：WEB_PORT=6041 bash web/run-verify.sh"
  exit 1
fi

python3 -m http.server "$PORT" --directory web/dist >/dev/null 2>&1 &
SRV=$!
# trap 里最后一句是 `|| true`,而它会把【整支脚本的退出码抹成 0】——
# 于是脚本死在半路(下面那个空数组就是一例),调用方拿到的仍然是「过了」。
# 这一支是这一堆门禁里最重的一支,它报绿等于说「动线全通」。
# 所以退出码要自己接住、原样还回去。
trap 'rc=$?; kill $SRV 2>/dev/null || true; exit $rc' EXIT

# 等它真的起来再开始 —— 直接跑的话第一次连接可能被拒
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT/index.html" >/dev/null && break
  sleep 0.25
done

# 排盘服务(另一个仓库)在本机跑着的话就自动接上 —— 不用记得加参数。
# 这一档验的是【有本命】那个状态,而那是真实用户几乎永远所处的状态:
# 不接它,一屏放不放得下只在「还没建本命」上验过,而那一屏少了两大块。
# (2026-08-23:接上之后当场量出 home 超 185px、natal 超 180px,
#  两页在没有本命时都是刚好放得下的。)
# CI 上那台机器没有它,照旧明说跳过,不给它做假的。
MINGLI_ARG=()
# 判据是「6027 上有东西应答」,不是某一条路径给 200 ——
# 拿 /health 当探针在这个项目里已经误判过两次(后端与这里),
# 那条路由压根不存在,404 说明服务活着。
if [[ "$*" != *"--mingli="* ]] \
   && curl -s --max-time 1 -o /dev/null "http://127.0.0.1:6027/" 2>/dev/null; then
  MINGLI_ARG=(--mingli=http://127.0.0.1:6027)
  echo "（本机 6027 上有排盘服务，自动接上 —— 这一档会验到用神）"
fi

# `"${MINGLI_ARG[@]}"` 在空数组上会炸 —— macOS 自带的是 bash 3.2,
# `set -u` 下空数组展开就是 unbound variable。而排盘服务没起时它【就是】空的,
# 也就是注释上面那句「CI 上那台机器没有它」说的那种机器。
# 配上上面那个把退出码抹平的 trap,结果是:**没有排盘服务的机器上,
# 这一支从来没跑过,而且每次都报绿**。
# `${A[@]+"${A[@]}"}` 是 3.2 下安全的写法:数组为空时整个展开成零个词。
bun web/verify.mjs --base="http://127.0.0.1:$PORT" ${MINGLI_ARG[@]+"${MINGLI_ARG[@]}"} "$@"
