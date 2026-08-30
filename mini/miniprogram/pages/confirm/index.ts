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
import type { ProductDetail } from '../../types/commerce'
import { money } from '../../utils/money'
import { 一句 } from '../../utils/say'

interface Contact { name?: string; phone?: string; address?: string }

interface IData {
  id: string
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
  qty: number
  message: string
  contact: Contact | null
  /** 选地址失败时那一行字。真机独有的能力，在网页上会抛 */
  addrNote: string
  buying: boolean
  note: string
  buyKey: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    id: '', loading: true, err: '', p: null,
    skuId: '', unit: 0, cur: 'CNY', unitText: '', totalText: '', face: '',
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
        const sku = p.skus.find((x) => x.current_price_minor !== null && x.current_price_minor !== undefined)
        const unit = sku ? (sku.current_price_minor || 0) : 0
        const cur = (sku && sku.current_currency) || 'CNY'
        this.setData({
          loading: false, p,
          skuId: sku ? sku.id : '',
          unit, cur,
          unitText: sku ? money(unit, cur) : '',
          // 脸上那个字取姓名末字 —— 跟别处几处一样（门禁 check-face-color 盯着）
          face: p.villager ? p.villager.name.slice(-1) : '',
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
    if (!this.data.skuId) { this.setData({ note: '这一件挑不出价，买不了' }); return }
    /* 【寄到哪】是必须的:这是实物,没有地址就寄不出去 ——
       而订单那一屏也没有补填的地方,一单落下去就成了悬案。
       原先这里一个字都不问,「去付」照样满橙。 */
    if (!(contact && contact.address)) {
      this.setData({ note: '还差【寄到哪】—— 上面点一下选个地址，御守要寄到你手上' })
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
