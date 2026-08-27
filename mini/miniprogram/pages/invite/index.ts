/* 谁能来 —— 挑一位不完人请回家。
 *
 * 它替掉了「铺」（docs/REDESIGN.md R3）。差别不在换个名字：
 * 铺是按 category 分栏的目录，谁都能有；这一页只干一件事 ——
 * 把「还能请谁」摆出来。东西长在卖它的人身上，所以入口是人，不是货架。
 *
 * **四十位都列出来**，在卖的能点、没上架的写「未上架」（设计册 10.8）。
 * 只列在卖的那几位，读的人会以为世上只有那几位 —— 那正是它说的「拿别人顶上」。
 *
 * 这跟「还没请回来的人连名字都不该知道」不冲突，两者作用域不同：
 * 那一条管的是【你的村子那一格】（空屋不说是谁），而这是目录，
 * 四十位是公开的事实（设计册 11：官网放四十位档案）。
 * 2026-08-27 拍板，同时把 `scripts/orphan-routes.json` 里 `village.all`
 * 那条孤儿划掉 —— 名册就是从那条来的。
 *
 * 顺带：`/v1/products` 的调用方从铺移到了这里。铺删掉之后它不会变成孤儿。
 */

import { villageApi } from '../../services/village'
import { natalApi } from '../../services/natal'
import type { ApiError } from '../../services/api'
import type { VillagerCard } from '../../types/village'

/** 一页五位。设计（product-v1.html 10.3）：横向翻页代替竖向滚动 ——
 *  她不是在比价，是在挑人，一次看五个正好。 */
const 每页 = 5

interface IData {
  loading: boolean
  err: string
  items: Array<{ id: string; name: string; sub: string; onSale: boolean; product: string | null }>
  /** 当前这一页的五位。渲染只认它 —— items 全渲会把一屏撑成五万像素 */
  page: Array<{ id: string; name: string; sub: string; onSale: boolean; product: string | null }>
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
    villageApi.all().then(
      (list: VillagerCard[]) => {
        /* 在卖的排前面。**不是把没上架的藏起来** —— 它们照样在册上，
           只是排在后面：一页五位，前几页是真能请的，翻下去是还没上架的。 */
        const 排 = [...list].sort((a, b) => {
          const s = (v: VillagerCard) => (v.omamori_product_id ? 0 : 1)
          return s(a) - s(b) || a.id.localeCompare(b.id)
        })
        this.setData({
          loading: false,
          items: 排.map((v) => ({
            id: v.id,
            name: v.name,
            sub: [v.title, v.art].filter(Boolean).join(' · '),
            onSale: !!v.omamori_product_id,
            product: v.omamori_product_id,
          })),
        })
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
    const 那位 = this.data.items.find((x) => x.id === id)
    /* 没上架的点不动。**不是点了再说「买不了」** —— 那是先答应再反悔；
       行上已经写着「未上架」，它就该按不动。 */
    if (那位 && 那位.onSale && 那位.product) {
      wx.navigateTo({ url: '/pages/product/index?id=' + 那位.product })
    }
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
