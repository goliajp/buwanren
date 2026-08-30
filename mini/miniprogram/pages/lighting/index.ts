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

interface IData {
  /** 人数。取不到是 null —— 不是 0，那是句假话 */
  count: number | null
  iLit: boolean
  busy: boolean
  /** 已烧 / 约多久，mm:ss */
  burned: string
  total: string
  /** 只在点着的那一下为真 —— 窜火那个动画靠它出场 */
  刚点着: boolean
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

function mmss(秒: number): string {
  const s = Math.max(0, Math.floor(秒))
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { count: null, iLit: false, busy: false, burned: '00:00', total: '25:00', 刚点着: false },

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
          iLit: s.i_lit,
          total: mmss(s.burn_seconds),
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
        this.setData({ burned: mmss(this.烧多久) })
        wx.showToast({ title: '这一支烧完了', icon: 'none' })
        setTimeout(退出去, 900)
        return
      }
      this.setData({ burned: mmss(已烧) })
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
