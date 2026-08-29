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

# 端口得是空的。被别人占着的话,下面的 http.server 绑不上就退了,
# 而后面那圈 curl 照样能连上【那个别人】—— 于是这一轮验的是别人的服务器,
# 结果看着像数据。(2026-08-18 真踩到:一个跑偏的 vite 占了 6031。)
占着() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

if [ -n "${WEB_PORT:-}" ]; then
  # 明说了要哪个口,就不替他挪 —— 挪了他会拿不准自己验的是哪一个
  PORT="$WEB_PORT"
  if 占着 "$PORT"; then
    echo "✗ 端口 $PORT 被占着，这一轮不能验 —— 占着它的是："
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN | tail -n +2 | sed 's/^/   /'
    exit 1
  fi
else
  # 没指定就自己找个空的。原先是【占着就整支挂掉】,而门禁里挂一支和
  # 「动线真的断了」在总账上长得一模一样 —— 今天(08-30)就为这个丢了一轮:
  # 截屏用的静态服务一直占着 6031,于是「web verify · 动线」连着报红,
  # 而失败账是空的(一条断言都没跑到),我照着空账去查机器负载。
  # 换个空口这件事脚本自己就能做,让人去查才是浪费。
  PORT=""
  for p in 6031 6041 6042 6043 6044 6045; do
    占着 "$p" || { PORT="$p"; break; }
  done
  if [ -z "$PORT" ]; then
    echo "✗ 6031/6041-6045 全被占着，这一轮不能验 —— 腾一个出来，或 WEB_PORT= 指一个"
    exit 1
  fi
  [ "$PORT" = 6031 ] || echo "· 6031 被占着，这一轮改用 $PORT"
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
# 浏览器被系统收掉,跟「动线断了」在总账上长得一模一样 —— 都是这一支挂。
# 分得开的只有两条同时出现的旁证:输出里有 Playwright 那句固定的
# 「Target page, context or browser has been closed」,而失败账是【空的】
# (一条断言都没红,是半路没的)。机器忙的时候 Chrome 会被内存压力收走,
# 08-30 这台负载 10 以上,一轮跑五页就没。
#
# 重来一次是正当的:这一支验的东西没有副作用,重跑一遍拿到的是同一个答案。
# 两次都被收走就明说是哪一种 —— 不许让它跟真红混在一起,
# 因为「有时候红」会把每一次真红都变得可以被当成噪音。
跑一趟() {
  bun web/verify.mjs --base="http://127.0.0.1:$PORT" ${MINGLI_ARG[@]+"${MINGLI_ARG[@]}"} "$@"
}
# 变量名只能是 ASCII —— macOS 自带的 bash 3.2 里 `日志=$(mktemp)` 直接
# 「No such file or directory」，而报的位置是那一行的【值】，看着像 mktemp 坏了。
# 函数名没这个限制。
被收走了() {
  grep -q 'Target page, context or browser has been closed\|Target closed\|browser has been closed' "$1" \
    && [ ! -s "${VERIFY_FAILLOG:-/tmp/verify-failures.txt}" ]
}

LOGF=$(mktemp)
if 跑一趟 "$@" 2>&1 | tee "$LOGF"; then
  rm -f "$LOGF"; exit 0
fi
if 被收走了 "$LOGF"; then
  echo "· 浏览器半路被系统收走了（失败账是空的，一条断言都没红）—— 重来一次"
  rm -f "$LOGF"; LOGF=$(mktemp)
  if 跑一趟 "$@" 2>&1 | tee "$LOGF"; then
    rm -f "$LOGF"; exit 0
  fi
  if 被收走了 "$LOGF"; then
    echo "✗ 连着两轮浏览器都被系统收走，【这一轮没跑完】——"
    echo "  它跟「动线断了」不是一回事：失败账是空的，一条断言都没红。"
    echo "  机器闲下来再跑一遍（当前负载：$(uptime | sed 's/.*averages*: *//')）。"
    rm -f "$LOGF"; exit 2
  fi
fi
rm -f "$LOGF"
exit 1
