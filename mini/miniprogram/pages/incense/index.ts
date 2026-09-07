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
import { 脸 } from '../../utils/face'
import { incenseApi } from '../../services/incense'
import { 那一天那一刻, 今天那一刻 } from '../../utils/incense-when'
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
  /** 苏合的头像那一段 style。她的脸画好了就有，没有就是空串 */
  脸样: string
  /** 卖的是哪一件。从村民那一页带过来 —— 写死的话，
   *  第二个卖东西的人来了这一屏就指错商品。
   *  （她那一句的口气仍是苏合的：第二个卖家来时各配一张表。） */
  productId: string
  loading: boolean
  err: string
  /** 今晚那一场开着没有（设计册 E1）。开着这一槽才是入口 */
  tonight: boolean
  /** 点香是几点（「周四晚九点」/「今晚九点」）。**按后端那份排期生成** ——
   *  几点点香在后端是配置，写死在屏上的话，挪了时间就成了一句假话。
   *  取不到就是空串:这一句宁可不显示，也不说一个可能已经不对的时刻 */
  当口: string
  今口: string
  /** 她那一句。没有本命时是空 —— **不编一句**，改说不知道并给出口 */
  line: string
  skus: Array<{ id: string; name: string; priceText: string; 荐: boolean }>
  /** 按月送那一档。取不到就是空 —— 那时整块不摆，不编一个价出来。
   *  它跟上面三档不是同一种东西:三档是买一次，这一档是每月收到一盒。 */
  按月: { skuId: string; priceText: string } | null
}

/* 三档要分出主次。
   原先三张牌各带一条一模一样的实心橙「买」—— 三个同级的主动作等于
   没有主动作，眼睛无处落，而这一屏最要紧的事就是选一档。

   推荐哪一档？**不编社会证明**。「多数人选这个」得有数据，我们没有，
   写了就是骗。能诚实说的只有一件事:第一次买的人该从最小的一档起，
   所以荐的是【最便宜的那一档】—— 由价格算出来，不写死在第几张牌上。
   （写死 index 0 的话，哪天档位次序一改，推荐就悄悄落到别处。） */
function 标出最便宜那一档<T extends { 分: number }>(档: T[]): Array<T & { 荐: boolean }> {
  const 最低 = Math.min(...档.map((x) => x.分))
  return 档.map((x) => ({ ...x, 荐: x.分 === 最低 }))
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    /* 这一屏就是苏合的 —— 头像也就写死她。
       上一轮接四十张脸时扫的是 `face-{{…}}` 那种模式，
       这里的类名是写死的 `face-near`，于是漏掉了。 */
    脸样: 脸('suhe'), productId: 'prod-suhe-incense', loading: true, err: '', line: '', skus: [], tonight: false, 当口: '', 今口: '', 按月: null },

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
        skus: 标出最便宜那一档(d.skus
          /* 挑不出价的档不显示。显示一个没有价钱的选项，
             点进去才发现买不了，比不显示更糟。 */
          .filter((s) => s.current_price_minor != null && s.current_currency)
          .map((s) => ({
            id: s.id,
            name: s.name,
             分: s.current_price_minor as number,
            priceText: money(s.current_price_minor as number, s.current_currency as string),
          }))),
      }),
      (e: ApiError) => this.setData({ loading: false, err: 一句(e) }),
    )
    this.loadLine()
    this.load按月()
    /* 今晚开着没有。取不到就当没开 —— 猜「开着」的话，
       这一槽会把人送进一屏说「还没开始」的东西。 */
    incenseApi.now().then(
      (n) => this.setData({ tonight: !!n }),
      () => this.setData({ tonight: false }),
    )
    incenseApi.schedule().then(
      (s) => this.setData({ 当口: 那一天那一刻(s), 今口: 今天那一刻(s) }),
      // 取不到就不说时刻。说错一个钟点比不说更伤 —— 有人会照着它来
      () => this.setData({ 当口: '', 今口: '' }),
    )
  },

  /* 【按月送那一档】。
     商品号写死在这儿，跟这一屏的头像写死苏合是同一个理由:
     **这一屏就是她的**（设计册 10.8「东西长在卖它的人身上」）。
     第二个按月卖东西的人来时，各配一张表 —— 那时再拆。

     取不到就不摆这一块。摆一个没有价的入口，点进去才发现买不了,
     比不摆更糟 —— 跟上面三档挑价那一段同一条判据。 */
  load按月() {
    commerceApi.product('prod-incense-monthly').then(
      (d) => {
        const 有价 = d.skus.filter((s) => s.current_price_minor != null && s.current_currency)
        this.setData({
          按月: 有价.length
            ? {
                skuId: 有价[0].id,
                priceText: money(有价[0].current_price_minor as number,
                                 有价[0].current_currency as string),
              }
            : null,
        })
      },
      () => this.setData({ 按月: null }),
    )
  },

  onPick按月() {
    const s = this.data.按月
    if (s) wx.navigateTo({ url: '/pages/confirm/index?id=prod-incense-monthly&sku=' + s.skuId })
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
