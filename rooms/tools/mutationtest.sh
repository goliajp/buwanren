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
    walklint)     bun rooms/tools/walklint.js     "$2" >/dev/null 2>&1 ;;
    hardcodelint) bun rooms/tools/hardcodelint.js "$2" >/dev/null 2>&1 ;;
    pathlint)     python3 rooms/tools/pathlint.py "$2" >/dev/null 2>&1 ;;
    # 用 compare 而不是 check:check 比的是【存下来的基准】,那份基准绑机器
    # (同一份 design.html 在 macOS 与 Linux 的 Chrome 上 24 个场景全部渲出不同哈希),
    # 拿到 CI 上对照组会直接红,整个变异测试的结论就不可信了。
    # compare 在同一台机器上比两个版本,与平台无关;对照组比自己,必然相同。
    regress)      bun rooms/tools/regress.js "$2" compare --against="$SRC" >/dev/null 2>&1 ;;
    selfcheck)    bun rooms/tools/regress.js "$2" selfcheck >/dev/null 2>&1 ;;
    blobscan)     bun rooms/tools/blobscan.js     "$2" --gate-only >/dev/null 2>&1 ;;
    buildsync)    bun rooms/tools/build.js --check --out="$2" >/dev/null 2>&1 ;;
    portlint)     bun rooms/tools/portlint.js      "$2" >/dev/null 2>&1 ;;
    winlint)      python3 rooms/tools/winlint.py rooms/src >/dev/null 2>&1 ;;
    buildengine)  bun rooms/tools/build-engine.js verify --page="$2" >/dev/null 2>&1 ;;
  esac
}

# 同上,但不吞输出。对照组红了要看得见原因。
gate_verbose() {
  case "$1" in
    assetlint)    bun rooms/tools/assetlint.js    "$2" ;;
    roomaudit)    bun rooms/tools/roomaudit.js    "$2" ;;
    walklint)     bun rooms/tools/walklint.js     "$2" ;;
    hardcodelint) bun rooms/tools/hardcodelint.js "$2" ;;
    pathlint)     python3 rooms/tools/pathlint.py "$2" ;;
    regress)      bun rooms/tools/regress.js "$2" compare --against="$SRC" ;;
    selfcheck)    bun rooms/tools/regress.js "$2" selfcheck ;;
    blobscan)     bun rooms/tools/blobscan.js     "$2" --gate-only ;;
    buildsync)    bun rooms/tools/build.js --check --out="$2" ;;
    portlint)     bun rooms/tools/portlint.js      "$2" ;;
    winlint)      python3 rooms/tools/winlint.py rooms/src ;;
    buildengine)  bun rooms/tools/build-engine.js verify --page="$2" ;;
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

# walklint 守的是「走起来腿不动、整个人平移」。丹增房当年就是这样
# 带着滑行过了【所有】门禁 —— 姿态名字齐全,值却是同一帧。
#
# 挑 shenyan 是有原因的:它是【已注册角色】里唯一一个帧二来自 WALK_OVR 的。
# 第一版挑的是 aluo,改完 walklint 一声不响 —— 它根本没注册,
# 运行层那一半够不着它。变异挑错对象时,报出来的是「门禁没抓到」,
# 而实际是这条变异压根没碰到它管的东西。
mutate "某个角色的走路帧二没了(会滑行)" walklint \
  "s=s.replace('      shenyan:{side:{pal:','      shenyanX:{side:{pal:',1); assert 'shenyanX:{side:' in s"

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

# design.html 现在是构建产物。直接改它的人必须被拦住 —— 否则下一次 build 悄悄盖掉他的改动
mutate "有人直接改了构建产物" buildsync \
  "s = s + '\\n<!-- 手改产物 -->\\n'"

# 渲染路径绕过平台缝直接摸 document,小程序里就跑不起来(台账 D2)
mutate "渲染路径绕过平台缝" portlint \
  "s = s.replace('cv = HOST.createCanvas(a.w, a.h)', \"cv = document.createElement('canvas'); cv.width = a.w; cv.height = a.h\", 1); assert 'document.createElement' in s"

# 独立产物(小程序那份)与设计页必须渲得一样。改设计页的引擎、不改 src,
# 两边就会分岔 —— 抓不到就说明这支工具只是「构建成功」而没在比像素。
mutate "产物与设计页分岔了" buildengine \
  "s=s.replace('rgba(30,20,10,0.22)','rgba(30,20,10,0.44)',1); assert '0.44' in s"

# 已拆出宿主那一段的房间(白鹭),脚本本身要能在无浏览器环境里加载并渲对。
# 改设计页里它的布局、不改 src,两边就分岔 —— 抓不到说明房间那条路没真在比。
mutate "拆出去的房间与设计页分岔" buildengine \
  "s=s.replace(\"['bailu_broom', 220, 2040]\",\"['bailu_broom', 340, 2040]\",1); assert '340, 2040' in s"

# 村子的静态层(地形/房屋)。它 2026-08-17 才第一次有视觉网,
# 而新加的场景自己也得证明报得出红 —— 否则等于又多了一处假绿。
#
# 2026-08-26 换了锚点:原来锚的 '#3f86bc' 在村子重排(704×1920 → 704×960)
# 时没有了,这条从那天起就一直「植不进去」—— 而**这支脚本当时不在门禁清单里**,
# 所以没有人看见。现在锚的是河水那一档蓝。
mutate "村子静态层变了" regress \
  "s=s.replace(\"'#4a7a9a'\",\"'#4a7aff'\",1); assert '#4a7aff' in s"

mutate "任一像素变了" regress \
  "s=s.replace(\"['bailu_broom', 220, 2040]\",\"['bailu_broom', 340, 2040]\",1); assert '340, 2040' in s"

# roomaudit 此前只出现在【对照组】里 —— 也就是从来没有一条用例问过它报不报得出红,
# 而它管的是「每一件东西点下去点到的是不是它自己」。
#
# 这条变异重演的是真出过的那个 bug:命中用的排序线与绘制用的不是同一条。
# renderRoom 按占地矩形的【顶边】排,而命中一度按【底边】排 ——
# 两套公式,于是两件重叠时绘制的前后与命中的前后可能相反,
# 症状是「看得见的那件点不到」。2026-08-26 实测:改回底边之后
# 两间房各有一件整件点不到,roomaudit 退出码 1。
mutate "命中与绘制的排序线不一致" roomaudit \
  "s = s.replace('return p[2] + (a.foot && a.foot[3] > 0 ? a.foot[1] : a.base)', 'return p[2] + a.base', 1); assert 'return p[2] + a.base' in s"

echo
echo "── 对照:未变异的源码,同一批门禁必须全绿 ──"
for g in assetlint roomaudit hardcodelint pathlint walklint regress blobscan buildsync selfcheck portlint winlint buildengine; do
  if gate "$g" "$SRC"; then printf '  ✓ %-14s 绿\n' "$g"; pass=$((pass+1))
  else
    printf '  ✗ %-14s 在【干净】源码上就报红 —— 变异测试的结论不可信\n' "$g"; fail=$((fail+1))
    # 对照组红了要看得见原因。此前这里也把输出丢给 /dev/null,
    # 于是 CI 上报了一次红、日志里只有一行「不可信」,查不下去 ——
    # 一个说「出事了」却不说出什么事的门禁,等于把人挡在门外。
    printf '     ↓ 重跑一遍取输出\n'
    gate_verbose "$g" "$SRC" 2>&1 | sed 's/^/     /' | tail -20
  fi
done

echo
echo "抓到 $pass 项 · 漏掉 $fail 项"
[ "$fail" -eq 0 ] || exit 1
