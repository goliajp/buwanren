#!/usr/bin/env bash
# 钱的两处必须带幂等键 —— 不带就该当场 400。
#
# 为什么单独守一道：D6 拍板「客户端带幂等键」，服务端也实现了，但它原先
# **不带键就放行**。而查下来**没有任何客户端在发这个头**——也就是这道保护
# 对真实调用方等于不存在。这个仓库已经有过一次「引擎完整、九条测试绿、
# 零调用方」（工序单 D7 注释里点名的风控）。
#
# 今天还没有客户端调这两条（买御守那条流程还没进小程序），所以这道门禁
# 现在守的是**将来那个人**：他忘了带键，会当场看见 400，而不是悄悄多扣一次。
#
# 用法: bash scripts/check-idem-required.sh [base]
set -u
BASE="${1:-http://127.0.0.1:6028}"

if ! curl -sf "$BASE/v1/health" >/dev/null 2>&1; then
  echo "✗ 后端（${BASE}）没起，这一项没法验"
  exit 1
fi

TOK=$(curl -s -X POST "$BASE/v1/auth/anonymous" -H 'content-type: application/json' -d '{}' \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
if [ -z "$TOK" ]; then
  echo "✗ 匿名登录拿不到 token，后面没法验"
  exit 1
fi

pass=0; fail=0

# check <说明> <期望状态码> <期望响应里出现的字，空串=不查> <curl 额外参数...>
#
# 光看状态码不够:去掉「必须带键」之后,支付那条【照样 400】——只是换了个理由
# (业务校验挡的)。那样这道门禁会以正确的状态码、错误的原因通过。
# 所以要钉住那句话本身。
check() {
  local desc="$1" want="$2" want_msg="$3"; shift 3
  local out code
  out=$(curl -s -w '\n%{http_code}' "$@")
  code=$(printf '%s' "$out" | tail -1)
  body=$(printf '%s' "$out" | sed '$d')
  if [ "$code" != "$want" ]; then
    printf '  ✗ %-34s 期望 %s，实际 %s\n' "$desc" "$want" "$code"; fail=$((fail+1)); return
  fi
  if [ -n "$want_msg" ] && ! printf '%s' "$body" | grep -q "$want_msg"; then
    printf '  ✗ %-34s 状态码对，但说的不是那件事：%s\n' "$desc" "$(printf '%s' "$body" | head -c 90)"
    fail=$((fail+1)); return
  fi
  printf '  ✓ %-34s %s\n' "$desc" "$code"; pass=$((pass+1))
}

echo "══ 钱的接口要不要幂等键 ══"

# 建单：不带键 400，带键就进到业务校验（空 lines → 422）
check "建单 · 不带键要 400" 400 idempotency-key \
  -X POST "$BASE/v1/orders" -H "authorization: Bearer $TOK" \
  -H 'content-type: application/json' -d '{"lines":[]}'
check "建单 · 带键就往下走" 422 "" \
  -X POST "$BASE/v1/orders" -H "authorization: Bearer $TOK" \
  -H 'content-type: application/json' -H "idempotency-key: gate-$$-a" -d '{"lines":[]}'

# 支付：不带键 400。订单不存在也不要紧 —— 这道检查在业务之前
check "支付 · 不带键要 400" 400 idempotency-key \
  -X POST "$BASE/v1/orders/ord-nonexistent/pay" -H "authorization: Bearer $TOK" \
  -H 'content-type: application/json' -d '{"channel":"wx_mp"}'

echo
echo "过 $pass · 挂 $fail"
[ "$fail" -eq 0 ] || exit 1
