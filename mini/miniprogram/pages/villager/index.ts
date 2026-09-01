/* 一位不完人 —— 从村子里点一格进来（docs/REDESIGN.md R2 / 设计 V2）。
 *
 * 为什么从内联卡片改成一屏：卡片只放得下一个名字加两颗按钮，
 * 而这一屏要说的是【他是谁】—— 号、术、稀有度，尤其是**他缺什么**。
 * 「缺」是这个产品的身份字段，塞在一张两行的卡片里等于没说。
 *
 * 设计稿上还有一句「今天她说」。**这里没有** —— 那份数据不存在：
 * 现在唯一的每日一句是 `/v1/villagers/:id/reading`（问签），
 * 而设计把「今天她说」（免费）与「问问她」（¥49）分成两件事。
 * 把问签冒充成每日一句，等于把要收钱的东西白送、还把设计里的两层压成一层。
 * 缺就说缺，不拿别的顶上。
 */

import { villageApi } from '../../services/village'
import { 脸 } from '../../utils/face'
import { commerceApi } from '../../services/commerce'
import type { ApiError } from '../../services/api'
import type { VillagerInVillage } from '../../types/village'
import { 一句 } from '../../utils/say'
import { money } from '../../utils/money'

/* 哪几间房搬进来了 —— 由 engine/rooms/index.js 报，不在这手写一份。
   手写的话：rooms/ 那边新做一间房，这里忘了加，那间房永远进不去而且不报错。
   （村主屏里同一段注释，同一个理由。） */
declare const ROOM_INDEX: string[]
const hasRoom = (id: string) =>
  typeof ROOM_INDEX !== 'undefined' && ROOM_INDEX.indexOf(id) >= 0

interface IData {
  id: string
  loading: boolean
  err: string
  who: (VillagerInVillage & { face?: string }) | null
  /** 头像那一段 style。画好脸的人是 background-image，没画好的是空串 */
  脸样: string
  /** 有没有搬进小程序的屋子 —— 没有就不给「去他家坐坐」这颗按钮 */
  canEnter: boolean
  /** 他卖着东西吗（设计册 10.8：东西长在卖它的人身上） */
  sells: boolean
  sellsLabel: string
  sellsProduct: string
  /** 找他的御守时那一行字 */
  say: string
  /** 请他回村要多少钱 —— 「¥99」这样一个字符串，取不到是空串。
   *  按钮上必须写它:一个没用过的人，不知道按下去是马上扣钱还是先看看，
   *  于是干脆不按（五路评审里三路把这条列成第一个不敢按的理由）。 */
  价: string
  /** 请不回来时按钮上那句话。空串 = 请得回来。
   *  这句话里有「御守」两个字，而【挂着人不等于是御守】——
   *  香也挂着苏合。所以这句只在筛过 `fulfillment_kind === 'residency'`
   *  之后才拼得出来，跟那个判断写在同一处（门禁 check-omamori-sense）。 */
  请不来: string
  inviting: boolean
  asking: boolean
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { id: '', loading: true, err: '', who: null, canEnter: false, say: '', inviting: false, asking: false,
    价: '', 请不来: '',
    脸样: '',
          sells: false, sellsLabel: '', sellsProduct: '' },

  onLoad(q: Record<string, string | undefined>) {
    this.setData({ id: q.id || '' })
  },

  /* 无条件取，不拿 token 当守卫 —— 跟村主屏一致。
     带守卫的写法在【还没登录】时什么都不做，页面就一直停在「取着……」，
     而逐页扫只看有没有报错，于是空着也算过（2026-08-23 假服务端上抓到）。
     没登录就让它 401，页面照实说取不到；`onAuthReady` 落下来再取一次。 */
  onShow() {
    this.load()
  },

  onAuthReady() {
    this.load()
  },

  async load() {
    const { id } = this.data
    if (!id) {
      this.setData({ loading: false, err: '没说是哪一位' })
      return
    }
    this.setData({ loading: true, err: '' })
    try {
      const v = await villageApi.mine()
      const who = v.villagers.find((x) => x.id === id) || null
      if (!who) {
        this.setData({ loading: false, err: '村里没有这一位' })
        return
      }
      this.setData({
        loading: false,
        // 头像占位:姓名末字。等 40 张画好换这一行，版式不用动
        who: { ...who, face: who.name.slice(-1) },
        脸样: 脸(who.id),
        canEnter: who.at_home && hasRoom(id),
        /* 他卖的东西，入口在他这儿。**要先请回家** ——
           人都还没来，摊子就不该摆在这儿。 */
        sells: !!(who.at_home && who.sells),
        sellsLabel: who.sells ? who.sells.name : '',
        sellsProduct: who.sells ? who.sells.product_id : '',
      })
      wx.setNavigationBarTitle({ title: who.name })
      if (!who.at_home) this.取价(id)
    } catch (e) {
      this.setData({ loading: false, err: '取不到：' + (一句(e as { status?: number; message?: string })) })
    }
  },

  /* 请他回村要多少钱。**在按钮上写出来，不等点进去才说。**
     价钱是列表接口给的（`from_price_minor` = 这件商品最便宜那一档），
     跟详情页同一套 region/platform 生效规则，不是页面自己算的。

     取不到分两种，说法不一样:
       · 一件都没有 → 「御守还没上架」，按钮变灰，别让人白点一趟
       · 有商品但没价 → 只写「请 X 回村」，不编一个数字出来
     这两种都不该拿别人的价顶上 —— 价钱写错一次，后面写什么都没人信。 */
  取价(id: string) {
    commerceApi.products('omamori', id).then(
      (all) => {
        if (this.data.id !== id) return          // 翻页翻快了，别把上一位的价贴上来
        /* 【挂着人 ≠ 是御守】。香也挂着苏合（`sku.villager_id`），
           但买香是寄一盒香给你，不是请她搬进来。判据是会不会有人住进村里
           —— `fulfillment_kind === 'residency'`，不是分类叫 omamori。 */
        const list = all.filter((x) => x.fulfillment_kind === 'residency')
        if (!list.length) {
          const 谁 = this.data.who ? this.data.who.name : '他'
          this.setData({ 请不来: 谁 + '的御守还没上架' })
          return
        }
        const 分 = list[0].from_price_minor
        if (typeof 分 !== 'number') return
        /* 【格式化只有一支】:`utils/money.ts` 的 `money()`。
           这里原先自己抄了一份 —— 非 CNY 不写符号，JPY 还会被多除一次 100
           （日元没有分）。库里 region=cn 有 202 个 sku 同时挂着两种币的在售价，
           显示什么币种是数据说了算，不是代码说了算。 */
        this.setData({ 价: money(分, list[0].from_currency || 'CNY') })
      },
      () => {},                                   // 取不到价就不写价，页面照常
    )
  },

  /* 问签。注意它不是起卦 —— 起卦是罗盘（`pages/ask`，naji），
     问签是【向某一位】要一句话（`/v1/villagers/:id/reading`）。
     两件事，两条接口，别互相顶替。 */
  onAsk() {
    const { id, who } = this.data
    if (!id) return
    this.setData({ asking: true, say: '' })
    villageApi.ask(id).then(
      (r) => this.setData({ asking: false, say: r.say }),
      (e) => {
        /* 没请回家是 **404 不是 403** —— 那不是权限检查，是设定：御守是入住凭证。
           所以照状态码判，不去猜错误文案（文案会改，状态码是契约）。 */
        const err = e as ApiError
        this.setData({
          asking: false,
          say: '',
          err: err.status === 404
            ? (who ? who.name : '他') + '还没住进你的村子'
            : (一句(err)),
        })
      },
    )
  },

  goSells() {
    if (this.data.sellsProduct) {
      wx.navigateTo({ url: '/pages/incense/index?id=' + this.data.sellsProduct })
    }
  },

  onEnter() {
    wx.navigateTo({ url: '/pages/room/index?room=' + this.data.id })
  },

  /* 没请回来的那位：直接找他的御守（`sku.villager_id` 绑着人）。
     四十位里只有几位有御守在卖，找不到就照实说，不拿别人的顶上。 */
  goInvite() {
    const { id } = this.data
    if (!id) return
    this.setData({ inviting: true, say: '' })
    commerceApi.products('omamori', id).then(
      (list) => {
        this.setData({ inviting: false })
        if (!list.length) {
          this.setData({ say: '他的御守还没上架' })
          return
        }
        wx.navigateTo({ url: '/pages/product/index?id=' + list[0].id })
      },
      () => this.setData({ inviting: false, say: '一时找不到他的御守' }),
    )
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
