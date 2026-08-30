/* 徽章 —— 得到过什么。
 *
 * 后端一直在发（起卦到次数就发一个，库里已经发出去几百个），
 * 而**没有任何客户端读它**：得了也没人告诉你。这一页是它的出口。
 */

import { mineApi } from '../../services/mine'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import type { Badge } from '../../types/mine'
import { 一句 } from '../../utils/say'
import { 那一天 } from '../../utils/day'

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
          /* 拿到那天说人话：「2026年8月30日」而不是「2026-08-30」。
             这是一枚纪念，不是台账上的一行 —— 台账（下单、寄出）才用数字。
             `check-day-words` 那一支只盯「页面自己拼日期」，
             而这里是把服务端的串切一刀，它够不着。 */
          earned_at: b.earned_at ? 那一天(b.earned_at) : null,
        })),
        got: list.filter((b) => b.earned).length,
        all: list.length,
      }),
      (e: ApiError) => this.setData({ loading: false, err: 一句(e) }),
    )
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/me/index' }) } })
  },
})
