/* 一张单子 —— 从下单到付掉，中间那一段。
 *
 * 这一页承担 docs/FLOW.md 里 U3 的后半段：付款、取消、看它走到哪儿了。
 *
 * 支付那一步**只有真机有**：`wx.requestPayment` 在移动网页版上会抛，
 * 那是照镜像第 2 条铁律来的 —— 空实现会让这一步在网页上「成功」而真机上
 * 根本没发生。所以这一页在网页版上验得到「发起支付拿到了 outcome」，
 * 验不到「钱真的付了」。
 */

import { commerceApi, newIdemKey } from '../../services/commerce'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import type { OrderDetail, Shipment, TraceEvent } from '../../types/commerce'
import { money, 状态说法 } from '../../utils/money'
import { 唤醒, 扫一枚 } from '../../utils/omamori'
import { 一句 } from '../../utils/say'

/** 包裹状态的说法。取值跟后端 `ShipmentStatus` 一一对应，不自创 */
const 物流说法: Record<string, string> = {
  pending: '待发', picked_up: '已揽收', in_transit: '在途',
  out_for_delivery: '派件中', delivered: '已签收', exception: '有异常',
  returned: '已退回', cancelled: '已取消',
  // 轨迹里可能出现的那几种（后端认不出的记 unknown，不编成「在途」）
  departed: '离开集散中心', arrived_at_sort_facility: '到达集散中心',
  failed_delivery: '投递失败', unknown: '承运商没说清',
}

Page({
  data: {
    id: '',
    loading: true,
    err: '',
    status: '',
    statusText: '',
    totalText: '',
    paidText: '',
    /** 已付多少分。0 时不摆「已付」那一行 —— 摆一行 0 是噪音 */
    paidMinor: 0,
    lines: [] as Array<{ name: string; qty: number; sub: string }>,
    /** 重试要复用同一个键 —— 换了键就是另一次操作，会真的再下一单 */
    payKey: '',
    cancelKey: '',
    paying: false,
    note: '',
    /** 寄出去的那些。空数组 = 这单没有实物要寄，不是「还没查」 */
    shipments: [] as Array<Shipment & { statusText: string }>,
    /** 取物流失败时说一句 —— 空数组是「没有包裹」，不是「取不到」 */
    shipErr: '',
    /** 展开的那件包裹的轨迹 */
    /** 标题：买的那个东西（设计册 M3）。多件时「第一件 等 N 件」 */
    headline: '',
    whenText: '',
    traceOf: '',
    /** 超出八条的那几条有几条。0 就是没超（设计册 10.3） */
    traceMore: 0,
    trace: [] as Array<{ 时间: string; 说: string; 在: string }>,
    refunding: false,
    refundKey: '',
    /** 这一单里还有没有没扫开的御守（设计册 M3）。
     *  有 → 这一屏的主按钮是「收到了，去扫开它」。 */
    toScan: false,
    /** 这一单买的那一册（设计册 M2「看 ›」）。null = 这单没买报告 */
    report: null as { id: string; status: string } | null,
    waking: false,
    code: '',
    wakeErr: '',
  },

  onLoad(q: Record<string, string | undefined>) {
    const id = q.id || ''
    this.setData({
      id,
      payKey: newIdemKey('pay'),
      cancelKey: newIdemKey('cancel'),
      refundKey: newIdemKey('refund'),
    })
    if (!id) {
      this.setData({ loading: false, err: '没说是哪一张' })
      return
    }
    this.load()
  },

  onShow() {
    if (this.data.id && storage.getToken()) this.load()
  },

  onAuthReady() {
    if (this.data.id) this.load()
  },

  load() {
    if (!this.data.id) return
    this.setData({ loading: true, err: '' })
    commerceApi.order(this.data.id).then(
      (d: OrderDetail) => {
        const o = d.order
        this.setData({
          loading: false,
          err: '',
          status: o.status,
          statusText: 状态说法[o.status] || o.status,
          totalText: money(o.amount_total_minor, o.currency),
          paidText: money(o.amount_paid_minor, o.currency),
          paidMinor: Number(o.amount_paid_minor) || 0,
          lines: d.lines.map((l) => ({
            name: l.sku_name || l.sku_id,
            qty: l.qty,
            sub: money(l.line_subtotal_minor, o.currency),
          })),
          toScan: !!d.to_scan,
          /* 这一单买的册子。御守的完成态是住进村里，报告的完成态是
             **你读到了** —— 所以它跟「去扫开它」一样是主按钮。
             还没出的那些（还差生辰）也给出来：它是这一单真实的状态，
             不给的话这一屏会显示成「已完成」而买家手上什么都没有。 */
          report: (d.reports || [])[0] || null,
          /* 标题用【下单那一刻的快照名】，跟「我买过的」那一列同一个来源 ——
             两处叫法不一样的话，点进来会以为点错了。 */
          headline: d.lines.length
            ? ((d.lines[0].sku_name || d.lines[0].sku_id)
               + (d.lines.length > 1 ? ' 等 ' + d.lines.length + ' 件' : ''))
            : '单 ' + this.data.id.slice(0, 8),
          whenText: (String(o.created_at || '')).slice(5, 10).replace('-', '/'),
        })
      },
      (e: ApiError) => this.setData({ loading: false, err: 一句(e) }),
    )
    this.loadShipments()
  },

  /* 「收到了，去扫开它」（设计册 M3）。跟村子主屏共用 `utils/omamori` ——
     两份实现会漂，而漂的那天村子上催你去扫、点进单子却是另一套话。 */
  onWake() {
    if (this.data.waking) return
    this.setData({ waking: true, wakeErr: '' })
    扫一枚().then((r) => {
      this.setData({ waking: false, wakeErr: r && !r.ok ? r.msg : '' })
      if (r && r.ok) this.load()
    })
  },

  onCodeInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ code: e.detail.value, wakeErr: '' })
  },

  onCodeSubmit() {
    const code = this.data.code.trim()
    if (!code) { this.setData({ wakeErr: '把御守背面那串字填进来' }); return }
    this.setData({ waking: true, wakeErr: '' })
    唤醒('qr', code).then((r) => {
      this.setData({ waking: false, wakeErr: r.ok ? '' : r.msg, code: r.ok ? '' : code })
      if (r.ok) this.load()
    })
  },

  /* 物流单独取。订单详情里其实也带 `shipments`，但轨迹要另一条接口，
     而且这一段失败不该把整张单子拖红 —— 单子还在，只是不知道寄到哪儿了。

     **失败与「没有包裹」要分开**。第一版这里失败也写 `shipments: []`，
     于是「这单没有实物要寄」跟「取不到」长得一模一样，屏幕上都是什么都不显示。
     那正是我一整天在别处修的那种坏法，写自己代码时又犯了一次。 */
  loadShipments() {
    commerceApi.shipments(this.data.id).then(
      (list) => this.setData({
        shipErr: '',
        shipments: list.map((s) => ({ ...s, statusText: 物流说法[s.status] || s.status })),
      }),
      (e: ApiError) => this.setData({ shipments: [], shipErr: 一句(e) }),
    )
  },

  onTrace(e: WechatMiniprogram.BaseEvent) {
    const sid = String((e.currentTarget.dataset as Record<string, unknown>).sid || '')
    if (!sid) return
    if (this.data.traceOf === sid) { this.setData({ traceOf: '', trace: [], traceMore: 0 }); return }
    commerceApi.trace(this.data.id, sid).then(
      (t) => this.setData({
        traceOf: sid,
        /* 一屏八条，超了折叠（设计册 10.3）。理由它自己写了：
           「实测轨迹很少超过六条」—— 八条是安全上限，不是随手定的数。

           **只留最近八条，更早的照实说一句**，不给展开：
           展开会让这一屏滚，而 10.3 的例外只留给「用户就是来读长东西的」
           那种页面（报告正文、签词全文）。一单不是来读轨迹全文的。 */
        traceMore: Math.max(0, (t.trace || []).length - 8),
        trace: (t.trace || []).slice(0, 8).map((ev: TraceEvent) => ({
          时间: (ev.event_at || '').replace('T', ' ').slice(5, 16),
          说: ev.description || 物流说法[ev.event_kind] || ev.event_kind,
          在: ev.location || '',
        })),
      }),
      (err: ApiError) => this.setData({ note: 一句(err) }),
    )
  },

  onRefund() {
    if (this.data.refunding) return
    this.setData({ refunding: true, note: '' })
    commerceApi.refund(this.data.id, 'user_request', this.data.refundKey).then(
      () => { this.setData({ refunding: false, note: '退款已申请，等审核' }); this.load() },
      (e: ApiError) => this.setData({ refunding: false, note: 一句(e) }),
    )
  },

  onPay() {
    if (this.data.paying) return
    this.setData({ paying: true, note: '' })
    /* openid：真机上由微信登录拿到，存在 user 里。匿名用户没有 openid，
       后端目前也不校验它（微信支付真接通是 Beta1 那条）。
       没有就发空串，**不编一个** —— 编出来的 openid 在真接通那天会静默失败。 */
    const u = storage.getUser<{ wx_mp_openid?: string }>()
    const openid = (u && u.wx_mp_openid) || ''
    commerceApi.pay(this.data.id, openid, this.data.payKey).then(
      (r) => {
        this.setData({ paying: false, note: '已发起支付 · ' + r.outcome.kind })
        /* 真机走这一步；网页版上它会抛，而那是对的 —— 浏览器里没有微信收银台。
           抛出来会被垫片的全屏报错接住，动线脚本据此知道「到这儿为止」。 */
        const q = (r.outcome.params || {}) as Record<string, unknown>
        const 必填 = ['nonceStr', 'package', 'paySign', 'timeStamp']
        const 缺 = 必填.filter((k) => typeof q[k] !== 'string')
        if (缺.length) {
          this.setData({ note: '支付参数缺：' + 缺.join(' · ') })
          return
        }
        wx.requestPayment({
          nonceStr: q.nonceStr as string,
          package: q.package as string,
          paySign: q.paySign as string,
          timeStamp: q.timeStamp as string,
          signType: (q.signType as 'RSA' | 'MD5' | 'HMAC-SHA256') || 'RSA',
          success: () => this.load(),
          fail: () => this.setData({ note: '支付没完成' }),
        })
      },
      (e: ApiError) => this.setData({ paying: false, note: 一句(e) }),
    )
  },

  onCancel() {
    commerceApi.cancelOrder(this.data.id, this.data.cancelKey).then(
      () => this.load(),
      (e: ApiError) => this.setData({ note: 一句(e) }),
    )
  },

  /** 去读那一册。还差生辰的也进去 —— 那一屏说得清还差什么、去哪儿填 */
  onRead() {
    const r = this.data.report
    if (!r) return
    wx.navigateTo({ url: `/pages/report/index?id=${r.id}` })
  },

  onBack() {
    wx.navigateBack({ fail() { wx.navigateTo({ url: '/pages/orders/index' }) } })
  },
})
