#!/usr/bin/env bash
# 变异测试 —— 门禁能报绿不等于它报得出红。
#
# 「全部通过」这句话只有在【工具确实抓得住坏掉的东西】时才有意义。
# 本仓库反复栽在假绿上:写死房间清单、打印 ✗ 却退 0、解析不到就静静跳过。
# 这个脚本往 design.html 的副本里逐个植入已知缺陷,跑全套门禁,
# 断言【该抓的那支抓到了】。哪支没抓到,它就是下一个假绿。
#
# 用法:bash rooms/tools/mutationtest.sh [design.html]
set -u
export PATH="$HOME/.bun/bin:$PATH"
SRC="${1:-rooms/design.html}"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
pass=0; fail=0

# 跑一支门禁,回显退出码
gate() { # gate <名字> <文件>
  case "$1" in
    assetlint)    bun rooms/tools/assetlint.js    "$2" >/dev/null 2>&1 ;;
    roomaudit)    bun rooms/tools/roomaudit.js    "$2" >/dev/null 2>&1 ;;
    hardcodelint) bun rooms/tools/hardcodelint.js "$2" >/dev/null 2>&1 ;;
    pathlint)     python3 rooms/tools/pathlint.py "$2" >/dev/null 2>&1 ;;
    regress)      bun rooms/tools/regress.js      "$2" check >/dev/null 2>&1 ;;
  esac
}

# mutate <说明> <该抓到的门禁> <python 变异代码>
mutate() {
  local desc="$1" expect="$2" code="$3"
  local f="$WORK/m.html"
  cp "$SRC" "$f"
  if ! python3 -c "
import pathlib,sys
p=pathlib.Path('$f'); s=p.read_text(encoding='utf-8')
$code
p.write_text(s,encoding='utf-8')
"; then printf '  ✗ %-34s 变异没植进去(基准源码变了?)\n' "$desc"; fail=$((fail+1)); return; fi

  if gate "$expect" "$f"; then
    printf '  ✗ %-34s %s 没抓到 —— 这就是下一个假绿\n' "$desc" "$expect"; fail=$((fail+1))
  else
    printf '  ✓ %-34s %s 抓到\n' "$desc" "$expect"; pass=$((pass+1))
  fi
}

echo "══ 变异测试:往副本里植入缺陷,看门禁抓不抓得住 ══"

mutate "家具挪出画布" assetlint \
  "s=s.replace(\"['bailu_broom', 220, 2040]\",\"['bailu_broom', 220, 9000]\",1); assert '9000' in s"

mutate "foot 超出素材范围" assetlint \
  "s=s.replace('w: 68, h: 204, base: 204, foot: [48, 176, 20, 28]','w: 68, h: 204, base: 204, foot: [48, 176, 90, 28]',1); assert '90, 28' in s"

mutate "素材引用不存在的 id" assetlint \
  "s=s.replace(\"['bailu_broom', 220, 2040]\",\"['bailu_no_such_thing', 220, 2040]\",1); assert 'no_such_thing' in s"

mutate "家具吞掉整间房(锚点全被埋)" pathlint \
  "s=s.replace('w: 68, h: 204, base: 204, foot: [48, 176, 20, 28]','w: 68, h: 204, base: 204, foot: [0, 0, 1400, 2500]',1); assert '1400, 2500' in s"

mutate "房间里写死坐标" hardcodelint \
  "i=s.index(\"getElementById('bailuCanvas')\"); j=s.index('\\n',i); s=s[:j]+'\\n      const bad = st.x + 40   // 写死\\n'+s[j:]"

mutate "任一像素变了" regress \
  "s=s.replace(\"['bailu_broom', 220, 2040]\",\"['bailu_broom', 340, 2040]\",1); assert '340, 2040' in s"

echo
echo "── 对照:未变异的源码,同一批门禁必须全绿 ──"
for g in assetlint roomaudit hardcodelint pathlint regress; do
  if gate "$g" "$SRC"; then printf '  ✓ %-14s 绿\n' "$g"; pass=$((pass+1))
  else printf '  ✗ %-14s 在【干净】源码上就报红 —— 变异测试的结论不可信\n' "$g"; fail=$((fail+1)); fi
done

echo
echo "抓到 $pass 项 · 漏掉 $fail 项"
[ "$fail" -eq 0 ] || exit 1
