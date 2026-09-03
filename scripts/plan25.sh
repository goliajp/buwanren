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
  rm -f "$STATE"
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
INSERT INTO product (id, code, name, sub_title, category, kind, status,
                     fulfillment_kind, tags, sort_weight, available_regions)
VALUES ('p25-box', 'p25_box', '验收用的一只盒子', '两个区都寄得到',
        'charm', 'one_shot', 'listed', 'shipping', ARRAY['验收'], 10,
        ARRAY['cn','hk'])
ON CONFLICT (id) DO UPDATE SET status='listed', available_regions=ARRAY['cn','hk'];
INSERT INTO sku (id, product_id, code, name, stock_kind, default_currency, status)
VALUES ('p25-sku-box', 'p25-box', 'p25_sku_box', '验收用的一只盒子',
        'unlimited', 'CNY', 'active')
ON CONFLICT (id) DO UPDATE SET status='active';

-- 价排在 sku 之后 —— price_book.sku_id 有外键，插在前面会当场报
-- 「is not present in table sku」，而那条报错混在一堆输出里很容易被读成噪音。
INSERT INTO price_book (id, sku_id, currency, price_minor, region, platform, status, effective_from)
VALUES ('p25-pb-oma-cn', 'p25-sku-oma-ayun', 'CNY', 9900, 'cn', 'all', 'active', NOW()),
       ('p25-pb-oma-hk', 'p25-sku-oma-ayun', 'CNY', 9900, 'hk', 'all', 'active', NOW()),
       ('p25-pb-box-cn', 'p25-sku-box',      'CNY', 8800, 'cn', 'all', 'active', NOW()),
       ('p25-pb-box-hk', 'p25-sku-box',      'CNY', 8800, 'hk', 'all', 'active', NOW())
ON CONFLICT (id) DO UPDATE SET status='active';
SQL
}

do_seed() {
  make_omamori_product
  local roster

  # ── U1 新来的：什么都不做。空态是这个产品的主设计 ──────────
  read -r T1 I1 <<<"$(make_user u1 cn)"
  say_dim "U1 新来的 $I1 —— 什么都不做，他撑着每一屏的空态"

  # ── U2 算过命的：本命 → 七天签 → 买说明书 → 领券 → 报名 ────
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
  o2=$(call POST "$T2" /v1/orders "{\"lines\":[{\"sku_id\":\"sku-naji-deep\",\"qty\":1}],\"region\":\"cn\"}" | jq -r '.order_id // empty')
  if [ -n "$o2" ]; then
    call POST "$T2" "/v1/orders/$o2/pay" '{"channel":"wechat_jsapi","openid":"p25_u2"}' >/dev/null
    wait_paid "$o2" || return 1
  fi
  say_dim "U2 算过命的 $I2 —— 本命 + 七天签 + 说明书一册"

  # ── U3 请了人的：买御守 → 发货 → 扫开 → 进屋追问 ────────────
  read -r T3 I3 <<<"$(make_user u3 cn)"
  local o3
  o3=$(call POST "$T3" /v1/orders '{"lines":[{"sku_id":"p25-sku-oma-ayun","qty":1}],"region":"cn","contact":{"name":"P25·请了人的","phone":"13800000003"},"shipping_address":{"province":"浙江","city":"杭州","district":"西湖","detail":"某处 1 号","name":"P25","phone":"13800000003"}}' | jq -r '.order_id // empty')
  if [ -n "$o3" ]; then
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
  fi
  say_dim "U3 请了人的 $I3 —— 阿云住进来了、屋里追问过"

  # ── U4 钱在飞的：待付 + 已付在履约 + 一笔退款等着批 + 订阅 ──
  read -r T4 I4 <<<"$(make_user u4 cn)"
  # ① 一张待付（不付款，留给「快过期」那一屏）
  call POST "$T4" /v1/orders '{"lines":[{"sku_id":"sku-incense-try","qty":1}],"region":"cn","contact":{"name":"P25·钱在飞的","phone":"13800000004"},"shipping_address":{"province":"上海","city":"上海","district":"静安","detail":"某处 4 号","name":"P25","phone":"13800000004"}}' >/dev/null
  # ② 一张已付、在履约、包裹在途
  local o4b
  o4b=$(call POST "$T4" /v1/orders '{"lines":[{"sku_id":"sku-jade-pendant","qty":1}],"region":"cn","contact":{"name":"P25·钱在飞的","phone":"13800000004"},"shipping_address":{"province":"上海","city":"上海","district":"静安","detail":"某处 4 号","name":"P25","phone":"13800000004"}}' | jq -r '.order_id // empty')
  if [ -n "$o4b" ]; then
    call POST "$T4" "/v1/orders/$o4b/pay" '{"channel":"wechat_jsapi","openid":"p25_u4"}' >/dev/null
    wait_paid "$o4b" || return 1
    wait_shipment "$o4b" || return 1
    mock_carrier_in_transit "$o4b" P25TRACK0004
  fi
  # ③ 一笔退款等着批 —— 走真接口，不批（那是阿超在后台要做的事）
  local o4c
  o4c=$(call POST "$T4" /v1/orders '{"lines":[{"sku_id":"sku-naji-deep","qty":1}],"region":"cn"}' | jq -r '.order_id // empty')
  if [ -n "$o4c" ]; then
    call POST "$T4" "/v1/orders/$o4c/pay" '{"channel":"wechat_jsapi","openid":"p25_u4"}' >/dev/null
    wait_paid "$o4c" || return 1
    call POST "$T4" "/v1/orders/$o4c/refund" '{"reason_code":"user_request","reason_text":"不想要了"}' >/dev/null
  fi
  say_dim "U4 钱在飞的 $I4 —— 待付 / 在途 / 等着批的退款"

  # ── U5 香港那位：贵的一单（触发风控）+ 包裹出状况 ────────────
  read -r T5 I5 <<<"$(make_user u5 hk)"
  local o5
  o5=$(call POST "$T5" /v1/orders '{"lines":[{"sku_id":"p25-sku-oma-ayun","qty":1}],"region":"hk","contact":{"name":"P25·香港那位","phone":"85200000005"},"shipping_address":{"province":"香港","city":"香港","district":"中西区","detail":"某处 5 号","name":"P25","phone":"85200000005"}}' | jq -r '.order_id // empty')
  if [ -n "$o5" ]; then
    call POST "$T5" "/v1/orders/$o5/pay" '{"channel":"wechat_jsapi","openid":"p25_u5"}' >/dev/null
    wait_paid "$o5" || return 1
    # 御守不寄东西（付款即入住），所以包裹那一条另买一件真会寄的
    wait_move_in "$I5" ayun || return 1
  fi
  local o5b
  o5b=$(call POST "$T5" /v1/orders '{"lines":[{"sku_id":"p25-sku-box","qty":1}],"region":"hk","contact":{"name":"P25","phone":"85200000005"},"shipping_address":{"province":"香港","city":"香港","district":"中西区","detail":"某处 5 号","name":"P25","phone":"85200000005"}}' | jq -r '.order_id // empty')
  if [ -n "$o5b" ]; then
    call POST "$T5" "/v1/orders/$o5b/pay" '{"channel":"wechat_jsapi","openid":"p25_u5"}' >/dev/null
    wait_paid "$o5b" || return 1
    wait_shipment "$o5b" || return 1
    mock_carrier_exception "$o5b" P25TRACK0005
  fi
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

  echo
  echo "══ U5 香港那位 · 别的区 ══"
  want "他在 hk"            hk "$(psql1 "SELECT region FROM app_user WHERE id='$I5'")"
  want "他的单也记在 hk"    hk "$(psql1 "SELECT region FROM order_record WHERE user_id='$I5' LIMIT 1")"
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
  *) echo "用法: bash scripts/plan25.sh {reset|seed|check|all}"; exit 2 ;;
esac
