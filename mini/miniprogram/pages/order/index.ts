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
import { 脸 } from '../../utils/face'
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

/* 这一单走到哪一步了。

   订单详情在最常见的情况下（买一件、还没付、没有物流）整屏只有标题、
   金额、状态三行，中间七百多像素全空 —— 而人点进来就是想知道
   「我这单现在怎么样、接下来会怎样」。

   步骤按这一单【买了会发生什么】分：会住进村里的走「寄出 → 住进来」，
   要算的走「算好 → 读过」，其余就是寄东西。判据来自后端给的
   `becomes_resident` 与这一单有没有册子，不在这里猜。 */
function 这一单走到哪儿(status: string, d: OrderDetail): Array<{ t: string; s: string }> {
  const 住 = (d.lines || []).some((l) => l.becomes_resident)
  const 册 = (d.reports || [])[0]
  const 名: string[] = 住
    ? ['下单', '付款', '寄出', '住进来']
    : (册 ? ['下单', '付款', '算好', '读过'] : ['下单', '付款', '寄出', '收到'])

  const 付了 = status !== 'unpaid' && status !== 'draft' && status !== 'cancelled'
  const 做好了 = (住 || !册)
    ? (d.shipments || []).length > 0
    : 册.status === 'ready'
  const 完了 = status === 'done' || (住 && 付了 && !d.to_scan && 做好了)

  /* 【走过的必须是连着的一段】。分开判各步的话会出现「还没付款、
     但算好那一步亮着」——本机的册子是验证脚本直接种成 ready 的，
     真实链路里也可能因为补偿任务先跑而短暂出现。
     所以取【从头连续成立】的那一段，遇到第一个没成立的就停。 */
  const 成了 = [true, 付了, 做好了, 完了]
  let 走过 = 0
  while (走过 < 名.length && 成了[走过]) 走过++

  /* 橙的那一点是【下一步该发生的事】，不是「最后做完的那件」——
     人点进订单是想知道接下来等什么。全部做完时没有下一步，
     那就让最后一步亮着。 */
  const 现在 = 走过 >= 名.length ? 名.length - 1 : 走过
  return 名.map((t, i) => ({ t, s: i < 现在 ? 'past' : (i === 现在 ? 'now' : 'todo') }))
}

/* 【下一步等什么】。进度线说得出「在哪儿」，说不出「接下来会怎样」。
   按这一单买了会发生什么分三种:会住进村里的、要算的、寄东西的。
   已经走完的不说 —— 那时该说的话在按钮上。 */
function 下一步等什么(status: string, d: OrderDetail): string {
  if (status === 'cancelled' || status === 'done') return ''
  const 住 = (d.lines || []).some((l) => l.becomes_resident)
  const 册 = (d.reports || [])[0]
  if (status === 'unpaid' || status === 'draft') {
    return 住 ? '付完就把御守寄给你 —— 收到扫一下，他就住进村里那一格'
         : 册 ? '付完马上开始算 —— 算好了这一屏会告诉你'
              : '付完就寄给你 —— 到了这一屏会告诉你'
  }
  if (住) return d.to_scan ? '御守在路上。收到之后扫一下，他就住进来' : '已经付过了，等寄出'
  if (册) return 册.status === 'ready' ? '算好了 —— 上面那颗按钮打得开' : '在算了 —— 算好会告诉你'
  return '已经付过了，等寄出'
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
    who: null as null | { name: string; face: string; direction: string; 脸样: string },
    toScan: false,
    走到哪儿: [] as Array<{ t: string; s: string }>,
    下一步: '',
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
            // 「谁谁的御守」只对【买了会有人住进来】的行成立。
            // 香也挂着苏合，写成「苏合的御守」的话，同一屏上明细叫一个名字、
            // 底下总计那行叫另一个，看着像买了两样东西。
            name: (l.becomes_resident && l.villager_name)
              ? l.villager_name + '的御守'
              : (l.sku_name || l.sku_id),
            qty: l.qty,
            sub: money(l.line_subtotal_minor, o.currency),
          })),
          /* 【这一屏的那张脸】。wxml 上一直写着 who，而 ts 里从来没有这个字段 ——
             也就是说这块脸从第一天起就没显示过。从商品页到确认屏都有他，
             到了订单详情人就消失了。
             只在【会住进来】的那种单上摆:买香买报告没有「那个人」。 */
          who: (() => {
            const l = (d.lines || [])[0]
            return l && l.becomes_resident && l.villager_name
              ? { name: l.villager_name, face: l.villager_name.slice(-1),
                  direction: l.villager_direction || '',
                  脸样: 脸(l.villager_id || '') }
              : null
          })(),
          toScan: !!d.to_scan,
          走到哪儿: 这一单走到哪儿(o.status, d),
          下一步: 下一步等什么(o.status, d),
          /* 这一单买的册子。御守的完成态是住进村里，报告的完成态是
             **你读到了** —— 所以它跟「去扫开它」一样是主按钮。
             还没出的那些（还差生辰）也给出来：它是这一单真实的状态，
             不给的话这一屏会显示成「已完成」而买家手上什么都没有。 */
          report: (d.reports || [])[0] || null,
          /* 标题用【下单那一刻的快照名】，跟「我买过的」那一列同一个来源 ——
             两处叫法不一样的话，点进来会以为点错了。 */
          /* 御守说得出是谁 —— 「丹增的御守」而不是「御守 · 单枚」。
             从商品页那一屏的「丹增 · 下山的武僧」走过来，人不该在结账时消失。 */
          headline: d.lines.length
            ? (((d.lines[0].becomes_resident && d.lines[0].villager_name)
                 ? d.lines[0].villager_name + '的御守'
                 : (d.lines[0].sku_name || d.lines[0].sku_id))
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


  /* 长按复制单号。出了事人得有个东西能念给客服 ——
     这一屏原先没有任何这样的东西。 */
  onCopyId() {
    wx.setClipboardData({
      data: this.data.id,
      success: () => wx.showToast({ title: '单号复制好了', icon: 'none' }),
    })
  },

  onBack() {
    wx.navigateBack({ fail() { wx.navigateTo({ url: '/pages/orders/index' }) } })
  },
})
