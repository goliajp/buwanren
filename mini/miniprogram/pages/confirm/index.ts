/* 确认（docs/REDESIGN.md R5 · P2）。
 *
 * 原先「买」是一步到位：商品页点一下就建单，直落订单页。
 * 中间少了一屏 —— 而这一屏要问三件事：**几件、寄到哪、要不要留句话**。
 * 一步到位的代价不是少点一下，是这三件事根本没地方问。
 *
 * 网页版上验得到的：数量、留言、算账、「去付」建单。
 * **只有真机有的**：`wx.chooseAddress`（微信地址簿）—— 垫片会抛，不假装成功。
 */

import { commerceApi } from '../../services/commerce'
import { 脸 } from '../../utils/face'
import type { ProductDetail } from '../../types/commerce'
import { money } from '../../utils/money'
import { 一句 } from '../../utils/say'

interface Contact { name?: string; phone?: string; address?: string }

interface IData {
  id: string
  /** 他在上一屏挑的那一档。空 = 上一屏没让他挑（只有一档的商品） */
  wantSku: string
  loading: boolean
  err: string
  p: ProductDetail | null
  /** 挑出来的那个 sku 与它的价 —— 挑不出价的 sku 不能买 */
  skuId: string
  unit: number
  cur: string
  unitText: string
  totalText: string
  /** 御守封着的那位，脸上那个字（姓名末字）。不是御守就是空 */
  face: string
  /** 头像那一段 style。画好脸的人有，没画好的是空串 */
  脸样: string
  /** 买了会不会住进村里 —— 只有会的那种才叫「谁谁的御守」 */
  住进来: boolean
  /** 这一件【真的要寄】吗。只有 shipping 那一种要 ——
   *  御守付完人就搬进来，说明书是算出来的，两样都没有包裹。
   *  见下面 `go()` 里那段。 */
  要寄: boolean
  /** 付完之后会发生什么 —— 按这一件的履约方式说一句实话 */
  付完呢: string
  qty: number
  message: string
  contact: Contact | null
  /** 选地址失败时那一行字。真机独有的能力，在网页上会抛 */
  addrNote: string
  /** 寄到哪填了没 —— 「去付」长什么样看它。
   *  这是【实物】：没有地址的订单寄不出去，而订单那一屏也没有补填的地方。 */
  有地址: boolean
  buying: boolean
  note: string
  buyKey: string
}

/* 付完之后会发生什么 —— 底下那一行。
   原先写死一句「付完之后就等它到 —— 到了会有人告诉你」，
   而三种履约里只有一种真的会「到」:御守付完那位当场搬进村里，
   说明书是算出来的。等一个不会来的包裹是这一版最贵的一句错话。 */
function 付完会怎样(kind: string): string {
  if (kind === 'residency') return '付完就搬进村里那一格 —— 马上就能去屋里坐坐'
  if (kind === 'async_compute') return '付完就开始算 —— 算好了这一屏会告诉你'
  if (kind === 'shipping') return '付完之后就等它到 —— 到了会有人告诉你'
  return '付完马上就能用'
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    id: '', wantSku: '', loading: true, err: '', p: null,
    skuId: '', unit: 0, cur: 'CNY', unitText: '', totalText: '', face: '', 脸样: '', 住进来: false,
    要寄: false, 付完呢: '',
    qty: 1, message: '',
    contact: null, addrNote: '', buying: false, note: '', buyKey: '',
    /* 寄到哪填了没 —— 「去付」长什么样看它。
       这是【实物】：没有地址的订单寄不出去，而订单那一屏也没有补填的地方。
       满橙的大按钮长得跟能按一样，跟填出生时间那一屏是同一个病。 */
    有地址: false,
  },

  onLoad(q: Record<string, string | undefined>) {
    /* 幂等键在进这一屏时就定下来，不在点「去付」时才生成 ——
       点两下就是两个键，也就是两张单（那正是重复扣款的来路）。 */
    this.setData({
      id: q.id || '',
      /* 【他挑的是哪一档】。香有三档（三支 ¥29 / 十支 ¥128 / 单配 ¥268），
         点进来时带着 `sku=`，而这一屏原先从头到尾没读过它 —— 自己在
         `load()` 里挑「第一个有价的」。于是想买 ¥128 的人落到一屏写着
         「一共 ¥29」的确认页，下单建的是三支那一档。
         哪一档排第一由 `ORDER BY s.created_at` 定，而三档是同一条 INSERT
         种下去的、时间戳相同 —— 也就是说买到哪一档没有定则。 */
      wantSku: q.sku || '',
      buyKey: 'confirm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    })
  },

  onShow() {
    this.load()
  },

  onAuthReady() {
    this.load()
  },

  load() {
    const { id } = this.data
    if (!id) { this.setData({ loading: false, err: '没说是哪一件' }); return }
    this.setData({ loading: true, err: '' })
    commerceApi.product(id).then(
      (p) => {
        const 有价 = (x: { current_price_minor?: number | null }) =>
          x.current_price_minor !== null && x.current_price_minor !== undefined
        /* 他挑过就用他挑的。挑的那一档没了价（下架、改价）就说不出来，
           不悄悄换一档给他 —— 换了他也看不出来，直到收到货。 */
        const 想要 = this.data.wantSku
          ? p.skus.find((x) => x.id === this.data.wantSku)
          : undefined
        if (this.data.wantSku && (!想要 || !有价(想要))) {
          this.setData({ loading: false, err: '这一档现在买不了了 —— 回去挑一档别的' })
          return
        }
        const sku = 想要 || p.skus.find(有价)
        const unit = sku ? (sku.current_price_minor || 0) : 0
        const cur = (sku && sku.current_currency) || 'CNY'
        this.setData({
          loading: false, p,
          skuId: sku ? sku.id : '',
          unit, cur,
          unitText: sku ? money(unit, cur) : '',
          // 脸上那个字取姓名末字 —— 跟别处几处一样（门禁 check-face-color 盯着）
          face: p.villager ? p.villager.name.slice(-1) : '',
          脸样: p.villager ? 脸(p.villager.id) : '',
          /* 买了会不会住进村里 —— 只有会的那种才叫「谁谁的御守」。
             香也挂着苏合，但买香是寄一盒香给你。原先拿「有没有关联村民」
             当判据，于是买香的确认页写着「苏合的御守」，
             底下明细却写「苏合配的那一味」——一屏两个名字。 */
          住进来: p.product ? p.product.fulfillment_kind === 'residency' : false,
          /* 【地址只在真要寄的时候问】。上一版对每一件都要地址 ——
             而 ¥99 的御守付完那位就住进村里，一个包裹都没有;说明书是算出来的。
             于是主推的那一件在成交前多一道跟它无关的坎:按钮上写着
             「先填寄到哪儿」，弹出微信地址簿，而那个地址此后没有任何东西用它
             （2026-09-01 第二轮评审 · 转化路）。
             判据用后端给的 fulfillment_kind，不在这里按品类猜。 */
          要寄: p.product ? p.product.fulfillment_kind === 'shipping' : false,
          付完呢: 付完会怎样(p.product ? p.product.fulfillment_kind : ''),
          totalText: sku ? money(unit * this.data.qty, cur) : '',
        })
      },
      (e) => this.setData({ loading: false, err: '取不到：' + (一句(e)) }),
    )
  },

  setQty(n: number) {
    const qty = Math.min(99, Math.max(1, n))
    this.setData({ qty, totalText: this.data.skuId ? money(this.data.unit * qty, this.data.cur) : '' })
  },
  minus() { this.setQty(this.data.qty - 1) },
  plus() { this.setQty(this.data.qty + 1) },
  onMessage(e: WechatMiniprogram.Input) { this.setData({ message: e.detail.value }) },

  /* 微信地址簿。浏览器里没有对应的东西 —— 垫片抛，这里如实说，
     不给一个「假装填好了」的分支。 */
  chooseAddr() {
    const anyWx = wx as unknown as { chooseAddress?: (o?: unknown) => Promise<Record<string, string>> }
    if (typeof anyWx.chooseAddress !== 'function') {
      this.setData({ addrNote: '这台设备上没有地址簿' })
      return
    }
    /* 两种失败形状都要接：真机上用户取消是 **rejected promise**，
       网页版的垫片是**同步抛**（`deviceOnly` 直接 throw，不返回 promise）。
       只接后一种的话，网页上这一下会窜成未捕获异常，
       而这一屏该说的是「这台设备上做不到」—— 说不出来就等于假装没这回事。 */
    let pending: Promise<Record<string, string>>
    try {
      pending = anyWx.chooseAddress({})
    } catch (e) {
      const err = e as { message?: string }
      this.setData({ addrNote: err && err.message ? err.message : '这台设备上选不了' })
      return
    }
    pending.then(
      (a) => this.setData({
        addrNote: '',
        有地址: true,
        contact: {
          name: a.userName,
          phone: a.telNumber,
          address: [a.provinceName, a.cityName, a.countyName, a.detailInfo].filter(Boolean).join(''),
        },
      }),
      (e: { message?: string }) => this.setData({ addrNote: e && e.message ? e.message : '没选成' }),
    )
  },

  go() {
    const { p, qty, buying, buyKey, contact, message } = this.data
    if (buying || !p) return
    /* 没地址时这颗按钮上写的是「先填寄到哪儿」—— 它就该去做那件事。
       原先它写「去付」、是灰的，按下去只在底下冒一句「还差寄到哪」:
       整屏唯一的成交按钮长得跟禁用一样，人按两下没反应就走了。 */
    if (this.data.要寄 && !(contact && contact.address)) { this.chooseAddr(); return }
    if (!this.data.skuId) { this.setData({ note: '这一件挑不出价，买不了' }); return }
    /* 【寄到哪】只对真要寄的那一件是必须的:没有地址就寄不出去，
       而订单那一屏也没有补填的地方，一单落下去就成了悬案。
       御守 / 说明书没有包裹，这一步对它们是纯粹的坎（见上面 `要寄`）。 */
    if (this.data.要寄 && !(contact && contact.address)) {
      this.setData({ note: '还差【寄到哪】—— 上面点一下选个地址，东西要寄到你手上' })
      return
    }
    this.setData({ buying: true, note: '' })
    const c: Record<string, unknown> = { ...(contact || {}) }
    if (message.trim()) c.message = message.trim()
    commerceApi.createOrder(this.data.skuId, qty, buyKey, Object.keys(c).length ? c : undefined).then(
      (o) => {
        this.setData({ buying: false })
        wx.redirectTo({ url: '/pages/order/index?id=' + o.order_id })
      },
      (e) => this.setData({ buying: false, note: 一句(e) }),
    )
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
