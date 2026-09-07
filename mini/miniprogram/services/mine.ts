/**
 * 「我的东西」API 封装 · 徽章与订阅。
 *
 * 这两样后端一直在、客户端一个人都没有：得了徽章没人告诉你，
 * 订着的服务在 app 里看不见（docs/FLOW.md 的 B3 / U5）。
 */

import { api } from './api'
import type { Badge, Subscription } from '../types/mine'
import type { UserPublic } from '../types/auth'

export const mineApi = {
  /** 我的徽章。已得的排在前面，由后端排序 */
  badges: (): Promise<Badge[]> => api.get<Badge[]>('/v1/user/me/badges'),

  subscriptions: (): Promise<Subscription[]> => api.get<Subscription[]>('/v1/subscriptions'),

  /** 不再续了。**到期不续，不是立刻停** —— 这一期的钱付过了，东西照发 */
  cancelSubscription: (id: string): Promise<{ ok: boolean }> =>
    api.post<{ ok: boolean }>(`/v1/subscriptions/${id}/cancel`, {}),

  /** 这一期的单。**它不收钱**（2026-09-07）——
   *  开出（或找出）这一期那张待付的单，把单号交回来；
   *  钱走的是跟第一次买一模一样那条路（订单屏 → 微信）。
   *
   *  它原先返回 `paid: true`，而那个 true 是后端自己插一条
   *  `status='success'` 的支付造出来的：渠道一分钱没动。 */
  paySubscription: (id: string): Promise<{ ok: boolean; order_id?: string | null; amount_minor?: number; why?: string }> =>
    api.post<{ ok: boolean; order_id?: string | null; amount_minor?: number; why?: string }>(
      `/v1/subscriptions/${id}/pay`, {}),

  /** 客户端配置。**这条接口一直在，而没有一个客户端调过它**
   *  （孤儿台账里记着）—— 现在它带着「这一期该付了」那条订阅消息的模板号，
   *  而模板号来自微信后台、每个小程序不一样，写死在这儿就得为它发版。 */
  config: (): Promise<{ subscribe_bill_template?: string }> =>
    api.get<{ subscribe_bill_template?: string }>('/v1/config'),

  /** 记下一次订阅消息授权。**授权那一下只有真机有**（`wx.requestSubscribeMessage`）——
   *  网页版会抛，这是对的:授权的额度记在微信那一侧，空实现会让
   *  「他授权了」在网页上成功而真机上什么都没发生。 */
  grantSubscribe: (templateId: string): Promise<{ ok: boolean }> =>
    api.post<{ ok: boolean }>('/v1/user/me/subscribe-grant', { template_id: templateId }),

  /** 服务端说的我是谁。本地缓存的那份是登录那一刻的快照，会旧 */
  me: (): Promise<UserPublic> => api.get<UserPublic>('/v1/user/me'),

  /* 【注销账号】（2026-09-05）。隐私政策上写了两遍「在「设置」里退出并
     删除账号」，而在这之前客户端唯一跟「删」有关的东西是本机那个
     `logout()` —— 它清 token，服务端一行数据都不动。
     删什么留什么见 `unmei_app::account`。 */
  deleteMe: (): Promise<{ ok: true }> =>
    api.post<{ ok: true }>('/v1/user/me/delete', {}),

  /* 改名 / 换头像。`/v1/user/me` 的 PATCH 一直在，而客户端从来没调过 ——
     也就是绑定微信那一刻定下的昵称，此后再也改不了（docs/FLOW.md 的判据：
     一个资源只有入口没有出口）。
     `wx.request` 不支持 PATCH，后端把 POST 挂在同一个 handler 上，
     所以这里走 POST —— `api.patch` 也是这么做的。 */
  updateMe: (patch: { nickname?: string; avatar_url?: string }): Promise<UserPublic> =>
    api.patch<UserPublic>('/v1/user/me', patch),
}
