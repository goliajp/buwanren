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
import { natalApi } from '../../services/natal'
import { commerceApi } from '../../services/commerce'
import { activityApi } from '../../services/activity'
import type { ApiError } from '../../services/api'
import { 一句 } from '../../utils/say'
import { money, 状态那一词, 该做什么 } from '../../utils/money'
import type { OrderCard, TraceEvent } from '../../types/commerce'
import { 台账那天 } from '../../utils/day'

interface Recent {
  id: string
  title: string
  when: string
  state: string
  /** 右边那个动作词。待付的单子该「去付」，不是「看」 */
  go: string
}

interface IData {
  nickname: string
  /** 出生时间那一行的右侧:「已填 · 三份」/「还没填」。
   *  【2026-09-01】这一行原先【不存在】—— 而建档那一屏自己写着
   *  「留几份、随时换」「问清楚了再建一份准的换过来」，
   *  那句话在界面上没有兑现的地方:填完之后，再也回不去了。 */
  natalText: string
  orderText: string
  /** 说明书那一行说什么。买过就是「打得开」，没买过就是价钱；空串 = 不摆这一行 */
  bookText: string
  /** 买过的那一单 id。空串 = 还没买过，那一行通到商品页 */
  bookOrder: string
  badgeText: string
  subText: string
  /** 「三场可去」/ 空串。空串时那一行不摆 —— 见下面 `hasActs` 的理由 */
  actText: string
  /** 「2 张能用」/「3 张 · 都用不了了」。手里一张都没有时那一行不摆 */
  couponText: string
  hasCoupons: boolean
  /** 真订着东西没有。没有就不摆那一行 —— 空的那一屏只会说产品没做完 */
  hasSubs: boolean
  hasActs: boolean
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
    natalText: '',
    orderText: '',
    /** 说明书那一行说什么。买过就是「打开」，没买过就是价钱 */
    bookText: '',
    /** 买过的那一单 id。空串 = 还没买过，那一行通到商品页 */
    bookOrder: '',
    badgeText: '',
    subText: '',
    actText: '',
    couponText: '',
    hasCoupons: false,
    hasSubs: false,
    hasActs: false,
    recent: null,
    recentEmpty: false,
    recentNote: '',
    nextStop: '',
  },

  onShow() {
    this.pull()
    if (storage.getToken()) { this.loadMine(); this.取出生时间() }
  },

  /* 匿名登录是异步的：冷启动时 onShow 会抢在 token 之前跑，
     拿一串 401 之后再也不重取。app 拿到身份会广播这个。 */
  onAuthReady() {
    this.pull()
    this.loadMine()
    this.取出生时间()
  },

  pull() {
    const app = getApp<IAppOption>()
    const user = app.globalData.user
    this.setData({ nickname: (user && user.nickname) || '新来的' })
  },

  goName() { wx.navigateTo({ url: '/pages/name/index' }) },

  goNatal() { wx.navigateTo({ url: '/pages/natal/index' }) },

  /* 有几份出生时间。**取不到就不写**，不写「还没填」——
     那两种在屏上长得一样，而一个填过的人看见「还没填」会以为自己的没了。 */
  取出生时间() {
    natalApi.list().then(
      (l) => this.setData({ natalText: l.length ? (l.length > 1 ? `${l.length} 份` : '已填') : '还没填' }),
      () => this.setData({ natalText: '' }),
    )
  },
  goOrders() { wx.navigateTo({ url: '/pages/orders/index' }) },
  /* 【¥199 那一件，填完生辰之后从整个 app 里消失】（2026-09-06 三路验证 ·
     第一次打开的人）。通往商品页的路全仓只有四条，而说明书唯一那条是
     摇卦之后的推荐位 —— `ai_compose.rs` 里 `has_natal` 为真时
     候选类目只剩御守与配饰（那是**有理由的**产品决定，见那一段注释）。
     于是链路成了:没填生辰 → 推荐说明书；填了生辰（而 app 到处都在催你填）
     → 说明书再也找不到在哪儿卖。

     而说明书自己最后一页写着「这一册一直在「我的」里」——
     「我的」那八行里没有一行叫说明书。两头都缺，补在同一处:
     买过的打得开，没买过的通到那一件。 */
  goBook() {
    if (this.data.bookOrder) {
      wx.navigateTo({ url: '/pages/order/index?id=' + this.data.bookOrder })
      return
    }
    wx.navigateTo({ url: '/pages/product/index?id=prod-naji-deep' })
  },
  goBadges() { wx.navigateTo({ url: '/pages/badges/index' }) },
  goSubs() { wx.navigateTo({ url: '/pages/subs/index' }) },
  goActivity() { wx.navigateTo({ url: '/pages/activity/index' }) },
  goCoupons() { wx.navigateTo({ url: '/pages/coupons/index' }) },
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
        this.setData({ nickname: u.nickname || '新来的' })
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

    /* 【门闩挑错了变量】。这一行原先只在「你订过东西」时出现，
       而「订着的」那一屏的空状态【正是唯一在卖订阅的地方】——
       两个条件互为反面:订过的人才进得去，而他们进去之后
       `loadOffers()` 永远不跑;没订过的人根本进不去
       （2026-09-01 五路评审 · 工程审计）。
       该看的是【村里有没有可订的】，不是「你订过没有」。
       两样都取不到就不摆这一行 —— 那时它确实无处可去。 */
    /* 【真有场次才摆这一行】——跟「订着的」同一条规矩。
       活动是线下办的，没有的时候点进去只会说「这阵子没有活动」，
       而它跟另外几行并排挂着，会把那几行的可信度一起拉低。
       这一页的规矩是:一行要么通向一件真事，要么不在。 */
    activityApi.list().then(
      (场次) => this.setData({
        actText: 场次.length ? 场次.length + ' 场可去' : '',
        hasActs: 场次.length > 0,
      }),
      () => this.setData({ actText: '', hasActs: false }),
    )

    /* 【手里真有券才摆那一行】——跟「订着的」「去得了的」同一条规矩:
       一行要么通向一件真事，要么不在。
       用不了的券也算「有」:过期的、用掉的仍然是他的台账，
       而藏起来的话，运营说「给你发了」而他屏上什么都没有 ——
       那正是这一整条链要修的那件事。 */
    commerceApi.coupons().then(
      (券) => {
        const 能用 = 券.filter((x) => x.usable).length
        this.setData({
          couponText: 券.length ? (能用 ? 能用 + ' 张能用' : 券.length + ' 张 · 都用不了了') : '',
          hasCoupons: 券.length > 0,
        })
      },
      () => this.setData({ couponText: '', hasCoupons: false }),
    )

    Promise.all([
      mineApi.subscriptions().catch(() => null),
      commerceApi.subscribable().catch(() => []),
    ]).then(([list, 能订的]) => {
      if (!list) { this.setData({ subText: '看不到' }); return }
      this.setData({
        subText: list.length ? list.length + ' 个订着' : (能订的.length ? '还没有' : ''),
        hasSubs: list.length > 0 || 能订的.length > 0,
      })
    })

    commerceApi.orders().then(
      (page) => {
        const items = page.items || []
        this.setData({
          orderText: page.total ? page.total + ' 笔' : '还没有',
          recentEmpty: items.length === 0,
        })
        /* 说明书那一行:买过就打得开那一单，没买过就说它多少钱。
           判据是【下单那一刻的快照名】里有没有「说明书」——
           跟这一列别处一样，不 join 现在的商品表:
           商品改了名、下了架，单子上写的还该是当时买的那个东西。 */
        const 册单 = items.find((x: OrderCard) => /说明书/.test(String(x.title || '')))
        if (册单) {
          this.setData({ bookOrder: 册单.id, bookText: '打得开' })
        } else {
          this.setData({ bookOrder: '' })
          commerceApi.product('prod-naji-deep').then(
            (d) => {
              const 有价 = d.skus.filter((s) => s.current_price_minor != null && s.current_currency)
              this.setData({
                bookText: 有价.length
                  ? money(有价[0].current_price_minor as number, 有价[0].current_currency as string)
                  : '',
              })
            },
            // 取不到价就不摆这一行 —— 摆一个买不了的入口比不摆更糟
            () => this.setData({ bookText: '' }),
          )
        }
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
            when: 台账那天(String(o.created_at || '')) + ' 下单',
            state: 状态那一词(o.status, o.cancel_reason),
            go: 该做什么(o.status),
          },
        })
        this.loadNextStop(o)
      },
      (e: { message?: string }) => this.setData({
        recent: null, recentEmpty: false, orderText: '看不到',
        // 一律走 `一句` —— 直接摆 e.message 就是把技术原文推到屏上
        recentNote: 一句(e as ApiError),
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
