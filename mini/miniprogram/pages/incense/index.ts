/**
 * H5 · 一味香。
 *
 * 设计册 10.8 写着一条：**香在苏合家里卖，不在铺子里** ——
 * 「东西长在卖它的人身上」。在这之前这条论点只有御守一个例证，
 * 而御守的 `villager_id` 是「里面封的是谁」，不是「谁卖的」。
 *
 * 所以这一屏不是通用商品页的一个实例：它从她的口气开始
 * （「你缺火，我给你配一味暖的」），三档价钱只是那句话的后果。
 */
import { natalApi } from '../../services/natal'
import { incenseApi } from '../../services/incense'
import { commerceApi } from '../../services/commerce'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import { money } from '../../utils/money'
import { 一句 } from '../../utils/say'

/** 她按你缺的那一味说话。缺什么由本命算出来，这里只负责挑一句。 */
const 配语: Record<string, string> = {
  木: '你缺木，我给你配一味松快的',
  火: '你缺火，我给你配一味暖的',
  土: '你缺土，我给你配一味稳的',
  金: '你缺金，我给你配一味清的',
  水: '你缺水，我给你配一味润的',
}

interface IData {
  /** 卖的是哪一件。从村民那一页带过来 —— 写死的话，
   *  第二个卖东西的人来了这一屏就指错商品。
   *  （她那一句的口气仍是苏合的：第二个卖家来时各配一张表。） */
  productId: string
  loading: boolean
  err: string
  /** 今晚那一场开着没有（设计册 E1）。开着这一槽才是入口 */
  tonight: boolean
  /** 她那一句。没有本命时是空 —— **不编一句**，改说不知道并给出口 */
  line: string
  skus: Array<{ id: string; name: string; priceText: string }>
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { productId: 'prod-suhe-incense', loading: true, err: '', line: '', skus: [], tonight: false },

  onLoad(q: Record<string, string | undefined>) {
    if (q.id) this.setData({ productId: q.id })
  },

  onShow() {
    if (storage.getToken()) this.load()
  },

  onAuthReady() { this.load() },

  load() {
    this.setData({ loading: true, err: '' })
    commerceApi.product(this.data.productId).then(
      (d) => this.setData({
        loading: false,
        err: '',
        skus: d.skus
          /* 挑不出价的档不显示。显示一个没有价钱的选项，
             点进去才发现买不了，比不显示更糟。 */
          .filter((s) => s.current_price_minor != null && s.current_currency)
          .map((s) => ({
            id: s.id,
            name: s.name,
            priceText: money(s.current_price_minor as number, s.current_currency as string),
          })),
      }),
      (e: ApiError) => this.setData({ loading: false, err: 一句(e) }),
    )
    this.loadLine()
    /* 今晚开着没有。取不到就当没开 —— 猜「开着」的话，
       这一槽会把人送进一屏说「还没开始」的东西。 */
    incenseApi.now().then(
      (n) => this.setData({ tonight: !!n }),
      () => this.setData({ tonight: false }),
    )
  },

  /** 她那一句要按【你缺什么】来。取不到本命就不说 —— 见 wxml 里那一段。 */
  loadLine() {
    const nid = getApp<IAppOption>().globalData.activeNatalId
    if (!nid) { this.setData({ line: '' }); return }
    natalApi.summary(nid).then(
      (s) => this.setData({ line: 配语[s.primary_yongshen] || '' }),
      // 取不到就不说话，不猜一句。她说错了比不说更伤
      () => this.setData({ line: '' }),
    )
  },

  onPick(e: WechatMiniprogram.BaseEvent) {
    const id = String((e.currentTarget.dataset as Record<string, unknown>).id || '')
    if (id) wx.navigateTo({ url: '/pages/confirm/index?id=' + this.data.productId + '&sku=' + id })
  },

  goTonight() { wx.navigateTo({ url: '/pages/lighting/index' }) },

  goNatal() { wx.navigateTo({ url: '/pages/natal/index' }) },

  onBack() { wx.navigateBack() },
})
