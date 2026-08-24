#!/usr/bin/env bash
# 变异测试 · check-sql 报得出红吗
#
# 单独一支而不是并进 `mutationtest-checks.sh`：那一支在 mini 那条 workflow 里跑，
# 那里【没有 Postgres】。这一支要连库，所以跟 check-sql 一起放在 backend 那条。
#
# 为什么非有不可：这支被测的脚本，在写它的当天**假绿过两次**——
#   · 报错行前面带 `psql:<stdin>:123:` 前缀，判 startswith('ERROR:') 永远不匹配，
#     于是 326 条一条也没在看，输出却是「全过」
#   · 记号用 `\echo`（stdout）而报错在 stderr，合并后先后不保证，
#     错归到隔壁那条上 —— 行号看着像真的，却是错的
# 两次都是靠植入缺陷发现的，读代码读不出来。
#
# 用法: bash scripts/mutationtest-sql.sh
set -u
cd "$(dirname "$0")/.."

FILES=(backend/unmei-api/src/routes/natal.rs backend/unmei-api/src/routes/village.rs)
# ── 开跑之前两道自保 ────────────────────────────────────────────
# 这支脚本【会真改源码】，所以两件事必须先确认：
#
# 1. 要改的那几个文件在 git 里是干净的。上一轮若因中断留下了变异，
#    这一轮备份的就是【已变异】的文件，跑完「还原」等于把变异永久烙进去。
# 2. 同时只能跑一份。两份并行时,各自的备份/还原互相冲掉 ——
#    2026-08-18 就这么把 `/admin/users` 的变异留在了工作区。
LOCK=/tmp/unmei-mutationtest.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  # 锁在,但持有者可能已经不在了 —— 管道提前关闭(`| head`)会发 SIGPIPE,
  # EXIT trap 根本跑不到,锁就留了下来。所以锁里记 PID:进程没了就接管。
  # 一把永远清不掉的锁,比它要防的问题更烦人。
  OWNER=$(cat "$LOCK/pid" 2>/dev/null || echo 0)
  if [ "$OWNER" != 0 ] && kill -0 "$OWNER" 2>/dev/null; then
    echo "✗ 已经有一份变异测试在跑（pid ${OWNER}）。它会改源码，不能并行。"
    exit 1
  fi
  echo "· 捡起一把没主的锁（上一次是 pid ${OWNER}，已经不在了）"
fi
echo $$ > "$LOCK/pid"

DIRTY=$(git status --porcelain -- "${FILES[@]}" 2>/dev/null)
if [ -n "$DIRTY" ]; then
  echo "✗ 要改的文件在 git 里不干净，先处理掉再跑（否则会把改动当成基准备份下来）:"
  echo "$DIRTY" | sed 's/^/   /'
  exit 1
fi

BAK=$(mktemp -d)
# 一个 trap 做两件事。分两个 `trap ... EXIT` 的话后一个会把前一个【覆盖掉】。
trap 'for f in "${FILES[@]}"; do cp "$BAK/$(echo "$f" | tr / _)" "$f"; done; rm -rf "$BAK" "$LOCK"' EXIT
# 信号先转成退出,好让上面那个 EXIT 跑到
trap 'exit 130' INT TERM PIPE
for f in "${FILES[@]}"; do cp "$f" "$BAK/$(echo "$f" | tr / _)"; done
restore() { for f in "${FILES[@]}"; do cp "$BAK/$(echo "$f" | tr / _)" "$f"; done; }

pass=0; fail=0

# mutate <说明> <文件> <旧> <新> <期望在报告里出现的片段>
#
# 期望的片段要挑【不随编辑漂移】的东西。原先写的是 `natal.rs:12` ——
# 行号编码进了断言，而 2026-08-18 给同一个文件加了几行之后，
# 那条 SQL 挪到 141 行，CI 当场红，红的是断言不是产品。
# 现在断言 Postgres 报出来的那个名字（`natal_sumary` / `n.yaer`）：
# 它只有在【认对了那一条 SQL】时才会出现，而且改多少行都不动。
mutate() {
  local desc="$1" file="$2" old="$3" new="$4" want="$5"
  restore
  if ! python3 - "$file" "$old" "$new" <<'EOFPY'
import pathlib, sys
p = pathlib.Path(sys.argv[1]); s = p.read_text(encoding='utf-8')
c = s.count(sys.argv[2])
# 【必须恰好一处】。多处时种到哪一处说不准，而漂走之后失败信息会说
# 「门禁没抓到」—— 指错方向。跨目录那支 2026-08-18 真被这么坑过一次。
if c != 1:
    sys.exit(f'变异植不进去（源码里有 {c} 处，要恰好 1 处）: {sys.argv[2][:60]}')
p.write_text(s.replace(sys.argv[2], sys.argv[3], 1), encoding='utf-8')
EOFPY
  then
    printf '  ✗ %-28s 变异没植进去（基准源码变了？）\n' "$desc"; fail=$((fail+1)); return
  fi

  out=$(python3 scripts/check-sql.py 2>&1)
  if [ $? -eq 0 ]; then
    printf '  ✗ %-28s 没抓到 —— 这就是下一个假绿\n' "$desc"; fail=$((fail+1))
  elif ! echo "$out" | grep -q "$want"; then
    printf '  ✗ %-28s 抓到了，但没指到 %s —— 行号错了比没有行号更糟\n' "$desc" "$want"
    echo "$out" | grep '✗' | head -3 | sed 's/^/       /'
    fail=$((fail+1))
  else
    printf '  ✓ %-28s 抓到，且指对了位置\n' "$desc"; pass=$((pass+1))
  fi
}

echo "══ check-sql · 变异测试 ══"
echo
mutate "表名少一个字母" backend/unmei-api/src/routes/natal.rs \
  'FROM natal_summary WHERE' 'FROM natal_sumary WHERE' 'natal_sumary'
mutate "列名写错" backend/unmei-api/src/routes/village.rs \
  'SELECT n.year, n.month' 'SELECT n.yaer, n.month' 'n.yaer'

restore
echo
echo "── 对照：没变异的源码必须绿 ──"
if python3 scripts/check-sql.py >/dev/null 2>&1; then
  printf '  ✓ check-sql 绿\n'; pass=$((pass+1))
else
  printf '  ✗ check-sql 在【干净】源码上就报红 —— 变异测试的结论不可信\n'; fail=$((fail+1))
  python3 scripts/check-sql.py 2>&1 | tail -8 | sed 's/^/     /'
fi

echo
echo "抓到 $pass 项 · 漏掉 $fail 项"
[ "$fail" -eq 0 ] || exit 1
