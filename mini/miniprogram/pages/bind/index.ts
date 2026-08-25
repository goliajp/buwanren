/**
 * 绑定微信。
 *
 * 从「我的」搬出来自己一屏：这是一张表单（选头像 + 填昵称 + 按钮 + 说明），
 * 一块 372px。跟「名字」独立成屏是同一个理由 —— 表单要有自己的地方。
 *
 * **镜像里这一屏点不动**：`chooseAvatar` 与 `wx.login` 只有真机有，
 * 垫片会抛（web/runtime 三条铁律的第二条）。所以这一屏的验证止于渲染。
 */
import { upgradeToWx } from '../../services/auth'

interface IData {
  draft: { avatar_url: string; nickname: string }
  binding: boolean
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    draft: { avatar_url: '', nickname: '' },
    binding: false,
  },

  onChooseAvatar(e: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
    this.setData({ 'draft.avatar_url': e.detail.avatarUrl })
  },

  onNickname(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ 'draft.nickname': e.detail.value })
  },

  onBack() { wx.navigateBack() },

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
      wx.showToast({ title: '已绑定微信', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (_e) {
      wx.showToast({ title: '绑定失败，请重试', icon: 'error' })
    } finally {
      this.setData({ binding: false })
    }
  },
})
