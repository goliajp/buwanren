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
  平台说法: string
  isWx: boolean
  activeNatalId: string | null
  version: string
}

/* 库里那三个枚举 → 念得出口的一句话。
   认不出的值【原样留着】，不编 —— 编一个好听的说法出来，
   客服拿着它反而查不到东西。 */
function 念得出口(u: UserPublic | null): string {
  if (!u) return ''
  const 端: Record<string, string> = { mini: '小程序', web: '网页', ios: 'iOS', android: '安卓' }
  const 区: Record<string, string> = { cn: '中国大陆', jp: '日本', kr: '韩国', sea: '东南亚', na: '北美' }
  const 语: Record<string, string> = { 'zh-CN': '简体中文', 'zh-TW': '繁体中文', 'en-US': '英文', 'ja-JP': '日文' }
  return [端[u.platform] || u.platform, 区[u.region] || u.region, 语[u.locale] || u.locale]
    .filter(Boolean).join(' · ')
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    user: null,
    /* 「平台 · 区域」那一行念给客服听的说法。库里存的是 `mini` / `cn` /
       `zh-CN` 三个枚举值，原样摆在屏上买家会以为自己看见了后台。 */
    平台说法: '',
    isWx: false,
    activeNatalId: null,
    version: CONFIG.APP_VERSION,
  },

  /* 那串 ID 是给客服念的 —— 它被 `.prof-v` 的 max-width + ellipsis
     截断了，念不全。长按复制，跟订单号那儿一个做法。
     浏览器里 `wx.setClipboardData` 是真接上的（走 navigator.clipboard），
     不是空实现 —— 只是它要 https 或 localhost，被拒时走 fail，跟真机一样。 */
  goPrivacy() { wx.navigateTo({ url: '/pages/policy/index?kind=privacy' }) },
  goTerms() { wx.navigateTo({ url: '/pages/policy/index?kind=terms' }) },

  onCopyId() {
    const id = this.data.user && this.data.user.id
    if (!id) return
    wx.setClipboardData({
      data: id,
      success: () => wx.showToast({ title: '账号复制好了', icon: 'none' }),
    })
  },

  onShow() { this.pull() },
  onAuthReady() { this.pull() },

  pull() {
    const app = getApp<IAppOption>()
    const user = app.globalData.user
    this.setData({
      user,
      平台说法: 念得出口(user),
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
          /* 【指对地方，而且跟屏上那句说同一个后果】
             （2026-09-02 第三轮评审 · 文案）。上一版有两处错:
             一、说「先回上一屏绑微信」—— 而「绑定微信」那一行就在
                【这一屏最上面】，上一屏是「我的」，那儿没有入口。
                照这句做的人会走丢，而这是账号找不回来前最后一次挽救。
             二、屏上常驻那句写的是「都回不来了」，这里写「留在旧账号里」——
                同一件不可逆的事，一处说没了、一处说还在只是够不着。
                买过说明书的人读屏上那句会以为册子会被删。
             统一成「回不来」:匿名账号退出之后那个账号就再也进不去了，
             那才是实情。 */
          ? '你还没绑微信 —— 退出之后这个账号就回不来了，村里的人、买过的东西、说明书都跟着回不来。想留住它们，先在这一屏最上面绑微信'
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
    this.setData({ user: null, 平台说法: '', isWx: false, activeNatalId: null })

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
