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
    /* 【先问一句】。匿名账号退出 = 换一个新的匿名号，旧号里的村民、
       买过的东西、说明书全都够不着了 —— 不可逆，而按钮上写的是
       「退出并重新登录」，听着像刷新。

       危险的那一头放在 confirm（要主动点右边那颗），安全的放 cancel:
       网页版的垫片用的是浏览器 confirm，显示不出这两个按钮的文字，
       而 Playwright 默认 dismiss（= cancel）。把「退出」放 cancel 的话，
       每次跑验证都会真的把账号退掉。 */
    const 匿名 = !!(this.data.user && this.data.user.is_anonymous)
    const 答 = await new Promise<boolean>((给) => {
      wx.showModal({
        title: 匿名 ? '退出就找不回来了' : '退出？',
        content: 匿名
          ? '你还没绑微信 —— 退出会换一个新账号，村里的人、买过的东西、说明书都留在旧账号里。想留住它们，先回上一屏绑微信'
          : '下次用微信登录回来，东西都还在',
        confirmText: 匿名 ? '还是退出' : '退出',
        cancelText: 匿名 ? '先不退' : '算了',
        success: (r) => 给(!!r.confirm),
        fail: () => 给(false),
      })
    })
    if (!答) return

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
