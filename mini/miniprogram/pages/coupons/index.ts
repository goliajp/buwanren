/* 手里的券。
 *
 * 【在这一页之前，用户那一侧看不见任何一张券】。后台一直发得出绑人的券
 * （`POST /admin/commerce/coupons` 收 `owner_user_id`），库里那一列从建库
 * 起就是为「这一张是谁的」留的 —— 而客户端唯一跟券有关的东西是确认页上
 * 那个「有券码就填这儿」的格子，也就是**他得先知道那串码**。
 *
 * 后果：运营给一位用户补一张券，用户打开 app 什么都看不到。券要另外找
 * 一条路送到他眼前（短信 / 客服 / 二维码），而那条路一断，这张券就等于没发。
 *
 * 「能不能用」是后端算的（`GET /v1/coupons` 的 `usable` / `why`），
 * 这一屏不另算一遍：那要问券的状态、活动的有效期与预算，而屏上写着
 * 「能用」下单却被拒，比不显示更糟 —— 人是看到「能用」之后才按的付款。
 */

import { commerceApi } from '../../services/commerce'
import type { MyCoupon } from '../../types/commerce'
import { 一句 } from '../../utils/say'
import { 轻 } from '../../utils/feel'
import { 券面那句话 } from '../../utils/money'
import { 那一天 } from '../../utils/day'

/* 卡片下面那半行。同一个 `expires_at`，能用的和不能用的说的是两件事：
   能用的关心「还剩几天」，用掉的关心「用在哪一天」，
   而用不了的那些，该说的是**为什么** —— 日子那时候不重要。 */
function 说什么(c: MyCoupon): string {
  if (!c.usable) return c.why
  const 到 = 那一天(c.expires_at)
  if (!到) return ''
  const 还剩 = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000)
  /* 【快过期的要说天数】。「2026年9月8日 到期」得让人自己算今天几号，
     而这张券的全部要紧之处就是那个数。三天以内直接说剩几天 */
  if (还剩 <= 3) return 还剩 <= 1 ? '今天就过期' : `还剩 ${还剩} 天`
  return `${到} 到期`
}

interface IData {
  loading: boolean
  err: string
  /** `面 / 说` 是屏上那两样 —— wxml 里调不了函数，在这儿算好 */
  券: Array<MyCoupon & { 面: string; 说: string }>
  /** 副标题。「3 张 · 2 张能用」——「有几张」跟「能用几张」是两件事 */
  说明: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { loading: true, err: '', 券: [], 说明: '' },

  /* 无条件取，不拿 token 当守卫 —— 跟别的几屏一致。
     带守卫的写法在还没登录时什么都不做，页面一直停在「取着……」，
     而逐页扫只看有没有报错，于是空着也算过。 */
  onShow() { this.load() },
  onAuthReady() { this.load() },

  async load() {
    this.setData({ loading: true, err: '' })
    try {
      const list = await commerceApi.coupons()
      const 能用 = list.filter((x) => x.usable).length
      this.setData({
        loading: false,
        券: list.map((x) => ({ ...x, 面: 券面那句话(x), 说: 说什么(x) })),
        说明: list.length
          ? (能用 ? `${list.length} 张 · ${能用} 张能用` : `${list.length} 张 · 都用不了了`)
          : '还没有',
      })
    } catch (e) {
      this.setData({ loading: false, err: 一句(e as Parameters<typeof 一句>[0]) })
    }
  },

  /* 【券得有地方花】。一张能用的券，这一屏能给的最有用的东西就是
     「哪儿能花掉它」—— 券不绑商品，所以指向村子，那是所有东西的入口。 */
  goVillage() { 轻(); wx.switchTab({ url: '/pages/village/index' }) },

  goOrder(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (!id) return
    轻()
    wx.navigateTo({ url: '/pages/order/index?id=' + id })
  },

  onBack() { wx.navigateBack({ delta: 1 }) },
})
