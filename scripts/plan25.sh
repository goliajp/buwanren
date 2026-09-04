#!/usr/bin/env bash
# 25 计划 · 横切验收 —— 2 个管理员 + 5 个用户，清零重来。
#
# 设计见 docs/ACCEPTANCE-25.md。这一支只管三件事：
#
#   reset   把这一族数据删干净（按 `P25·` 与 `p25-` 两个记号，不碰别人的）
#   seed    造五个人和他们的行为 —— **全走真接口**
#   check   跑用例，报总账
#
# 为什么全走真接口：写 SQL 插出来的订单不经过取价、不经过风控、
# 不写 outbox、不发事件 —— 它长得像订单，而它不是。
# 这一支要验的恰恰是「这条链走得通」。
#
# 用法：
#   bash scripts/plan25.sh reset
#   bash scripts/plan25.sh seed
#   bash scripts/plan25.sh check
#   bash scripts/plan25.sh all      # reset → seed → check
set -u
cd "$(dirname "$0")/.."

API=${API:-http://127.0.0.1:6028}
ADMIN=${ADMIN:-http://127.0.0.1:6029}
DB=${DATABASE_URL:-postgres://unmei:unmei_dev_pwd@localhost:6032/unmei}
STATE=${PLAN25_STATE:-/tmp/plan25-state.json}

say_bad() { printf '\033[31m✗\033[0m %s\n' "$*"; }
say_ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
say_dim() { printf '\033[2m·\033[0m %s\n' "$*"; }

psql1() { psql "$DB" -tAc "$1" 2>/dev/null; }

# ── 前提：三样都得在，缺一样就明说，不偷偷降档 ──────────────
preflight() {
  local bad=0
  psql1 'SELECT 1' >/dev/null || { say_bad "连不上库（${DB}）"; bad=1; }
  curl -sf -m 3 "$API/v1/health" >/dev/null || { say_bad "用户 API 不在（${API}）"; bad=1; }
  curl -sf -m 3 "$ADMIN/admin/health" >/dev/null || { say_bad "后台 API 不在（${ADMIN}）"; bad=1; }
  command -v jq >/dev/null || { say_bad "要 jq"; bad=1; }
  # 【排盘服务也要在】（2026-09-04）。
  # U2 那一格是「本命 + 七天签 + 说明书」——三样都要 mingli 算。
  # 它不在的时候，这个脚本报的是「本命摘要　期望 200 实际 404」：
  # 那句话读起来像本命那条接口坏了，而真因是【另一个服务没起】。
  # 今天为这个查了一轮 —— 会话重启把三个服务全带走了，
  # 而屏幕上写的是履约和排盘的毛病。
  #
  # 【问它自己】。`/api/health` 是 mingli 真正的健康路径，
  # 它回的是「service: mingli-api, status: ok」加二十一个算子的清单。
  # 判据不该是「端口上有人听」——那只说明有个进程绑着口,
  # 说不了它是不是这个服务、算不算得动。
  # 后台那一页（运营台 › 排盘服务）早就是这么探的
  # （`unmei-admin-api/src/routes/mingli.rs`）,而我今天自己造了
  # 一个 `curl /` 的坏判据 —— mingli 只认 `/api/*`，问 `/` 一律 404,
  # 于是它明明起着，我等了它十分钟。
  # `.claude/CLAUDE.md` 里记着「拿 `/health` 当探针在这个仓里
  # 误判过两次」——这是第三次，而正确的那条判据一直在代码里。
  #
  # 【shell 里没有块注释】。这一段头一版写成了 `/* … */` ——
  # 而 `bash -n` 查不出来：它只验语法，`/*` 是一个合法的命令名
  # （glob 展开成 /bin /etc …）。今天这是第二次，
  # 上一次记在这个文件里「御守两条入口」那一段。
  local mingli_base=${MINGLI_BASE:-http://127.0.0.1:6027}
  if ! curl -sf -m 3 "${mingli_base}/api/health" >/dev/null 2>&1; then
    say_bad "排盘服务答不上话（${mingli_base}/api/health）—— U2 的本命、七天签、说明书全要它"
    echo "     起它：cd ../mingli && cargo run -p mingli-api"
    bad=1
  fi
  [ "$bad" = 0 ] || { echo; echo "先把它们起起来：bash scripts/dev-all.sh"; exit 2; }
}

# ── 清零 ────────────────────────────────────────────────────
#
# 【按这一族自己的记号删，不按时间、不按「最近的」】。
# 五个人的 nickname 一律 `P25·xxx`，造出来的商品前缀 `p25-`。
# 顺着 app_user 摸下去，一层层删干净。
#
# **不动两个管理员**（他们是种子里的），**不动别人的数据**。
do_reset() {
  local n_users
  n_users=$(psql1 "SELECT count(*) FROM app_user WHERE nickname LIKE 'P25·%'")
  say_dim "库里有 ${n_users:-0} 个 P25 用户"

  psql "$DB" -q <<'SQL'
BEGIN;
CREATE TEMP TABLE p25_users AS
  SELECT id FROM app_user WHERE nickname LIKE 'P25·%';
CREATE TEMP TABLE p25_orders AS
  SELECT id FROM order_record WHERE user_id IN (SELECT id FROM p25_users);

-- 从叶子往根删。每一层都写出来，不靠 ON DELETE CASCADE ——
-- 靠级联的话，哪天有人把外键改成 RESTRICT，这里会静静地删不干净。
DELETE FROM shipment_trace_event WHERE shipment_id IN
  (SELECT id FROM shipment WHERE order_id IN (SELECT id FROM p25_orders));
DELETE FROM shipment          WHERE order_id  IN (SELECT id FROM p25_orders);
DELETE FROM refund            WHERE order_id  IN (SELECT id FROM p25_orders);
DELETE FROM payment_event     WHERE payment_id IN
  (SELECT id FROM payment WHERE order_id IN (SELECT id FROM p25_orders));
DELETE FROM payment_attempt   WHERE payment_id IN
  (SELECT id FROM payment WHERE order_id IN (SELECT id FROM p25_orders));
DELETE FROM payment           WHERE order_id  IN (SELECT id FROM p25_orders);
DELETE FROM order_event       WHERE order_id  IN (SELECT id FROM p25_orders);
DELETE FROM order_meta        WHERE order_id  IN (SELECT id FROM p25_orders);
DELETE FROM report            WHERE order_line_id IN
  (SELECT id FROM order_line WHERE order_id IN (SELECT id FROM p25_orders));
DELETE FROM coupon_redemption WHERE coupon_id IN
  (SELECT id FROM coupon WHERE owner_user_id IN (SELECT id FROM p25_users));
DELETE FROM order_line        WHERE order_id  IN (SELECT id FROM p25_orders);
DELETE FROM order_record      WHERE id        IN (SELECT id FROM p25_orders);

DELETE FROM subscription_invoice WHERE subscription_id IN
  (SELECT id FROM subscription WHERE user_id IN (SELECT id FROM p25_users));
DELETE FROM subscription       WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM coupon             WHERE owner_user_id IN (SELECT id FROM p25_users);
DELETE FROM activity_registration WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM user_badge         WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM naji_record        WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM villager_reading   WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM villager_residency WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM natal              WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM risk_event         WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM risk_case          WHERE involved_user_ids && ARRAY(SELECT id FROM p25_users);
DELETE FROM idempotency_log    WHERE user_id IN (SELECT id FROM p25_users);
DELETE FROM app_user           WHERE id IN (SELECT id FROM p25_users);

-- 造出来的目录（御守那一件，见文档里的先决条件）
-- 【按 sku 也要摸一遍】。验收商品可能被别人的单引着 ——
-- 镜像动线就从目录里挑过它。只顺着用户删的话，那些行留在库里，
-- 而 sku 被 order_line 引着删不掉，清零当场报外键。
CREATE TEMP TABLE p25_stray AS
  SELECT DISTINCT order_id FROM order_line WHERE sku_id LIKE 'p25-%';
DELETE FROM shipment_trace_event WHERE shipment_id IN
  (SELECT id FROM shipment WHERE order_id IN (SELECT order_id FROM p25_stray));
DELETE FROM shipment      WHERE order_id IN (SELECT order_id FROM p25_stray);
DELETE FROM refund        WHERE order_id IN (SELECT order_id FROM p25_stray);
DELETE FROM payment_event WHERE payment_id IN
  (SELECT id FROM payment WHERE order_id IN (SELECT order_id FROM p25_stray));
DELETE FROM payment_attempt WHERE payment_id IN
  (SELECT id FROM payment WHERE order_id IN (SELECT order_id FROM p25_stray));
DELETE FROM payment       WHERE order_id IN (SELECT order_id FROM p25_stray);
DELETE FROM order_event   WHERE order_id IN (SELECT order_id FROM p25_stray);
DELETE FROM order_meta    WHERE order_id IN (SELECT order_id FROM p25_stray);
DELETE FROM report        WHERE order_line_id IN
  (SELECT id FROM order_line WHERE order_id IN (SELECT order_id FROM p25_stray));
DELETE FROM order_line    WHERE order_id IN (SELECT order_id FROM p25_stray);
DELETE FROM order_record  WHERE id       IN (SELECT order_id FROM p25_stray);

DELETE FROM omamori_credential WHERE omamori_id LIKE 'p25-%';
DELETE FROM omamori            WHERE id LIKE 'p25-%';
DELETE FROM price_book         WHERE id LIKE 'p25-%';   -- 含补给 hk 的那条
DELETE FROM sku                WHERE id LIKE 'p25-%';
DELETE FROM product            WHERE id LIKE 'p25-%';
COMMIT;
SQL
  local n_left
  n_left=$(psql1 "SELECT count(*) FROM app_user WHERE nickname LIKE 'P25·%'")
  if [ "${n_left:-1}" != 0 ]; then
    say_bad "清零之后还剩 $n_left 个 P25 用户 —— 删不干净就别说清了"
    return 1
  fi
  rm -f "$STATE" "$STATE.checked"
  say_ok "清零：P25 的人与数据都没了（管理员与目录没动）"
}

# ── 种人 ────────────────────────────────────────────────────
anon_login() {
  curl -s -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{}' | jq -r .token
}
call() {   # call <方法> <token> <路径> [body]
  local m=$1 t=$2 p=$3 b=${4:-}
  if [ -n "$b" ]; then
    curl -s -X "$m" "$API$p" -H "authorization: Bearer $t" \
      -H 'content-type: application/json' -H "idempotency-key: p25-$RANDOM$RANDOM" -d "$b"
  else
    curl -s -X "$m" "$API$p" -H "authorization: Bearer $t"
  fi
}
# 五个人的名字。参数走 ASCII 代号，中文只在这一处 ——
# shell 里 `$(f 中文)` 会被标点门禁当成「中文括号」报红（那是它的盲区，
# 代码里的括号不是文案），把中文收进这里就没这回事。
#
# **不用关联数组**：macOS 自带的是 bash 3.2，`declare -A` 是 bash 4 才有的，
# 而这个仓库的判据是 `bash scripts/...`，不是 zsh
#（同一天已经在中文函数名与中文变量名上各栽过一次）。
p25_name() {
  case "$1" in
    u1) echo 新来的 ;;
    u2) echo 算过命的 ;;
    u3) echo 请了人的 ;;
    u4) echo 钱在飞的 ;;
    u5) echo 香港那位 ;;
    *)  echo "$1" ;;
  esac
}

# 等这一单的钱真的到账。
#
# 【发起支付 ≠ 收到钱】。`POST /orders/:id/pay` 回的是给客户端去调起
# 微信支付的参数（prepay_id / paySign），钱还没动 —— 真实里由渠道回调推进，
# 开发机上由 `UNMEI_PAY_STUB_AUTOSETTLE=1` 的 payment_sweep 每 30 秒结一轮。
#
# 头一版种完人就往下走，于是每一张单都停在 unpaid，五条用例跟着红 ——
# 而它们报的是「包裹在途是空的」「退款是空的」，看着像别处坏了。
# **等的是状态真的翻了**，不是等一个固定的秒数：
# 固定秒数在机器忙的时候不够，而不够的时候它长得跟「付款坏了」一样。
wait_paid() {  # wait_paid <订单号>
  local i st
  for i in $(seq 1 60); do
    st=$(psql1 "SELECT status FROM order_record WHERE id='$1'")
    case "$st" in
      paid|fulfilling|done) return 0 ;;
    esac
    sleep 2
  done
  say_bad "等了两分钟，$1 还是 $st —— 支付没结上（sweeper 在跑吗？AUTOSETTLE 开了吗？）"
  return 1
}

# 等这一单的运单建出来。
#
# 【付款成功 ≠ 运单已存在】。运单是履约那一步建的:
# `OrderPaid` 事件进 outbox → dispatcher 每 5 秒取一批 → `apply_order_paid`
# 里才 INSERT shipment。头一版付完就 `UPDATE shipment`，影响 0 行 ——
# 而 0 行不报错，于是它静静地什么都没改，用例报的是「包裹在途是空的」。
wait_shipment() {  # wait_shipment <订单号>
  local i n
  for i in $(seq 1 60); do
    n=$(psql1 "SELECT count(*) FROM shipment WHERE order_id='$1'")
    [ "${n:-0}" != 0 ] && return 0
    sleep 2
  done
  say_bad "等了两分钟，$1 还没有运单 —— outbox 在跑吗？"
  return 1
}

# 等这个人真的住进来。御守是付款即入住，而那一步在履约里 ——
# 跟运单一样要等 outbox 那一跳。
wait_move_in() {  # wait_move_in <用户号> <村民号>
  local i n
  for i in $(seq 1 60); do
    n=$(psql1 "SELECT count(*) FROM villager_residency WHERE user_id='$1' AND villager_id='$2'")
    [ "${n:-0}" != 0 ] && return 0
    sleep 2
  done
  say_bad "等了两分钟，$2 还没住进 $1 的村子 —— 履约在跑吗？"
  return 1
}

# ── mock：真机才有的那几件事 ──────────────────────────────
#
# 商业级验收要覆盖全部动线，而这几件事在这台机器上**做不到**：
# 承运商的回调要外部服务打进来、微信支付的回调要微信打进来、
# 扫码要一部真手机。做不到的不许假装通过（`.claude/CLAUDE.md` 三条铁律），
# 但也不能因此让整条链断在这里 —— 所以给每一件一个**说清楚的 mock**：
# 走的是系统里真实的那条写路径，只是触发的人是这个脚本，不是外部世界。
#
# 每一个 mock 都在这里列明「它替代了谁」，那一行就是它的边界。

# 【mock 也要回读】。写完不看一眼的话，改了 0 行跟改成了长得一模一样 ——
# 而 0 行不报错。这一支今天就栽过一次:mock 报「做完了」，
# 用例报「包裹在途是空的」，看着像别处坏了。
# 变量名一律 ASCII —— bash 不收中文标识符（zsh 收，所以 `bash -n` 才是判据）。
# 今天在函数名、变量名、局部变量上各栽过一次，这是第三次。
mock_ship() {  # mock_ship <订单号> <目标状态> [运单号]
  local oid=$1 to=$2 no=${3:-} i st
  for i in 1 2 3; do
    psql1 "UPDATE shipment SET status='$to',
             tracking_no=COALESCE(NULLIF('$no',''), tracking_no),
             carrier_code=COALESCE(carrier_code,'sf'),
             picked_up_at=CASE WHEN '$to'='in_transit' THEN COALESCE(picked_up_at, NOW()) ELSE picked_up_at END,
             delivered_at=CASE WHEN '$to'='delivered'  THEN NOW() ELSE delivered_at END
           WHERE order_id='$oid'" >/dev/null
    st=$(psql1 "SELECT status FROM shipment WHERE order_id='$oid' LIMIT 1")
    [ "$st" = "$to" ] && return 0
    # 履约那一步可能刚好又写了一次状态 —— 等它写完再来
    sleep 2
  done
  say_bad "mock 把 $oid 的运单推到 ${to}，回读却是 ${st:-空}"
  return 1
}
# mock：承运商推来「已揽收 → 在途」。真实里是 POST /v1/webhooks/carrier/:provider
mock_carrier_in_transit() { mock_ship "$1" in_transit "$2"; }
# mock：承运商推来「出了状况」（地址不详 / 拒收）
mock_carrier_exception()  { mock_ship "$1" exception  "$2"; }
# mock：承运商推来「已签收」
mock_carrier_delivered()  { mock_ship "$1" delivered; }

# mock：他订上了。
#
# 【为什么是 mock 而不是走接口】：全仓没有一处建订阅的代码。
# `plan` 表只有后台在读，`INSERT INTO subscription` 只出现在三个测试文件里 ——
# 也就是说续费、催缴、账单、后台那一整页订阅，底下没有一条用户走得到的路。
# 这是先决条件，记在 docs/ACCEPTANCE-25.md，不在这儿现造一个下单即签约的接口。
#
# 而它必须被 mock 出来，因为「订着的」那一屏有两支：一支是空态，
# 三轮评审都在打磨它；另一支是【真的订着】，一次也没渲染过 ——
# 五个验收用户没有一个有订阅，于是那一支里三样字段原样打库里的值
# （`plan-mg-month` / `active` / `2026-10-05T04:12:33.123456+08:00`）
# 一直没人看见。红着的分支不会自己喊。
mock_subscribe() {  # mock_subscribe <单号> <用户号> <套餐号> <状态> <起> <止> <到期不续>
  local sid=$1 uid=$2 pid=$3 st=$4 from=$5 to=$6 cancel=$7 got
  psql1 "INSERT INTO subscription(id, user_id, plan_id, status, source_channel,
           current_period_start, current_period_end, next_billing_attempt_at,
           cancel_at_period_end, region)
         VALUES('$sid','$uid','$pid','$st','wechat_jsapi',
           NOW() - INTERVAL '$from', NOW() + INTERVAL '$to',
           CASE WHEN '$st'='past_due' THEN NOW() + INTERVAL '1 day' END,
           $cancel,'cn')" >/dev/null
  got=$(psql1 "SELECT status FROM subscription WHERE id='$sid'")
  [ "$got" = "$st" ] && return 0
  say_bad "mock 订阅 $sid 写不进去（回读是 ${got:-空}）"
  return 1
}

# 下一单，把单号打出来。下不成就【当场喊】，不往下走。
#
# 【下单失败不许静默】（2026-09-04）。头一版写的是
#   o4b=$(call POST ... | jq -r '.order_id // empty')
#   if [ -n "$o4b" ]; then ... fi
# —— 下单失败时 `o4b` 是空的，整块直接跳过，seed 报「造好了」，
# 而三个环节之后用例报「有一件包裹在途 空的」。那条红指的是履约，
# 真正坏掉的是三步之前的下单，中间隔着两个函数。
# 真因当时是库存耗尽，接口原原本本答了「不够了 —— 要 1，还剩 0」,
# 这句话被 `// empty` 吃掉了。
must_order() {  # must_order <token> <单据 JSON> <这一单是干嘛的> → 打印单号
  local tok=$1 body=$2 what=$3 resp oid
  resp=$(call POST "$tok" /v1/orders "$body")
  oid=$(printf '%s' "$resp" | jq -r '.order_id // empty')
  if [ -z "$oid" ]; then
    # 【报错要走 stderr】。这个函数的返回值是【命令替换取走的】——
    # 打在 stdout 上的话，这句话会被 `$( )` 连同单号一起吞进变量里，
    # 于是脚本静默退出，一个字都不留在屏幕上。
    # 2026-09-04 这个函数第一版就栽在这:它是为了「失败不许静默」而写的，
    # 自己却静默了一次。
    say_bad "下不了单（${what}）—— 接口说：$(printf '%s' "$resp" | head -c 300)" >&2
    return 1
  fi
  printf '%s' "$oid"
}

make_user() {  # make_user <代号> <区> → 打印 "token id"
  local tok id
  tok=$(anon_login)
  [ -n "$tok" ] && [ "$tok" != null ] || { say_bad "匿名登录拿不到 token"; return 1; }
  call POST "$tok" /v1/user/me "{\"nickname\":\"P25·$(p25_name "$1")\"}" >/dev/null
  id=$(call GET "$tok" /v1/user/me | jq -r .id)
  # 区不是用户能改的（那是注册时按来源定的），这一处直接写库并说明理由：
  # 五个人里必须有一个在别的区，否则分区那一整套验不到（见文档「名单」一节）。
  psql1 "UPDATE app_user SET region='$2' WHERE id='$id'" >/dev/null
  echo "$tok $id"
}

# 御守那一件 —— 见文档里的先决条件：种子里一件都没有，这一支自己造。
make_omamori_product() {
  psql "$DB" -q <<'SQL'
INSERT INTO product (id, code, name, sub_title, category, kind, status,
                     fulfillment_kind, tags, sort_weight, available_regions)
VALUES ('p25-oma-ayun', 'p25_oma_ayun', '阿云的护身符', '请她回村 · 住进你的村子',
        'omamori', 'one_shot', 'listed', 'residency', ARRAY['御守','村民'], 95,
        ARRAY['cn','hk'])
ON CONFLICT (id) DO UPDATE SET status='listed';
INSERT INTO sku (id, product_id, code, name, stock_kind, default_currency, status, villager_id)
VALUES ('p25-sku-oma-ayun', 'p25-oma-ayun', 'p25_sku_oma_ayun', '阿云的护身符',
        'unlimited', 'CNY', 'active', 'ayun')
ON CONFLICT (id) DO UPDATE SET status='active';

-- 先决条件之三：**真目录只在 cn 上架**。
-- prod-jade-pendant / prod-suhe-incense / prod-naji-deep 三件的
-- available_regions 全是 {cn} —— 也就是说海外五个 cell 一件商品都没有，
-- 而多区域是这个后台从建库起就在做的事（每条查询按 region 过滤、
-- 11 个 KPI 与月报都按它分组）。
-- 跟前两条同源：目录只做了 cn。
--
-- 25 计划不去改真商品的上架区（那是产品决定：定价、合规、物流各区不同），
-- 改造一件自己的「会寄的东西」，两个区都上 —— 这样「香港用户买一件实物、
-- 包裹出状况、阿港去处理」这条链才验得到。
-- 【验收用的东西不许混进真目录】（2026-09-04，两条门禁同时报出来）。
-- 头一版把它挂在 cn+hk 上架，于是：
--   · 「在售的东西给得出吗」报它没有商品图 —— 那条门禁是对的，
--     在架的实物买家要看得见它长什么样
--   · 镜像动线从目录里挑「在售的东西」建单，挑中了它 ——
--     那张单不属于 P25 的人，于是清零顺着用户删不到，
--     而 sku 被它的 order_line 引着，删不掉
--
-- 跟 `verify-semantics.sh` 那件校验商品同一个办法：给它一个只属于验收的区。
-- 真目录（cn/hk/…）里看不见它，而 U5 用 region=p25 下单照样买得到。
-- 【在架的实物必须有图】——「在售的东西给得出吗」那一支不看区，
-- 它是对的:在架就该有图，买家要看得见自己买的东西长什么样。
-- 这一只借用玉坠那张:它不面向买家（只在验收区），不值得单画一张，
-- 而留空会让那支门禁红，那条红说的是别的事。
INSERT INTO product (id, code, name, sub_title, category, kind, status,
                     fulfillment_kind, tags, sort_weight, available_regions,
                     hero_image_url)
VALUES ('p25-box', 'p25_box', '验收用的一只盒子', '只在验收区里寄得到',
        'charm', 'one_shot', 'listed', 'shipping', ARRAY['验收'], 10,
        ARRAY['p25'], '/images/goods-jade.png')
ON CONFLICT (id) DO UPDATE SET status='listed', available_regions=ARRAY['p25'],
        hero_image_url='/images/goods-jade.png';
INSERT INTO sku (id, product_id, code, name, stock_kind, default_currency, status)
VALUES ('p25-sku-box', 'p25-box', 'p25_sku_box', '验收用的一只盒子',
        'unlimited', 'CNY', 'active')
ON CONFLICT (id) DO UPDATE SET status='active';

-- 价排在 sku 之后 —— price_book.sku_id 有外键，插在前面会当场报
-- 「is not present in table sku」，而那条报错混在一堆输出里很容易被读成噪音。
INSERT INTO price_book (id, sku_id, currency, price_minor, region, platform, status, effective_from)
VALUES ('p25-pb-oma-cn', 'p25-sku-oma-ayun', 'CNY', 9900, 'cn', 'all', 'active', NOW()),
       ('p25-pb-oma-hk', 'p25-sku-oma-ayun', 'CNY', 9900, 'hk', 'all', 'active', NOW()),
       -- 定得贵，为的是让种子里那条风控规则真命中
       -- （`amount > 100000 AND user.age_days < 7`）——
       -- 观察模式要看的就是「它会拦下什么」，而不命中的话那一整块验不到。
       ('p25-pb-box-p25', 'p25-sku-box',     'CNY', 128000, 'p25', 'all', 'active', NOW())
ON CONFLICT (id) DO UPDATE SET status='active';

-- 【super 的 scope 是 global，不是某一个区】。种子给阿超的是 {cn} ——
-- 于是验收区里的单他在后台一条都读不到，「给包裹填运单号」当场 403。
--
-- 头一版想的是给他加一格写成 {cn,p25}。那条路把另一件事炸了出来：
-- `normalize_region_scoped` 的规矩是「scope 有多个区、请求又不带 region
-- 参数 → 当场拒」（注释写着「跨区聚合要另设一个明确的接口」）。
-- 于是阿超一管两个区，`/admin/users`、发券这些不带 region 的端点
-- 【全部 403】—— 后台大半个页面对他空着。
-- 那条规矩本身是对的（悄悄换区比报错糟得多），代价却从来没人付过：
-- 种子里【一个多区管理员都没有】，所以这条路径一次都没被走过。
-- 记在 docs/ACCEPTANCE-25.md 的先决条件里 —— 要不要给跨区聚合开一个
-- 明确的接口，那是产品决定，不是这个脚本该拍的。
--
-- 这里走的是代码本来就留好的那一条：`不限 = scope 为空 || 含 global`。
-- super 本来就该不限区，{cn} 是种子的遗漏。阿港不动（仍只有 hk），
-- 「分区管理员越不越得了区」验的是他。
--
-- 另一条走不通的路：把这只盒子也挂到 cn 上架，U4 就能在 cn 区买它 ——
-- 上架就进目录，镜像的动线会从目录里挑东西建单，挑中它的话那张单
-- 不属于 P25 的人，清零顺着用户就删不到（2026-09-04 撞过一次）。
-- 【验收用的东西不许混进真目录】优先于「让 U4 的单落在 cn」。
UPDATE admin_user SET region_scope = ARRAY['global']
 WHERE email = 'admin@unmei.local' AND NOT ('global' = ANY(region_scope));
SQL
}

do_seed() {
  make_omamori_product
  local roster

  # ── U1 新来的：什么都不做。空态是这个产品的主设计 ──────────
  read -r T1 I1 <<<"$(make_user u1 cn)"
  say_dim "U1 新来的 $I1 —— 什么都不做，他撑着每一屏的空态"

  # ── U2 算过命的：本命 → 七天签 → 买说明书 → 报名一场 ──────
  #
  # 【标题写的就是下面真做的】。上一版这一行写着「…… → 领券 → 报名」,
  # 而底下【两件都没有】:券是阿超那一天发给 U1 的，跟 U2 无关;
  # 报名一直没写。U4 那一格同一天犯了同一处（标题写着「+ 订阅」而没有）。
  # 标题跟身体对不上，是这一份夹具里最便宜的一种谎。
  read -r T2 I2 <<<"$(make_user u2 cn)"
  local n2
  n2=$(call POST "$T2" /v1/user/natals \
       '{"label":"我","year":1992,"month":3,"day":15,"hour":9,"minute":30,"gender":"female"}' | jq -r '.id // empty')
  [ -n "$n2" ] && call POST "$T2" "/v1/user/natals/$n2/activate" >/dev/null
  # 七天的签。同一天只能一签（那是规矩），所以造完之后把日子往回推 ——
  # 这一处改的是 `asked_at`，不是伪造一签:每一条都是真起出来的。
  for q in 我该结婚吗 换个工作好不好 要不要搬家 这笔钱该投吗 明天见客户顺不顺 该不该说出来 走还是留; do
    call POST "$T2" /v1/naji/spin "{\"question\":\"$q\"}" >/dev/null
    psql1 "UPDATE naji_record SET asked_at = asked_at - INTERVAL '1 day',
             asked_day = asked_day - 1
           WHERE user_id='$I2'" >/dev/null
  done
  local o2
  o2=$(must_order "$T2" "{\"lines\":[{\"sku_id\":\"sku-naji-deep\",\"qty\":1}],\"region\":\"cn\"}" "U2 的那册说明书") || return 1
  call POST "$T2" "/v1/orders/$o2/pay" '{"channel":"wechat_jsapi","openid":"p25_u2"}' >/dev/null
  wait_paid "$o2" || return 1
  # 报一场线下活动 —— 这一段是这一格的标题里写着、而body里一直没做的那一件。
  #
  # 它撑的是「去得了的」那一屏的【报过名】那一支:那一颗按钮上写「不去了」
  # （报过名的人要撤销），而没报过的人看到的是「我要去」。
  # 库里三场都是 open、cn 区、免费，U2 就是 cn 的人 —— 走真接口，不 mock。
  # 变量名一律 ASCII —— bash 不收中文标识符（这个仓里栽过四次）
  local reg
  reg=$(call POST "$T2" /v1/activity/a_dy/register | jq -r '.registration_id // empty')
  if [ -z "$reg" ]; then
    say_bad "U2 报不上那一场（/v1/activity/a_dy/register）—— 「去得了的」那一屏只剩一半"
    return 1
  fi
  say_dim "U2 算过命的 $I2 —— 本命 + 七天签 + 说明书一册 + 报了一场"

  # ── U3 请了人的：买御守 → 发货 → 扫开 → 进屋追问 ────────────
  read -r T3 I3 <<<"$(make_user u3 cn)"
  local o3
  o3=$(must_order "$T3" '{"lines":[{"sku_id":"p25-sku-oma-ayun","qty":1}],"region":"cn","contact":{"name":"P25·请了人的","phone":"13800000003"},"shipping_address":{"province":"浙江","city":"杭州","district":"西湖","detail":"某处 1 号","name":"P25","phone":"13800000003"}}' "U3 请阿云回村的那一单") || return 1
  call POST "$T3" "/v1/orders/$o3/pay" '{"channel":"wechat_jsapi","openid":"p25_u3"}' >/dev/null
  wait_paid "$o3" || return 1
  # 【买御守不寄东西 —— 付款即入住】。fulfillment_kind=residency
  # 那一支在 fulfillment.rs 里直接 move_in_from_line，不建运单。
  # 头一版在这里等运单，等了两分钟等不到 —— 而报出来的是
  # 「outbox 在跑吗」，看着像履约坏了，实际是我把两条入口搞混了。
  #
  # 御守有【两条】入口，这一版两条都要覆盖：
  #   · 线上买 → 付款即入住（就是上面这一单）
  #   · 线下拿到实体的一枚 → 扫开它（下面这一段，走真的扫码接口）
  # 第二条用另一位村民（婆婆）—— 同一个人同一位村民有唯一约束，
  # 用同一位的话第二条会被吃掉，而那一下什么都验不到。
  #
  # 【shell 里没有块注释】。头一版这一段写成 Rust 的 /* … */，
  # 于是整段被当成命令执行 —— 报出来是十几行 command not found，
  # 而中间那句带括号的还引发了语法错误。
  wait_move_in "$I3" ayun || return 1

  # mock：线下那一枚。真实里御守是随货寄出的实体，凭据印在上面 ——
  # 这里造一枚并走**真的**扫码接口，替代的只是「手机对着它碰一下」。
  psql "$DB" -q -c "INSERT INTO omamori(id, villager_id, note) VALUES ('p25-oma-popo-01','popo','25 计划 · 线下那一枚') ON CONFLICT (id) DO NOTHING;
     INSERT INTO omamori_credential(omamori_id, carrier_kind, credential) VALUES ('p25-oma-popo-01','qr','P25POPO0001') ON CONFLICT DO NOTHING;"
  call POST "$T3" /v1/omamori/scan '{"carrier":"qr","credential":"P25POPO0001"}' >/dev/null
  # 进屋追问三次 —— 第三次才松口，那是设计好的
  for _ in 1 2 3; do call POST "$T3" /v1/villagers/ayun/reading '{"question":"最近顺不顺"}' >/dev/null; done
  say_dim "U3 请了人的 $I3 —— 阿云住进来了、屋里追问过"

  # ── U4 钱在飞的：待付 + 已付在履约 + 一笔退款等着批 + 订阅 ──
  read -r T4 I4 <<<"$(make_user u4 cn)"
  # ① 一张待付（不付款，留给「快过期」那一屏）
  call POST "$T4" /v1/orders '{"lines":[{"sku_id":"sku-incense-try","qty":1}],"region":"cn","contact":{"name":"P25·钱在飞的","phone":"13800000004"},"shipping_address":{"province":"上海","city":"上海","district":"静安","detail":"某处 4 号","name":"P25","phone":"13800000004"}}' >/dev/null
  # ② 一张已付、在履约、包裹在途
  #
  # 买的是【验收自己那只盒子】，不是种子里的玉坠。玉坠是 limited、只有 50 件，
  # 25 计划每跑一轮吃掉一件 —— 跑到第 50 轮它就永远下不了单，
  # 而那时的报错会落在三步之后的「有一件包裹在途 空的」上。
  # 盒子是 unlimited，跑一万轮也不会把真目录吃空。
  #
  # 单落在 p25 区 —— 盒子只在那里上架，而【验收的东西不许混进真目录】。
  # U4 这一格要的是「钱在飞」：待付 / 在途 / 等着批的退款，
  # 跟这张单记在哪个区无关；他本人仍然是 cn 的人。
  # 阿超在后台够得着这张单，是因为上面给他的 scope 加了 p25。
  local o4b
  o4b=$(must_order "$T4" '{"lines":[{"sku_id":"p25-sku-box","qty":1}],"region":"p25","contact":{"name":"P25·钱在飞的","phone":"13800000004"},"shipping_address":{"province":"上海","city":"上海","district":"静安","detail":"某处 4 号","name":"P25","phone":"13800000004"}}' "U4 那件会寄的东西") || return 1
  call POST "$T4" "/v1/orders/$o4b/pay" '{"channel":"wechat_jsapi","openid":"p25_u4"}' >/dev/null
  wait_paid "$o4b" || return 1
  wait_shipment "$o4b" || return 1
  mock_carrier_in_transit "$o4b" P25TRACK0004
  # ③ 一笔退款等着批 —— 走真接口，不批（那是阿超在后台要做的事）
  local o4c
  o4c=$(must_order "$T4" '{"lines":[{"sku_id":"sku-naji-deep","qty":1}],"region":"cn"}' "U4 那笔要退的") || return 1
  call POST "$T4" "/v1/orders/$o4c/pay" '{"channel":"wechat_jsapi","openid":"p25_u4"}' >/dev/null
  wait_paid "$o4c" || return 1
  call POST "$T4" "/v1/orders/$o4c/refund" '{"reason_code":"user_request","reason_text":"不想要了"}' >/dev/null
  # ④ 三份订阅 —— 「订着的」那一屏的列表支要有东西才看得见。
  #    这一格叫「钱在飞」，而每月自动扣的那笔正是飞得最久的一笔。
  #    三份各是一种状态，因为屏上那一行对七种状态说七件事：
  #      年卡 · 还订着，但他点过「到期不续」—— 状态仍是 active，
  #             屏上唯一说得出这件事的是 cancel_at_period_end 那一句
  #      月卡 · 这期没扣成 —— 他现在就得动手，那一行是要显眼的
  #      月卡 · 早就到期的那一份 —— 台账里留着，不该跟前两种一个说法
  mock_subscribe "p25-sub-${I4}-y" "$I4" plan-mg-year  active   '300 days' '65 days'  true  || return 1
  mock_subscribe "p25-sub-${I4}-m" "$I4" plan-mg-month past_due '25 days'  '5 days'   false || return 1
  mock_subscribe "p25-sub-${I4}-o" "$I4" plan-mg-month expired  '420 days' '-390 days' false || return 1
  say_dim "U4 钱在飞的 $I4 —— 待付 / 在途 / 等着批的退款 / 三份订阅"

  # ── U5 香港那位：贵的一单（触发风控）+ 包裹出状况 ────────────
  read -r T5 I5 <<<"$(make_user u5 hk)"
  local o5
  o5=$(must_order "$T5" '{"lines":[{"sku_id":"p25-sku-oma-ayun","qty":1}],"region":"hk","contact":{"name":"P25·香港那位","phone":"85200000005"},"shipping_address":{"province":"香港","city":"香港","district":"中西区","detail":"某处 5 号","name":"P25","phone":"85200000005"}}' "U5 请阿云回村的那一单") || return 1
  call POST "$T5" "/v1/orders/$o5/pay" '{"channel":"wechat_jsapi","openid":"p25_u5"}' >/dev/null
  wait_paid "$o5" || return 1
  # 御守不寄东西（付款即入住），所以包裹那一条另买一件真会寄的
  wait_move_in "$I5" ayun || return 1
  local o5b
  o5b=$(must_order "$T5" '{"lines":[{"sku_id":"p25-sku-box","qty":1}],"region":"p25","contact":{"name":"P25","phone":"85200000005"},"shipping_address":{"province":"香港","city":"香港","district":"中西区","detail":"某处 5 号","name":"P25","phone":"85200000005"}}' "U5 那只出状况的包裹") || return 1
  call POST "$T5" "/v1/orders/$o5b/pay" '{"channel":"wechat_jsapi","openid":"p25_u5"}' >/dev/null
  wait_paid "$o5b" || return 1
  wait_shipment "$o5b" || return 1
  mock_carrier_exception "$o5b" P25TRACK0005
  say_dim "U5 香港那位 $I5 —— hk 区、包裹出了状况"

  roster=$(jq -n --arg u1 "$I1" --arg u2 "$I2" --arg u3 "$I3" --arg u4 "$I4" --arg u5 "$I5" \
        --arg t1 "$T1" --arg t2 "$T2" --arg t3 "$T3" --arg t4 "$T4" --arg t5 "$T5" \
        '{u1:{id:$u1,token:$t1},u2:{id:$u2,token:$t2},u3:{id:$u3,token:$t3},u4:{id:$u4,token:$t4},u5:{id:$u5,token:$t5}}')
  echo "$roster" > "$STATE"
  say_ok "五个人都在了 —— 名册记在 $STATE"
}

# ── 用例 ────────────────────────────────────────────────────
n_ok=0; n_bad=0; bad_list=()
want() {  # 判 <说明> <期望> <实际>
  if [ "$2" = "$3" ]; then n_ok=$((n_ok+1)); printf '  \033[32m✓\033[0m %-46s %s\n' "$1" "$3"
  else n_bad=$((n_bad+1)); bad_list+=("$1"); printf '  \033[31m✗\033[0m %-46s 期望 %s 实际 %s\n' "$1" "$2" "$3"; fi
}
want_some() { # 判非空 <说明> <实际>
  if [ -n "$2" ] && [ "$2" != null ] && [ "$2" != 0 ]; then n_ok=$((n_ok+1)); printf '  \033[32m✓\033[0m %-46s %s\n' "$1" "$2"
  else n_bad=$((n_bad+1)); bad_list+=("$1"); printf '  \033[31m✗\033[0m %-46s 空的（%s）\n' "$1" "${2:-空}"; fi
}

# ── 管理员的一天 ───────────────────────────────────────────
#
# 【验收不是「看得见」，是「办得了」】。上面那些用例查的是数据在不在，
# 而这一段是两个管理员真把这五个人的活儿办一遍 ——
# 每一件都要在【用户那一侧】看得见结果，不然「后台点了一下」什么都不说明。
#
# 每一件都是真接口，没有 mock:后台本来就是给人点的，不需要替代谁。
#
# 【这一段会改状态，所以 check 只能在 seed 之后跑一遍】。
# 批过的退款不会再是「等着批」，填过的运单号不会再是空的 ——
# 第二遍跑就会红，而那个红说的是「你已经办过了」，不是「它坏了」。
#
# 两条路可选，这里选了后者：
#   · 每一件都先把状态摆回去 —— 那等于验收自己在改数据，
#     而「摆回去」这个动作本身没有人验，它出错的时候整段静静失真
#   · **要重跑就重来一遍**（`plan25.sh all`）——
#     清零重种是这套东西本来就有的能力，用它比另造一套回滚可靠
#
# 所以 `check` 不是幂等的，而 `all` 是。判据永远是 `all`。
admin_call() {  # admin_call <方法> <token> <路径> [body]
  local m=$1 t=$2 p=$3 b=${4:-}
  if [ -n "$b" ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$m" "${ADMIN}$p" \
      -H "authorization: Bearer $t" -H 'content-type: application/json' -d "$b"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$m" "${ADMIN}$p" -H "authorization: Bearer $t"
  fi
}

do_admin_day() {  # do_admin_day <阿超的 token> <U1..U5 的 id>
  local A=$1 I1=$2 I2=$3 I4=$5 I5=$6
  echo
  echo "══ 阿超的一天 · 每一件都要在用户那一侧看得见 ══"

  # ① 批掉 U4 那笔退款 —— 钱要真的退回去
  local rid
  rid=$(psql1 "SELECT r.id FROM refund r JOIN order_record o ON o.id=r.order_id
                WHERE o.user_id='$5' AND r.status='requested' LIMIT 1")
  if [ -n "$rid" ]; then
    want "批一笔退款" 200 "$(admin_call POST "$A" "/admin/commerce/refunds/$rid/approve" '{}')"
    want_some "用户那一侧退款到账了" "$(psql1 "SELECT COALESCE(amount_refunded_minor,0) FROM order_record
                                              WHERE id=(SELECT order_id FROM refund WHERE id='$rid')")"
  else
    say_bad "没有等着批的退款 —— 这一件办不了（seed 没造出来？）"
    n_bad=$((n_bad+1)); bad_list+=("批一笔退款")
  fi

  # ② 给 U4 的包裹填运单号 —— 用户在订单页要查得到物流
  local sid
  sid=$(psql1 "SELECT s.id FROM shipment s JOIN order_record o ON o.id=s.order_id
                WHERE o.user_id='$5' AND s.status='in_transit' LIMIT 1")
  if [ -n "$sid" ]; then
    want "填一个运单号" 200 "$(admin_call POST "$A" "/admin/commerce/shipments/$sid/assign-tracking" '{"carrier_code":"sf","tracking_no":"P25ADMIN0001"}')"
    want "用户查得到这个号" P25ADMIN0001 "$(psql1 "SELECT tracking_no FROM shipment WHERE id='$sid'")"
  fi

  # ③ 封掉 U1 再放开 —— 封了要真的进不来
  want "封一个人" 200 "$(admin_call POST "$A" "/admin/users/$I1/ban" '{"banned":true,"reason":"25 计划验收"}')"
  want "封了之后他真进不来" 403 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/user/me" -H "authorization: Bearer $(jq -r .u1.token "${STATE}")")"
  want "放开他" 200 "$(admin_call POST "$A" "/admin/users/$I1/ban" '{"banned":false,"reason":"验收完了"}')"
  want "放开之后他又进得来" 200 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/user/me" -H "authorization: Bearer $(jq -r .u1.token "${STATE}")")"

  # ④ 结掉 U5 那个风控案子
  local cid
  cid=$(psql1 "SELECT id FROM risk_case WHERE involved_user_ids && ARRAY['$6'] AND state IN ('open','investigating') LIMIT 1")
  if [ -n "$cid" ]; then
    want "结一个风控案子" 200 "$(admin_call POST "$A" "/admin/commerce/risk/cases/$cid/state" '{"state":"resolved","note":"25 计划验收"}')"
    want "案子真的结了" resolved "$(psql1 "SELECT state FROM risk_case WHERE id='$cid'")"
  else
    say_dim "U5 没有风控案子（那条规则的阈值是 ¥1000，而他买的没到）—— 这一件跳过"
  fi

  # ⑤ 给 U1 发一张券 —— 他手里要真的多一张
  # 【JSON 用 jq 生成，不手拼】。手拼那一版里 `\"$code\"` 的转义
  # 经过一层函数参数之后就不是原来那个样子了，接口回 422 ——
  # 而 422 读起来像「后端不收这个字段」，跟「我拼错了」完全是两件事。
  local code body
  code="P25$(date +%s)$RANDOM"
  body=$(jq -n --arg c "$code" --arg u "$I1" \
    '{code:$c, benefit_json:{pct_off_bps:1000}, expires_at:"2027-01-01T00:00:00Z", owner_user_id:$u}')
  want "发一张券" 200 "$(admin_call POST "$A" '/admin/commerce/coupons' "$body")"
  want_some "他手里真的多了一张" "$(psql1 "SELECT count(*) FROM coupon WHERE code='$code' AND owner_user_id='$I1'")"
  # 【这一段的规矩写在标题上:「每一件都要在用户那一侧看得见」】,
  # 而上面那一条问的是库 —— 六件里只有券这一件是这么问的。
  #
  # 因为券是唯一一件用户【看不见】的:全仓没有「我的券」这个接口
  # （`/v1/coupons` 不存在，见 docs/ACCEPTANCE-25.md 先决条件六），
  # 确认页上那个格子只收码，不列他手里有什么。
  # 退一步问「他用得上吗」:券是绑人的，别人拿这个码算不出折扣 ——
  # 算得出，就说明这一张真的落到了他名下，而且他这一侧真能使。
  local u1tok pv
  u1tok=$(jq -r .u1.token "${STATE}")
  pv=$(call POST "$u1tok" /v1/orders/preview \
       "{\"lines\":[{\"sku_id\":\"sku-naji-deep\",\"qty\":1}],\"region\":\"cn\",\"coupon_codes\":[\"${code}\"]}")
  want_some "他自己算价时这张券真能用" \
    "$(printf '%s' "$pv" | jq '[.amount_discount_minor // 0]|map(select(.>0))|length')"

  # ⑥ 给 U4 的单加一条备注 —— 留痕里要查得到
  local oid
  oid=$(psql1 "SELECT id FROM order_record WHERE user_id='$5' LIMIT 1")
  if [ -n "$oid" ]; then
    want "给一张单加备注" 200 "$(admin_call POST "$A" "/admin/commerce/orders/$oid/annotate" '{"note":"25 计划验收留的"}')"
    want_some "这件事留下了痕" "$(psql1 "SELECT count(*) FROM audit_log WHERE action='order.annotate' AND target_id='$oid'")"
  fi
}

# ── 逐屏走 ─────────────────────────────────────────────────
#
# 【空态与满态都要看到】。24 个小程序页，匿名一个新人走一遍只截得到空态 ——
# 而空态是这个产品的主设计，满态是它卖的东西，两半缺一不可。
#
# 五个人各走一轮:U1 出空态、U2 出命理、U3 出村子、U4 出钱、U5 出别的区。
# 图留在 ${SHOTS}/<谁>/，人扫一眼；机器判的是「该非空的屏真的非空」。
SHOTS=${PLAN25_SHOTS:-/tmp/plan25-shots}

do_shots() {
  command -v bun >/dev/null || { say_dim "没有 bun，逐屏走这一段跳过 —— 这一段【没验】"; return 0; }
  # 【想跳过要显式说】。五轮截屏十来分钟，改一行文案就重跑一遍不划算 ——
  # 但跳过必须留在总账上:`PLAN25_NO_SHOTS=1` 跳过，而它**不算通过**。
  if [ "${PLAN25_NO_SHOTS:-0}" = 1 ]; then
    say_dim "PLAN25_NO_SHOTS=1，逐屏走跳过 —— 这一段【没验】，不是通过"
    return 0
  fi
  rm -rf "${SHOTS}"; mkdir -p "${SHOTS}"
  bun web/build.mjs >/dev/null 2>&1 || { say_bad "镜像组装不起来"; return 1; }

  local who tok n
  for who in u1 u2 u3 u4 u5; do
    tok=$(jq -r ".${who}.token" "${STATE}")
    # 【它为什么没跑完，要说出来】（2026-09-05）。
    # 上一版是 `>/dev/null 2>&1`，失败时屏上只剩一句「没跑完」——
    # 而真因写在被丢掉的那几行里（那次是「这个人没有说明书」）。
    # 留一份到文件，红的时候把最后几行贴出来。
    if ! bun web/shots.mjs --out="${SHOTS}/${who}" --api="${API}" --token="${tok}" \
         >"/tmp/plan25-shots-${who}.log" 2>&1; then
      say_bad "${who} 那一轮截屏没跑完"
      sed 's/^/       /' "/tmp/plan25-shots-${who}.log" | tail -6
      printf '       （整份输出：/tmp/plan25-shots-%s.log）\n' "${who}"
      n_bad=$((n_bad+1)); bad_list+=("${who} 截屏")
      continue
    fi
    n=$(ls "${SHOTS}/${who}"/*.png 2>/dev/null | wc -l | tr -d ' ')
    want_some "${who}（$(p25_name "${who}")）截到的屏数" "${n}"
  done
  say_dim "图在 ${SHOTS}/ —— 一页看完：open ${SHOTS}/u3/index.html"
}

# ── 后台逐页走 · 两个管理员各一轮 ───────────────────────────
#
# 【一个管理员走不出分区那一面】。已有的 `webadmin-verify` 拿阿超走 ——
# 他管全部，每一页都是满的，于是「分区管理员看到的那一屏长什么样」
# 一次都没被看过。而那正是这套后台最容易出事的地方:
# 一页把 region 漏掉，阿超那一侧一切正常，阿港那一侧多出别人的数据。
#
# 所以两个人各走一轮。判据用它自己那条（不靠映射表）：
# **接口给了 N 条，页面却一行都没渲** —— 那条判据对两个人一样成立。
do_console() {
  command -v bun >/dev/null || { say_dim "没有 bun，后台逐页走跳过 —— 这一段【没验】"; return 0; }
  if [ "${PLAN25_NO_SHOTS:-0}" = 1 ]; then
    say_dim "PLAN25_NO_SHOTS=1，后台逐页走跳过 —— 这一段【没验】，不是通过"
    return 0
  fi
  local who email out
  for who in root hk; do
    case "${who}" in
      root) email=admin@unmei.local ;;
      hk)   email=hk@unmei.local ;;
    esac
    out=$(ADMIN_EMAIL="${email}" bash scripts/webadmin-verify.sh --shots="${SHOTS}/admin-${who}" 2>&1)
    if printf '%s' "${out}" | grep -q '都通了'; then
      n_ok=$((n_ok+1))
      printf '  \033[32m✓\033[0m %-46s %s\n' "${email} 逐页走" "$(printf '%s' "${out}" | grep -c '✓')"
    else
      n_bad=$((n_bad+1)); bad_list+=("${email} 逐页走")
      printf '  \033[31m✗\033[0m %-46s\n' "${email} 逐页走"
      printf '%s' "${out}" | grep '✗' | head -4 | sed 's/^/       /'
    fi
  done
}

# ── 每一条读接口都打一遍 ────────────────────────────────────
#
# 【谁去打，决定了它是空态还是满态】。41 条用户接口里，前面那些用例
# 顺带打到了 15 条 —— 剩下的没人碰过，而「没人碰过」跟「碰了没事」
# 在总账上长得一模一样。
#
# 这一段逐条打，并且**用对的人打**：
# 说明书要用买过的人去取，卦要用问过的人，本命摘要要用建过的人 ——
# 用错人拿到的是 404，而那 404 说不清是「接口坏了」还是「这个人没有」。
do_read_all() {  # do_read_all <T1..T5> <I2 的本命 id>
  local T1=$1 T2=$2 T3=$3 T4=$4 T5=$5
  local code

  # 谁都能看的（不需要身份也不需要数据）
  # 【`/v1/incense` 不在这一组】——它要身份（「你今天点没点香」是这个人的事）。
  # 头一版把它列成公开的，报的是 401，而那 401 读起来像「接口挂了」。
  for p in /v1/health /v1/products /v1/villagers /v1/badge /v1/activity; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "${API}${p}")
    want "谁都看得到 ${p}" 200 "${code}"
  done

  # 要身份的:用【手里真有那样东西】的人去打
  local pairs
  # 每一行是「说明 | 用谁的 token | 路径」
  pairs="我是谁|${T1}|/v1/user/me
我的徽章|${T1}|/v1/user/me/badges
我的本命|${T2}|/v1/user/natals
问过的签|${T2}|/v1/naji/history
我的村子|${T3}|/v1/village
我买过的|${T4}|/v1/orders
我订着的|${T4}|/v1/subscriptions
我报了哪些活动|${T2}|/v1/activity/mine
今天点没点香|${T3}|/v1/incense"
  # 变量名一律 ASCII —— bash 不收中文标识符（zsh 收，所以 `bash -n` 才是判据）。
  # 这里栽的是第四次：`read -r 名 tok p` 让整个循环【一次都没跑】，
  # 而 read 的报错混在一片 ✓ 里，总账「过 50」看着仍然像回事 ——
  # 九条读接口的断言凭空消失，没有一条报红。
  while IFS='|' read -r label tok p; do
    [ -z "${p}" ] && continue
    code=$(curl -s -o /dev/null -w '%{http_code}' "${API}${p}" -H "authorization: Bearer ${tok}")
    want "${label}" 200 "${code}"
  done <<< "${pairs}"

  # 【要身份的，没身份就得挡住】。挑一条真会漏数据的:我买过的。
  code=$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/orders")
  want "不带身份看不到别人买过什么" 401 "${code}"

  # 按 id 取的三条 —— 各用手里真有那一件的人
  local nid oid rid naji
  nid=$(call GET "${T2}" /v1/user/natals | jq -r '.[0].id // empty')
  [ -n "${nid}" ] && want "本命摘要" 200 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/natal/${nid}/summary" -H "authorization: Bearer ${T2}")"
  naji=$(call GET "${T2}" /v1/naji/history | jq -r '.items[0].id // empty')
  [ -n "${naji}" ] && want "那一签" 200 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/naji/${naji}" -H "authorization: Bearer ${T2}")"
  oid=$(call GET "${T4}" /v1/orders | jq -r '.items[0].id // empty')
  if [ -n "${oid}" ]; then
    want "一张单的详情" 200 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/orders/${oid}" -H "authorization: Bearer ${T4}")"
    want "那一单的物流" 200 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/orders/${oid}/shipments" -H "authorization: Bearer ${T4}")"
    # 【别人的单看不到】——这一条是这一段里最要紧的
    want "别人的单看不到" 404 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/orders/${oid}" -H "authorization: Bearer ${T5}")"
  fi
  rid=$(psql1 "SELECT r.id FROM report r JOIN order_line ol ON ol.id=r.order_line_id
                JOIN order_record o ON o.id=ol.order_id
               WHERE o.user_id=(SELECT id FROM app_user WHERE nickname='P25·算过命的' LIMIT 1) LIMIT 1")
  [ -n "${rid}" ] && want "买来的那册说明书" 200 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/v1/reports/${rid}" -H "authorization: Bearer ${T2}")"
}

do_check() {
  [ -f "$STATE" ] || { say_bad "没有名册（${STATE}）—— 先 seed"; exit 2; }
  local T1 T2 T3 T4 T5 I1 I2 I3 I4 I5
  T1=$(jq -r .u1.token "$STATE"); I1=$(jq -r .u1.id "$STATE")
  T2=$(jq -r .u2.token "$STATE"); I2=$(jq -r .u2.id "$STATE")
  T3=$(jq -r .u3.token "$STATE"); I3=$(jq -r .u3.id "$STATE")
  T4=$(jq -r .u4.token "$STATE"); I4=$(jq -r .u4.id "$STATE")
  T5=$(jq -r .u5.token "$STATE"); I5=$(jq -r .u5.id "$STATE")

  echo "══ U1 新来的 · 空态要空得对 ══"
  want "他没有本命"        0 "$(call GET "$T1" /v1/user/natals | jq 'length')"
  want "他没买过东西"      0 "$(call GET "$T1" /v1/orders | jq '.items|length')"
  want "他村里没有人"      0 "$(call GET "$T1" /v1/village | jq '[.residents//[]]|flatten|length')"
  want "他一枚徽章都没得到" 0 "$(call GET "$T1" /v1/user/me/badges | jq '[.[]|select(.earned)]|length')"
  want "他订着的是空的"    0 "$(call GET "$T1" /v1/subscriptions | jq 'length')"
  want_some "而徽章图鉴仍然列得出来" "$(call GET "$T1" /v1/user/me/badges | jq 'length')"

  echo
  echo "══ U2 算过命的 · 命理那一半 ══"
  want_some "他有本命"          "$(call GET "$T2" /v1/user/natals | jq 'length')"
  want_some "问过的签有历史"    "$(call GET "$T2" /v1/naji/history | jq '.items|length')"
  want_some "买过的说明书出得来" "$(call GET "$T2" /v1/orders | jq '[.items[]|select(.status=="done" or .status=="fulfilling")]|length')"
  want_some "得到过徽章"        "$(call GET "$T2" /v1/user/me/badges | jq '[.[]|select(.earned)]|length')"
  want "报了一场线下活动"     1 "$(call GET "$T2" /v1/activity/mine | jq '.activity_ids|length')"

  echo
  echo "══ U3 请了人的 · 村子那一半 ══"
  want_some "买来的那位住进来了（付款即入住）" "$(psql1 "SELECT count(*) FROM villager_residency WHERE user_id='$I3' AND villager_id='ayun'")"
  want_some "扫来的那位也住进来了（线下那一枚）" "$(psql1 "SELECT count(*) FROM villager_residency WHERE user_id='$I3' AND villager_id='popo'")"
  want "他村里一共两个人" 2 "$(psql1 "SELECT count(*) FROM villager_residency WHERE user_id='$I3'")"
  want_some "屋里追问有记录"   "$(psql1 "SELECT count(*) FROM villager_reading WHERE user_id='$I3'")"
  want "他那一单已经完成"     done "$(psql1 "SELECT status FROM order_record WHERE user_id='$I3' LIMIT 1")"

  echo
  echo "══ U4 钱在飞的 · 钱那一半 ══"
  want_some "有一张待付的"     "$(psql1 "SELECT count(*) FROM order_record WHERE user_id='$I4' AND status='unpaid'")"
  want_some "有一件包裹在途"   "$(psql1 "SELECT count(*) FROM shipment s JOIN order_record o ON o.id=s.order_id WHERE o.user_id='$I4' AND s.status='in_transit'")"
  want_some "有一笔退款等着批" "$(psql1 "SELECT count(*) FROM refund r JOIN order_record o ON o.id=r.order_id WHERE o.user_id='$I4' AND r.status='requested'")"
  want "订着的有三份"         3 "$(call GET "$T4" /v1/subscriptions | jq 'length')"
  want "其中一份这期没扣成"   1 "$(call GET "$T4" /v1/subscriptions | jq '[.[]|select(.status=="past_due")]|length')"
  want "其中一份到期不再续"   1 "$(call GET "$T4" /v1/subscriptions | jq '[.[]|select(.cancel_at_period_end)]|length')"
  # 【接口得把套餐名带出来】。它一直在带（commerce.rs `p.name AS plan_name`），
  # 是屏那一头没读 —— 而没有这一条，屏上打回 `plan-mg-month` 也没人拦得住。
  want "每一份都带着套餐名"   3 "$(call GET "$T4" /v1/subscriptions | jq '[.[]|select(.plan_name!=null and .plan_name!="")]|length')"

  echo
  echo "══ U5 香港那位 · 别的区 ══"
  want "他在 hk"            hk "$(psql1 "SELECT region FROM app_user WHERE id='$I5'")"
  # 【要说清是哪一单】。U5 有两单:御守记在 hk、验收那只盒子记在 p25 区
  # （验收用的东西不混进真目录）。`LIMIT 1` 取到哪一张全看行序。
  want "他买御守那一单记在 hk" hk "$(psql1 "SELECT o.region FROM order_record o JOIN order_line ol ON ol.order_id=o.id WHERE o.user_id='$I5' AND ol.sku_id='p25-sku-oma-ayun' LIMIT 1")"
  want "他买盒子那一单记在验收区" p25 "$(psql1 "SELECT o.region FROM order_record o JOIN order_line ol ON ol.order_id=o.id WHERE o.user_id='$I5' AND ol.sku_id='p25-sku-box' LIMIT 1")"
  want_some "他的包裹出了状况" "$(psql1 "SELECT count(*) FROM shipment s JOIN order_record o ON o.id=s.order_id WHERE o.user_id='$I5' AND s.status='exception'")"

  echo
  echo "══ 两个管理员 · 分区与角色 ══"
  local A_root A_hk
  A_root=$(curl -s "$ADMIN/admin/auth/login" -H 'content-type: application/json' -d '{"email":"admin@unmei.local","password":"admin123"}' | jq -r .token)
  A_hk=$(curl -s "$ADMIN/admin/auth/login" -H 'content-type: application/json' -d '{"email":"hk@unmei.local","password":"admin123"}' | jq -r .token)
  want_some "阿超登得进来" "${A_root:0:12}"
  want_some "阿港登得进来" "${A_hk:0:12}"
  # 阿港只管 hk：他看得见 U5，看不见 U1–U4
  local hk_sees
  hk_sees=$(curl -s "$ADMIN/admin/users?size=200" -H "authorization: Bearer $A_hk" | jq -r '[.items[].region]|unique|join(",")')
  want "阿港只看得见 hk 的人" hk "$hk_sees"
  local hk_gets_cn
  hk_gets_cn=$(curl -s -o /dev/null -w '%{http_code}' "$ADMIN/admin/commerce/orders/$(psql1 "SELECT id FROM order_record WHERE user_id='$I4' LIMIT 1")" -H "authorization: Bearer $A_hk")
  want "阿港按 id 也读不到 cn 的单" 404 "$hk_gets_cn"
  local root_sees
  root_sees=$(curl -s "$ADMIN/admin/users?size=200&q=P25" -H "authorization: Bearer $A_root" | jq -r '.total')
  want_some "阿超看得见 P25 的人" "$root_sees"

  echo
  echo "══ 每一条读接口都打一遍 · 用手里真有那样东西的人 ══"
  do_read_all "$T1" "$T2" "$T3" "$T4" "$T5"

  do_admin_day "$A_root" "$I1" "$I2" "$I3" "$I4" "$I5"

  echo
  echo "══ 逐屏走 · 五个人各一轮 ══"
  do_shots

  echo
  echo "══ 后台逐页走 · 两个管理员各一轮 ══"
  do_console

  echo
  if [ "$n_bad" = 0 ]; then say_ok "25 计划 · $n_ok 条都过了"; else
    say_bad "25 计划 · 过 $n_ok · 挂 $n_bad"
    printf '   挂了：%s\n' "${bad_list[*]}"
    return 1
  fi
}

case "${1:-}" in
  reset) preflight; do_reset ;;
  seed)  preflight; do_seed ;;
  check) preflight; do_check ;;
  all)   preflight; do_reset && do_seed && do_check ;;
  cases)
    # 【清单从脚本里读，不手抄】。文档里抄一份的话，加一条用例
    # 而忘了改文档，那份清单就开始骗人 —— 而它看起来跟真的一样。
    echo "# 25 计划 · 用例清单"
    echo
    echo "由 \`bash scripts/plan25.sh cases\` 生成，别手改。"
    echo
    awk '
      /^  echo "══/ { line=$0
        sub(/^  echo "══ */, "", line); sub(/ *══".*$/, "", line)
        printf "\n## %s\n\n", line; next }
      /want(_some)? "/ {
        # 从【第一个 want 之后】切起 —— 有几条写在 `[ -n … ] && want …` 里，
        # 按行首切的话切出来的是那个条件语句本身。
        line=$0
        sub(/^.*want(_some)? "/, "", line); sub(/".*$/, "", line)
        if (line !~ /\$/ && line != "") printf "- %s\n", line
      }
    ' "$0"
    ;;
  *) echo "用法: bash scripts/plan25.sh {reset|seed|check|all|cases}"; exit 2 ;;
esac
