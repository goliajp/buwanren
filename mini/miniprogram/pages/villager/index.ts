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
import { commerceApi } from '../../services/commerce'
import type { ApiError } from '../../services/api'
import type { VillagerInVillage } from '../../types/village'

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
  who: VillagerInVillage | null
  /** 有没有搬进小程序的屋子 —— 没有就不给「去他家坐坐」这颗按钮 */
  canEnter: boolean
  /** 找他的御守时那一行字 */
  say: string
  inviting: boolean
  asking: boolean
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { id: '', loading: true, err: '', who: null, canEnter: false, say: '', inviting: false, asking: false },

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
        who,
        canEnter: who.at_home && hasRoom(id),
      })
      wx.setNavigationBarTitle({ title: who.name })
    } catch (e) {
      this.setData({ loading: false, err: '取不到：' + ((e as ApiError).message || '未知错误') })
    }
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
            : (err.message || '问签失败'),
        })
      },
    )
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
