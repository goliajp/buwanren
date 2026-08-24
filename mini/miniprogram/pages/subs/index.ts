/* 订着的 —— 正在续的服务。
 *
 * 为什么现在才有这一页（docs/REDESIGN.md：R3 顺手拽进来的 M5）：
 * 「我的 → 订」原先没有自己的一页，点它去铺里看订阅类商品 ——
 * **没有的时候，出口就是「去哪儿能有」**。铺删掉之后那个出口断了，
 * 所以这一页必须跟着铺一起做，不能等 R5。
 *
 * 空状态是这一页的主设计：空不是问题，说不清哪儿能有才是。
 */

import { commerceApi } from '../../services/commerce'
import { mineApi } from '../../services/mine'
import type { ApiError } from '../../services/api'
import type { ProductCard } from '../../types/commerce'
import type { Subscription } from '../../types/mine'

interface IData {
  loading: boolean
  err: string
  subs: Subscription[]
  /** 空的时候摆出来的出口：村里现在有什么可以订 */
  offers: ProductCard[]
  offersErr: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { loading: true, err: '', subs: [], offers: [], offersErr: '' },

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
    this.setData({ loading: true, err: '' })
    try {
      const list = await mineApi.subscriptions()
      this.setData({ loading: false, subs: list })
      if (!list.length) this.loadOffers()
    } catch (e) {
      // 取不到订阅，跟「一个都没订」是两件事 —— 后者才该出空状态
      this.setData({ loading: false, err: '取不到：' + ((e as ApiError).message || '未知错误') })
    }
  },

  /* 出口那一半单独取。它失败不该让整页失败 ——
     「你订着两个」这件事跟「还能订什么」不互为前提。 */
  loadOffers() {
    commerceApi.products('service').then(
      (list) => this.setData({ offers: list, offersErr: '' }),
      () => this.setData({ offers: [], offersErr: '一时取不到能订的' }),
    )
  },

  onTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (id) wx.navigateTo({ url: '/pages/product/index?id=' + id })
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/me/index' }) } })
  },
})
