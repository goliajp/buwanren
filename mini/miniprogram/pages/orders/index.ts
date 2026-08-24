/* 我的单子 —— 花过的钱要能找回来。
 *
 * 在这一页之前，`/v1/orders` 后端一直在、客户端一个人都没有：
 * 下了单就再也看不见（docs/FLOW.md 的 B3）。
 */

import { commerceApi } from '../../services/commerce'
import { storage } from '../../services/storage'
import type { ApiError } from '../../services/api'
import type { OrderCard } from '../../types/commerce'
import { money, 状态说法 } from '../../utils/money'


Page({
  data: {
    loading: true,
    err: '',
    items: [] as Array<OrderCard & { statusText: string; totalText: string }>,
    total: 0,
  },

  onShow() {
    if (storage.getToken()) this.load()
  },

  onAuthReady() {
    this.load()
  },

  onTap(e: WechatMiniprogram.BaseEvent) {
    const id = String((e.currentTarget.dataset as Record<string, unknown>).id || '')
    if (id) wx.navigateTo({ url: '/pages/order/index?id=' + id })
  },

  load() {
    this.setData({ loading: true, err: '' })
    commerceApi.orders().then(
      (page) => {
        this.setData({
          loading: false,
          err: '',
          total: page.total,
          items: page.items.map((o) => ({
            ...o,
            statusText: 状态说法[o.status] || o.status,
            totalText: money(o.amount_total_minor, o.currency),
          })),
        })
      },
      (e: ApiError) => this.setData({ loading: false, err: e.message || '取不到单子' }),
    )
  },
})
