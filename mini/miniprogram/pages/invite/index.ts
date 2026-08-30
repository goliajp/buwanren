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
import { 轻 } from '../../utils/feel'
import { 一句 } from '../../utils/say'

/** 一页五位。设计（product-v1.html 10.3）：横向翻页代替竖向滚动 ——
 *  她不是在比价，是在挑人，一次看五个正好。 */
const 每页 = 5

interface IData {
  loading: boolean
  err: string
  items: Array<{ id: string; name: string; sub: string; onSale: boolean; product: string | null; face: string; lack: string; direction: string }>
  /** 当前这一页的五位。渲染只认它 —— items 全渲会把一屏撑成五万像素 */
  page: Array<{ id: string; name: string; sub: string; onSale: boolean; product: string | null; face: string; lack: string; direction: string }>
  pageNo: number
  pageCount: number
  /** 这一页一位都请不动（全还没上架），而别处有在卖的 —— 那就得给条出路 */
  这页请不动: boolean
  /** 「你缺的」那一行。取不到就空着 —— 它是理由，不是门槛 */
  lack: string
  /** 取用神失败与「还没建本命」是两件事，分开说 */
  lackErr: string
  /** 为什么是这几位 —— 后端给的那条理由。没按用神排过就是空的 */
  why: string
  /** 只看在卖的（设计册 V4 弹性槽）。默认关着 —— 四十位都列出来是刻意的 */
  onlyOnSale: boolean
  /** 在卖的有几位。0 就不摆那一条：没得挑时给一个筛选是句空话 */
  saleCount: number
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { loading: true, err: '', items: [], page: [], pageNo: 0, pageCount: 0, lack: '', lackErr: '', why: '', onlyOnSale: false, saleCount: 0, 这页请不动: false },

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

  /* 先问用神，再取名册。
     两件事并行看着快一点，但那样名册是【没按用神排过】的，而顶上那句
     「你缺 X，下面这几位跟你补得上」照样会说出来 —— 说了一个还没发生的因果。
     慢那一个来回，换这一屏说的话是真的。 */
  async load() {
    this.setData({ loading: true, err: '' })
    const 用神 = await this.loadLack()
    villageApi.all(用神).then(
      (list: VillagerCard[]) => {
        /* 顺序由后端定 —— 按用神排要用 `lack_bias` × `yongshen_bias`
           两张表，那是领域判断，不该在页面里抄一份（抄一份就会漂）。
           不传用神时它退回原来的规矩：在卖的排前面，再按 id。 */
        this.setData({
          loading: false,
          /* 顶上那句的理由，用【头一位的】那条 —— 它是主方向那一条。
             没按用神排过时后端给 null，这一句就不说（设计册 10.8）。 */
          why: (list[0] && list[0].why) || '',
          saleCount: list.filter((v) => v.omamori_product_id).length,
          items: list.map((v) => ({
            id: v.id,
            name: v.name,
            sub: [v.title, v.art].filter(Boolean).join(' · '),
            onSale: !!v.omamori_product_id,
            product: v.omamori_product_id,
            // 头像占位:姓名末字。等 40 张画好换成图片地址,版式不动
            face: v.name.slice(-1),
            lack: v.lack || '',
            // 头像底色按方向分 —— 四十位一个颜色时分不出谁是谁
            direction: v.direction || '',
          })),
        })
        this.gotoPage(0)
      },
      (e) => this.setData({ loading: false, err: '取不到：' + (一句(e)) }),
    )
  },

  /** 这一趟看得见的那些。开着「只看在卖的」就只剩能请的几位 */
  看得见() {
    const { items, onlyOnSale } = this.data
    return onlyOnSale ? items.filter((x) => x.onSale) : items
  },

  onToggleOnSale() {
    this.setData({ onlyOnSale: !this.data.onlyOnSale }, () => this.gotoPage(0))
  },

  gotoPage(n: number) {
    const items = this.看得见()
    const count = Math.max(1, Math.ceil(items.length / 每页))
    const no = Math.min(Math.max(0, n), count - 1)
    const 这一页 = items.slice(no * 每页, no * 每页 + 每页)
    /* 这一页一个都请不动的时候要说一声。
       排序本身是诚实的（先按你缺的方向排，同方向里在卖的靠前），
       但「跟你最补得上的那几位恰好都还没上架」是真会发生的:
       填完生辰回到这儿，第一页五位全是灰的「还没来」，一个点不动。
       出口其实一直有（「只看在卖的」），可它在弹性槽里 ——
       而矮屏（iPhone SE 就是）正是把弹性槽收起来的那一档，
       于是唯一能救这一屏的控件在参考机型上看不见。
       这一条不进弹性槽，且只在真的卡住时出现。 */
    this.setData({
      pageNo: no,
      pageCount: items.length ? count : 0,
      page: 这一页,
      这页请不动: 这一页.length > 0 && !这一页.some((x: { onSale: boolean }) => x.onSale)
        && !this.data.onlyOnSale && this.data.saleCount > 0,
    })
  },

  onPrev() { this.gotoPage(this.data.pageNo - 1) },
  onNext() { this.gotoPage(this.data.pageNo + 1) },

  /* 顶上那句「你缺 X，这几位跟你补得上」。
     没本命就不说这句 —— 不编一个理由出来。 */
  /** 返回用神（五行单字）—— 名册要按它排，所以取回来给调用方 */
  async loadLack(): Promise<string | undefined> {
    const nid = getApp<IAppOption>().globalData.activeNatalId
    if (!nid) {
      this.setData({ lack: '', lackErr: '' })
      return undefined
    }
    try {
      const s = await natalApi.summary(nid)
      this.setData({ lack: s.primary_yongshen, lackErr: '' })
      return s.primary_yongshen || undefined
    } catch (e) {
      const err = e as ApiError
      if (err.status === 404 || err.status === 403) {
        this.setData({ lack: '', lackErr: '' })
      } else {
        // 取不到用神不该让整页失败 —— 挑人这件事不依赖它
        this.setData({ lack: '', lackErr: '一时取不到你缺的那一样' })
      }
      // 取不到用神就不按它排 —— 名册照原来的规矩来，那句话也就不说
      return undefined
    }
  },

  onTap(e: WechatMiniprogram.BaseEvent) {
    轻()
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
