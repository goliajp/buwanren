#!/usr/bin/env bash
# 语义校验 · 补 e2e.sh 不覆盖的那一半
#
# e2e.sh 走的是 happy path:能不能下单、能不能支付、能不能履约。
# 这个脚本走的是**边界**:该拒的有没有拒、该 404 的有没有 404、
# 该落库的字段有没有真落进去。P1 合并两份实现时逐条定下的语义,都在这里钉住。
#
# 前置:pg + unmei-api :6028 + unmei-admin-api :6029 都在跑
#   bash scripts/setup-dev.sh
#   cd backend && cargo run -p unmei-api & cargo run -p unmei-admin-api &
#
# 用法:bash scripts/verify-semantics.sh
#
# 依赖:curl / jq / docker(读库对账)
#
# ⚠ 会写数据:建订单、发一条 JPY 价、取消订单。对 dev 库跑,别对生产跑。
set -uo pipefail

API=http://localhost:6028
ADMIN=http://localhost:6029
# 连库两条路：给了 PSQL_URL 就直连（CI 的库是 service container，
# 在 localhost:5432，没有名叫 unmei-postgres 的容器可 exec）；
# 没给就退回本机那个容器。`web/verify.mjs` 早就是这么写的 ——
# 2026-08-18 我把这支脚本加进 slice 时没照抄，CI 上 9 条断言全读到空值，
# 看起来像「字段没落库」，其实是 psql 根本没跑起来。
PSQL() {
  if [ -n "${PSQL_URL:-}" ]; then
    psql "$PSQL_URL" -tA -c "$1"
  else
    docker exec -i unmei-postgres psql -U unmei -d unmei -tA -c "$1"
  fi
}

pass=0; fail=0
check() { # check <标题> <期望> <实际>
  if [ "$2" = "$3" ]; then printf "  \033[32m✓\033[0m %-52s %s\n" "$1" "$3"; pass=$((pass+1))
  else printf "  \033[31m✗\033[0m %-52s 期望 %s 实际 %s\n" "$1" "$2" "$3"; fail=$((fail+1)); fi
}

# ── 先确认三样东西都够得着，再开始打分 ────────────────────────
# 够不到的时候，下面每一条 curl 都回空串，于是二十来条断言全部
# 「期望 400 实际 空」—— 报告指着产品，错却在这一侧。CI 上真发生过：
# psql 连不上，九条被判失败，改的是脚本不是产品。
#
# 用 --max-time：连接被拒时 curl 立刻回来，超时值不会让这里变慢，
# 但服务在起而没就绪时它才不会一直挂着。
reach() { # reach <名字> <url>
  curl -sS --max-time 5 -o /dev/null "$2" 2>/dev/null && return 0
  echo "✗ 够不到 $1（$2）—— 不往下判了，免得把够不到说成产品的错" >&2
  return 1
}
down=0
reach "业务 API" "$API/health" || down=1
reach "后台 API" "$ADMIN/health" || down=1
if ! PSQL "SELECT 1" >/dev/null 2>&1; then
  echo "✗ 够不到库（PSQL_URL=${PSQL_URL:-未设，走 docker exec unmei-postgres}）" >&2
  down=1
fi
[ "$down" = 0 ] || { echo "  起法见 .claude/CLAUDE.md「打真后端」那一节" >&2; exit 2; }

echo "▶ 准备 token"
ADMIN_TOKEN=$(curl -sS -X POST "$ADMIN/admin/auth/login" -H 'content-type: application/json' \
  -d '{"email":"admin@unmei.local","password":"admin123"}' | jq -r .token)
USER_JSON=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{"region":"cn"}')
TOKEN=$(echo "$USER_JSON" | jq -r .token)
UID_=$(echo "$USER_JSON" | jq -r .user.id)
echo "  admin_token=${#ADMIN_TOKEN} user=$UID_"
if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = null ] || [ -z "$UID_" ] || [ "$UID_" = null ]; then
  # 没有 token 的话后面全是 401，报告会写成「产品拒绝了这些请求」。
  echo "✗ 没拿到 token —— 后台种子账号的口令换了？库是空的？先看这个，别看下面的断言" >&2
  exit 2
fi

echo
# 写操作要带幂等键（工序单 D6）。这支脚本比那条要求早，不带键的话
# 建单一律 400，后面十条全连坐 —— 而失败信息看着像「混币种没被拒」。
# 每次调用换一个键：这里验的是语义，不是重发去重。
idem() { printf 'verify-%s-%s' "$1" "$RANDOM$RANDOM"; }

echo "▶ A · publish_price 用例（P1 新增：SKU 不存在应 404）"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$ADMIN/admin/commerce/pricing/sku-does-not-exist/publish" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"currency":"CNY","price_minor":100}')
check "publish_price 到不存在的 SKU" "404" "$code"

echo "  为 sku-naji-single 发一条 JPY 价（建混币种场景）"
# 发到 **cn**，不是 jp。原先发到 jp 也能把下一条测红，但那是**靠 bug**：
# 建单当时不看区域，取的是「最新那一行」，于是 cn 的单拿到了 jp 的价。
# 2026-08-19 建单改成按区域取价之后，发到 jp 的价对 cn 的单不再可见 ——
# 混币种这个前提就没了，那一条会变成假绿。
# 要验「同一笔里币种不一致会不会被拒」，就得把不一致**真的造在同一个区里**。
resp=$(curl -sS -X POST "$ADMIN/admin/commerce/pricing/sku-naji-single/publish" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"currency":"JPY","price_minor":1200,"region":"cn","platform":"all"}')
check "publish_price 合法请求" "true" "$(echo "$resp" | jq -r .ok)"

echo
echo "▶ B · 建单：混币种必须被拒（两份旧实现都会静默算错）"
code=$(curl -sS -o /tmp/mix.json -w '%{http_code}' -X POST "$API/v1/orders" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: $(idem mix)" \
  -d '{"lines":[{"sku_id":"sku-naji-deep","qty":1},{"sku_id":"sku-naji-single","qty":1}],"region":"cn"}')
check "混币种下单 HTTP" "422" "$code"
check "混币种下单 code" "validation" "$(jq -r .code /tmp/mix.json)"
echo "    错误文本： $(jq -r .error /tmp/mix.json)"

# 把刚才那条 JPY 的 cn 价收掉 —— 留着的话这个 sku 在 cn 就有两个币种的活价，
# 而「商品页显示的价 = 下单记的账」这条性质会跟着坏，往后每次跑都更乱。
PSQL "UPDATE price_book SET status='expired'
      WHERE sku_id='sku-naji-single' AND region='cn' AND currency='JPY' AND status='active'" >/dev/null

echo
echo "▶ C · 建单：ip / ua 落库（旧实现一直写 NULL）"
ORD=$(curl -sS -X POST "$API/v1/orders" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: $(idem ord)" \
  -H 'x-forwarded-for: 203.0.113.42, 10.0.0.1' -H 'user-agent: unmei-verify/1.0' \
  -d '{"lines":[{"sku_id":"sku-naji-deep","qty":1}],"region":"cn","contact":{"name":"测试"}}' | jq -r .order_id)
echo "  order_id=$ORD"
check "order.ip 落库"  "203.0.113.42"   "$(PSQL "SELECT COALESCE(ip,'NULL') FROM order_record WHERE id='$ORD'")"
check "order.ua 落库"  "unmei-verify/1.0" "$(PSQL "SELECT COALESCE(ua,'NULL') FROM order_record WHERE id='$ORD'")"

echo
echo "▶ D · order_meta.contact_json 存的是 contact 而不是 receipt（旧 service 放错列）"
check "contact_json.name" "测试" "$(PSQL "SELECT contact_json->>'name' FROM order_meta WHERE order_id='$ORD'")"

echo
echo "▶ E · outbox 收到 OrderCreated（旧路由根本不写）"
check "outbox OrderCreated 条数" "1" \
  "$(PSQL "SELECT COUNT(*) FROM outbox_event WHERE kind='OrderCreated' AND aggregate_id='$ORD'")"

echo
echo "▶ F · 状态机：未付订单可取消"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/v1/orders/$ORD/cancel" \
  -H "idempotency-key: $(idem cancel)" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"reason":"verify"}')
check "取消 unpaid 订单" "200" "$code"
check "取消后状态" "cancelled" "$(PSQL "SELECT status FROM order_record WHERE id='$ORD'")"
check "cancel_actor 写的是 kind 不是字面量" "user" "$(PSQL "SELECT cancel_actor FROM order_record WHERE id='$ORD'")"

echo
echo "▶ G · 归属校验：换个用户取消同一单应 404（旧 service 完全没有这条）"
TOKEN2=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{}' | jq -r .token)
ORD2=$(curl -sS -X POST "$API/v1/orders" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: $(idem ord2)" \
  -d '{"lines":[{"sku_id":"sku-naji-single","qty":1}],"region":"cn"}' | jq -r .order_id)
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/v1/orders/$ORD2/cancel" \
  -H "idempotency-key: $(idem cancel2)" \
  -H "authorization: Bearer $TOKEN2" -H 'content-type: application/json' -d '{"reason":"越权"}')
check "非属主取消" "404" "$code"
check "订单未被动" "unpaid" "$(PSQL "SELECT status FROM order_record WHERE id='$ORD2'")"

echo
echo "▶ H · 行为变更：已付订单不能直接取消（状态机没有 Paid→Cancelled）"
# 【自己把前提摆出来】，不去库里捡一张现成的已付单 ——
# 开发库里有几千张，全新的库（CI）一张都没有，于是 $PAID 是空串、
# URL 变成 .../orders//cancel、返回 404，报出来却是「取消已付单没返回 409」。
# 2026-08-18 就是这么在 CI 上红了两条，而本机一直绿。
PAID=$(curl -sS -X POST "$API/v1/orders" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: $(idem paid)" \
  -d '{"lines":[{"sku_id":"sku-naji-single","qty":1}],"region":"cn"}' | jq -r .order_id)
# 直接把它摆成 paid：这一条验的是【状态机拒不拒】，不是怎么付的钱
PSQL "UPDATE order_record SET status='paid', amount_paid_minor=amount_total_minor, paid_at=NOW() WHERE id='$PAID'" >/dev/null
echo "  自己造一笔已付的单： $PAID"
code=$(curl -sS -o /tmp/cancelpaid.json -w '%{http_code}' -X POST "$ADMIN/admin/commerce/orders/$PAID/cancel" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d '{"reason":"verify"}')
check "后台取消已付单" "409" "$code"
check "错误 code" "illegal_state_transition" "$(jq -r .code /tmp/cancelpaid.json)"
echo "    错误文本： $(jq -r .error /tmp/cancelpaid.json)"

echo
echo "▶ I · 幽灵 ID 不再返回 ok:true（旧实现全部静默成功）"
for spec in \
  "POST|$ADMIN/admin/commerce/orders/ord-nope/annotate|{\"note\":\"x\"}|annotate_order" \
  "POST|$ADMIN/admin/commerce/refunds/rfd-nope/deny|{\"reason\":\"x\"}|deny_refund" \
  "POST|$ADMIN/admin/commerce/shipments/shp-nope/mark-exception|{\"reason\":\"x\"}|mark_shipment_exception" \
  "POST|$ADMIN/admin/commerce/pricing/expire/pb-nope|{}|expire_price" \
  "POST|$ADMIN/admin/commerce/products/prd-nope/listing|{\"status\":\"listed\"}|toggle_product_listing" \
  ; do
  IFS='|' read -r m url body name <<< "$spec"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X "$m" "$url" \
    -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d "$body")
  check "$name 幽灵 ID" "404" "$code"
done

echo
echo "▶ I2 · 后台控制台上四个从没被执行过的写操作"
# 2026-08-18 量出来的：后台 19 条写路由里，这四条没有任何脚本打过，
# 而前端四个按钮都在调它们。用幽灵 ID 打 —— 不动真数据，
# 但足以分开「路由没接上 / handler 炸了 / 静静返回 ok:true」这三种。
for spec in \
  "POST|$ADMIN/admin/commerce/payments/pay-nope/mark-failed|{\"code\":\"x\",\"msg\":\"verify\"}|mark_payment_failed" \
  "POST|$ADMIN/admin/commerce/promotions/promo-nope/state|{\"status\":\"paused\"}|update_promotion_state" \
  "POST|$ADMIN/admin/commerce/subscriptions/sub-nope/cancel|{\"immediate\":false}|cancel_subscription" \
  ; do
  IFS='|' read -r m url body name <<< "$spec"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X "$m" "$url" \
    -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d "$body")
  check "$name 幽灵 ID" "404" "$code"
done

# 开关那条是 PATCH，而且要 operator 角色（`super` 通吃）—— 单独走
FLAG=$(curl -sS "$ADMIN/admin/feature_flags" -H "authorization: Bearer $ADMIN_TOKEN" | jq -r '.items[0].code // empty')
if [ -n "$FLAG" ]; then
  WAS=$(curl -sS "$ADMIN/admin/feature_flags" -H "authorization: Bearer $ADMIN_TOKEN" | jq -r ".items[] | select(.code==\"$FLAG\") | .default_on")
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH "$ADMIN/admin/feature_flags/$FLAG" \
    -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
    -d "{\"default_on\": $WAS}")
  check "改开关（改成它原来的值，不动行为）" "200" "$code"
  NOW=$(curl -sS "$ADMIN/admin/feature_flags" -H "authorization: Bearer $ADMIN_TOKEN" | jq -r ".items[] | select(.code==\"$FLAG\") | .default_on")
  check "改完还是原来的值" "$WAS" "$NOW"
else
  echo "  · 跳过：库里一个开关都没有（不计入通过）"
fi

echo
echo "▶ J · 状态白名单改走 domain 枚举"
code=$(curl -sS -o /tmp/badstatus.json -w '%{http_code}' -X POST "$ADMIN/admin/commerce/risk/rules/rr-1/state" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d '{"status":"bogus"}')
check "非法 risk rule 状态" "422" "$code"
check "错误 code" "validation" "$(jq -r .code /tmp/badstatus.json)"

echo
echo "▶ K · outbox retry 用例"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$ADMIN/admin/commerce/outbox/oe-nope/retry" \
  -H "authorization: Bearer $ADMIN_TOKEN")
check "retry 不存在的事件" "409" "$code"

echo
echo "▶ L · 内容池缺内容时，三处说的是不是同一句话"
# 三处原先各行其是：签词 500 `no published quote`（消息里没有 locale）、
# 门解**静静兜成「宜静」**、宜忌静静返回空。第二种最糟 —— 一句像模像样、
# 没有依据的判词。这一段按调用顺序把三处逐个逼出来：先什么都没有，
# 再补 gate_word，再补 quote，每补一层就该轮到下一处报。
#
# 会往库里写 locale='xx-TEST' 的行，跑完删掉。选这个 locale 是因为
# 它不可能是真内容，删的时候不会误伤。
LOC=xx-TEST
PSQL "DELETE FROM gate_word WHERE locale='$LOC'; DELETE FROM quote WHERE locale='$LOC'; DELETE FROM yiji_word WHERE locale='$LOC';" >/dev/null
T3=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' \
  -d "{\"region\":\"cn\",\"locale\":\"$LOC\"}" | jq -r .token)

spin_msg() { # 起一卦，把错误消息打出来（成功就打 ok）
  curl -sS -X POST "$API/v1/naji/spin" -H "authorization: Bearer $T3" \
    -H 'content-type: application/json' -d '{}' \
    | jq -r '.error // "ok"'
}

M=$(spin_msg)
check "① 什么都没有时，报的是 gate_word 且带 locale" \
  "internal: no published gate_word for locale \"$LOC\"" "$M"

for g in 休门 生门 伤门 杜门 景门 死门 惊门 开门; do
  PSQL "INSERT INTO gate_word (id,gate,direction,benefit_text,locale,version,status)
        VALUES ('gw-$LOC-$g','$g','N','t','$LOC',1,'published') ON CONFLICT DO NOTHING;" >/dev/null
done
M=$(spin_msg)
check "② 补上 gate_word 后，轮到 quote 报" \
  "internal: no published quote for locale \"$LOC\"" "$M"

PSQL "INSERT INTO quote (id,book,chapter,text,length,locale,status)
      VALUES ('q-$LOC','b','c','t',1,'$LOC','published') ON CONFLICT DO NOTHING;" >/dev/null
M=$(spin_msg)
check "③ 再补上 quote 后，轮到宜忌报（原先它静静空着）" \
  "internal: no published yiji_word(type=yi) for locale \"$LOC\"" "$M"

PSQL "DELETE FROM gate_word WHERE locale='$LOC'; DELETE FROM quote WHERE locale='$LOC'; DELETE FROM yiji_word WHERE locale='$LOC';" >/dev/null

echo
echo "▶ M · 删掉自己的本命之后，还起得了卦吗"
# 2026-08-19 实测坏过：app_user.active_natal_id 没有外键（指向同一张表的
# natal_summary 是 CASCADE、naji_record 是 SET NULL，就它没有），
# 删完还指着那一行，**此后每一次起卦都 500** —— 外键炸在 naji_record 上，
# 而且原始的数据库报错直接发回了客户端。一直到重新建一份为止。
T4=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{"region":"cn"}' | jq -r .token)
code=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$API/v1/user/natals/natal-ghost-$RANDOM" \
  -H "authorization: Bearer $T4")
check "删一个不存在的本命应 404（原先 200 ok:true）" "404" "$code"

NAT=$(curl -sS -X POST "$API/v1/user/natals" -H "authorization: Bearer $T4" \
  -H 'content-type: application/json' -H "idempotency-key: $(idem natal)" \
  -d '{"label":"verify","year":1990,"month":5,"day":6,"hour":10,"minute":0,"tz":8,"gender":"male","subject_type":"self"}' \
  | jq -r '.id // empty')
if [ -z "$NAT" ]; then
  # 建不出来就别去删 —— 删一个空 id 走的是另一条路，报的红指错方向
  check "建一份本命（后面两条要用）" "有 id" "建不出来，多半是排盘服务没起"
else
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$API/v1/user/natals/$NAT" -H "authorization: Bearer $T4")
  check "删自己的本命应 200" "200" "$code"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/v1/naji/spin" \
    -H "authorization: Bearer $T4" -H 'content-type: application/json' -d '{}')
  check "删完还起得了卦（原先 500，外键悬空）" "200" "$code"
fi

echo
echo "▶ N · 有本命的人问签，签里得带着盘"
# 2026-08-18 抓到过：84 条问签里 80 条的盘是空的（发给排盘服务的字段名不对）。
# 已修，复测 46 条全带盘，剩下 12 条空的全在修复之前。这一条把它钉住。
#
# 前提是排盘服务真的在：不在的话本命建不出 natal_summary，签里没有盘是
# **对的**，这时候明说跳过，不算通过。
T5=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{"region":"cn"}' | jq -r .token)
NAT2=$(curl -sS -X POST "$API/v1/user/natals" -H "authorization: Bearer $T5" \
  -H 'content-type: application/json' -H "idempotency-key: $(idem natal2)" \
  -d '{"label":"verify-reading","year":1992,"month":3,"day":18,"hour":14,"minute":30,"tz":8,"gender":"female","subject_type":"self"}' \
  | jq -r '.id // empty')
HAS_SUMMARY=$([ -n "$NAT2" ] && PSQL "SELECT count(*) FROM natal_summary WHERE natal_id='$NAT2'" || echo 0)
if [ "${HAS_SUMMARY:-0}" = "0" ]; then
  echo "  · 跳过：本命没算出盘（排盘服务没起？）—— 这一条【没验】，不计入通过"
else
  # 自己发一张御守，别指望库里正好有 —— CI 上是空库
  OMA="oma-verify-$RANDOM"; CRED="VERIFY-$RANDOM$RANDOM"
  PSQL "INSERT INTO omamori (id, villager_id) VALUES ('$OMA','ayun') ON CONFLICT DO NOTHING;
        INSERT INTO omamori_credential (carrier_kind, credential, omamori_id)
        VALUES ('qr','$CRED','$OMA') ON CONFLICT DO NOTHING;" >/dev/null
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/v1/omamori/scan" \
    -H "authorization: Bearer $T5" -H 'content-type: application/json' \
    -d "{\"carrier\":\"qr\",\"credential\":\"$CRED\"}")
  check "扫御守，阿云入住" "200" "$code"
  RID=$(curl -sS -X POST "$API/v1/villagers/ayun/reading" -H "authorization: Bearer $T5" \
    -H 'content-type: application/json' -H "idempotency-key: $(idem reading)" \
    -d '{"question":"verify"}' | jq -r '.villager_id // empty')
  check "出得了签" "ayun" "$RID"
  EMPTY=$(PSQL "SELECT count(*) FROM villager_reading vr JOIN app_user u ON u.id=vr.user_id
                WHERE u.id=(SELECT user_id FROM natal WHERE id='$NAT2')
                  AND (vr.chart_json IS NULL OR vr.chart_json='null'::jsonb)")
  check "签里带着盘（原先 84 条里 80 条是空的）" "0" "$EMPTY"
fi

echo
echo "▶ O · 物流与退款：用户这一侧看得见吗"
# 这两条在移动网页版上**验不到正路**：要到 paid 必须真付款，而付款只有真机有。
# 所以在这里用真数据验接口那一侧，界面那一侧由镜像验「没有就不显示」。
T6=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{"region":"cn"}' | jq -r .token)
U6=$(PSQL "SELECT id FROM app_user ORDER BY created_at DESC LIMIT 1")
ORD6=$(curl -sS -X POST "$API/v1/orders" -H "authorization: Bearer $T6" \
  -H 'content-type: application/json' -H "idempotency-key: $(idem ship)" \
  -d '{"lines":[{"sku_id":"sku-naji-single","qty":1}],"region":"cn"}' | jq -r '.order_id // empty')
if [ -z "$ORD6" ]; then
  check "建一张单（后面几条要用）" "有 order_id" "建不出来"
else
  # 摆成已付 + 造一件包裹。这一条验的是「用户看不看得见」，不是「怎么付的钱」。
  # 退款要的是**一笔真的成功支付**，不是把订单状态改成 paid 就行 ——
  # 只改订单会得到「无成功支付可退」（2026-08-19 第一版就这么错了）。
  # 所以走真的发起支付拿到 payment 行，再把那一笔摆成 success。
  curl -sS -o /dev/null -X POST "$API/v1/orders/$ORD6/pay" -H "authorization: Bearer $T6" \
    -H 'content-type: application/json' -H "idempotency-key: $(idem paystart)" \
    -d '{"channel":"wechat_jsapi","openid":"oVerify"}'
  PSQL "UPDATE payment SET status='success', paid_at=NOW() WHERE order_id='$ORD6';
        UPDATE order_record SET status='paid', amount_paid_minor=amount_total_minor, paid_at=NOW()
        WHERE id='$ORD6';
        INSERT INTO shipment (id, order_id, carrier_code, tracking_no, status)
        VALUES ('shp-verify-$RANDOM','$ORD6','sf','SFVERIFY001','in_transit');" >/dev/null
  SHP=$(PSQL "SELECT id FROM shipment WHERE order_id='$ORD6' LIMIT 1")
  PSQL "INSERT INTO shipment_trace_event (id, shipment_id, event_at, event_kind, location, description,
          raw_source, raw_payload_json)
        VALUES ('ste-verify-$RANDOM','$SHP',NOW(),'in_transit','长沙','离开集散中心','manual','{}'::jsonb);" >/dev/null

  n=$(curl -sS "$API/v1/orders/$ORD6/shipments" -H "authorization: Bearer $T6" | jq 'length')
  check "包裹看得见" "1" "$n"
  # 断言【看得见】，不断言条数。`workers/shipment_trace.rs` 那个后台 worker
  # 也往同一个包裹里追加轨迹 —— 断言「恰好 1 条」就是在跟它赛跑：
  # 2026-08-22 CI 上量到 4 条，红的是断言不是产品。
  # 这一条要证明的是「轨迹这个资源取得到」，那就照这个写。
  k=$(curl -sS "$API/v1/orders/$ORD6/shipments/$SHP/trace" -H "authorization: Bearer $T6" | jq '.trace | length')
  check "轨迹看得见" "有" "$([ "${k:-0}" -ge 1 ] && echo 有 || echo 无)"

  # 别人的单子看不见 —— 这两条也是接口，越权同样要挡
  T7=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{"region":"cn"}' | jq -r .token)
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$API/v1/orders/$ORD6/shipments" -H "authorization: Bearer $T7")
  check "别人的包裹看不到" "403" "$code"

  rid=$(curl -sS -X POST "$API/v1/orders/$ORD6/refund" -H "authorization: Bearer $T6" \
    -H 'content-type: application/json' -H "idempotency-key: $(idem refund)" \
    -d '{"reason_code":"user_request"}' | jq -r '.refund_id // empty')
  check "已付的单申请得了退款" "有" "$([ -n "$rid" ] && echo 有 || echo 没有)"

  # 批准之后那条链：RefundCompleted 事件 → outbox worker → 记一套退款分录。
  # 这一段此前【端到端从没跑过】—— 单测只测到 unmei_app::finance 那一层，
  # 而事件接不接得上、worker 那一侧转不转交，只有真跑才知道。
  # （2026-08-24 把记账从 worker 搬进 unmei-app 时留下的口子，同一轮补上。）
  if [ -n "$rid" ]; then
    ac=$(curl -sS -o /tmp/rfd.json -w '%{http_code}' -X POST "$ADMIN/admin/commerce/refunds/$rid/approve" \
         -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d '{}')
    check "后台批得了这笔退款" "200" "$ac"

    # outbox 每 5 秒一跳。等【分录出现】，不等固定秒数 ——
    # 等秒数在这个仓库里撒过三次谎，量到的是「还没到」而不是「不会到」。
    JE=""
    for _ in $(seq 1 12); do
      JE=$(PSQL "SELECT id FROM journal_entry WHERE business_kind='refund' AND business_ref_id='$rid' LIMIT 1")
      [ -n "$JE" ] && break
      sleep 5
    done
    check "退款记上账了　—— 事件真的走到了记账那一步" "有" "$([ -n "$JE" ] && echo 有 || echo 没有)"

    if [ -n "$JE" ]; then
      BAL=$(PSQL "SELECT CASE WHEN COALESCE(sum(debit_minor),0)=COALESCE(sum(credit_minor),0)
                              THEN '平' ELSE '不平' END FROM journal_line WHERE entry_id='$JE'")
      check "这套分录借贷是平的" "平" "$BAL"
      AMT=$(PSQL "SELECT COALESCE(sum(debit_minor),0)::text FROM journal_line WHERE entry_id='$JE'")
      RAMT=$(PSQL "SELECT amount_minor::text FROM refund WHERE id='$rid'")
      check "记的金额就是退款金额" "$RAMT" "$AMT"
      # 重试不该再记一套 —— worker 失败会重投，这一问是那条幂等的现场版
      N=$(PSQL "SELECT count(*)::text FROM journal_entry WHERE business_kind='refund' AND business_ref_id='$rid'")
      check "同一笔退款只有一套分录" "1" "$N"
    fi
  fi
fi


echo
echo "▶ Y · 别人的东西拿不到（每个吃 id 的接口都试一遍）"
# 甲建资源，乙拿甲的 id 去访问，必须被挡。
#
# **两头都要验**：只验「乙被挡」的话，一个对谁都 404 的坏接口照样全绿；
# 只验「甲拿得到」的话，归属过滤哪天被顺手删掉也没人知道 ——
# 而那正是 2026-08-24 修的那个洞的形状（`idempotency_log` 有 user_id 这一列，
# 却没有任何地方拿它过滤）。原本有的过滤被悄悄丢掉，比一开始就没有更难发现。
YB=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' \
     -d '{"region":"cn"}' | jq -r .token)
YORD=$(curl -sS -X POST "$API/v1/orders" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: $(idem yord)" \
  -d '{"lines":[{"sku_id":"sku-naji-deep","qty":1}],"region":"cn","contact":{"name":"甲"}}' \
  | jq -r '.order_id // empty')
YPAY=$(curl -sS -X POST "$API/v1/orders/$YORD/pay" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: $(idem ypay)" -d '{"channel":"wechat_jsapi","openid":"o_a"}' \
  | jq -r '.payment_id // empty')
YNJ=$(curl -sS -X POST "$API/v1/naji/spin" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{}' \
  | jq -r '.id // empty')

if [ -z "$YB" ] || [ -z "$YORD" ]; then
  printf "  \033[31m✗\033[0m %-52s 前置没建成，这一段没验成\n" "别人的东西拿不到"; fail=$((fail+1))
else
  # 挡住 = 4xx 且不是 400（400 多半是我的请求写错了，不是它在拦 ——
  # 头一版探针把 idempotency-key 那个头拼坏了，三条全回 400，
  # 差一点被当成「拦住了」记下来）
  挡() {  # 挡 <说明> <方法> <路径> [<体> <幂等键名>]
    local d="$1" m="$2" u="$3" b="${4:-}" k="${5:-}"
    local c
    if [ -n "$b" ]; then
      c=$(curl -sS -o /dev/null -w '%{http_code}' -X "$m" "$API$u" \
          -H "authorization: Bearer $YB" -H 'content-type: application/json' \
          -H "idempotency-key: $(idem "$k")" -d "$b")
    else
      c=$(curl -sS -o /dev/null -w '%{http_code}' -X "$m" "$API$u" -H "authorization: Bearer $YB")
    fi
    if [ "$c" = "403" ] || [ "$c" = "404" ]; then
      printf "  \033[32m✓\033[0m %-52s %s\n" "$d" "$c"; pass=$((pass+1))
    else
      printf "  \033[31m✗\033[0m %-52s 期望 403/404 实际 %s\n" "$d" "$c"; fail=$((fail+1))
    fi
  }
  挡 "乙看不到甲的单"          GET  "/v1/orders/$YORD"
  挡 "乙取消不了甲的单"        POST "/v1/orders/$YORD/cancel" '{}' ycan
  挡 "乙付不了甲的单"          POST "/v1/orders/$YORD/pay" '{"channel":"wechat_jsapi","openid":"o_b"}' ypayb
  挡 "乙退不了甲的单"          POST "/v1/orders/$YORD/refund" '{"reason_code":"user_request"}' yref
  挡 "乙看不到甲的包裹"        GET  "/v1/orders/$YORD/shipments"
  [ -n "$YPAY" ] && 挡 "乙看不到甲的那笔支付" GET "/v1/payments/$YPAY"
  [ -n "$YNJ" ]  && 挡 "乙看不到甲的那一签"   GET "/v1/naji/$YNJ"


  # 本命那三个接口要先有一张【真盘】，而排盘由另一个仓库（mingli）算。
  # 那台机器上没有它时建不出盘 —— 那就出声跳过，不计分。
  # 不给它做假的：假盘会按我以为的形状回话，而 2026-08-18 抓到的正是
  # 「我以为的形状」错了（性别发 M，它只认 male）。
  YNAT=$(curl -sS -X POST "$API/v1/user/natals" \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d '{"label":"归属校验","year":1998,"month":4,"day":12,"hour":8,"tz":8,"gender":"F"}' \
    | jq -r '.id // empty')
  if [ -z "$YNAT" ]; then
    echo "  · 这台机器上排盘服务不在，建不出本命 —— 本命那三个接口【没验】"
  else
    挡 "乙看不到甲的盘"          GET    "/v1/natal/$YNAT/summary"
    挡 "乙切换不了甲的盘"        POST   "/v1/user/natals/$YNAT/activate" '{}' ynact
    挡 "乙删不掉甲的盘"          DELETE "/v1/user/natals/$YNAT"
    # 删不掉这件事要看【库里还在不在】—— 只看状态码的话，
    # 一个「先删了再返回 404」的实现同样能骗过去。
    ZN=$(PSQL "SELECT count(*) FROM natal WHERE id='$YNAT'")
    check "乙试着删过之后，甲的盘还在库里" "1" "$ZN"
  fi

  # 另一头：甲自己必须拿得到。少了这一条，「对谁都 404」也能全绿。
  c=$(curl -sS -o /dev/null -w '%{http_code}' "$API/v1/orders/$YORD" -H "authorization: Bearer $TOKEN")
  check "甲自己看得到自己的单　—— 不是对谁都 404" "200" "$c"

  # 收尾：把这张单取消掉，别留一笔 pending 让冲刷器一直重试
  curl -sS -o /dev/null -X POST "$API/v1/orders/$YORD/cancel" \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -H "idempotency-key: $(idem ycleanup)" -d '{}' || true
fi
echo
echo "▶ Z · 已知资金问题台账（scripts/known-money-bugs.json）"
# 台账里的每一条都真跑一遍复现。还是那样 → 打印一条 `·`，不计分但每次都看得见；
# 不是那样了 → 红：行为变了，那一条该划掉或重写。
#
# 为什么要真跑：这条洞原先只是本文件末尾的一句注释。注释不会在行为变化时提醒谁 ——
# 它既拦不住「悄悄变得更糟」，也认不出「已经被顺手修好了」。
ZORD=$(curl -sS -X POST "$API/v1/orders" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: $(idem dblord)" \
  -d '{"lines":[{"sku_id":"sku-naji-deep","qty":1}],"region":"cn","contact":{"name":"台账复现"}}' \
  | jq -r '.order_id // empty')
if [ -z "$ZORD" ]; then
  printf "  \033[31m✗\033[0m %-52s 建不出单子，这一条没验成\n" "重复扣款台账"; fail=$((fail+1))
else
  for n in 1 2; do
    curl -sS -o /dev/null -X POST "$API/v1/orders/$ZORD/pay" \
      -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
      -H "idempotency-key: $(idem dblpay$n)" \
      -d '{"channel":"wechat_jsapi","openid":"oXxYz9mock"}'
  done
  ZN=$(PSQL "SELECT count(*) FROM payment WHERE order_id='$ZORD' AND status='pending'")
  ZDUE=$(PSQL "SELECT amount_total_minor FROM order_record WHERE id='$ZORD'")
  ZSUM=$(PSQL "SELECT COALESCE(sum(amount_minor),0) FROM payment WHERE order_id='$ZORD' AND status='pending'")
  # 2026-08-25 起这里验的是【修好了】：连点两次拿回的是同一笔。
  # 在那之前它验的是「还是老样子：两笔全额 pending」——
  # 台账那一条现在写的是收窄之后剩下的那一支（换渠道），不是这一条。
  if [ "$ZN" = "1" ] && [ "$ZSUM" = "$ZDUE" ]; then
    printf "  \033[32m✓\033[0m %-52s 一笔 pending %s = 应付 %s\n" \
      "连点两次「去支付」只有一笔待付" "$ZSUM" "$ZDUE"; pass=$((pass+1))
  else
    printf "  \033[31m✗\033[0m %-52s 现在是 %s 笔 pending、合计 %s（应付 %s）\n" \
      "连点两次「去支付」只有一笔待付" "$ZN" "$ZSUM" "$ZDUE"; fail=$((fail+1))
  fi
  # 换渠道那一支（台账 pay-channel-switch）：旧的那笔要被顶掉，且仍然只剩一笔待付。
  # 换的是【微信内部的模式】(jsapi → h5)：今天 pick() 只认 wechat_*，
  # 支付宝那种跨渠道在 API 这一侧压根进不来。而 jsapi → h5 是真实场景：
  # 小程序里发起了，人又去 H5 那一页。
  curl -sS -o /dev/null -X POST "$API/v1/orders/$ZORD/pay" \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -H "idempotency-key: $(idem dblpay3)" \
    -d '{"channel":"wechat_h5"}'
  ZN2=$(PSQL "SELECT count(*) FROM payment WHERE order_id='$ZORD' AND status='pending'")
  ZEXP=$(PSQL "SELECT count(*) FROM payment WHERE order_id='$ZORD' AND status='expired' AND audit_note LIKE '%顶掉%'")
  if [ "$ZN2" = "1" ] && [ "$ZEXP" -ge 1 ]; then
    printf "  \033[33m·\033[0m %-52s 旧那笔被顶掉、仍只剩一笔待付 —— 渠道侧可能已经付得出去，台账 pay-channel-switch 记着\n" \
      "换渠道：顶掉旧的那一笔"
  else
    printf "  \033[31m✗\033[0m %-52s 换渠道之后 %s 笔待付、%s 笔标着被顶掉 —— 行为变了，台账该重写\n" \
      "换渠道：跟台账对不上" "$ZN2" "$ZEXP"; fail=$((fail+1))
  fi
  # 收尾:把这张单取消掉,别让两笔 pending 被 sweeper 推成 success ——
  # 那会在开发库里留下一张真的重复扣款单,下一次跑校验时它就是噪音。
  curl -sS -o /dev/null -X POST "$API/v1/orders/$ZORD/cancel" \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -H "idempotency-key: $(idem dblcancel)" -d '{}' || true
fi

echo
printf "\033[1m结果： %d 通过 / %d 失败\033[0m\n" "$pass" "$fail"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)

# ─────────────────────────────────────────────────────────────────
# 尚未覆盖(需要等 sweep 周期,不适合放进快速校验):
#   · 支付 → sweep → 履约 → 退款全链路 → 见 e2e.sh
# (重复扣款那条已经不在这张「尚未覆盖」名单上了 —— 2026-08-23 起
#  它在上面 ▶ Z 那一段每次真跑一遍,对照 scripts/known-money-bugs.json。)
