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
PSQL() { docker exec -i unmei-postgres psql -U unmei -d unmei -tA -c "$1"; }

pass=0; fail=0
check() { # check <标题> <期望> <实际>
  if [ "$2" = "$3" ]; then printf "  \033[32m✓\033[0m %-52s %s\n" "$1" "$3"; pass=$((pass+1))
  else printf "  \033[31m✗\033[0m %-52s 期望 %s 实际 %s\n" "$1" "$2" "$3"; fail=$((fail+1)); fi
}

echo "▶ 准备 token"
ADMIN_TOKEN=$(curl -sS -X POST "$ADMIN/admin/auth/login" -H 'content-type: application/json' \
  -d '{"email":"admin@unmei.local","password":"admin123"}' | jq -r .token)
USER_JSON=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{"region":"cn"}')
TOKEN=$(echo "$USER_JSON" | jq -r .token)
UID_=$(echo "$USER_JSON" | jq -r .user.id)
echo "  admin_token=${#ADMIN_TOKEN} user=$UID_"

echo
echo "▶ A · publish_price 用例(P1 新增:SKU 不存在应 404)"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$ADMIN/admin/commerce/pricing/sku-does-not-exist/publish" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"currency":"CNY","price_minor":100}')
check "publish_price 到不存在的 SKU" "404" "$code"

echo "  为 sku-naji-single 发一条 JPY 价(建混币种场景)"
resp=$(curl -sS -X POST "$ADMIN/admin/commerce/pricing/sku-naji-single/publish" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"currency":"JPY","price_minor":1200,"region":"jp","platform":"all"}')
check "publish_price 合法请求" "true" "$(echo "$resp" | jq -r .ok)"

echo
echo "▶ B · 建单:混币种必须被拒(两份旧实现都会静默算错)"
code=$(curl -sS -o /tmp/mix.json -w '%{http_code}' -X POST "$API/v1/orders" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"lines":[{"sku_id":"sku-naji-deep","qty":1},{"sku_id":"sku-naji-single","qty":1}],"region":"cn"}')
check "混币种下单 HTTP" "422" "$code"
check "混币种下单 code" "validation" "$(jq -r .code /tmp/mix.json)"
echo "    错误文本: $(jq -r .error /tmp/mix.json)"

echo
echo "▶ C · 建单:ip / ua 落库(旧实现一直写 NULL)"
ORD=$(curl -sS -X POST "$API/v1/orders" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H 'x-forwarded-for: 203.0.113.42, 10.0.0.1' -H 'user-agent: unmei-verify/1.0' \
  -d '{"lines":[{"sku_id":"sku-naji-deep","qty":1}],"region":"cn","contact":{"name":"测试"}}' | jq -r .order_id)
echo "  order_id=$ORD"
check "order.ip 落库"  "203.0.113.42"   "$(PSQL "SELECT COALESCE(ip,'NULL') FROM order_record WHERE id='$ORD'")"
check "order.ua 落库"  "unmei-verify/1.0" "$(PSQL "SELECT COALESCE(ua,'NULL') FROM order_record WHERE id='$ORD'")"

echo
echo "▶ D · order_meta.contact_json 存的是 contact 而不是 receipt(旧 service 放错列)"
check "contact_json.name" "测试" "$(PSQL "SELECT contact_json->>'name' FROM order_meta WHERE order_id='$ORD'")"

echo
echo "▶ E · outbox 收到 OrderCreated(旧路由根本不写)"
check "outbox OrderCreated 条数" "1" \
  "$(PSQL "SELECT COUNT(*) FROM outbox_event WHERE kind='OrderCreated' AND aggregate_id='$ORD'")"

echo
echo "▶ F · 状态机:未付订单可取消"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/v1/orders/$ORD/cancel" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"reason":"verify"}')
check "取消 unpaid 订单" "200" "$code"
check "取消后状态" "cancelled" "$(PSQL "SELECT status FROM order_record WHERE id='$ORD'")"
check "cancel_actor 写的是 kind 不是字面量" "user" "$(PSQL "SELECT cancel_actor FROM order_record WHERE id='$ORD'")"

echo
echo "▶ G · 归属校验:换个用户取消同一单应 404(旧 service 完全没有这条)"
TOKEN2=$(curl -sS -X POST "$API/v1/auth/anonymous" -H 'content-type: application/json' -d '{}' | jq -r .token)
ORD2=$(curl -sS -X POST "$API/v1/orders" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"lines":[{"sku_id":"sku-naji-single","qty":1}],"region":"cn"}' | jq -r .order_id)
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/v1/orders/$ORD2/cancel" \
  -H "authorization: Bearer $TOKEN2" -H 'content-type: application/json' -d '{"reason":"越权"}')
check "非属主取消" "404" "$code"
check "订单未被动" "unpaid" "$(PSQL "SELECT status FROM order_record WHERE id='$ORD2'")"

echo
echo "▶ H · 行为变更:已付订单不能直接取消(状态机没有 Paid→Cancelled)"
PAID=$(PSQL "SELECT id FROM order_record WHERE status='paid' ORDER BY created_at DESC LIMIT 1")
if [ -z "$PAID" ]; then
  PAID=$(PSQL "SELECT id FROM order_record WHERE status='done' ORDER BY created_at DESC LIMIT 1")
fi
echo "  拿一笔已付/已完成的单: $PAID"
code=$(curl -sS -o /tmp/cancelpaid.json -w '%{http_code}' -X POST "$ADMIN/admin/commerce/orders/$PAID/cancel" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d '{"reason":"verify"}')
check "后台取消已付单" "409" "$code"
check "错误 code" "illegal_state_transition" "$(jq -r .code /tmp/cancelpaid.json)"
echo "    错误文本: $(jq -r .error /tmp/cancelpaid.json)"

echo
echo "▶ I · 幽灵 ID 不再返回 ok:true(旧实现全部静默成功)"
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
printf "\033[1m结果: %d 通过 / %d 失败\033[0m\n" "$pass" "$fail"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)

# ─────────────────────────────────────────────────────────────────
# 尚未覆盖(需要等 sweep 周期,不适合放进快速校验):
#   · 支付 → sweep → 履约 → 退款全链路 → 见 e2e.sh
#   · 重复扣款漏洞(同一订单两次 /pay 会产生两笔成功支付)
#     —— 已知问题,修法待拍板,见 README「未修的资金漏洞」
