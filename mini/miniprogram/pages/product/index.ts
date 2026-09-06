/* 商品详情 —— 一卦之后能做的那件事，落在这里。
 *
 * 怎么进来的：问签结果卡片上的「另荐 ›」。那张卡片一直都在，
 * 而在 2026-08-19 之前它 bindtap 弹一个 modal 就没了 —— 看着像链接，走不通。
 *
 * 这一页只做三件事：取详情、把价格显示出来、把「下一步」交出去。
 * 下单与支付是下一段（docs/FLOW.md S3），这里先如实写着还不能买。
 */

import { commerceApi } from '../../services/commerce'
import { 脸 } from '../../utils/face'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import type { ProductDetail, Sku } from '../../types/commerce'
import { 一句 } from '../../utils/say'
import { 轻 } from '../../utils/feel'
/* 价格用【共用的那支】。这一屏原先自己抄了一份 `money()`，
   于是同一个 9900 在商品屏上是「¥99.00」、在确认屏上是「¥99」——
   改了 utils 那一份只动了后者，两屏当场说两种话。
   抄一份的代价不是多十行，是它会漂。 */
import { money as 钱 } from '../../utils/money'

/** 分 → 一句能显示的价格。取不到价就空着，不写一个 0 出来 */
function money(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor === null || minor === undefined || !currency) return ''
  return 钱(minor, currency)
}

Page({
  data: {
    id: '',
    loading: true,
    err: '',
    name: '',
    subTitle: '',
    /* 【实物要有实物的样子】（2026-09-02 第四轮评审 · 两路各自报）。
       ¥29 的香、¥398 的玉坠都是寄到家的东西，而这一屏原先唯一的图
       是【店主的头像】—— 电商漏斗里最该有图的地方是空的。
       `hero_image_url` 这个字段一直在（后端 `SELECT *` 也一直带着它
       出来），只是没人填、页面也没接:字段做了、屏上没有。 */
    货图: '',
    desc: '',
    price: '',
    /** 履约方式 —— 御守是寄实物，报告是算出来的。文案按它分 */
    fulfillment: '',
    买法: '就要这个',
    /** 御守封着的那个人。不是御守的商品是 null —— 页面据此决定说不说他 */
    villager: null as null | { id: string; name: string; title: string | null; art: string | null; direction: string; face: string },
    /** 描述里已经交代过怎么寄了吗 —— 交代过就不再摆那一行 */
    描述里说了寄: false,
    /** 头像那一段 style。画好脸的人有，没画好的是空串 */
    脸样: '',
    /* 【多档】。三张牌摆得出来的时候，屏顶那个大价钱就是重复的 ——
       判据是 `有价.length > 1`，跟那一排牌用的是同一个。 */
    多档: false,
    skus: [] as Sku[],
    /** 有多档时摆出来的那几张牌。只有一档就是空数组，屏上不摆 */
    档: [] as Array<{ id: string; name: string; priceText: string }>,
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
        const 有价 = d.skus.filter(
          (s) => s.current_price_minor !== null && s.current_price_minor !== undefined)
        const sku = 有价[0]
        this.setData({
          /* 【一件东西有几档就摆几档】（2026-09-06 · 五路体验走查）。
             这一屏原先只挑「第一个有价的」，`onBuy` 跳确认屏又不带 sku,
             确认屏再挑一次「第一个有价的」—— 于是香那一件屏上永远是 ¥29,
             而正文写着「一支烧二三十分钟，十支约够一个月」。
             **¥29 买到的是三支**，而「试香 · 三支」这五个字两屏一次都没出现过
             （两屏显示的都是 `product.name`）。
             三档只有从苏合屋里进去才看得见 —— 同一件商品，
             从商品列表进和从人物屋里进，看到的是两个不同的东西。 */
          档: 有价.length > 1
            ? 有价.map((s) => ({
                id: s.id,
                name: s.name,
                priceText: money(s.current_price_minor, s.current_currency),
              }))
            : [],
          loading: false,
          err: '',
          name: d.product.name,
          subTitle: d.product.sub_title || '',
          货图: d.product.hero_image_url || '',
          desc: d.product.description_md || '',
          price: sku ? money(sku.current_price_minor, sku.current_currency) : '',
          skuId: sku ? sku.id : '',
          多档: 有价.length > 1,
          fulfillment: d.product.fulfillment_kind,
          /* 主按钮说什么，看卖的是什么。
             「请回家」是【御守】的话 —— 御守里封着一个人。
             一支香、一份报告不是人，对它们说「请回家」是把上一版
             统一代词时的改动套过了头（2026-08-30 从截图上看见的）。 */
          买法: d.product.fulfillment_kind === 'residency'
                /* 【一个动作一个词】。名册写「请回村 ›」、村民页写
                   「请{{name}}回村」、这一屏的眉标也写「请回村」——
                   只有这颗按钮写「回家」，而它就压在眉标底下
                   （2026-09-02 第三轮评审 · 文案）。 */
                ? (d.villager ? `请${d.villager.name}回村` : '请回村')
              : d.product.category === 'report' ? '就要这份'
              : '就要这个',
          /* 御守绑着一个人。脸的那个字取姓名末字 —— 跟别处四处一样（门禁盯着） */
          villager: d.villager
            ? { ...d.villager, face: d.villager.name.slice(-1), direction: d.villager.direction || '',
                /* 【身份跟手艺一样的时候只说一遍】。副标是「{身份} · {手艺}」——
                   卢恩的身份是「刻符的北地人」、手艺是「刻符」，
                   摆出来就是「刻符的北地人 · 刻符」，读着像卡带
                   （2026-09-02 玉那一屏第一次渲出来时看见的）。
                   身份里已经含着手艺两个字就不再重复。 */
                art: (d.villager.art && d.villager.title
                      && d.villager.title.indexOf(d.villager.art) >= 0)
                  ? null : d.villager.art }
            : null,
          脸样: d.villager ? 脸(d.villager.id) : '',
          描述里说了寄: /寄/.test(d.product.description_md || ''),
          skus: d.skus,
        })
      },
      (e: ApiError) => {
        this.setData({ loading: false, err: 一句(e) })
      },
    )
  },

  /* 「买」不再直接建单，先去确认那一屏（docs/REDESIGN.md R5 · P2）。
     一步到位省的不是一次点击 —— 是【几件、寄到哪、要不要留句话】
     这三件事根本没地方问。建单挪到那一屏上。 */
  /* 挑一档。价钱与「买法」跟着变 —— 挑了 ¥88 那一档而按钮下面写着 ¥29,
     是这一屏最不该出的错。 */
  挑一档(e: WechatMiniprogram.BaseEvent) {
    const id = String((e.currentTarget.dataset as { id?: string }).id || '')
    const 它 = this.data.档.find((x) => x.id === id)
    if (!它) return
    轻()
    this.setData({ skuId: 它.id, price: 它.priceText })
  },

  onBuy() {
    if (!this.data.id) return
    /* 【挑了哪一档就带哪一档过去】。原先不带 sku —— 确认屏于是自己
       再挑一次「第一个有价的」，人挑的那一档在跳转的那一下丢了。
       确认屏本来就收这个参数（`wantSku`），只是没人发过。 */
    const 带 = this.data.skuId ? '&sku=' + this.data.skuId : ''
    wx.navigateTo({ url: '/pages/confirm/index?id=' + this.data.id + 带 })
  },

  onBack() {
    /* 退不回去时落到「村子」——「问」已经不是 tab 了（见 docs/REDESIGN.md），
       而商品本来就是从人身上进来的，村子才是它的来处。 */
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
