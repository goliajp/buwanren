/**
 * 设置 · 账号的事都在这儿。
 *
 * 从「我的」搬出来的三块：绑定微信（再往里一屏）、这台设备上的账号、
 * 退出并重新登录。它们不是「我」的内容，是账号的维护面 ——
 * 而其中绑定那张卡一块 372px，留在 M1 上就没有一台机器放得下那一屏。
 */
import { ensureLogin, logout } from '../../services/auth'
import { storage } from '../../services/storage'
import { CONFIG } from '../../config/index'
import type { UserPublic } from '../../types/auth'

interface IData {
  user: UserPublic | null
  isWx: boolean
  activeNatalId: string | null
  version: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    user: null,
    isWx: false,
    activeNatalId: null,
    version: CONFIG.APP_VERSION,
  },

  onShow() { this.pull() },
  onAuthReady() { this.pull() },

  pull() {
    const app = getApp<IAppOption>()
    const user = app.globalData.user
    this.setData({
      user,
      isWx: !!user && user.platform === 'mini' && !user.is_anonymous,
      activeNatalId: app.globalData.activeNatalId,
    })
  },

  goBind() { wx.navigateTo({ url: '/pages/bind/index' }) },

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
