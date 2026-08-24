/* 商品详情 —— 一卦之后能做的那件事，落在这里。
 *
 * 怎么进来的：问签结果卡片上的「另荐 ›」。那张卡片一直都在，
 * 而在 2026-08-19 之前它 bindtap 弹一个 modal 就没了 —— 看着像链接，走不通。
 *
 * 这一页只做三件事：取详情、把价格显示出来、把「下一步」交出去。
 * 下单与支付是下一段（docs/FLOW.md S3），这里先如实写着还不能买。
 */

import { commerceApi } from '../../services/commerce'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import type { ProductDetail, Sku } from '../../types/commerce'

/** 分 → 一句能显示的价格。规则跟后端 `ai_compose::money_display` 一致 */
function money(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor === null || minor === undefined || !currency) return ''
  const d = currency === 'JPY' ? 0 : 2
  const sym: Record<string, string> = {
    CNY: '¥', JPY: '¥', USD: '$', EUR: '€', TWD: 'NT$', HKD: 'HK$', GBP: '£', SGD: 'S$',
  }
  const s = sym[currency] || currency + ' '
  if (d === 0) return s + minor
  return s + Math.floor(minor / 100) + '.' + String(minor % 100).padStart(2, '0')
}

Page({
  data: {
    id: '',
    loading: true,
    err: '',
    name: '',
    subTitle: '',
    desc: '',
    price: '',
    /** 履约方式 —— 御守是寄实物，报告是算出来的。文案按它分 */
    fulfillment: '',
    tags: [] as string[],
    skus: [] as Sku[],
    /** 能买的那个 sku（有价的第一个）。没有价就买不了，如实显示 */
    skuId: '',
    buying: false,
    note: '',
    /* 一次「买」一个键，重试复用。换键 = 另一次操作 = 真的再下一单。
       这是**第一个会发幂等键的客户端** —— 服务端要了很久，一直没人发。 */
  },

  onLoad(q: Record<string, string | undefined>) {
    const id = q.id || ''
    this.setData({ id })
    if (!id) {
      this.setData({ loading: false, err: '没说是哪一件' })
      return
    }
    this.load()
  },

  onShow() {
    // 冷启动时 token 可能还没到手，`onAuthReady` 之后再取一次。
    // 村主屏那一页就栽过这个：onShow 抢在 token 之前拿 401，此后再也不重取。
    if (!this.data.loading && this.data.err && storage.getToken()) this.load()
  },

  onAuthReady() {
    if (this.data.id && this.data.err) this.load()
  },

  load() {
    if (!this.data.id) return
    this.setData({ loading: true, err: '' })
    commerceApi.product(this.data.id).then(
      (d: ProductDetail) => {
        const sku = d.skus.find((s) => s.current_price_minor !== null && s.current_price_minor !== undefined)
        this.setData({
          loading: false,
          err: '',
          name: d.product.name,
          subTitle: d.product.sub_title || '',
          desc: d.product.description_md || '',
          price: sku ? money(sku.current_price_minor, sku.current_currency) : '',
          skuId: sku ? sku.id : '',
          fulfillment: d.product.fulfillment_kind,
          tags: d.product.tags || [],
          skus: d.skus,
        })
      },
      (e: ApiError) => {
        this.setData({ loading: false, err: e.message || '取不到这一件' })
      },
    )
  },

  /* 「买」不再直接建单，先去确认那一屏（docs/REDESIGN.md R5 · P2）。
     一步到位省的不是一次点击 —— 是【几件、寄到哪、要不要留句话】
     这三件事根本没地方问。建单挪到那一屏上。 */
  onBuy() {
    if (!this.data.id) return
    wx.navigateTo({ url: '/pages/confirm/index?id=' + this.data.id })
  },

  onBack() {
    /* 退不回去时落到「村子」——「问」已经不是 tab 了（见 docs/REDESIGN.md），
       而商品本来就是从人身上进来的，村子才是它的来处。 */
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
