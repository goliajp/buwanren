#!/usr/bin/env bash
# 跑后端全套测试，并断言【它们真的跑了】。
#
# 没有这道断言的话，集成测试哪天悄悄退化成「无 DB 静默跳过」也看不出来 ——
# 本机踩过一次:15 passed,其实一个没跑。
#
# 2026-08-25:这一段原先只在 CI 的 backend.yml 里。CI 删掉时差点跟着丢。
#
# shell 必须让 cargo 的退出码穿透管道 —— `cargo test | tee` 拿到的是 tee 的 0，
# 测试挂了照样看着像绿的。所以这里用 pipefail。
set -uo pipefail
cd "$(dirname "$0")/.."
LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

(cd backend && TEST_DATABASE_URL="${TESTDB:?TESTDB 没设}" cargo test --workspace 2>&1) | tee "$LOG"
RC=${PIPESTATUS[0]}
[ "$RC" -ne 0 ] && exit "$RC"

PASSED=$(grep -oE '^test result: ok\. [0-9]+ passed' "$LOG" | grep -oE '[0-9]+' | paste -sd+ - | bc)
echo "通过的测试总数：${PASSED:-0}"
# 纯逻辑单测（risk DSL + 状态机 + money + region + carrier）约 25 条；
# 加上用例层集成测试后远超这个数。低于 60 说明集成测试没跑起来。
if [ "${PASSED:-0}" -lt 60 ]; then
  echo "✗ 只有 ${PASSED:-0} 条测试通过，用例层集成测试没跑（多半是 TEST_DATABASE_URL 没生效）"
  exit 1
fi
echo "✓ 用例层集成测试确实跑了"
