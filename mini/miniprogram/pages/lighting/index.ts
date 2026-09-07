/**
 * E1 · 同步点香。
 *
 * 每周四晚九点，村里一起点一支，烧二十五分钟。设计册说它是
 * 「每周唯一零边际成本的内容」。
 *
 * 三条约束写在设计册 10.7 / 10.8 里，这一屏逐条照办：
 *   · **不到点这一屏不存在** —— 不做「本周还没开始」的占位页。
 *     所以接口回 null 时这一屏自己退出去，而不是站在那儿说「还没开始」。
 *   · 院子先出，人数后到；人数取不到就不显示那一行，香照点。
 *   · 「我没有香」也给一个出口 —— 不推销，但不能让没香的人卡在门外。
 */
import { incenseApi } from '../../services/incense'
import { storage } from '../../services/storage'
import { 今天那一刻 } from '../../utils/incense-when'

interface IData {
  /** 人数。取不到是 null —— 不是 0，那是句假话 */
  count: number | null
  /** 屏上那一行。取不到就是空串（不显示），真的一个都没有时说「你是头一个」 */
  人数话: string
  iLit: boolean
  busy: boolean
  /** 已烧 / 约多久，mm:ss */
  burned: string
  total: string
  /** 只在点着的那一下为真 —— 窜火那个动画靠它出场 */
  刚点着: boolean
  /** 这一场是什么时候开的（「今天上午九点」）。取不到就是空串 */
  当口: string
}

let 秒表: ReturnType<typeof setInterval> | null = null

/* 退出去。**没有上一页时也要有地方去** ——
   这一屏真实的进法是从推送直接进来（设计册 E1：周四晚九点 · 从推送进），
   那时页面栈里就它一个，`navigateBack` 会抛「退不回去了」，
   人就卡在一屏说不出话的东西上。 */
function 退出去() {
  wx.navigateBack({
    fail() { wx.switchTab({ url: '/pages/village/index' }) },
  })
}

/* 屏上那一行人数。
   【0 不能写成「还有 0 个人在点」】（2026-09-05 · 25 计划的用户逐屏走）。
   wxml 里那条注释早就写着「显示『0 个人在点』比不显示更糟：那是句假话」——
   而它的判据是 `count !== null`，够不到 0。这一屏一周只开二十五分钟，
   0 又只在头一个人进来那一下出现，所以那句话从来没人看见过。
   把窗口挪到现在头一回照相，屏上正是它。

   头一个进来的人不该被告知「还有 0 个人」——
   这一屏整个是在说「一起」，而那句话是全屏最孤单的一行。 */
function 人数怎么说(n: number | null): string {
  if (n === null) return ''          // 取不到:不显示，香照点
  if (n <= 0) return '你是头一个'
  return `还有 ${n} 个人在点`
}

/* 【烧多久说人话，不用 mm:ss】（2026-09-06 三路验证 · 第一次打开的人）。
   后端的 `UNMEI_INCENSE_MINUTES` 收到 240（`routes/incense.rs` 里 clamp 的
   上限），而这里是 `mm:ss` —— 于是屏上出现「已烧 99:16 / 约 240:00」。
   分钟位溢出成三位数，读起来像一个坏掉的计时器，
   而没有任何人知道那两个数的单位是什么。
   一小时以内照旧 mm:ss（那是秒表该有的样子）；超过就换成「几小时几分」。 */
function 烧了多久(秒: number): string {
  const s = Math.max(0, Math.floor(秒))
  if (s < 3600) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
  }
  const 时 = Math.floor(s / 3600)
  const 分 = Math.floor((s % 3600) / 60)
  return 分 ? `${时} 小时 ${分} 分` : `${时} 小时`
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { count: null, 人数话: '', iLit: false, busy: false, burned: '00:00', total: '25:00', 刚点着: false, 当口: '' },

  起于: 0,
  烧多久: 25 * 60,

  onShow() {
    if (storage.getToken()) this.load()
  },

  onAuthReady() { this.load() },

  onUnload() { this.停表() },
  onHide() { this.停表() },

  停表() {
    if (秒表) { clearInterval(秒表); 秒表 = null }
  },

  load() {
    /* 【标题不许写死「今晚」】（2026-09-06 三路验证 · 第一次打开的人）。
       几点点香在后端是配置（`UNMEI_INCENSE_WEEKDAY` / `HOUR` / `MINUTES`），
       `/v1/incense/schedule` 专门为此做出来了，一味香那一屏与村口那一槽
       都已经跟着它走 —— 而**这一屏，仪式本身那一屏，漏掉了**：
       实测这一场是上午九点开的，屏上大字写着「今晚一起点一支」。
       取不到就不说时刻（`当口` 留空，wxml 退回一句不带钟点的）——
       说错一个钟点比不说更伤，有人会照着它来。 */
    incenseApi.schedule().then(
      (s) => this.setData({ 当口: 今天那一刻(s) }),
      () => this.setData({ 当口: '' }),
    )
    incenseApi.now().then(
      (s) => {
        if (!s) {
          /* 不到点：这一屏不存在。退出去，不站在这儿说「还没开始」——
             那正是设计册说不要做的占位页。 */
          wx.showToast({ title: '今晚的还没开始', icon: 'none' })
          setTimeout(退出去, 700)
          return
        }
        this.起于 = new Date(s.started_at).getTime()
        this.烧多久 = s.burn_seconds
        this.setData({
          count: s.lit_count,
          人数话: 人数怎么说(s.lit_count),
          iLit: s.i_lit,
          total: 烧了多久(s.burn_seconds),
        })
        this.走表()
      },
      /* 取不到就退出去。**不猜一个场次** —— 猜错的话，这一屏会在
         不该出现的时刻摆出「大家都在点」的样子。 */
      () => {
        wx.showToast({ title: '一时问不到今晚', icon: 'none' })
        setTimeout(退出去, 700)
      },
    )
  },

  走表() {
    this.停表()
    const tick = () => {
      const 已烧 = (Date.now() - this.起于) / 1000
      if (已烧 >= this.烧多久) {
        /* 烧完了。这一场结束，这一屏也就不存在了 —— 同不到点那一支。 */
        this.停表()
        this.setData({ burned: 烧了多久(this.烧多久) })
        wx.showToast({ title: '这一支烧完了', icon: 'none' })
        setTimeout(退出去, 900)
        return
      }
      this.setData({ burned: 烧了多久(已烧) })
    }
    tick()
    秒表 = setInterval(tick, 1000)
  },

  onLit() {
    if (this.data.iLit || this.data.busy) return
    this.setData({ busy: true })
    incenseApi.lit().then(
      (r) => {
        this.setData({ busy: false, iLit: true, count: r.lit_count, 刚点着: true })
        /* 窜火只烧那一下 —— 留着的话下次 setData 会把它重放一遍。
           0.9s 是动画本身的长度，多给一点让它烧完。 */
        setTimeout(() => this.setData({ 刚点着: false }), 1100)
      },
      () => {
        this.setData({ busy: false })
        wx.showToast({ title: '没点上，再试一次', icon: 'none' })
      },
    )
  },

  /* 点上之后的出口。二十五分钟不是非坐满不可 —— 但也不催，
     所以它是一行很淡的字，不是一颗按钮。 */
  onLeave() { 退出去() },

  /** 「我没有香」通到苏合那儿 —— 不推销，只放这一个出口 */
  goIncense() {
    wx.navigateTo({ url: '/pages/incense/index?id=prod-suhe-incense' })
  },
})
