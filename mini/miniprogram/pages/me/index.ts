import { upgradeToWx, ensureLogin, logout } from '../../services/auth'
import { storage } from '../../services/storage'
import { CONFIG } from '../../config/index'
import type { UserPublic } from '../../types/auth'

interface IData {
  user: UserPublic | null
  isWx: boolean
  activeNatalId: string | null
  draft: { avatar_url: string; nickname: string }
  binding: boolean
  version: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    user: null,
    isWx: false,
    activeNatalId: null,
    draft: { avatar_url: '', nickname: '' },
    binding: false,
    version: CONFIG.APP_VERSION,
  },

  onShow() {
    this.pull()
  },

  onAuthReady() {
    this.pull()
  },

  pull() {
    const app = getApp<IAppOption>()
    const user = app.globalData.user
    const isWx = !!user && user.platform === 'mini' && !user.is_anonymous
    this.setData({
      user,
      isWx,
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
      wx.showToast({ title: '绑定失败,请重试', icon: 'error' })
    } finally {
      this.setData({ binding: false })
    }
  },

  async doLogout() {
    logout()
    const app = getApp<IAppOption>()
    app.globalData.token = null
    app.globalData.user = null
    app.globalData.authSource = null
    app.globalData.activeNatalId = null
    this.setData({ user: null, isWx: false, activeNatalId: null })

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
