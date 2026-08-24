/* 谁能来 —— 挑一位不完人请回家。
 *
 * 它替掉了「铺」（docs/REDESIGN.md R3）。差别不在换个名字：
 * 铺是按 category 分栏的目录，谁都能有；这一页只干一件事 ——
 * 把「还能请谁」摆出来。东西长在卖它的人身上，所以入口是人，不是货架。
 *
 * 只列真的请得来的那几位。设计稿里还画了「未上架」的那些，
 * 但那跟既有设定冲突（`scripts/orphan-routes.json` 记着：
 * 「还没请回来的人连名字都不该知道」）—— 露出多少是产品决定，不在这里改。
 *
 * 顺带：`/v1/products` 的调用方从铺移到了这里。铺删掉之后它不会变成孤儿。
 */

import { commerceApi } from '../../services/commerce'
import { natalApi } from '../../services/natal'
import type { ApiError } from '../../services/api'
import type { ProductCard } from '../../types/commerce'

/** 一页五位。设计（product-v1.html 10.3）：横向翻页代替竖向滚动 ——
 *  她不是在比价，是在挑人，一次看五个正好。 */
const 每页 = 5

interface IData {
  loading: boolean
  err: string
  items: ProductCard[]
  /** 当前这一页的五位。渲染只认它 —— items 全渲会把一屏撑成五万像素 */
  page: ProductCard[]
  pageNo: number
  pageCount: number
  /** 「你缺的」那一行。取不到就空着 —— 它是理由，不是门槛 */
  lack: string
  /** 取用神失败与「还没建本命」是两件事，分开说 */
  lackErr: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { loading: true, err: '', items: [], page: [], pageNo: 0, pageCount: 0, lack: '', lackErr: '' },

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

  load() {
    this.loadLack()
    this.setData({ loading: true, err: '' })
    commerceApi.products('omamori').then(
      (list) => {
        this.setData({ loading: false, items: list })
        this.gotoPage(0)
      },
      (e) => this.setData({ loading: false, err: '取不到：' + ((e as ApiError).message || '未知错误') }),
    )
  },

  gotoPage(n: number) {
    const { items } = this.data
    const count = Math.max(1, Math.ceil(items.length / 每页))
    const no = Math.min(Math.max(0, n), count - 1)
    this.setData({
      pageNo: no,
      pageCount: items.length ? count : 0,
      page: items.slice(no * 每页, no * 每页 + 每页),
    })
  },

  onPrev() { this.gotoPage(this.data.pageNo - 1) },
  onNext() { this.gotoPage(this.data.pageNo + 1) },

  /* 顶上那句「你缺 X，这几位跟你补得上」。
     没本命就不说这句 —— 不编一个理由出来。 */
  async loadLack() {
    const nid = getApp<IAppOption>().globalData.activeNatalId
    if (!nid) {
      this.setData({ lack: '', lackErr: '' })
      return
    }
    try {
      const s = await natalApi.summary(nid)
      this.setData({ lack: s.primary_yongshen, lackErr: '' })
    } catch (e) {
      const err = e as ApiError
      if (err.status === 404 || err.status === 403) {
        this.setData({ lack: '', lackErr: '' })
      } else {
        // 取不到用神不该让整页失败 —— 挑人这件事不依赖它
        this.setData({ lack: '', lackErr: '一时取不到你缺的那一样' })
      }
    }
  },

  onTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (id) wx.navigateTo({ url: '/pages/product/index?id=' + id })
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
