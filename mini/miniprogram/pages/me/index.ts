/**
 * M1 · 我的。
 *
 * 设计册 10.4 的 M1 就五条入口 + 一句话 + 最近一笔 + 弹性槽。
 * 这一屏原先还背着授权卡（372px）、账号明细折叠、退出并重新登录 ——
 * 那三块是**账号**的事，不是「我」的事，且授权卡一块就吃光了这一屏
 * 全部的纵向富余（台账记着超 230px）。2026-08-25 全部搬进「设置 ›」。
 */
import { storage } from '../../services/storage'
import { mineApi } from '../../services/mine'
import { commerceApi } from '../../services/commerce'
import { 状态说法 } from '../../utils/money'
import type { OrderCard, TraceEvent } from '../../types/commerce'

interface Recent {
  id: string
  title: string
  when: string
  state: string
}

interface IData {
  nickname: string
  orderText: string
  badgeText: string
  subText: string
  /** 有单子时的那一笔；没有就是 null */
  recent: Recent | null
  /** 真的一笔都没有（区别于「还没取到」——后者不该显示「还没买过什么」） */
  recentEmpty: boolean
  /** 取不到时说一句。空着跟「没有」看起来一样，那就等于骗人 */
  recentNote: string
  /** 弹性槽：最近一笔的最新一条轨迹。取不到就整块不出现 */
  nextStop: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    nickname: '',
    orderText: '',
    badgeText: '',
    subText: '',
    recent: null,
    recentEmpty: false,
    recentNote: '',
    nextStop: '',
  },

  onShow() {
    this.pull()
    if (storage.getToken()) this.loadMine()
  },

  /* 匿名登录是异步的：冷启动时 onShow 会抢在 token 之前跑，
     拿一串 401 之后再也不重取。app 拿到身份会广播这个。 */
  onAuthReady() {
    this.pull()
    this.loadMine()
  },

  pull() {
    const app = getApp<IAppOption>()
    const user = app.globalData.user
    this.setData({ nickname: (user && user.nickname) || '过客' })
  },

  goName() { wx.navigateTo({ url: '/pages/name/index' }) },
  goOrders() { wx.navigateTo({ url: '/pages/orders/index' }) },
  goBadges() { wx.navigateTo({ url: '/pages/badges/index' }) },
  goSubs() { wx.navigateTo({ url: '/pages/subs/index' }) },
  goSettings() { wx.navigateTo({ url: '/pages/settings/index' }) },
  goVillage() { wx.switchTab({ url: '/pages/village/index' }) },

  goRecent() {
    const r = this.data.recent
    if (r) wx.navigateTo({ url: '/pages/order/index?id=' + r.id })
  },

  loadMine() {
    /* 顺便问一次服务端我是谁 —— globalData 里那份是登录那一刻的快照，
       在「名字」那一屏改过之后它就旧了。取不到就用手里那份，不空屏，
       但**说一句**：不说的话「服务端说我叫这个」跟「问不到」没有区别。 */
    mineApi.me().then(
      (u) => {
        const app = getApp<IAppOption>()
        app.globalData.user = u
        storage.setUser(u)
        this.setData({ nickname: u.nickname || '过客' })
      },
      (e: { message?: string }) => console.warn('取不到我是谁，显示的是登录时那一份：', e && e.message),
    )

    mineApi.badges().then(
      (list) => {
        const got = list.filter((b) => b.earned).length
        this.setData({ badgeText: got + ' / ' + list.length + ' 枚徽章' })
      },
      () => this.setData({ badgeText: '看不到' }),
    )

    mineApi.subscriptions().then(
      (list) => this.setData({ subText: list.length ? list.length + ' 个订着' : '还没有' }),
      () => this.setData({ subText: '看不到' }),
    )

    commerceApi.orders().then(
      (page) => {
        const items = page.items || []
        this.setData({
          orderText: page.total ? page.total + ' 笔' : '还没有',
          recentEmpty: items.length === 0,
        })
        if (!items.length) { this.setData({ recent: null }); return }
        const o: OrderCard = items[0]
        this.setData({
          recent: {
            id: o.id,
            /* 名字来自下单那一刻的 sku 快照（后端 my_orders 的 title）。
               取不到就报单号前八位 —— 那是我们真知道的东西，
               编一个「一件商品」出来会让人以为系统知道它是什么。 */
            title: o.title
              ? (o.line_count > 1 ? o.title + ' 等 ' + o.line_count + ' 件' : o.title)
              : '单 ' + o.id.slice(0, 8),
            when: (o.created_at || '').slice(5, 10).replace('-', '/') + ' 下单',
            state: 状态说法[o.status] || o.status,
          },
        })
        this.loadNextStop(o)
      },
      (e: { message?: string }) => this.setData({
        recent: null, recentEmpty: false, orderText: '看不到',
        recentNote: e && e.message ? e.message : '取不到单子',
      }),
    )
  },

  /* 弹性槽：最近一笔的最新一条轨迹（设计册 M1 的「下一站」）。
     只有已付之后才可能有包裹，所以先按状态挡一道，不给每个人白打两条接口。
     **取不到就整块不出现** —— 弹性槽本来就是「删掉这一屏仍然成立」的那一块。 */
  loadNextStop(o: OrderCard) {
    if (['draft', 'unpaid', 'cancelled'].indexOf(o.status) >= 0) return
    commerceApi.shipments(o.id).then(
      (list) => {
        const s = list && list[0]
        if (!s) return
        commerceApi.trace(o.id, s.id).then(
          (t) => {
            const ev: TraceEvent | undefined = (t.trace || [])[0]
            if (!ev) return
            const when = (ev.event_at || '').replace('T', ' ').slice(5, 16)
            const where = ev.location || ev.description || ''
            this.setData({ nextStop: (when + '　' + where).trim() })
          },
          () => { /* 轨迹取不到，槽不出现。这一屏没有它照样成立 */ },
        )
      },
      () => { /* 没有包裹或取不到，同上 */ },
    )
  },
})
