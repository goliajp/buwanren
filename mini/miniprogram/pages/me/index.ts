import { upgradeToWx, ensureLogin, logout } from '../../services/auth'
import { storage } from '../../services/storage'
import { mineApi } from '../../services/mine'
import { CONFIG } from '../../config/index'
import type { UserPublic } from '../../types/auth'

interface IData {
  /** 账号明细收着还是展开 —— 见 wxml 那段注释 */
  profOpen: boolean
  user: UserPublic | null
  isWx: boolean
  activeNatalId: string | null
  draft: { avatar_url: string; nickname: string }
  binding: boolean
  version: string
  /** 徽章 / 订阅的一句话摘要。取不到写「看不到」，不编数字 */
  badgeText: string
  subText: string
  /** 显示用的名字。**不在模板里写 `user.nickname`** —— user 加载前是 null，
   *  真机上 WXML 会把它渲成空，而镜像的求值器照 JS 抛（web/runtime/wxml.js
   *  只把 ReferenceError 当空）。两边行为不同的地方，绕开它比赌哪边对更稳。 */
  nickname: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    
    /** 账号明细默认收起 —— 见 wxml 那段注释 */
    profOpen: false,user: null,
    isWx: false,
    activeNatalId: null,
    draft: { avatar_url: '', nickname: '' },
    binding: false,
    version: CONFIG.APP_VERSION,
    badgeText: '',
    subText: '',
    nickname: '',
  },

  onShow() {
    this.pull()
    if (storage.getToken()) this.loadMine()
  },

  onAuthReady() {
    this.pull()
    this.loadMine()
  },

  pull() {
    const app = getApp<IAppOption>()
    const user = app.globalData.user
    const isWx = !!user && user.platform === 'mini' && !user.is_anonymous
    this.setData({
      user,
      isWx,
      nickname: (user && user.nickname) || '过客',
      activeNatalId: app.globalData.activeNatalId,
    })
  },

  onChooseAvatar(e: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
    this.setData({ 'draft.avatar_url': e.detail.avatarUrl })
  },

  onNickname(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'draft.nickname': e.detail.value })
  },

  async doBind() {
    const { draft } = this.data
    const nickname = draft.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '先填个昵称', icon: 'none' })
      return
    }
    this.setData({ binding: true })
    try {
      const { user } = await upgradeToWx({
        nickname,
        avatar_url: draft.avatar_url || null,
      })
      const app = getApp<IAppOption>()
      app.globalData.user = user
      app.globalData.authSource = 'wxmp'
      this.setData({
        user,
        isWx: true,
        draft: { avatar_url: '', nickname: '' },
      })
      wx.showToast({ title: '已绑定微信', icon: 'success' })
    } catch (_e) {
      wx.showToast({ title: '绑定失败，请重试', icon: 'error' })
    } finally {
      this.setData({ binding: false })
    }
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/orders/index' })
  },

  goBadges() {
    wx.navigateTo({ url: '/pages/badges/index' })
  },

  /* 订阅有自己的一页了（docs/REDESIGN.md R3 顺手拽进来的 M5）。
     它原先点进铺里看订阅类商品 —— 铺删掉之后那个出口就断了，
     所以那一页必须跟着铺一起做。
     **没有的时候，出口就是「去哪儿能有」** 这条没变，只是搬进了那一页里面。 */
  toggleProf() {
    this.setData({ profOpen: !this.data.profOpen })
  },

  goSubs() {
    wx.navigateTo({ url: '/pages/subs/index' })
  },

  /** 徽章与订阅的一句话摘要。取不到就不显示数字，不编 */
  /* 改名搬到 `pages/name`（REDESIGN.md R5 · M6）：名字不是账户字段，
     是村里的人怎么称呼你 —— 那一屏要给「叫起来什么样」的预览。
     留在这儿的只有一个入口。 */
  goName() {
    wx.navigateTo({ url: '/pages/name/index' })
  },

  loadMine() {
    /* 顺便**问一次服务端我是谁**。`app.globalData.user` 是登录那一刻的快照 ——
       在别处改过名字之后它就旧了，而这一页是「我」，
       显示的该是服务端说的那个我。取不到就用手里那份，不空屏。 */
    mineApi.me().then(
      (u) => {
        const app = getApp<IAppOption>()
        app.globalData.user = u
        storage.setUser(u)
        this.setData({ user: u, nickname: u.nickname || '过客' })
      },
      // 取不到就用手里那份，不空屏；但**说一句** ——
      // 不说的话「服务端说我叫这个」跟「问不到，显示的是旧的」没有区别。
      (e: { message?: string }) => console.warn('取不到我是谁，显示的是登录时那一份：', e && e.message),
    )
    mineApi.badges().then(
      (list) => this.setData({
        badgeText: list.filter((b) => b.earned).length + ' / ' + list.length,
      }),
      () => this.setData({ badgeText: '看不到' }),
    )
    mineApi.subscriptions().then(
      (list) => this.setData({
        subText: list.length ? list.length + ' 个订着' : '还没有订阅',
      }),
      () => this.setData({ subText: '看不到' }),
    )
  },

  async doLogout() {
    logout()
    const app = getApp<IAppOption>()
    app.globalData.token = null
    app.globalData.user = null
    app.globalData.authSource = null
    app.globalData.activeNatalId = null
    this.setData({ user: null, isWx: false, nickname: '', activeNatalId: null })

    wx.showLoading({ title: '重新登录…', mask: true })
    try {
      const { user, source } = await ensureLogin()
      app.globalData.user = user
      app.globalData.token = storage.getToken()
      app.globalData.authSource = source
      app.globalData.activeNatalId = user.active_natal_id
      this.setData({
        user,
        isWx: user.platform === 'mini' && !user.is_anonymous,
        activeNatalId: user.active_natal_id,
      })
      wx.hideLoading()
      wx.showToast({ title: '已切换身份', icon: 'success' })
      app.broadcast('onNatalChanged')
    } catch (_e) {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'error' })
    }
  },
})
