#!/usr/bin/env bash
# 本机那个假微信 —— 起它、并把该配的环境变量打出来。
#
# 【它跟「桩」是两件事】。桩替我们的代码回答；这个进程让我们的代码
# 自己去问、自己去验：我们发的每个请求它真验签，它回的每条回调
# 真加密、真签名。于是我方那一侧的签名 / 验签 / 加解密 / 错误分支
# 全都真跑了一遍 —— 那些恰恰是上线那天唯一会出错的地方。
#
# 用法：
#   bash scripts/fake-wx.sh up        # 起（已经在跑就什么都不做）
#   bash scripts/fake-wx.sh env       # 打印 export 行，`eval` 它
#   bash scripts/fake-wx.sh down
set -uo pipefail
cd "$(dirname "$0")/.."

DIR=${FAKE_WX_DIR:-/tmp/unmei-wx-dev}
PORT=${FAKE_WX_PORT:-6033}
BIND=127.0.0.1:$PORT

活着() { curl -s -o /dev/null -m 2 "http://$BIND/v3/certificates" && return 0 || return 1; }

case "${1:-up}" in
  up)
    # 判据是「有没有人应答」，不是某条路径给不给 200 ——
    # 拿 /health 当探针在这个仓里已经误判过两次
    if 活着; then echo "· 假微信已经在 $BIND 上跑着"; exit 0; fi
    (cd backend && cargo build -p fake-wx) >/dev/null 2>&1 || {
      echo "✗ fake-wx 编不过"; exit 1; }
    FAKE_WX_DIR=$DIR FAKE_WX_BIND=$BIND FAKE_WX_PORT=$PORT \
      nohup ./backend/target/debug/fake-wx > /tmp/fake-wx.log 2>&1 &
    for _ in $(seq 1 40); do 活着 && break; sleep 0.25; done
    if 活着; then echo "✓ 假微信起来了 · $BIND · 凭据在 $DIR"; else
      echo "✗ 假微信没起来，看 /tmp/fake-wx.log"; tail -5 /tmp/fake-wx.log; exit 1; fi
    ;;
  env)
    [ -f "$DIR/apiv3.key" ] || { echo "# 先 bash scripts/fake-wx.sh up" >&2; exit 1; }
    cat <<ENVEOF
export WX_API_BASE=http://$BIND
export WX_PAY_API_BASE=http://$BIND
export WX_MP_APPID=wxfakeappid
export WX_MP_SECRET=fakesecret
export WX_H5_APPID=wxfakeh5
export WX_H5_SECRET=fakesecret
export WX_PAY_MCHID=1900000000
export WX_PAY_SERIAL_NO=MERCHANTCERT0001
export WX_PAY_KEY_PATH=$DIR/merchant_key.pem
export WX_PAY_API_V3_KEY=$(cat "$DIR/apiv3.key")
export WX_PAY_NOTIFY_URL=http://127.0.0.1:6028/v1/webhooks/wechat
# 「这一期该付了」那条订阅消息的模板号。假微信不校验它长什么样，
# 而没配的话客户端不会去要授权、服务端也不会发 —— 那一条路就不算跑过
export WX_TPL_SUB_BILL=FAKE_TPL_SUB_BILL
ENVEOF
    ;;
  down) pkill -f 'target/debug/fake-wx' && echo "· 停了" || echo "· 本来就没跑" ;;
  *) echo "up | env | down"; exit 2 ;;
esac
