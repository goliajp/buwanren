#!/usr/bin/env bash
# 变异测试 · 跨目录那几支核对 —— 它们报得出红吗？
#
# `rooms/tools/mutationtest.sh` 常驻守着房间那一批门禁；这一支守的是后来加的
# 几支跨目录核对：前后端字段、宅基表、关系网。
#
# 为什么要有：这几支每一条我都在加的时候手动验过「植入缺陷会不会红」，
# 但那种验证【只存在于当时那次会话里】。哪天有人把判据改松、把 grep 改宽，
# 或者把被核对的那一头改名导致核对静静失效，没有任何东西会发现 ——
# 而一支永远报绿的核对，比没有核对更糟：它让人以为这件事有人管。
#
# 每条变异都往【真文件】里植入，跑完还原（trap 兜底，中途挂了也还原）。
#
# 用法: bash scripts/mutationtest-checks.sh
set -u
cd "$(dirname "$0")/.."

FILES=(
  mini/miniprogram/types/village.ts
  backend/unmei-api/src/routes/village.rs
  rooms/src/engine/plots.js
  rooms/src/engine/village.js
  rooms/src/bible/glue-04.html
  backend/seed/villagers.sql
  mini/miniprogram/pages/home/index.wxml
  mini/miniprogram/pages/village/index.ts
  # 2026-08-23:「去他家坐坐」搬到了这一屏（REDESIGN.md R2）。
  # 忘了把它加进来的那一次，变异改的是名单外的文件 —— 还原还不到它，
  # `roomz` 被永久烙进了源码，下一条变异在「干净」源码上就报红。
  # **凡是被 mutate 改到的文件，都必须在这张名单里。**
  mini/miniprogram/pages/villager/index.ts
  mini/miniprogram/app.json
  scripts/orphan-routes.json
  backend/unmei-api/src/auth.rs
  webadmin/src/App.tsx
  webadmin/src/components/Layout.tsx
  backend/unmei-domain/src/lib.rs
  mini/miniprogram/types/natal.ts
  backend/unmei-admin-api/src/routes/users.rs
  webadmin/src/lib/api.ts
  backend/unmei-api/src/routes/village.rs
  mini/miniprogram/services/naji.ts
  mini/miniprogram/pages/ask/index.wxml
  backend/seed/seed.sql
  backend/unmei-admin-api/src/routes/commerce.rs
  backend/migrations/20260817003_residency.sql
  # 2026-08-23:后加的那四支门禁,原先只在写它们那一天手动验过一次 ——
  # 而那种验证只存在于当时那次会话里,正是这支脚本存在的理由。
  mini/miniprogram/pages/order/index.ts
  .claude/design/product-v1.html
  docs/REDESIGN.md
  backend/seed/art_leaf.sql
  # tsc 那条变异写在这个文件末尾。它必须在名单里 ——
  # 名单是 trap 兜底还原的依据,自己另存一份的话,中途被打断就还原不到它。
  mini/miniprogram/pages/name/index.ts
  mini/miniprogram/pages/plot/index.wxml
)
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

# 3. 每一个被 mutate/keep 改到的文件，都必须在 FILES 里。
#    不在的话，变异改完【还原还不到它】—— 那处改动就永久烙进了源码。
#    2026-08-23 真发生过一次：「去他家坐坐」搬到 pages/villager 之后，
#    锚点跟着搬了，文件却没加进名单，于是 `roomz` 留在了工作区，
#    下一条变异在「干净」源码上报红，而红的原因是上一条没还原。
#    两边都从这个脚本自己解析。第一版用 `printf ... | python3 - <<'PY'`：
#    heredoc 本身就是 stdin（`-` = 从 stdin 读程序），管道里的名单根本没进去，
#    于是三个明明在名单里的文件被报成「不在名单里」。
MISSING=$(python3 scripts/check-mutation-backup.py)
if [ -n "$MISSING" ]; then
  echo "✗ 这些文件会被变异改到，但不在 FILES 备份名单里 —— 改了就还原不回来:"
  echo "$MISSING" | sed 's/^/   /'
  exit 1
fi

DIRTY=$(git status --porcelain -- "${FILES[@]}" 2>/dev/null)
if [ -n "$DIRTY" ]; then
  echo "✗ 要改的文件在 git 里不干净，先处理掉再跑（否则会把改动当成基准备份下来）:"
  echo "$DIRTY" | sed 's/^/   /'
  exit 1
fi

BAK=$(mktemp -d)
# 一个 trap 做两件事。分两个 `trap ... EXIT` 的话后一个会把前一个【覆盖掉】——
# 2026-08-18 就是这么把十几处变异留在工作区的:锁清了,文件没还原。
trap 'for f in "${FILES[@]}"; do cp "$BAK/$(echo "$f" | tr / _)" "$f"; done; rm -rf "$BAK" "$LOCK"' EXIT
# 信号先转成退出,好让上面那个 EXIT 跑到（`| head` 掐断时发的 SIGPIPE 也算）
trap 'exit 130' INT TERM PIPE
# 文档 2026-08-24 起不进 git,所以名单里有几个在 CI 上根本不存在。
# 缺了就跳过 —— 但**它锚着的那几条变异也要跟着跳过**(见下面的 if 守卫),
# 不能让「植不进去」被当成「门禁没抓到」。
for f in "${FILES[@]}"; do [ -f "$f" ] && cp "$f" "$BAK/$(echo "$f" | tr / _)"; done

restore() { for f in "${FILES[@]}"; do [ -f "$BAK/$(echo "$f" | tr / _)" ] && cp "$BAK/$(echo "$f" | tr / _)" "$f"; done; true; }

pass=0; fail=0

# mutate <说明> <哪支核对> <python 代码>
#   python 代码里 `edit(路径, 旧, 新)` 改一处，改不到就直接失败
#   —— 改不到说明基准源码变了，这条变异已经不是原来那条了
mutate() {
  local desc="$1" checker="$2" code="$3"
  restore
  if ! python3 - "$code" <<'PY'
import pathlib, sys
def edit(path, old, new, n=1):
    p = pathlib.Path(path); s = p.read_text(encoding='utf-8')
    c = s.count(old)
    # 【必须恰好一处】。找不到 = 基准源码变了；找到多处 = 这条变异会种到
    # 哪一处说不准 —— 2026-08-18 就有一条漂到了注释上，而注释不归被测的
    # 那支门禁管，于是它报「没抓到」，看着像门禁退化。
    # 失败信息指错方向，比失败本身更贵。
    if c != 1:
        sys.exit(f'变异植不进去（源码里有 {c} 处，要恰好 1 处）: {old[:60]}')
    p.write_text(s.replace(old, new, n), encoding='utf-8')
exec(sys.argv[1])
PY
  then
    printf '  ✗ %-30s 变异没植进去（基准源码变了？）\n' "$desc"; fail=$((fail+1)); return
  fi

  # 有的门禁要带参数(`export-cast --check`),所以按空格拆成命令。
  # 名字里没空格的照旧走同一条路。
  read -r -a CMD <<< "$checker"
  if python3 "scripts/${CMD[0]}.py" "${CMD[@]:1}" >/dev/null 2>&1; then
    printf '  ✗ %-30s %s 没抓到 —— 这就是下一个假绿\n' "$desc" "$checker"; fail=$((fail+1))
  else
    printf '  ✓ %-30s %s 抓到\n' "$desc" "$checker"; pass=$((pass+1))
  fi
}

# keep <说明> <哪支核对> <python 代码>
#   跟 mutate 相反:植入【不该被报】的东西,核对必须【仍然绿】。
#   漏报会放过真 bug,误报会让人开始无视门禁 —— 两头都要守。
keep() {
  local desc="$1" checker="$2" code="$3"
  restore
  if ! python3 - "$code" <<'EOFPY'
import pathlib, sys
def edit(path, old, new, n=1):
    p = pathlib.Path(path); s = p.read_text(encoding='utf-8')
    c = s.count(old)
    # 【必须恰好一处】。找不到 = 基准源码变了；找到多处 = 这条变异会种到
    # 哪一处说不准 —— 2026-08-18 就有一条漂到了注释上，而注释不归被测的
    # 那支门禁管，于是它报「没抓到」，看着像门禁退化。
    # 失败信息指错方向，比失败本身更贵。
    if c != 1:
        sys.exit(f'变异植不进去（源码里有 {c} 处，要恰好 1 处）: {old[:60]}')
    p.write_text(s.replace(old, new, n), encoding='utf-8')
exec(sys.argv[1])
EOFPY
  then
    printf '  ✗ %-30s 变异没植进去（基准源码变了？）\n' "$desc"; fail=$((fail+1)); return
  fi

  read -r -a CMD <<< "$checker"
  if python3 "scripts/${CMD[0]}.py" "${CMD[@]:1}" >/dev/null 2>&1; then
    printf '  ✓ %-30s %s 没误报\n' "$desc" "$checker"; pass=$((pass+1))
  else
    printf '  ✗ %-30s %s 误报了 —— 会误报的门禁，人很快就开始无视\n' "$desc" "$checker"; fail=$((fail+1))
    python3 "scripts/${CMD[0]}.py" "${CMD[@]:1}" 2>&1 | sed 's/^/     /' | tail -4
  fi
}

echo "══ 跨目录核对 · 变异测试 ══"

echo
echo "── check-api-shape（前端读的字段与状态码）──"
mutate "前端把字段名写错" check-api-shape \
  "edit('mini/miniprogram/types/village.ts', '  moved_in: boolean', '  movedIn: boolean')"
mutate "后端改了字段名" check-api-shape \
  "edit('backend/unmei-api/src/routes/village.rs', '\"moved_in\": out.is_new()', '\"is_new\": out.is_new()')"
mutate "后端 handler 改名（核对失效）" check-api-shape \
  "edit('backend/unmei-api/src/routes/village.rs', 'async fn scan(', 'async fn do_scan(')"
mutate "404 改成 403（前端按状态码判）" check-api-shape \
  "edit('backend/unmei-api/src/routes/village.rs', 'return Err(ApiError::not_found(format!(', 'return Err(ApiError::forbidden(format!(')"
mutate "那道判断改名（核对失效）" check-api-shape \
  "edit('backend/unmei-api/src/routes/village.rs', 'residency::is_home(&st.db, &c.sub, &villager_id)', 'residency::lives_here(&st.db, &c.sub, &villager_id)')"

# 结构体那一路 —— 大半响应是结构体 serde 出来的,不是 json! 拼的
mutate "后端结构体改了字段名" check-api-shape \
  "edit('backend/unmei-domain/src/lib.rs', 'pub day_master: String,', 'pub daymaster: String,')"
mutate "响应结构体改名（核对失效）" check-api-shape \
  "edit('backend/unmei-domain/src/lib.rs', 'pub struct NajiResult', 'pub struct NajiOutcome')"
# 请求体那一层:后端 serde 默认把不认识的字段【静静丢掉】,不会 422
mutate "前端发的字段后端不认（会被静静丢掉）" check-api-shape \
  "edit('mini/miniprogram/types/natal.ts', 'export interface NatalInput {\\n  label?: string', 'export interface NatalInput {\\n  title?: string')"
mutate "后端把请求体字段改了个名" check-api-shape \
  "edit('backend/unmei-domain/src/lib.rs', 'pub struct NatalInput {\\n    pub label: Option<String>,', 'pub struct NatalInput {\\n    pub nickname: Option<String>,')"
mutate "后端可能不发，前端当必有" check-api-shape \
  "edit('mini/miniprogram/types/natal.ts', 'export interface NatalSummary {', 'export interface NatalSummary {\\n  strength_score: number')"

echo
echo "── check-plots（宅基表）──"
# 2026-08-25 重排之后这七条全部重写。旧的那七条锚在「两份来源要对得上」——
# 老村手摆在 village.js、plots.js 是它的影子。四十栋改成照表画之后只剩一份来源,
# 那条不变式没有了,锚着它的变异自然也就植不进去。
# 这支脚本当时报的是「变异植不进去(基准源码变了?)」而不是默默跳过 —— 那正是它该有的样子。
mutate "表里漏掉一位不完人" check-plots \
  "edit('rooms/src/engine/plots.js', \"    { id: 'anonymous', row: 7, col: 4,\", \"    { id: 'anonymous_', row: 7, col: 4,\")"
mutate "两个人分到同一格" check-plots \
  "edit('rooms/src/engine/plots.js', \"{ id: 'mago', row: 2, col: 4,\", \"{ id: 'mago', row: 2, col: 3,\")"
mutate "某格出了画布" check-plots \
  "edit('rooms/src/engine/plots.js', \"{ id: 'aman', row: 4, col: 4, w: 68,\", \"{ id: 'aman', row: 4, col: 4, w: 260,\")"
mutate "一整排挪出了画布" check-plots \
  "edit('rooms/src/engine/plots.js', '828, 948]', '828, 1400]')"
mutate "kind 画的那一侧不认得" check-plots \
  "edit('rooms/src/engine/plots.js', \"kind: 'dome', roof: ['#9a938a', '#6e6862']\", \"kind: 'yurt', roof: ['#9a938a', '#6e6862']\")"
mutate "drawHouse 改名（核对失效）" check-plots \
  "edit('rooms/src/engine/village.js', '    function drawHouse(q) {', '    function paintHouse(q) {')"
# 这一条守的是【读表的装置本身】。check-plots 是照 plots.js 那套算法
# 自己把 row/col 还原成坐标的 —— 坐标的定义挪走而它读不到,
# 那它算出来的每一个 x/gy 都是凭空的,而四十行照样解析得出来:
# 一屏「✓ 40 格」,量的却不是画上那四十栋。
mutate "坐标定义改名（核对失效）" check-plots \
  "edit('rooms/src/engine/plots.js', '  const ROW_GY = [', '  const GROUND_Y = [')"

echo
echo "── check-relations（对白长在真实关系上）──"
mutate "两个没关系的人有了专属对白" check-relations \
  "edit('rooms/src/engine/village.js', '  const CONVOS = [', \"  const CONVOS = [\n    { a:'bailu', b:'popo', L:[['a','…'],['b','…']] },\")"
mutate "B10 里的名字名册上没有" check-relations \
  "
import pathlib
p = pathlib.Path('rooms/src/bible/glue-04.html'); s = p.read_text(encoding='utf-8')
i = s.index('B10 · 关系网'); j = s.index('<b>奥兰多</b>', i)
p.write_text(s[:j] + '<b>奥兰朵</b>' + s[j+len('<b>奥兰多</b>'):], encoding='utf-8')
"
mutate "B10 那一节改名（核对失效）" check-relations \
  "edit('rooms/src/bible/glue-04.html', 'B10 · 关系网', 'B10 · 人物图谱')"

echo
echo "── check-routes（前端调的接口后端有没有）──"
mutate "后端把路由改名了" check-routes \
  "edit('backend/unmei-admin-api/src/routes/users.rs', '.route(\"/admin/users\"', '.route(\"/admin/app-users\"')"
mutate "前端路径拼错一个字母" check-routes \
  "edit('webadmin/src/lib/api.ts', \"'/commerce/dashboard'\", \"'/commerce/dashbord'\")"
mutate "后端改了【拼出来的】那条路由" check-routes \
  "edit('backend/unmei-api/src/routes/village.rs', '\"/v1/villagers/:id/reading\"', '\"/v1/villagers/:id/ask\"')"
keep "拼在路径后面的查询串不算路径段" check-routes \
  "edit('mini/miniprogram/services/naji.ts', \"'/v1/naji/history'\", \"'/v1/naji/history' + qs({page:1})\")"
keep "字符串方法的参数不算路径" check-routes \
  "edit('webadmin/src/lib/api.ts', \"if (!path.startsWith('/commerce')) return path;\", \"if (!path.startsWith('/commerce')) return path;\\n  if (path.startsWith('/nowhere')) return path;\")"

echo
echo "── check-bodies（写操作的请求体）──"
mutate "前端把字段改了个名" check-bodies \
  "edit('webadmin/src/lib/api.ts', 'annotate\`, { note })', 'annotate\`, { comment: note })')"
mutate "后端把字段改了个名" check-bodies \
  "edit('backend/unmei-admin-api/src/routes/commerce.rs', 'struct AnnotateBody { note: String }', 'struct AnnotateBody { memo: String }')"

echo
echo "── check-punct-ui（界面文案的标点）──"
# 2026-08-23:「缺」是长期结构那一句随空态合并删掉了（两块在说同一件事）。
# 锚点换成现在真在页面上的一句。它当时报的是「变异没植进去（基准源码变了？）」
# 而不是假绿 —— 那正是它该有的样子。
mutate "界面上多了个半角逗号" check-punct-ui \
  "edit('mini/miniprogram/pages/home/index.wxml', '想清楚再摇', '想清楚再摇,')"
# 带上单引号，把这条钉在【代码里的字符串】上。
# 不带的话它会漂到注释上去：2026-08-18 有人在同文件的注释里写了
# 「取不到村子：unauthorized」，变异就种进了注释 —— 而注释不归标点门禁管，
# 于是这条断言报「没抓到」，看着像门禁退化，其实是断言自己漂了。
mutate "错误文案用了半角冒号" check-punct-ui \
  "edit('mini/miniprogram/pages/village/index.ts', \"'取不到村子：'\", \"'取不到村子:'\")"
keep "半角落在注释里（不归它管）" check-punct-ui \
  "edit('mini/miniprogram/pages/village/index.ts', '  /** 他刚说的那一句 */', '  // 注释里的半角逗号,不是界面文案,不该报\\n  /** 他刚说的那一句 */')"
mutate "种子里的文案用了半角" check-punct-ui \
  "edit('backend/seed/seed.sql', '至人无己，神人无功，圣人无名。', '至人无己,神人无功,圣人无名。')"
keep "JSON 数组里的逗号（不是文案）" check-punct-ui \
  "import pathlib; p = pathlib.Path('backend/seed/seed.sql'); s = p.read_text(encoding='utf-8'); assert s.count(chr(39)+'[\\\"水\\\",\\\"木\\\"]'+chr(39)) >= 1; p.write_text(s.replace(chr(39)+'[\\\"水\\\",\\\"木\\\"]'+chr(39), chr(39)+'[\\\"水\\\",\\\"木\\\",\\\"火\\\"]'+chr(39), 1), encoding='utf-8')"
mutate "括号里是中文却用了半角" check-punct-ui \
  "edit('mini/miniprogram/pages/home/index.wxml', '（可空 · 只给你自己看）', '(可空 · 只给你自己看)')"
keep "括号里是数字或英文（豁免）" check-punct-ui \
  "edit('mini/miniprogram/pages/home/index.wxml', '（可空 · 只给你自己看）', '（可空 · 只给你自己看）(+8)(control plane)')"
keep "中文当对象键的代码" check-punct-ui \
  "edit('mini/miniprogram/pages/village/index.ts', '  /** 他刚说的那一句 */', \"  /* eslint-disable */ // const 五行 = { 木: 'mu', 火: 'huo' }\\n  /** 他刚说的那一句 */\")"

restore
echo
echo "── check-migrations（已应用的迁移不许改）──"
mutate "改了一个已有的迁移" check-migrations \
  "edit('backend/migrations/20260817003_residency.sql', 'CREATE TABLE IF NOT EXISTS omamori (', 'CREATE TABLE IF NOT EXISTS omamori_v2 (')"

echo
echo "── check-reachable-pages（每一页都得走得到）──"
# 村从 tab 上摘掉,屋子跟着一起孤立 —— 这正是 2026-08-19 之前的真实状态:
# 全应用唯一的扫码入口在村里,而村谁也进不去,门禁全绿。
mutate "把村从 tab 上摘了" check-reachable-pages \
  "edit('mini/miniprogram/app.json', '      {\n        \"pagePath\": \"pages/village/index\",\n        \"text\": \"村子\"\n      },\n', '')"
# 2026-08-22:tab 从五个减到三个（docs/REDESIGN.md R0），村改叫村子，
# app.json 也从单行重排成多行 —— 这条锚点跟着改了两处。
# 它当时报的是「变异没植进去（基准源码变了？）」而不是假绿，这一点是对的。
# 反过来那一半:屋子本来就不在 tab 上,靠「去他家坐坐」那句 navigateTo 才可达。
# 把那句改个名,它就成了孤儿 —— 传递可达这件事得真的在算,不能只看 tab。
# 2026-08-23:那句从村主屏搬到了村民那一屏（REDESIGN.md R2，点一格开一屏），
# 锚点跟着走。它当时报的是「变异没植进去（基准源码变了？）」而不是假绿。
mutate "通往屋子的那句改没了" check-reachable-pages \
  "edit('mini/miniprogram/pages/villager/index.ts', \"'/pages/room/index?room='\", \"'/pages/roomz/index?room='\")"

# 后台控制台那一半：路由与侧边栏要一一对上。
# 照的是真事 —— Users 那一页从初始提交起就挂在侧边栏上，而它要的接口后端没有。
mutate "后台加一页不挂进侧边栏" check-reachable-pages \
  "edit('webadmin/src/App.tsx', '<Route path=\"/quotes\" element={<Quotes />} />', '<Route path=\"/quotes\" element={<Quotes />} />\n        <Route path=\"/hidden\" element={<Quotes />} />')"
mutate "侧边栏指向一个不存在的页" check-reachable-pages \
  "edit('webadmin/src/components/Layout.tsx', \"{ to: '/quotes',\", \"{ to: '/quotes-nope',\")"

echo
echo "── check-routes 的孤儿棘轮 ──"
# 台账原先只报不判。「接上还是删掉是产品决定」对已经在册的成立,
# 对新长出来的一条不成立 —— 不判的话,第八次「实现完整、零调用方」
# 照样得靠偶然发现。
mutate "村里不再调 scan（新长一个死封装）" check-routes \
  "edit('mini/miniprogram/pages/village/index.ts', 'villageApi.scan({', 'villageApi.scanZZ({')"
mutate "台账上多记了一条（早该划掉）" check-routes \
  "edit('scripts/orphan-routes.json', '      \"/v1/badge\":', '      \"/v1/villagers\": \"探针\",\n      \"/v1/badge\":')"
# 每条孤儿都要写理由。「暂时没接」不算理由 —— 那是欠账不是决定。
mutate "台账里有一条没写理由" check-routes \
  "edit('scripts/orphan-routes.json', '\"/v1/payments/:x\": \"单笔支付详情', '\"/v1/payments/:x\": \"\", \"_x\": \"单笔支付详情')"

echo
echo "── check-error-leak（外部报错原文不进响应体）──"
# 响应体就是 AppError 的 Display。`From<sqlx::Error>` 里写 Internal(format!)
# 等于把表名、约束名公开 —— 2026-08-19 实测客户端真收到过
# `insert or update on table "naji_record" violates …`。
mutate "数据库报错退回 Internal" check-error-leak \
  "edit('backend/unmei-api/src/auth.rs', 'Self(AppError::Infra(format!(\"db: {e}\")))', 'Self(AppError::Internal(format!(\"db: {e}\")))')"

restore
echo
echo "── check-page-imports（页面之间不许互相 import）──"
mutate "一个页面 import 了另一个页面" check-page-imports \
  "edit('mini/miniprogram/pages/order/index.ts', \"import { storage } from '../../services/storage'\", \"import { storage } from '../../services/storage'\\nimport { money } from '../orders/index'\")"
keep "从 utils 里 import（这才是该走的路）" check-page-imports \
  "edit('mini/miniprogram/pages/order/index.ts', \"import { storage } from '../../services/storage'\", \"import { storage } from '../../services/storage'\\nimport { money as m2 } from '../../utils/money'\")"

echo
echo "── check-wxml-handlers（bind 的处理器真的存在吗）──"
mutate "bind 到一个不存在的处理器" check-wxml-handlers \
  "edit('mini/miniprogram/pages/ask/index.wxml', 'bindtap=\"goHome\">再问一次', 'bindtap=\"reset\">再问一次')"

echo
echo "── check-design-css（设计文档里的 var 真定义过吗）──"
if [ -f .claude/design/product-v1.html ]; then
  mutate "SVG 里用了一个没定义的颜色变量" check-design-css \
    "edit('.claude/design/product-v1.html', '<text class=\"w-cap\" x=\"348\" y=\"66\">V5　进屋</text>', '<text class=\"w-cap\" fill=\"var(--nope)\" x=\"348\" y=\"66\">V5　进屋</text>')"
  keep "用的是真定义过的那个变量" check-design-css \
    "edit('.claude/design/product-v1.html', '<text class=\"w-cap\" x=\"348\" y=\"66\">V5　进屋</text>', '<text class=\"w-cap\" fill=\"var(--fg)\" x=\"348\" y=\"66\">V5　进屋</text>')"

else
  printf "  · %-30s 这台机器上没有 .claude/design/product-v1.html（文档不进 git），问不出东西，不计入\n" "整段"
fi
echo
echo "── check-wireframe-fill（线框每一屏都填满了吗）──"
if [ -f .claude/design/product-v1.html ]; then
  # 变异方向要选对：把弹性槽的边往【下】挪是抓不到的 ——
  # 原先在槽里的那些字会跟着变成核心内容，缺口反而没变大。
  # 这支门禁要抓的是「画到一半、底下留一大片白」，所以就删掉一屏底下那排按钮。
  mutate "一屏底下那排按钮没画（留一片白）" check-wireframe-fill \
    "edit('.claude/design/product-v1.html', '<rect class=\"w-btn-p\" x=\"358\" y=\"450\" width=\"64\" height=\"22\" rx=\"3\"/>\\n        <text class=\"w-btn-p\" x=\"390\" y=\"464\" text-anchor=\"middle\">问问她</text>\\n        <rect class=\"w-btn\" x=\"430\" y=\"450\" width=\"69\" height=\"22\" rx=\"3\"/>\\n        <text class=\"w-btn\" x=\"464\" y=\"464\" text-anchor=\"middle\">去她家坐坐</text>', '<!-- 删掉了 -->')"

else
  printf "  · %-30s 这台机器上没有 .claude/design/product-v1.html（文档不进 git），问不出东西，不计入\n" "整段"
fi
echo
# 先还原。`mutate` / `keep` 是在【开头】还原的,所以跑完最后一条,
# 树上还留着那一条变异 —— 对照跑在变异过的源码上,结论正好反过来。
# 原先名单里没有受影响的那几支,所以这个顺序问题一直没露头
# (2026-08-23 把名单补齐时当场报红)。
echo
echo "── check-punct（中文标点全角 · 存量记账）──"
if [ -f docs/REDESIGN.md ]; then
  mutate "中文句子里混进一个半角逗号" check-punct \
    "edit('docs/REDESIGN.md', '按设计 H1，罗盘是「吃掉纵向富余」的那一块', '按设计 H1,罗盘是「吃掉纵向富余」的那一块')"
  keep "英文之间的半角逗号（不该算）" check-punct \
    "edit('docs/REDESIGN.md', '按设计 H1，罗盘是「吃掉纵向富余」的那一块', '按设计 H1（flex, grid 都行），罗盘是「吃掉纵向富余」的那一块')"

else
  printf "  · %-30s 这台机器上没有 docs/REDESIGN.md（文档不进 git），问不出东西，不计入\n" "整段"
fi
echo
echo "── export-cast --check（村民表与设计册同步）──"
mutate "seed 里某位的名字跟设计册对不上" "export-cast --check" \
  "edit('backend/seed/villagers.sql', \"'阿云'\", \"'阿雲'\")"

echo
echo "── check-art-leaf（术数指的叶真存在吗）──"
# 这支门禁要读 mingli 仓库(另一个仓库)。读不到时它明说跳过并返回 0 ——
# 那是对的(够不着的检查不该打分),但也意味着**这条变异在那种机器上问不出东西**:
# 它会报「没抓到」,而实际是门禁根本没在判。所以这里跟着一起跳过,并说出来。
# (2026-08-23:我在注释里预判了这件事却照样推了,CI 当场红。)
if [ -f "$HOME/workspace/goliajp/mingli/crates/mingli-registry/src/lib.rs" ]; then
  mutate "某门术数指向一片不存在的叶" check-art-leaf \
    "edit('backend/seed/art_leaf.sql', \"('ziwei',     'ziwei'),\", \"('ziwei',     'ziweidoushu'),\")"
else
  printf '  · %-30s 这台机器上没有 mingli 仓库，门禁自己也在跳过 —— 问不出东西，不计入\n' \
    "某门术数指向一片不存在的叶"
fi

echo
echo "── check-admin-roles（后台写操作查角色了吗）──"
# 变异要【真的给它加上角色检查】。头一版是把函数改名 —— 那样检查器根本
# 找不到函数体，判出来还是「没查角色」,等于什么都没变。
# 变异挑错动作时,报出来的是「门禁没抓到」,而实际是这条变异没碰到它管的东西。
mutate "台账里的某条忽然查起角色来了" check-admin-roles \
  "edit('backend/unmei-admin-api/src/routes/commerce.rs', '    app_refund::approve(&st.db, &id, &Actor::admin(&admin.0.sub)).await?;', '    admin.requires_role(\"finance\")?;\\n    app_refund::approve(&st.db, &id, &Actor::admin(&admin.0.sub)).await?;')"
mutate "新加一条没查角色的写操作" check-admin-roles \
  "edit('backend/unmei-admin-api/src/routes/commerce.rs', '        .route(\"/admin/commerce/outbox/:id/retry\",                  post(retry_outbox))', '        .route(\"/admin/commerce/outbox/:id/retry\",                  post(retry_outbox))\\n        .route(\"/admin/commerce/danger/:id/wipe\", post(retry_outbox))')"

echo
echo "── tsc（类型）──"
# tsc 不是我们写的门禁,但它【能被悄悄放松】:一个 @ts-nocheck、
# 一处 tsconfig 改松,它就再也不报了,而 gates.sh 上那一行照旧显示绿。
# 所以照样问一次:植一个真类型错误,它必须红。
restore
printf '\nconst 变异用的类型错: number = "这是字符串"\n' >> mini/miniprogram/pages/name/index.ts
if (cd mini && npx tsc --noEmit -p . >/dev/null 2>&1); then
  printf '  ✗ %-30s tsc 没抓到 —— 类型检查已经形同虚设\n' "植入一个真类型错误"; fail=$((fail+1))
else
  printf '  ✓ %-30s tsc 抓到\n' "植入一个真类型错误"; pass=$((pass+1))
fi
restore

echo
echo "── web verify · 动线 ──"
# 镜像是这一堆里最重的一支门禁,而【从没有一条用例问过它报不报得出红】——
# 它今天红过很多次,那是经验,不是断言。跑假服务端那一档(最快的),
# 把空屋那一句改掉:镜像有一条断言正是在等它。
#
# 只放一条。跑一遍镜像要一分多钟,而这一条要证明的事只有一件:
# 「页面变了,动线看得见」。
restore
python3 -c "
import pathlib
p = pathlib.Path('mini/miniprogram/pages/plot/index.wxml')
s = p.read_text(encoding='utf-8')
assert s.count('这间空着') == 1
p.write_text(s.replace('这间空着', '这间没人'), encoding='utf-8')
"
if bash web/run-verify.sh >/dev/null 2>&1; then
  printf '  ✗ %-30s 动线没抓到 —— 页面改了它却照样全通\n' "空屋那一句被改掉"; fail=$((fail+1))
else
  printf '  ✓ %-30s 动线抓到\n' "空屋那一句被改掉"; pass=$((pass+1))
fi
restore

echo
restore
echo "── 对照：没变异的源码，下面每一支都必须全绿 ──"
# 这张名单要跟上面变异过的那些支对齐 —— 少一支，那一支「在干净源码上是不是本来就红」
# 就没人问过，而它的「抓到」也就不能当数。
for c in check-api-shape check-plots check-relations check-punct-ui check-routes \
         check-bodies check-reachable-pages check-error-leak \
         check-page-imports check-wxml-handlers check-design-css check-wireframe-fill \
         check-punct check-art-leaf check-admin-roles "export-cast --check"; do
  # 读文档的那三支:文档不在就跳过 —— 够不着的检查不该打分
  case "$c" in
    check-punct|check-design-css|check-wireframe-fill)
      [ -f docs/REDESIGN.md ] || [ -f .claude/design/product-v1.html ] || {
        printf "  · %-22s 文档不在这台机器上，跳过\n" "$c"; continue; }
      ;;
  esac
  read -r -a C <<< "$c"
  if python3 "scripts/${C[0]}.py" "${C[@]:1}" >/dev/null 2>&1; then
    printf '  ✓ %-22s 绿\n' "$c"; pass=$((pass+1))
  else
    printf '  ✗ %-22s 在【干净】源码上就报红 —— 变异测试的结论不可信\n' "$c"; fail=$((fail+1))
    python3 "scripts/${C[0]}.py" "${C[@]:1}" 2>&1 | sed 's/^/     /' | tail -12
  fi
done

echo
echo "抓到 $pass 项 · 漏掉 $fail 项"
[ "$fail" -eq 0 ] || exit 1
