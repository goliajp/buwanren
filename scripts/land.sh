#!/usr/bin/env bash
# 把一支分支落到 develop：合并 → 【在合并结果上】跑门禁 → 全绿才推。
#
# 这条规矩 .claude/CLAUDE.md 里写着（「推之前必须在合并后的 develop 上
# 跑一遍门禁，不是只在分支上跑过就算」），而它一直靠人记 ——
# 2026-08-31 我两次没记住：一次把 merge 和 push 串在一条命令里、
# 中间没跑；一次门禁报了 1 挂而我没等结果就推了。
# 靠记的规矩迟早会漏，所以把它变成一条能跑的命令。
#
# 用法：bash scripts/land.sh <分支名> "<合并说明>"
set -uo pipefail
cd "$(dirname "$0")/.."

# 用显式判断而不是 `${1:?说明}` —— 那个 `?` 紧挨着汉字，
# 会被界面文案的标点门禁当成「汉字前的半角问号」（它看不出那是 bash 语法）。
BR="${1:-}"
MSG="${2:-}"
[ -n "$BR" ]  || { echo "用法：bash scripts/land.sh <分支名> <合并说明>"; exit 1; }
[ -n "$MSG" ] || { echo "用法：bash scripts/land.sh <分支名> <合并说明>"; exit 1; }

git rev-parse --verify "$BR" >/dev/null 2>&1 || { echo "✗ 没有这一支：$BR"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "✗ 工作区不干净，先处理掉"; git status -s; exit 1; }

echo "── 合并 $BR → develop ──"
git checkout develop || exit 1
git merge --no-ff "$BR" -m "$MSG" || { echo "✗ 合并没成"; exit 1; }

echo
echo "── 在【合并后的 develop】上跑门禁 ──"
LOG=$(mktemp)
bash scripts/gates.sh 2>&1 | tee "$LOG"
if ! grep -qE '^过 [0-9]+ · 挂 0 · 跳过 0' "$LOG"; then
  echo
  echo "✗ 合并后的 develop 没有全绿 —— 不推。"
  echo "  这一支已经合进本地 develop 了。两条路："
  echo "    · 修好，再跑一次这条命令"
  echo "    · git reset --hard HEAD~1   ← 只退这次合并"
  echo
  echo "  【别用 git reset --hard origin/develop】除非你确认本地没有别的"
  echo "  未推提交 —— 它会把那些一起丢掉。2026-08-31 我就这么丢了两个，"
  echo "  从 reflog 才捡回来。"
  rm -f "$LOG"; exit 1
fi
rm -f "$LOG"

echo
git push origin develop || { echo "✗ 推不上去"; exit 1; }
git branch -D "$BR"
echo "✓ $BR 已落到 develop 并推出去了"
