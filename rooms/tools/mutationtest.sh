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
    blobscan)     bun rooms/tools/blobscan.js     "$2" --gate-only >/dev/null 2>&1 ;;
  esac
}

# 把某件素材的 foot 换掉 —— 按素材名定位,不锚死当前数值。
# 从前这里写死 `foot: [48, 176, 20, 28]`,那件素材的 foot 一改,两条变异同时失配。
# 正则里用 . 匹配素材名两侧的引号:写成 \" 会被外层双引号吃掉,变成 def\(名字,
# 从而永远匹配不上,报出来却是「找不到素材」这种指向完全错误的错。
# 附带好处是 def("x" 与 def('x' 两种写法都认。
setfoot() { echo "
import re
m = re.search(r'def\(.$1.,', s)
assert m, '找不到素材 $1'
seg = s[m.start():m.start()+900]
seg2, n = re.subn(r'foot:\s*\[[^\]]*\]', 'foot: [$2]', seg, count=1)
assert n == 1, '$1 里没有 foot 字段'
s = s[:m.start()] + seg2 + s[m.start()+900:]
"; }

# mutate <说明> <该抓到的门禁> <python 变异代码>
mutate() {
  local desc="$1" expect="$2" code="$3"
  local f="$WORK/m.html"
  cp "$SRC" "$f"
  # 变异代码写进文件再跑,不嵌进 shell 字符串 —— 代码里但凡带一个 " 就会把
  # 外层双引号提前闭合,报出来的是「找不到素材」这种指向完全错误的错。
  { echo "import pathlib, re"
    echo "p = pathlib.Path('$f')"
    echo "s = p.read_text(encoding='utf-8')"
    printf '%s\n' "$code"
    echo "p.write_text(s, encoding='utf-8')"
  } > "$WORK/mut.py"
  if ! python3 "$WORK/mut.py"; then printf '  ✗ %-34s 变异没植进去(基准源码变了?)\n' "$desc"; fail=$((fail+1)); return; fi

  if gate "$expect" "$f"; then
    printf '  ✗ %-34s %s 没抓到 —— 这就是下一个假绿\n' "$desc" "$expect"; fail=$((fail+1))
  else
    printf '  ✓ %-34s %s 抓到\n' "$desc" "$expect"; pass=$((pass+1))
  fi
}

echo "══ 变异测试:往副本里植入缺陷,看门禁抓不抓得住 ══"

mutate "家具挪出画布" assetlint \
  "s=s.replace(\"['bailu_broom', 220, 2040]\",\"['bailu_broom', 220, 9000]\",1); assert '9000' in s"

mutate "foot 超出素材范围" assetlint "$(setfoot bailu_whisk '48, 176, 90, 28')"

mutate "素材引用不存在的 id" assetlint \
  "s=s.replace(\"['bailu_broom', 220, 2040]\",\"['bailu_no_such_thing', 220, 2040]\",1); assert 'no_such_thing' in s"

mutate "家具吞掉整间房(锚点全被埋)" pathlint "$(setfoot bailu_whisk '0, 0, 1400, 2500')"

mutate "房间里写死坐标" hardcodelint \
  "i=s.index(\"getElementById('bailuCanvas')\"); j=s.index('\\n',i); s=s[:j]+'\\n      const bad = st.x + 40   // 写死\\n'+s[j:]"

mutate "foot 挪到实体旁边的空处" blobscan "$(setfoot bailu_whisk '48, 176, 16, 20')"

mutate "foot 比实体宽一倍" blobscan "$(setfoot bailu_whisk '0, 170, 68, 20')"

mutate "任一像素变了" regress \
  "s=s.replace(\"['bailu_broom', 220, 2040]\",\"['bailu_broom', 340, 2040]\",1); assert '340, 2040' in s"

echo
echo "── 对照:未变异的源码,同一批门禁必须全绿 ──"
for g in assetlint roomaudit hardcodelint pathlint regress blobscan; do
  if gate "$g" "$SRC"; then printf '  ✓ %-14s 绿\n' "$g"; pass=$((pass+1))
  else printf '  ✗ %-14s 在【干净】源码上就报红 —— 变异测试的结论不可信\n' "$g"; fail=$((fail+1)); fi
done

echo
echo "抓到 $pass 项 · 漏掉 $fail 项"
[ "$fail" -eq 0 ] || exit 1
