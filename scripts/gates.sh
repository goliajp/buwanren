#!/usr/bin/env bash
# 合并前跑这一条 —— 全部门禁，一次跑完，最后报总账。
#
# 为什么要有这支：
#
# ★ 一支【偶尔】红的门禁，比一支常红的更坏 —— 它训练人把每次真红
#   当噪音。2026-08-31 撞到一次:`the_voice_is_the_villagers_own` 在比
#   「白鹭这次抽到的句子比丹增短」，而抽哪句由随机 user id 做种子，
#   连跑十二次全绿、门禁那趟撞上另一面。判据改成累计七天才稳。
#
#   顺手把同类扫了一遍（2026-08-31），当时的结论:
#     · `assert_ne!`（「必须不同」）那几条 —— 句库按「缺」分 41 条,
#       比较的两位缺不同，结论必然不同，不靠运气
#     · `Utc::now()` 都是当输入用（造数据），不拿来断言
#     · 问候那条用的是涵盖所有时段的正则，不钉死某一句
#     · 数目那几条钉的是结构常数（四柱恒 4、香恒 3 档），不随数据量漂
#   再加断言时照这四条对一遍：**判据不许挑一个会自己翻面的量**。
# ★ 它跑着的时候【整个工作区都别改】。变异测试要把源文件改掉再复原,
#   复原之间那一瞬跟你的编辑撞上,报出来的是「某支没红」—— 而那一支
#   其实好好的。2026-08-30 撞过一次(75/1),什么都没动重跑就是 76/0。
#   这种失效长得跟数据一模一样:它报的是一个真实存在的失败形态。
# ★ 它跑着的时候【不要改这个文件】。bash 是按字节偏移往下读脚本的,
#   中途插几行就让它从半个词接着读 —— 报出来是「line 338: unexpected EOF」,
#   而那一行完全正常。2026-08-30 踩到:一轮 55 支全绿的门禁，
#   最后的总账被这个假语法错顶掉了,看着像门禁自己坏了。
#
# 门禁的清单以前只是 `.claude/CLAUDE.md` 里的一行散文（「build --check /
# regress check / portlint / ...」）。散文会过时——后来加的 check-punct、
# check-punct-ui、check-api-shape、check-plots、check-relations、
# mutationtest、web/run-verify.sh 一个都不在那行里。清单写成代码就不会。
#
# 还有一个更具体的理由：手敲一条条跑的时候，很容易写成
# `python3 scripts/check-punct.py | tail -1` —— 管道之后拿到的是 `tail`
# 的退出码，**门禁红了也看着像绿的**。2026-08-18 我就这么把一次真失败
# 当成通过提交了。这支脚本自己判退出码，不经过管道。
#
# 特点：**不在第一个失败处停**。全跑完再报总账 —— 只知道「第一个坏的」
# 会让人一轮一轮地挤牙膏。
#
# 用法:
#   bash scripts/gates.sh              全部（要 Postgres）
#   bash scripts/gates.sh --quick      跳过慢的那几支（引擎校验 / 变异 / cargo test）
set -u
cd "$(dirname "$0")/.."

QUICK=0
[ "${1:-}" = "--quick" ] && QUICK=1

# 一次只许跑一份。两份同时跑会互相踩:镜像那一支占的是固定端口,
# 引擎那几支要重建 design.html 与 mini/miniprogram/engine —— 一份跑到一半
# 被另一份换掉了产物,量到的就是别人的东西。
#
# 2026-08-25 真踩到:一份挂住的旧run 跟新起的一份并行了一个半小时,
# blobscan 与 web verify 报红,而两支单独跑都是绿的。
# **看起来像产品坏了,其实是两份门禁在抢同一批文件** —— 这种红最贵:
# 查错方向完全是反的。变异测试那支早就有锁,这支一直没有。
# node 得在 PATH 里。不在的话下面那两支报的是
# 「tsc: 类型」与「webadmin build」挂了 —— 而实际是它们【根本没跑】，
# 报出来的话把人往「代码有类型错」的方向带，跟真相反着。
# 2026-08-27 真踩到：换了一个 shell，nvm 的那段没加载，两支当场红。
#
# nvm 装的 node 不在默认 PATH 里，这里自己找一次。找不到就明说是它没装，
# 而不是让两支门禁替它背锅。
if ! command -v npx >/dev/null 2>&1; then
  for d in "$HOME/.nvm/versions/node"/*/bin; do
    [ -x "$d/npx" ] && PATH="$d:$PATH" && export PATH && break
  done
fi

LOCK=/tmp/unmei-gates.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  OWNER=$(cat "$LOCK/pid" 2>/dev/null || echo 0)
  if kill -0 "$OWNER" 2>/dev/null; then
    # 变量名后面紧跟全角字符时一定要加花括号 —— `$OWNER）` 会被当成
    # 名字叫 `OWNER）` 的变量，`set -u` 当场报 unbound variable。
    echo "✗ 已经有一份门禁在跑（pid ${OWNER}）—— 两份并行会互相踩，量到的不算数"
    echo "  等它跑完，或者 kill ${OWNER} 之后 rm -rf ${LOCK}"
    exit 1
  fi
  echo "· 捡到一把没人认领的锁（pid ${OWNER} 已经不在了），接着用"
  rm -rf "$LOCK"; mkdir "$LOCK"
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
trap 'exit 130' INT TERM PIPE

pass=0; fail=0; skipped=0
FAILED=()

# gate <名字> <在哪个目录> <命令...>
gate() {
  local name="$1" dir="$2"; shift 2
  local out
  if ! out=$(cd "$dir" && "$@" 2>&1); then
    printf '  ✗ %-34s\n' "$name"
    # `LC_ALL=C` 让 sed 按【字节流】处理 —— 不然它对中文报
    # "RE error: illegal byte sequence"，失败摘要就成了乱码:
    # 门禁挂了却读不懂它在说什么，跟没挂一样糟。
    # （不用 en_US.UTF-8：那个 locale 不保证这台机器上有。
    #   `s/^/  /` 只匹配行首，字节流下完全安全。）
    echo "$out" | tail -6 | LC_ALL=C sed 's/^/       /'
    # 【整份留下来】。尾部六行常常不是失败的原因 —— cargo test 挂在中间某个
    # crate 时，尾部只剩最后一个 crate 的「ok」，看着像什么都没错
    # （2026-08-30 撞上一次：这一支挂了，而屏上打印的是 18 passed / 0 failed，
    #   重跑又全绿，于是唯一能得出的结论是「偶发」—— 那不是结论，是没证据）。
    # 变量名只能是 ASCII —— macOS 自带的是 bash 3.2，中文变量名它直接拒绝
    # （"not a valid identifier"）。这个坑这个仓里踩过不止一次。
    local keep="${GATES_LOGDIR:-/tmp}/gate-fail-$(echo "$name" | LC_ALL=C tr -c 'a-zA-Z0-9' '-' | cut -c1-40).log"
    printf '%s\n' "$out" > "$keep"
    printf '       （整份输出：%s）\n' "$keep"
    fail=$((fail+1)); FAILED+=("$name")
  else
    printf '  ✓ %-34s\n' "$name"
    pass=$((pass+1))
  fi
}

skip() { printf '  · %-34s %s\n' "$1" "$2"; skipped=$((skipped+1)); }

echo "══ 门禁 ══"
echo
echo "── 房间 / 引擎 ──"
gate "build --check"        rooms bun tools/build.js --check --src=src
gate "hardcodelint"         rooms bun tools/hardcodelint.js design.html
gate "pathlint · 走位不穿模"  rooms python3 tools/pathlint.py design.html
gate "assetlint"            rooms bun tools/assetlint.js design.html
gate "roomaudit"            rooms bun tools/roomaudit.js design.html
gate "walklint"             rooms bun tools/walklint.js design.html
gate "blobscan"             rooms bun tools/blobscan.js design.html --gate-only
gate "portlint · 离得开浏览器吗" rooms bun tools/portlint.js design.html
gate "winlint"              rooms python3 tools/winlint.py src
gate "regress selfcheck"    rooms bun tools/regress.js design.html selfcheck
if [ "$QUICK" = 1 ]; then
  skip "build-engine verify" "--quick"
else
  gate "build-engine verify · 逐像素"  rooms bun tools/build-engine.js verify
fi

echo
echo "── 跨目录核对 ──"
gate "check-plots · 宅基表"      . python3 scripts/check-plots.py
gate "check-relations · 关系网"  . python3 scripts/check-relations.py
gate "check-api-shape · 前后端"  . python3 scripts/check-api-shape.py
gate "check-punct · 文档标点"    . python3 scripts/check-punct.py
gate "check-punct-ui · 界面文案" . python3 scripts/check-punct-ui.py
# 「缺 X」是村民自己缺 X（lack_bias 表:缺过才懂，所以那样劝你）。
# 请人那一屏曾把它说成「他补你哪一样」——村民成了工具，
# 产品叫「不完人」的理由当场没了，而两屏各说各的谁也不会红。
gate "「缺」说的是谁" . python3 scripts/check-lack-sense.py
# 挂着人不等于是御守 —— 香也挂着苏合，但买香是寄一盒香给你。
# 这个等价错过三次（商品页眉标、下单页卡片名、订单详情明细），
# 每次都是各自在前端推断。后端现在直接给 becomes_resident，这一支盯着别再猜。
gate "挂着人不等于是御守" . python3 scripts/check-omamori-sense.py
gate "设计文档里有没有悄悄失效的" . python3 scripts/check-design-css.py
gate "线框每一屏都填满了吗" . python3 scripts/check-wireframe-fill.py
gate "check-routes · 调的接口都在吗" . python3 scripts/check-routes.py
gate "check-bodies · 请求体字段对得上" . python3 scripts/check-bodies.py
gate "迁移没被改过" . python3 scripts/check-migrations.py
# 村民表是【从设计册导出来的产物】。改了 design.html 却没重导，
# 库里的字就是旧的，而那件事没有任何地方看得出来。
# 房间那边早有同样的护栏（`rooms/tools/build.js --check`），这边一直没有。
gate "村民表与设计册同步" . python3 scripts/export-cast.py --check
# 参照数据的源头是 backend/seed/*.sql，不是迁移。改「缺」这种键的时候
# 只补一条 UPDATE 迁移、不动种子，下一次灌种子就把旧词原样插回来 ——
# 偏向表多一行，而那句「应有 41 行」要到合并之后才红（2026-08-31 真踩到）。
gate "缺与偏向对得上" . python3 scripts/check-seed-lack.py
# 四十位的正面像素图早就画在设计册里，小程序这一侧却一直是
# 「圆底 + 姓名末字」—— 缺的不是画，是接线。这一支盯着别再断:
# 每位都有脸、每张脸解得开、用到头像的每一屏都接了 脸()。
gate "四十位的脸都接上了吗" . python3 scripts/check-faces.py
if [ "$QUICK" = 1 ]; then
  # `--quick` 跳过变异测试，而变异测试是【钉在具体文件的具体字符串上】的。
  # 你改的要是它盯着的文件，这一跳就正好跳过了唯一会发现「断言漂了」的那支。
  #
  # 2026-08-18 真踩到：我在 `village/index.ts` 的注释里写了「取不到村子：」，
  # 那条变异于是种到注释上（注释不归标点门禁管），断言报「没抓到」——
  # 本机 `--quick` 全绿，推上去 CI 才红。
  #
  # 所以这里不只说「跳过了」，还要说【你这次动的文件里有它盯着的】。
  PINNED=$(sed -n '/^FILES=(/,/^)/p' scripts/mutationtest-checks.sh | grep -oE '[a-z][A-Za-z0-9_/.-]+\.(ts|rs|js|sql|html|wxml)' | sort -u)
  TOUCHED=$( { git diff --name-only; git diff --name-only --cached; git diff --name-only origin/develop...HEAD 2>/dev/null; } | sort -u)
  HIT=$(comm -12 <(echo "$PINNED") <(echo "$TOUCHED") | tr '\n' ' ')
  if [ -n "${HIT// /}" ]; then
    skip "mutationtest · 报得出红吗" "--quick，但你动了它盯着的文件：${HIT}—— 推之前跑一遍全量"
  else
    skip "mutationtest · 报得出红吗" "--quick"
  fi
  skip "mutationtest · SQL 那支" "--quick"
  skip "mutationtest · 房间那支" "--quick"
else
  gate "mutationtest · 报得出红吗" . bash scripts/mutationtest-checks.sh
  # SQL 那支只在 CI 里跑过（backend.yml）。本地不跑的后果不是「少验一遍」——
  # 2026-08-18 我把 `$OWNER,` 改成 `$OWNER，`，bash 把多字节字符吃进变量名，
  # 这两支的「捡起没主的锁」分支双双炸掉；CI 全绿，因为全新 runner 上没有锁，
  # 那条分支根本不走。只有本地会走到的路，只有本地跑得出来。
  gate "mutationtest · SQL 那支"  . bash scripts/mutationtest-sql.sh
  # 房间那批门禁（assetlint / roomaudit / pathlint / walklint / regress / blobscan /
  # portlint / winlint / buildengine）自己的变异测试。**它一直不在这张清单里** ——
  # 也就是说「这些门禁报不报得出红」这件事没有任何人在跑。
  # 2026-08-26 手动跑了一次才发现里面有一条早就失配了：村子重排
  # （704×1920 → 704×960）把它锚着的那个颜色改没了，而没人看得见。
  # 一支没人跑的变异测试，比没有更糟：它让人以为那批门禁有人守着。
  gate "mutationtest · 房间那支" . bash rooms/tools/mutationtest.sh
fi

echo
echo "── 小程序 / 移动网页版 ──"
if command -v npx >/dev/null 2>&1; then
  gate "tsc · 类型"  mini npx tsc --noEmit
else
  skip "tsc · 类型" "PATH 里没有 npx（node 没装或 nvm 没加载）—— 这一项【没验】"
fi
gate "每一页都走得到吗" . python3 scripts/check-reachable-pages.py
gate "页面之间没互相 import 吧" . python3 scripts/check-page-imports.py
# 开屏就取数的页面,都得等得到登录。匿名登录是异步的,冷启动那一次
# 必然赶在 token 前面拿 401 —— 要紧的不是那次 401,是之后再也不取:
# 那一屏停在「取不到」,刷新一下又好了。栽过两次(村主屏、那一册)。
gate "开屏取数的页等得到登录吗" . python3 scripts/check-auth-ready.py
gate "bind 的处理器都真有吗" . python3 scripts/check-wxml-handlers.py
# 昼夜的边界摊在三个文件里(天色、问候语、村民语料的四段)。走散的样子是
# 「屏上写着傍晚好而村子已经点起灯」,或者问候语加了一档、验证脚本的白名单没加 ——
# 后者只在一天里的某几个钟头红,而只在某几个钟头出现的红最容易被当成噪音放过。
gate "昼夜的边界三处对得上吗" . python3 scripts/check-clock-bands.py
# 一个人的头像色摊在四屏(名册 / 村主屏 / 他的主页 / 扫开那一屏)。
# 少接一处,他在那一屏就是另一个颜色 —— 而颜色是翻四十个人时最快的线索,
# 一处不准整条线索就不能信。页面里写 background 也会盖掉它,症状一模一样。
gate "一个人的颜色四处一样吗" . python3 scripts/check-face-color.py
# 真机上每页都有一条原生导航栏,而镜像不画它 —— 截图上看不见,只能靠这一支。
# 0830 之后页面自己画了大标题,导航栏再写一遍页面名就是同一个词出现两次;
# 空着更糟:那条栏还在,只是没有字。
gate "导航栏标题统一吗" . python3 scripts/check-nav-title.py
# 「八月三十 · 周日」是说给人听的,「2026-08-30」是给系统读的。
# 三屏各拼了一份,其中两屏还是并排的 tab —— 切过去一种写法,切回来另一种。
gate "日期只有一种说法吗" . python3 scripts/check-day-words.py
# 2026-08-30 用户定:「完全不允许有任何文言古书的表达,只能是在命理分析中
# 专业细节中有」。规则不写成代码就会漂 —— 上一版的门解、宜忌、收尾句
# 全是文言，而三支标点门禁都是绿的:它们只管标点，不管说的是不是人话。
gate "屏上说的是人话吗" . python3 scripts/check-plain-words.py
# 0830 标尺（设计册 §1.5）里能机械判的那四条:沉浸 / 我在哪儿 /
# 一屏一件事 / 不是死路。此前每一轮都是我看着截图说「这屏成立」——
# 那是印象不是自查。落成代码之后头一次跑就抓出两处真的
#（一单那屏没有他的脸、两颗主按钮结构上能同时出现）。
gate "五行色文字用 -fg"       . python3 scripts/check-wuxing-fg.py
gate "村民台词合规格"        . python3 scripts/check-villager-lines.py
gate "屏上不拿指代当名字"     . python3 scripts/check-no-deixis.py
gate "金额只有一支格式化"     . python3 scripts/check-money-fmt.py
gate "22 屏对得上尺子吗" . python3 scripts/check-screen-ruler.py
gate "开局站位对得上第一件事吗" . python3 scripts/check-room-start.py
# 「站位对得上」不等于「看得见」——婆婆的站位一直是对的，
# 只是正对着水晶球坐，从正面看整个人只剩一个帽尖（实测露出 41%）。
# 这一支把主人染成品红重渲一次，数画面上还剩多少 —— 那就是没被挡住的部分。
gate "进屋看得见主人吗" . bun web/see-host.mjs
# 镜像自己会先组装。动线要真跑一遍浏览器,几十秒
gate "web verify · 动线"  . bash web/run-verify.sh

echo
echo "── 部署配置 ──"
if docker info >/dev/null 2>&1; then
  gate "docker-compose 合不合法" . docker compose config --quiet
  gate "nginx.conf 合不合法" . bash -c 'docker run --rm -v "$PWD/webadmin/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t'
  gate "反代目标 compose 里有吗" . bash -c 'for s in $(grep -oE "http://[a-z-]+:[0-9]+" webadmin/nginx.conf | sed "s|http://||;s|:.*||" | sort -u); do docker compose config --services | grep -qx "$s" || { echo "nginx 反代到 ${s}，compose 里没有"; exit 1; }; done'
else
  skip "部署配置那三支" "docker 没起，跳过 —— 这几项【没验】"
fi

echo
echo "── 后台（webadmin）──"
if [ -d webadmin/node_modules ]; then
  gate "webadmin build · 类型+打包" webadmin npm run build
else
  skip "webadmin build · 类型+打包" "没装依赖(cd webadmin && npm ci)"
fi
if curl -sf http://127.0.0.1:6029/admin/health >/dev/null 2>&1; then
  gate "admin 冒烟 · 每条路由" . python3 scripts/admin-smoke.py
  # 它两边都探（后台 17 条 + 用户侧 6 条），所以两个 API 都得起着。
  if curl -sf http://127.0.0.1:6028/v1/health >/dev/null 2>&1; then
    gate "幽灵 id 的写操作不许说成功" . python3 scripts/check-ghost-id.py
  else
    skip "幽灵 id 的写操作不许说成功" "业务 API（:6028）没起，跳过 —— 这一项【没验】"
  fi
  gate "admin 控制台 · 逐页走"  . bash scripts/webadmin-verify.sh
  # 通知条得在真浏览器里看才算数：它是 8 秒 TTL 的东西，接口层看不见。
  # 通知条那一支现在由 `webadmin-verify.sh` 带着跑（vite 在那儿起着），
  # 不再单独跑一遍 —— 单独跑要另起一个 vite，而它此前【只在本机】跑，
  # CI 一次都没碰过。
else
  skip "admin 冒烟 · 每条路由" "后台 API（:6029）没起，跳过 —— 这一项【没验】"
  skip "幽灵 id 的写操作不许说成功" "同上"
  skip "admin 控制台 · 逐页走"  "同上"
  skip "通知条 · 真浏览器"      "同上"
fi

echo
echo "── 后端 ──"
gate "术数指的叶真存在吗" . python3 scripts/check-art-leaf.py
# 后台写操作有没有查角色。判的不是「角色对不对」——那要产品定分工表——
# 而是「有没有变」：新加一条没查的要红，台账里某条加上了也要红。
gate "后台写操作查角色了吗" . python3 scripts/check-admin-roles.py
gate "外部报错原文不进响应体" . python3 scripts/check-error-leak.py
if curl -sf http://127.0.0.1:6028/v1/health >/dev/null 2>&1; then
  gate "要登录的接口挡得住吗" . python3 scripts/check-auth-guards.py
  gate "甲的东西乙碰得到吗" . python3 scripts/check-cross-user.py
  gate "钱的接口要不要幂等键" . bash scripts/check-idem-required.sh
  # 前端声明的字段，真响应里到底有没有。上一支（check-api-shape）比的是
  # 源码里 `json!({…})` 的键，够不着 `map_rows` ——而钱那条链整片走的是它。
  # 2026-08-28 就漏在这儿：`OrderLine.sku_name` 前端有、响应没有，
  # 于是每一单的商品名都显示成 sku_id，不报错、不留白。
  gate "声明的字段真响应里有吗" . python3 scripts/check-api-shape-live.py
  # 边界语义：该拒的拒没拒、该 404 的 404 没有、该落库的字段落没落。
  # 要两个服务都在，所以放在这里。
  if curl -sf http://127.0.0.1:6029/admin/health >/dev/null 2>&1; then
    gate "语义 · 边界那一半" . bash scripts/verify-semantics.sh
  else
    skip "语义 · 边界那一半" "后台 API（:6029）没起，跳过 —— 这一项【没验】"
  fi
else
  # 这三条以前【一行都不打】就消失了，总账看着还是完整的。
  # 没跑就要说没跑 —— 这支脚本的全部意义就在这句。
  skip "要登录的接口挡得住吗" "后端（:6028）没起，跳过 —— 这一项【没验】"
  skip "甲的东西乙碰得到吗"   "同上"
  skip "钱的接口要不要幂等键" "同上"
  skip "声明的字段真响应里有吗" "同上"
  skip "语义 · 边界那一半"    "同上"
fi
# 枚举声明的取值 vs 库里的 CHECK。要库，不要 API。
if ! pg_isready -h localhost -p 6032 >/dev/null 2>&1; then
  skip "枚举跟库里的 CHECK 对得上吗" "Postgres（:6032）没起，跳过 —— 这一项【没验】"
  skip "在售的东西给得出吗" "同上"
  skip "每个用神都指得着人吗" "同上"
else
  gate "枚举跟库里的 CHECK 对得上吗" . env \
    PSQL_URL='postgres://unmei:unmei_dev_pwd@localhost:6032/unmei' \
    python3 scripts/check-enum-check.py
  # 在售的东西，付了钱真给得出来吗。这个仓库栽在这件事上三次，
  # 形状一模一样：商品上架了，履约那一头是空的（报告 / 合婚与问事一卦 /
  # 黄金会员）。三次都是人读代码才发现的。
  gate "在售的东西给得出吗" . env \
    PSQL_URL='postgres://unmei:unmei_dev_pwd@localhost:6032/unmei' \
    python3 scripts/check-listed-deliverable.py
  # 「你缺 X，下面这几位跟你补得上」那句话的依据。写错一个方向名这条链就断,
  # 而断了【不报错】—— 匹配不到人,排序悄悄退回原样,那句话跟着变成假话。
  gate "每个用神都指得着人吗" . env \
    PSQL_URL='postgres://unmei:unmei_dev_pwd@localhost:6032/unmei' \
    python3 scripts/check-yongshen-bias.py
fi
# ── 下面这几支 2026-08-25 之前【只在 CI 的 backend.yml 里跑】 ─────────
# 删 CI 那天差点跟着一起没了。「只在 CI 里跑过」的东西最容易这样消失:
# 本机从来看不见它们，于是也想不起它们。
gate "依赖方向 · domain 不许碰基础设施" . bash scripts/check-domain-purity.sh

if [ "$QUICK" = 1 ]; then
  skip "cargo check · 全部 target" "--quick"
else
  # 比 cargo test 宽:bench / example 编不编得过,它才看得见
  gate "cargo check · 全部 target" backend cargo check --workspace --all-targets --quiet
fi

# 本仓禁用 sqlx 的 query! 宏,代价是编译期完全不校验 SQL:表名、列名写错
# 都要到运行期才变成 500。这一支把那层校验补回来 —— 不自己解析 SQL,
# 交给真的 Postgres PREPARE 一遍。
if [ "$QUICK" = 1 ]; then
  skip "check-sql · 每条 SQL 过一遍 Postgres" "--quick"
elif ! pg_isready -h localhost -p 6032 >/dev/null 2>&1; then
  skip "check-sql · 每条 SQL 过一遍 Postgres" "Postgres（:6032）没起 —— 这一项【没验】"
else
  gate "check-sql · 每条 SQL 过一遍 Postgres" . env \
    DATABASE_URL='postgres://unmei:unmei_dev_pwd@localhost:6032/unmei' \
    python3 scripts/check-sql.py
fi

if [ "$QUICK" = 1 ]; then
  skip "cargo test --workspace" "--quick"
elif ! pg_isready -h localhost -p 6032 >/dev/null 2>&1; then
  # 库在 docker 里、端口 6032(不是默认的 5432)。查错端口会误判成「没跑」
  skip "cargo test --workspace" "Postgres（:6032）没起，跳过 —— 这一项【没验】"
else
  # 测试用【自己的库】,不跟跑着的 API 共用。
  #
  # 共用时:测试往 price_book 插的行留在库里,下一轮 `verify-semantics`
  # 发布的那条 JPY 价被它按 effective_from 盖过去 —— 于是「同一笔里币种不一致」
  # 这个前提根本没造出来,下单当然是 200,那条断言就偶发地红一次。
  # 偶发的门禁比常红的更糟:它让每一次真红都可以被当成噪音。
  # (2026-08-22 立案,见 docs/FINDING-2026-08-22-shared-test-db.md;2026-08-23 修。)
  #
  # 建库放在这里,是为了 `bash scripts/gates.sh` 在新机器上直接跑得起来。
  # 幂等:已经有了就什么都不做。测试自己会 `sqlx::migrate!`,所以空库就够。
  # 两边跑过对照:169 通过 / 0 失败,一条不少 —— 换库没有把测试悄悄跳掉。
  TESTDB='postgres://unmei:unmei_dev_pwd@localhost:6032/unmei_test'
  if ! psql "$TESTDB" -c 'SELECT 1' >/dev/null 2>&1; then
    psql 'postgres://unmei:unmei_dev_pwd@localhost:6032/postgres' \
      -c 'CREATE DATABASE unmei_test OWNER unmei' >/dev/null 2>&1 || true
    psql "$TESTDB" -f infra/postgres/init.sql >/dev/null 2>&1 || true
  fi
  # 跑测试**并断言它们真的跑了** —— 见 scripts/run-backend-tests.sh。
  # 没有那道断言的话，集成测试退化成「无 DB 静默跳过」也看着像绿的。
  gate "cargo test --workspace（并断言真跑了）" . env TESTDB="$TESTDB" \
    bash scripts/run-backend-tests.sh
fi

echo
echo "过 $pass · 挂 $fail · 跳过 $skipped"
if [ "$fail" -gt 0 ]; then
  printf '挂了这几支：%s\n' "${FAILED[*]}"
  exit 1
fi
[ "$skipped" -gt 0 ] && echo "（跳过的没验，别当它过了）"
exit 0
