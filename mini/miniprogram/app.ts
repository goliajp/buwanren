import { ensureLogin } from './services/auth'
import { storage } from './services/storage'

App<IAppOption>({
  globalData: {
    token: null,
    user: null,
    authSource: null,
    activeNatalId: null,
  },

  onLaunch() {
    // 后台异步 · 首次匿名 · 不阻塞首屏
    ensureLogin()
      .then(({ user, source }) => {
        const g = this.globalData
        g.user = user
        g.token = storage.getToken()
        g.authSource = source
        g.activeNatalId = user.active_natal_id
        // 严格 sync storage · 避免上一个身份的 stale natal_id 泄漏到新会话
        if (user.active_natal_id) {
          storage.setActiveNatalId(user.active_natal_id)
        } else {
          storage.clearActiveNatalId()
        }
        console.info(
          `[app] 登录 ok · ${user.id} · source=${source} · natal=${user.active_natal_id ?? '无'}`
        )
        this.broadcast('onAuthReady')
      })
      .catch((err) => {
        console.error('[app] 登录失败:', err)
      })
  },

  /** 主动通知已挂载页面 · 避免异步登录/本命变化后 UI 卡在初始态 */
  broadcast(name: 'onAuthReady' | 'onNatalChanged') {
    const pages = getCurrentPages()
    for (const page of pages) {
      const p = page as unknown as Record<string, ((this: unknown) => void) | undefined>
      const fn = p[name]
      if (typeof fn === 'function') fn.call(page)
    }
  },
})
