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
  setActiveNatalId(id: string): void {
    wx.setStorageSync(K_NATAL_ID, id)
  },
  clearActiveNatalId(): void {
    wx.removeStorageSync(K_NATAL_ID)
  },

  clearAll(): void {
    this.clearToken()
    this.clearUser()
    this.clearActiveNatalId()
  },
}
