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
import { money, 状态那一词, 退款那一词 } from '../../utils/money'
import { 一句, 照原文 } from '../../utils/say'
import { 台账那天 } from '../../utils/day'
import { 物流那一词 } from '../../utils/ship'


/* 是哪家寄的。屏上原先原样打库里那两个字母 —— 单号那一行读作
   「sf · P25ADMIN0001」。后台早有同一张对照表
   （webadmin/src/components/util.ts 的 `carrierLabel`），这一屏没有。

   它躲过了三轮：U4 的订单页每一轮都照了相，而「sf」两个小字看着
   像单号的一部分，不像一个没翻译的枚举。 */
const 快递说法: Record<string, string> = {
  // 中国大陆
  sf: '顺丰', jd: '京东', zto: '中通', yto: '圆通', yunda: '韵达',
  sto: '申通', ems: 'EMS',
  // 日本 / 韩国 / 东南亚 / 港澳台 —— 这几个区一个都没有的时候，
  // 那边的买家在单号那一行看到的是 `yamato`、`cj_logistics`
  jp_post: '日本邮政', yamato: '黑猫宅急便', sagawa: '佐川急便',
  cj_logistics: 'CJ 大韩通运', hanjin: '韩进', lotte: '乐天',
  jnt: '极兔', ninja_van: 'Ninja Van', chunghwa_post: '中华邮政',
  // 北美
  usps: 'USPS', dhl: 'DHL', fedex: 'FedEx', ups: 'UPS',
  /* `manual` 是后台的人手填了单号、没挑承运商。后台那张表把它写成
     「人工录入」—— 那句是说给运营听的。对着这一屏的人不需要知道
     单号是谁录进去的，所以这一档【不写承运商】，只留单号本身。 */
  manual: '',
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
  /* 【御守只有三步】（2026-09-01 第二轮评审 · 转化路）。
     原先画的是「下单 › 付款 › 寄出 › 住进来」，而这一单里【没有包裹】——
     后端的 residency 分支在付款那一刻直接 move_in，从不建 shipment。
     于是「做好了」判的 `shipments.length > 0` 对御守永远是 false:
     进度条永远停在「寄出」，底下那句永远是「已经付过了，等寄出」，
     而那位其实已经在村里住着了。
     三步说的是真会发生的:下单 → 付款 → 住进来。 */
  const 名: string[] = 住
    ? ['下单', '付款', '住进来']
    : (册 ? ['下单', '付款', '算好', '读过'] : ['下单', '付款', '寄出', '收到'])

  const 付了 = status !== 'unpaid' && status !== 'draft' && status !== 'cancelled'
  /* 住进来了没:看这一单的御守行履约完了没，不看有没有包裹。
     `to_scan` 是「这一单里还有没有没扫开的御守」—— 付了钱而它还是 true，
     说明履约还没跑到（事件是异步派发的），那就还没住进来。 */
  const 住下了 = 付了 && !d.to_scan &&
    (d.lines || []).filter((l) => l.becomes_resident)
                   .every((l) => l.fulfillment_status === 'done')
  /* 【「收到」判的是签收，不是「建了运单」】（2026-09-04 · 25 计划）。
     上一版写的是 `(d.shipments||[]).length > 0` —— 运单一建出来
     最后那一格就亮，而包裹这时候刚离开仓库。买家看到「收到」亮着，
     读到的是「已经签收了」。

     这跟上面那段御守的教训是同一句话的另一半:那次发现
     「有没有运单」对御守【永远为假】,这次是它对实物【太早为真】。
     判据换成运单自己说的:`delivered` 才是收到。 */
  const 收到了 = (d.shipments || []).some(
    (x) => x.status === 'delivered' || !!x.delivered_at)
  const 做好了 = 住 ? 住下了
    : (!册 ? 收到了 : 册.status === 'ready')
  const 完了 = status === 'done' || (住 && 住下了)

  /* 【走过的必须是连着的一段】。分开判各步的话会出现「还没付款、
     但算好那一步亮着」——本机的册子是验证脚本直接种成 ready 的，
     真实链路里也可能因为补偿任务先跑而短暂出现。
     所以取【从头连续成立】的那一段，遇到第一个没成立的就停。 */
  // 御守只有三格，第四个判据用不上 —— slice 到步数，免得 while 越界读 undefined
  const 成了 = [true, 付了, 做好了, 完了].slice(0, 名.length)
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
/* 【还剩多少时间】。建单时后端写的是 `NOW() + 30 分钟`
   （unmei-app/src/order.rs），到点由 payment_sweep 把它取消掉，
   `cancel_reason='expired'`。

   这件事屏上原先【一个字都没说】:待付的单子看不出有时限，
   过期之后状态变成「已取消」—— 而买家没有取消过任何东西，
   偏偏「不要这一单了」那条文字链就在旁边，最容易的理解是
   「我是不是手滑点了它」（2026-09-01 第二轮评审 · 转化路）。

   不用计时器。计时器要在 onHide / onUnload 里清，漏一个就是个
   常驻的 zombie;而这一屏本来就在 `onShow` 重取（付款回来要刷新状态），
   顺手重算就够。「约」字担着不精确那一档:分钟级的数不需要秒级的真。 */
function 还有多久(status: string, d: OrderDetail): string {
  if (status !== 'unpaid' && status !== 'draft') return ''
  const t = d.order && d.order.expires_at
  if (!t) return ''
  const 剩 = Math.round((new Date(String(t).replace(' ', 'T')).getTime() - Date.now()) / 60000)
  if (!isFinite(剩)) return ''
  // 已经过点了但还没被扫到 —— 说「就要取消了」，不说负数
  if (剩 <= 0) return '超时了 —— 这一单一会儿会自己取消'
  if (剩 > 120) return ''            // 时限改长了的话这一句就没必要
  /* 【断句要断对】（2026-09-02 第四轮评审 · 第一次来的人）。
     原先写的是「还有约 29 分钟没付，这一单会自己取消」——
     中文在这里会先把「还有约 29 分钟没付」读成一整个短语，
     即「已经 29 分钟没付了」，意思正好反过来。
     把条件和结果分开:先给时限，再说不付会怎样。 */
  return `还有约 ${剩} 分钟 —— 到时候还没付，这一单会自己取消`
}

/* 这一单还能不能申请退款。
 *
 * 【屏上不说不能退、按钮照给、结果照拒】（2026-09-06 · 五路体验走查）。
 * 用户协议写着「数字内容一经交付（住进来了、说明书出好了）不支持退款」,
 * 而那颗按钮的条件是 `status === 'paid' || 'fulfilling' || 'done'`
 * —— **不看买的是什么**。御守付完那一刻就 move_in（已交付），
 * 按协议 100% 退不了，屏上照样给一颗按钮，后端也照样受理，
 * 建一张永远批不下去的单。
 *
 * 买家的实际体验是:按了 → 屏上什么都没变 → 若干天后被拒。
 * 这不是「不能退」的问题（数字内容不退是合理的），
 * 是【说一套做一套】的问题。已交付的那两类换成一句说明。
 */
function 退不退得了(d: OrderDetail): { 能退: boolean; 退不了: string } {
  const 单 = d.order || ({} as Record<string, unknown>)
  const status = String(单.status || '')
  if (status !== 'paid' && status !== 'fulfilling' && status !== 'done') {
    return { 能退: false, 退不了: '' }   // 还没付的单子谈不上退款，那时给的是「不要这一单了」
  }
  /* 已经在退的那一笔还没有结果时，不给第二颗按钮 ——
     后端的在途检查会拒，而屏上此刻已经写着「审核中」 */
  const 在途 = (d.refunds || []).some(
    (r) => ['requested', 'approved', 'processing'].indexOf(r.status) >= 0)
  if (在途) return { 能退: false, 退不了: '' }

  const 住 = (d.lines || []).some((l) => l.becomes_resident)
  if (住 && !d.to_scan) {
    return { 能退: false, 退不了: '已经住进来了 · 这一单不退' }
  }
  const 册 = (d.reports || [])[0]
  if (册 && 册.status === 'ready') {
    return { 能退: false, 退不了: '册子已经出了 · 这一单不退' }
  }
  return { 能退: true, 退不了: '' }
}

function 下一步等什么(status: string, d: OrderDetail): string {
  /* 【超时取消要说是超时】。都写「已取消」的话，买家会以为是自己点的。
     判据是后端给的 `cancel_reason`，不猜。 */
  if (status === 'cancelled') {
    return d.order && d.order.cancel_reason === 'expired'
      ? '超过三十分钟没付，这一单自己取消了 —— 想要的话再下一单就行'
      : ''
  }
  if (status === 'done') return ''
  const 住 = (d.lines || []).some((l) => l.becomes_resident)
  const 册 = (d.reports || [])[0]
  if (status === 'unpaid' || status === 'draft') {
    return 住 ? '付完就搬进村里那一格 —— 不用等'
         : 册 ? '付完马上开始算 —— 算好了这一屏会告诉你'
              : '付完就寄给你 —— 到了这一屏会告诉你'
  }
  /* 【付了之后的两种】。上一版这里是 `d.to_scan ? '御守在路上…' : '已经付过了，等寄出'`
     —— 两支都在说一件不会发生的事（这一单从来没有包裹）。
     真实的两种是:履约跑完了（他住下了），或者还没跑到（正在收拾）。 */
  if (住) return d.to_scan ? '正在收拾屋子 —— 一会儿就好' : '已经住进来了 —— 上面那颗按钮进得去'
  if (册) return 册.status === 'ready' ? '算好了 —— 上面那颗按钮打得开' : '在算了 —— 算好会告诉你'
  /* 【寄东西的那一支，要看包裹走到哪儿】（2026-09-04 · 25 计划）。
     上一版这里只有一句「已经付过了，等寄出」—— 而下面那一块
     物流卡上明明白白写着「在途 · sf · P25ADMIN0001」。
     同一屏两个说法，而「等寄出」那句是错的:它已经在路上了。
     买家最想知道的就是这一件事，它却是屏上唯一说错的地方。 */
  const 包裹 = (d.shipments || [])[0]
  if (!包裹) return '已经付过了，等寄出'
  if (包裹.status === 'delivered' || 包裹.delivered_at) return '寄到了 —— 收好'
  if (包裹.status === 'exception') return '路上出了点状况 —— 底下那张卡上有轨迹'
  if (包裹.status === 'in_transit') return '在路上了 —— 底下那张卡看得到走到哪儿'
  return '已经交给快递了 —— 有了单号这一屏会告诉你'
}

Page({
  data: {
    id: '',
    短单号: '',
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
    shipments: [] as Array<Shipment & { statusText: string; 快递: string }>,
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
    /** 这一单上的退款单。**申请完屏上要看得见** ——
     *  没有它的时候，按完这一屏一个字都不变，人只会再按一次 */
    退款: [] as Array<{ id: string; 说: string; 钱: string; 短号: string }>,
    /** 这一单还能不能申请退款。数字内容交付之后不能 —— 见 `退不了的理由` */
    能退: false,
    /** 不能退时说清为什么。空串 = 能退（那时摆按钮） */
    退不了: '',
    /** 这一单里还有没有没扫开的御守（设计册 M3）。
     *  有 → 这一屏的主按钮是「收到了，去扫开它」。 */
    who: null as null | { name: string; face: string; direction: string; id: string; 脸样: string },
    住下了: false,
    走到哪儿: [] as Array<{ t: string; s: string }>,
    下一步: '',
    /** 待付时的时限提示。空 = 不摆 */
    还有多久: '',
    /** 这一单买的那一册（设计册 M2「看 ›」）。null = 这单没买报告 */
    report: null as { id: string; status: string } | null,
  },

  onLoad(q: Record<string, string | undefined>) {
    const id = q.id || ''
    /* 屏上只露前八位十六进制 —— 整串四十个字符摆出来读起来像
       开发者的东西漏了。八位够客服定位到唯一一单，长按复制的是整串。 */
    const 短单号 = (id.replace(/^ord-/, '').replace(/-/g, '') || id).slice(0, 8) || id
    this.setData({
      id,
      短单号,
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
          statusText: 状态那一词(o.status, o.cancel_reason),
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
            /* 取【那条御守行】，不是第一行 —— 一单里买了别的又买了御守时，
               `lines[0]` 可能是那盒香，于是这一屏认不出人来，而
               「去他屋里看看」正是靠它出现的（2026-09-01 第二轮评审）。 */
            const l = (d.lines || []).find((x) => x.becomes_resident && x.villager_name)
                   || (d.lines || [])[0]
            return l && l.becomes_resident && l.villager_name
              ? { name: l.villager_name, face: l.villager_name.slice(-1),
                  direction: l.villager_direction || '',
                  id: l.villager_id || '',
                  脸样: 脸(l.villager_id || '') }
              : null
          })(),
          /* 【住下了没】。这一屏原先摆的是「收到了，去扫一下」——
             而买御守从来不会寄出任何东西、也不会发凭据（后端付款那一刻
             直接 move_in），那颗按钮在这一屏按下去只会扫无可扫。
             扫御守那条路仍在村子主屏上，那是线下拿到实体的人走的。
             这里换成真实的完成态:他住进来了，去他屋里。
             判据跟进度条同源（`这一单走到哪儿`），不各写一套。 */
          住下了: !!(d.lines || []).some((l) => l.becomes_resident) &&
                  !d.to_scan &&
                  ['paid', 'fulfilling', 'done'].indexOf(o.status) >= 0 &&
                  (d.lines || []).filter((l) => l.becomes_resident)
                                 .every((l) => l.fulfillment_status === 'done'),
          走到哪儿: 这一单走到哪儿(o.status, d),
          下一步: 下一步等什么(o.status, d),
          还有多久: 还有多久(o.status, d),
          /* 这一单买的册子。御守的完成态是住进村里，报告的完成态是
             **你读到了** —— 所以它跟「去扫开它」一样是主按钮。
             还没出的那些（还差生辰）也给出来：它是这一单真实的状态，
             不给的话这一屏会显示成「已完成」而买家手上什么都没有。 */
          report: (d.reports || [])[0] || null,
          /* 【申请完这一屏要看得见】。没有这一块的时候，按完「申请退款」
             屏上一个字都不变（提示被这一次 `load()` 清掉），
             人只会再按一次 —— 而第二次撞上后端的在途检查。 */
          退款: (d.refunds || []).map((r) => ({
            id: r.id,
            说: 退款那一词(r.status),
            钱: money(r.amount_minor, r.currency),
            /* 单号只露前八位 —— 跟这一屏的订单号同一个规矩:
               整串四十个字符摆出来读起来像开发者的东西漏了，
               而八位够客服定位到唯一一笔 */
            短号: (r.id.replace(/^rfd-/, '').replace(/-/g, '') || r.id).slice(0, 8),
          })),
          ...退不退得了(d),
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
          whenText: 台账那天(String(o.created_at || '')),
        })
      },
      (e: ApiError) => this.setData({ loading: false, err: 一句(e) }),
    )
    this.loadShipments()
  },

  /* 这一单真正的完成态:他住进来了，去他屋里坐坐。
     原先这个位置是「收到了，去扫一下」+ 一个手输编号的输入框 ——
     两样都够不着任何东西:买御守不寄实物、不发凭据。
     扫御守仍在村子主屏（连手输那条路一起），那是线下拿到实体的人走的。 */
  onVisit() {
    const w = this.data.who
    if (!w || !w.id) return
    wx.navigateTo({ url: '/pages/room/index?room=' + w.id })
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
        shipments: list.map((s) => ({
          ...s,
          statusText: 物流那一词(s.status),
          // 表里没有的代号原样留着 —— 编一个好听的名字比英文原值更难查
          快递: s.carrier_code ? (快递说法[s.carrier_code] ?? s.carrier_code) : '',
        })),
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
          说: ev.description || 物流那一词(ev.event_kind),
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
      /* 【后端那几句是给人看的，照原文上屏】（2026-09-06）。
         这里原先走 `一句(e)` —— 它按错误码映射，`validation` 一律翻成
         「有个地方填得不对 —— 回上一步看看」。
         而后端为这一路准备的是「这一单的 9900 分已经在退款审核里了，
         等它有结果再说」:一句写得很用心、正好回答人此刻的疑问的话，
         被翻成了一句毫不相干的。
         同一屏的券那一格用的就是 `照原文`，退款这一路选错了那一套。 */
      (e: ApiError) => this.setData({ refunding: false, note: 照原文(e) }),
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
        /* 【不把枚举名摆到屏上】。原先拼的是 `'已发起支付 · ' + r.outcome.kind`，
           屏上就成了「已发起支付 · Jsapi」—— `Jsapi` 是后端的接口枚举名，
           对买家没有意义，读起来像哪里漏出来的东西
           （2026-09-02 第三轮评审 · 第一次打开的人）。
           走到这一支说明微信那一头已经收下了这笔，接下来在微信里完成 ——
           那才是要告诉他的事。 */
        this.setData({ paying: false, note: '去微信里付吧 —— 付完回来这一屏会自己更新' })
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

  /* 取消订单是【不可逆】的，而这颗按钮跟旁边的「回去」同色同宽同高 ——
     一次误触没掉一张单。同一个仓库里「退出」是有二次确认的
     （settings/index.ts），只是这一处漏了（2026-09-01 五路评审）。
     样式上也分开:它现在是一行文字链，不是一块跟「回去」一样的木牌。 */
  async onCancel() {
    const 答 = await new Promise<boolean>((给) => {
      wx.showModal({
        title: '不要这一单了？',
        content: '取消之后这一单就没了，想要的话得重新下一次',
        confirmText: '不要了',
        cancelText: '再想想',
        success: (r) => 给(!!r.confirm),
        fail: () => 给(false),
      })
    })
    if (!答) return
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
