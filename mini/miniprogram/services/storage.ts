/**
 * 本地 storage 封装 · 命名空间 `buwanren:` 避免与其它库冲突。
 */

const K_TOKEN = 'buwanren:token'
const K_USER = 'buwanren:user'
const K_NATAL_ID = 'buwanren:active_natal_id'

export const storage = {
  getToken(): string | null {
    const v = wx.getStorageSync(K_TOKEN)
    return typeof v === 'string' && v.length > 0 ? v : null
  },
  setToken(t: string): void {
    wx.setStorageSync(K_TOKEN, t)
  },
  clearToken(): void {
    wx.removeStorageSync(K_TOKEN)
  },

  getUser<T = unknown>(): T | null {
    const v = wx.getStorageSync(K_USER)
    return v && typeof v === 'object' ? (v as T) : null
  },
  setUser<T>(u: T): void {
    wx.setStorageSync(K_USER, u)
  },
  clearUser(): void {
    wx.removeStorageSync(K_USER)
  },

  getActiveNatalId(): string | null {
    const v = wx.getStorageSync(K_NATAL_ID)
    return typeof v === 'string' && v.length > 0 ? v : null
  },
  /* 存这个 id 的同时，把【缓存的 user】里那一栏也改掉。

     两者分开写会各说各话：`ensureLogin` 有 token 时直接返回缓存的 user
     （它是登录那一刻的快照），而 `app.onLaunch` 拿 `user.active_natal_id`
     覆盖 globalData、并据此清掉这里存的 id。
     于是「建完本命 → 杀掉小程序 → 重开」时，「今」那一页又开始劝你去建本命，
     直到你点一次「命」才自愈。(2026-08-18 实测复现。)

     绑在一起写，它们就不会打架。 */
  setActiveNatalId(id: string): void {
    wx.setStorageSync(K_NATAL_ID, id)
    const u = wx.getStorageSync(K_USER)
    if (u && typeof u === 'object') {
      wx.setStorageSync(K_USER, { ...u, active_natal_id: id })
    }
  },
  clearActiveNatalId(): void {
    wx.removeStorageSync(K_NATAL_ID)
    const u = wx.getStorageSync(K_USER)
    if (u && typeof u === 'object') {
      wx.setStorageSync(K_USER, { ...u, active_natal_id: null })
    }
  },

  clearAll(): void {
    this.clearToken()
    this.clearUser()
    this.clearActiveNatalId()
  },
}
