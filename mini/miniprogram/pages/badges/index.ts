/* 徽章 —— 得到过什么。
 *
 * 后端一直在发（起卦到次数就发一个，库里已经发出去几百个），
 * 而**没有任何客户端读它**：得了也没人告诉你。这一页是它的出口。
 */

import { mineApi } from '../../services/mine'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import type { Badge } from '../../types/mine'

Page({
  data: {
    loading: true,
    err: '',
    items: [] as Badge[],
    got: 0,
    all: 0,
  },

  onShow() {
    if (storage.getToken()) this.load()
  },

  onAuthReady() {
    this.load()
  },

  load() {
    this.setData({ loading: true, err: '' })
    mineApi.badges().then(
      (list) => this.setData({
        loading: false,
        err: '',
        items: list.map((b) => ({
          ...b,
          // 只留到日，时分秒对「哪天得的」没有意义
          earned_at: b.earned_at ? b.earned_at.slice(0, 10) : null,
        })),
        got: list.filter((b) => b.earned).length,
        all: list.length,
      }),
      (e: ApiError) => this.setData({ loading: false, err: e.message || '取不到徽章' }),
    )
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/me/index' }) } })
  },
})
