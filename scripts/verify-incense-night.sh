#!/usr/bin/env bash
# 同步点香（设计册 E1）那一屏 —— 到点那一支怎么验。
#
# 它一周只有二十五分钟能碰上，而「一周只有二十五分钟能验」跟「验不到」
# 实际上是一回事。所以后端把「几点点香」做成了可配的
# （UNMEI_INCENSE_WEEKDAY / HOUR / MINUTES）——
# **那不是测试后门**：运营想把时间挪一个钟头本来就不该改代码重新发版。
#
# 这一支起一个把时刻设成【现在】的后端实例（另一个端口、另一个缓存目录，
# 不碰 6028 那个），让镜像打它，把到点那一档走一遍。
#
# 用法： bash scripts/verify-incense-night.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# 两个临时端口自己找空的。写死一个的后果是每隔几周撞上别的东西，
# 而报出来的是「端口被占」—— 一句跟这次要验的事毫无关系的话。
# （这一轮连撞三个：6038 上一次的残留、6042 上的 postgres、6043 上的 pf-api。）
pick_free_port() {
  local p="$1"
  while lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; do p=$((p + 1)); done
  echo "$p"
}
PORT="${INCENSE_API_PORT:-$(pick_free_port 6038)}"
WEBP="${INCENSE_WEB_PORT:-$(pick_free_port $((PORT + 1)))}"

WD=$(python3 -c "import datetime,zoneinfo;print(datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Shanghai')).weekday())")
HR=$(TZ=Asia/Shanghai date +%-H)
echo "（上海现在是周$((WD+1)) $HR 点 —— 把这一场设成此刻）"

# 窗口放到三小时：后端算的场次是从 HOUR:00 起、烧 MINUTES 分钟，
# 而这一轮验证要跑五到八分钟 —— HOUR 固定在【启动那一刻】,
# 一跨整点就掉出窗口，于是点香那一整段静静走了「不到点」分支【报绿】。
# 2026-08-30 撞上一次：285 条全绿，而这支脚本存在的全部意义就是走到点那一档。
#
# 注释不能插进下面那条命令里 —— 上一行以 `\` 结尾，续接一行注释就把整条
# 命令截断了，进程根本不起，而报出来是「那个实例没起来」。`bash -n` 查不出：
# 语法是合法的，变的是语义。同一天在 gates.sh 上踩过它的近亲。
DATABASE_URL="${DATABASE_URL:-postgres://unmei:unmei_dev_pwd@localhost:6032/unmei}" \
UNMEI_API_BIND="127.0.0.1:$PORT" \
UNMEI_CACHE_DIR="$(mktemp -d)" \
UNMEI_INCENSE_WEEKDAY="$WD" UNMEI_INCENSE_HOUR="$HR" UNMEI_INCENSE_MINUTES=180 \
  backend/target/debug/unmei-api > /tmp/api-incense.log 2>&1 &
SRV=$!
# 退出码要自己接住再还回去 —— trap 里最后一句成功的话会把它抹成 0
trap 'rc=$?; kill $SRV 2>/dev/null || true; exit $rc' EXIT
trap 'exit 130' INT TERM PIPE

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/v1/health" && break
  sleep 0.5
done
curl -sf -o /dev/null "http://127.0.0.1:$PORT/v1/health" || { echo "✗ 那个实例没起来，看 /tmp/api-incense.log"; exit 1; }

echo "（后端 :${PORT} · 镜像 :${WEBP}）"
LOG=$(mktemp)
set +e
WEB_PORT="$WEBP" bash web/run-verify.sh --api="http://127.0.0.1:${PORT}" \
  --shots="${INCENSE_SHOTS:-/tmp/shots-night}" 2>&1 | tee "$LOG"
rc=${PIPESTATUS[0]}
set -e

# 走没走到【到点】那一档，自己核一遍。
# 不核的话它掉进「不到点」分支照样报绿 —— 而那一档普通的 run-verify
# 本来就在跑，这支脚本跑它等于什么都没验(「跳过不是通过」)。
if ! grep -q "点得上" "$LOG"; then
  echo
  echo "✗ 这一趟没走到【到点】那一档 —— 点香那一整段一条都没验到"
  echo "  （多半是跑的过程中跨了整点，或者后端没认那几个环境变量）"
  rm -f "$LOG"; exit 1
fi
rm -f "$LOG"
exit $rc
