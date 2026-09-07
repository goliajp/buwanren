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
import type { ProductCard } from '../../types/commerce'
import type { Subscription } from '../../types/mine'
import { 一句 } from '../../utils/say'
import { 轻 } from '../../utils/feel'
import { money } from '../../utils/money'
import { 那一天 } from '../../utils/day'

/* 屏上那一条订着的怎么说。
 *
 * 原先三样都是把库里的字段原样打出来：名字是 `plan-mg-month`、
 * 状态是 `active`、日子是 `2026-10-05T04:12:33.123456+08:00`。
 * 后端其实早就把套餐名 join 出来了（commerce.rs `p.name AS plan_name`），
 * 这一屏没读它。
 *
 * 之所以一直没人发现：**这一屏从来没有一位真的订着的人来过**。
 * 五个验收用户没有一个有订阅，`subs.length > 0` 那一支于是从没渲染过，
 * 空状态那一支反倒被打磨了三轮。红着的分支不会自己喊。
 *
 * `cancel_at_period_end` 更要紧：它为 true 的时候状态仍然是 `active`，
 * 而这一屏只打状态 —— 一位已经点了「到期不续」的人，看到的是「active」，
 * 跟没退的人一个字不差。
 */
const 状态说法: Record<string, string> = {
  trialing: '试用中',
  active: '订着',
  past_due: '这期没扣成',
  grace: '没扣成',
  paused: '先停着',
  cancelled: '已经退了',
  expired: '已经到期',
}

/* 日子那半句。同一个 `current_period_end`，在七种状态下说的是七件事：
   还在续的是「续到」，退了的是「还能用到」，扣不成的是「再不补就断」。
   都写成「到 X」就把这三件事说成了一件。 */
function 日子那句(x: Subscription): string {
  if (!x.current_period_end) return ''
  const 到 = 那一天(x.current_period_end)
  if (!到) return ''
  if (x.status === 'past_due' || x.status === 'grace') return `${到} 之前扣不成就断了`
  if (x.status === 'cancelled' || x.status === 'expired' || x.status === 'paused') {
    return new Date(x.current_period_end).getTime() > Date.now() ? `还能用到 ${到}` : `${到} 结束的`
  }
  /* 【会寄东西的那一档，说的是东西】（2026-09-05 · 一味香按月送）。
     「续到 10月4日」说的是合同，「下一盒 10月4日 发」说的是那天会发生什么 ——
     而后者才是订着的人真正在等的。哪一档会寄东西由后端给（`ships`），
     不在这儿按 plan_id 写死。 */
  /* 【说停之后那一句是假的】（2026-09-06 三路验证 · 准备花钱的那一路）。
     原先写的是「最后一盒 {到} 发 —— 之后不再续」。而那一盒是
     **扣款那一刻**跟着订单行一起建的（`subscription.rs` 开通 → `OrderPaid`
     → `fulfillment.rs` 建运单）；周期末那一天，`renew_due` 认出取消标记
     只把状态置成 `cancelled` 并发一个事件，**不建订单、不建运单**。
     也就是说：第 2 天点了「不再续」的人，屏上告诉他第 30 天还有一盒，
     他等到第 31 天，什么都不会来 —— 而手里那盒正是最后一盒。
     改成说手里那盒，以及那一天真正会发生的事（不再扣钱）。 */
  if (x.cancel_at_period_end) {
    return x.ships ? `手里那盒是最后一盒 · ${到} 之后不再扣钱` : `用到 ${到} 为止 —— 到期不再续`
  }
  return x.ships ? `下一盒 ${到} 发` : `续到 ${到}`
}

/* 这一份还能动吗 —— 决定卡片上给哪一个动作。
   三种状态三件事，不是一个通用的「管理」按钮：
   扣不成的要补、还在续的可以停、已经停了的什么都不给（也确实无事可做）。 */
type 动作 = '' | '补' | '停'
function 给什么动作(x: Subscription): 动作 {
  if (x.status === 'past_due' || x.status === 'grace') return '补'
  if ((x.status === 'active' || x.status === 'trialing') && !x.cancel_at_period_end) return '停'
  return ''
}

/* 还在续的那几种。跟后端排序用的是同一批（commerce.rs `my_subscriptions`
   的 ORDER BY）—— 两处各写一份必然走散，而走散的样子是「屏上说你还订着，
   而它排在最后面」。 */
const 还在续的 = ['trialing', 'active', 'past_due', 'grace', 'paused']

interface IData {
  loading: boolean
  err: string
  /** 手上还有没有一份在续的。**「有三份记录」跟「还订着」是两件事** ——
   *  三份全到期的人，这一屏原先是三张读不动的卡片加一颗「回去」 */
  还订着: boolean
  /** `名 / 说 / 要紧` 是屏上那三样 —— wxml 里调不了函数，在这儿算好 */
  subs: Array<Subscription & { 名: string; 说: string; 要紧: boolean; 动: '' | '补' | '停' }>
  /** 正在办的那一份的 id。按下去到答复回来之间，按钮换个字 ——
   *  不换的话人会以为没反应，再按一次（而第二次是真的又发一笔） */
  忙: string
  /** 空的时候摆出来的出口：村里现在有什么可以订 */
  /** 还能订什么。`价` 是本页算出来的显示串 —— 取不到就是空串，屏上不写价 */
  offers: Array<ProductCard & { 价: string }>
  offersErr: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { loading: true, err: '', subs: [], 还订着: false, offers: [], offersErr: '', 忙: '' },

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
      this.setData({
        loading: false,
        还订着: list.some((x) => 还在续的.indexOf(x.status) >= 0),
        subs: list.map((x) => ({
          ...x,
          // 取不到名就退回 id —— 不编一个好看的名字盖住「这条数据不全」
          名: x.plan_name || x.plan_id || x.id,
          说: [状态说法[x.status] || x.status, 日子那句(x)].filter(Boolean).join(' · '),
          // 扣不成的那两种要显眼:它们是【他现在就得动手】的，其余六种不是
          要紧: x.status === 'past_due' || x.status === 'grace',
          动: 给什么动作(x),
        })),
      })
      /* 【订过的人也要看得见还能订什么】。原先是 `if (!list.length)` ——
         也就是「已经订了就不再显示能订的」，跟「我的」那一行的门闩
         正好互为反面:两个条件合起来，卖订阅那一半永远到不了
         （2026-09-01 五路评审 · 工程审计）。 */
      this.loadOffers()
    } catch (e) {
      // 取不到订阅，跟「一个都没订」是两件事 —— 后者才该出空状态
      this.setData({ loading: false, err: '取不到：' + (一句(e as { status?: number; message?: string })) })
    }
  },

  /* 出口那一半单独取。它失败不该让整页失败 ——
     「你订着两个」这件事跟「还能订什么」不互为前提。 */
  loadOffers() {
    /* 【问的是 subscription，不是 service】（2026-09-05 · 25 计划的用户逐屏走）。
       `ProductKind` 里两个都有（one_shot / subscription / digital_goods / service），
       所以写 'service' 语法上、类型上都对 —— 而【全库一件 service 都没有】:
       唯一能订的那件是 `prod-membership-gold`（黄金会员），kind 是 subscription。

       于是这一页的空状态永远走「村里现在没有可以订的东西」那一支。
       而这一页的注释头一行写着「空状态是这一页的主设计:空不是问题，
       说不清哪儿能有才是」—— 说不清哪儿能有，正是它自己的下场。

       跟盘上那个「南 vs 南方」、物流那个「preparing vs pending」同一个形状:
       写死的键跟真值差一个词，两边都是合法值，错的跟对的看着一样。

       【那一次只改对了一半】（2026-09-05 稍后）。值改了，参数名没改 ——
       `products()` 把它发在 `category` 上，而 subscription 是 `kind` 的值。
       于是这一屏照旧问一个没有货的分类，空状态照旧是唯一走得到的那一支。
       现在走 `subscribable()`，那支的名字里就说清它问的是什么。 */
    commerceApi.subscribable().then(
      /* 列表接口带着 `from_price_minor`（这件商品最便宜那一档现价）——
         订阅那一条点下去就是掏钱，屏上得有价。取不到就留空，不编。 */
      /* 【已经订着的那件不再摆】。这一块是「还能订什么」，
         而把用户此刻正订着的那一件摆进去，等于给他一条通向他已有之物的路。
         判据用商品号，不用「有没有活着的订阅」那种一刀切 ——
         哪天有第二件可订的，一刀切会把它也一起藏掉。 */
      (list) => this.setData({
        offers: list.filter((x) => !this.订着哪些商品().includes(x.id)).map((x) => ({
          ...x,
          // 格式化只有一支（utils/money.ts）—— 自己抄一份会在非 CNY 上出错
          价: typeof x.from_price_minor === 'number'
            ? money(x.from_price_minor, x.from_currency || 'CNY')
            : '',
        })),
        offersErr: '',
      }),
      () => this.setData({ offers: [], offersErr: '一时取不到能订的' }),
    )
  },

  /* 【补上这一期】。屏上写着「再不补就断了」，而在这之前一个按得动的东西都没有 ——
     说了要紧的事却不给做那件事的办法，比不说更差。
     后端走的是续期那一条路（`renew_due` 复用还开着的那张发票），
     所以「补一期」跟「续一期」本来就是同一件事。 */
  onPay(e: WechatMiniprogram.BaseEvent) {
    const id = String((e.currentTarget.dataset as { id?: string }).id || '')
    if (!id || this.data.忙) return
    轻()
    this.setData({ 忙: id })
    mineApi.paySubscription(id).then(
      (r) => {
        this.setData({ 忙: '' })
        // 【没收成也要说】—— 静默地什么都不变，人只会再按一次
        wx.showToast({ title: r.paid ? '补上了' : (r.why || '这一期不用补'), icon: 'none' })
        this.load()
      },
      (e2) => {
        this.setData({ 忙: '' })
        wx.showToast({ title: 一句(e2 as { status?: number; message?: string }), icon: 'none' })
      },
    )
  },

  /* 【不再续了】。先问一句 —— 这一下花钱的反面，按错了要等一个月才发现。
     问的时候把「这一期照旧」说出来:不说的话，人会以为按下去香就断了。 */
  onStop(e: WechatMiniprogram.BaseEvent) {
    const id = String((e.currentTarget.dataset as { id?: string }).id || '')
    if (!id || this.data.忙) return
    const 那一份 = this.data.subs.find((x) => x.id === id)
    wx.showModal({
      title: '不再续了？',
      /* 同上：会寄东西的那一档，「最后一盒还会发」是假的 ——
         手里那盒就是最后一盒。按下去之后不会再有任何一盒。 */
      content: 那一份 && 那一份.ships
        ? '手里那盒是最后一盒 —— 到期之后不再扣钱，也不会再寄'
        : '这一期照旧 —— 到期之后就不再扣钱了',
      confirmText: '不再续',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ 忙: id })
        mineApi.cancelSubscription(id).then(
          () => { this.setData({ 忙: '' }); this.load() },
          (e2) => {
            this.setData({ 忙: '' })
            wx.showToast({ title: 一句(e2 as { status?: number; message?: string }), icon: 'none' })
          },
        )
      },
    })
  },

  /** 此刻还活着的那几份订的是哪几件商品 */
  订着哪些商品(): string[] {
    return this.data.subs
      .filter((x) => 还在续的.indexOf(x.status) >= 0 && x.product_id)
      .map((x) => x.product_id as string)
  },

  onTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id?: string }).id
    if (id) wx.navigateTo({ url: '/pages/product/index?id=' + id })
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/me/index' }) } })
  },
})
