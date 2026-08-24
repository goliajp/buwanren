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

  /** 服务端说的我是谁。本地缓存的那份是登录那一刻的快照，会旧 */
  me: (): Promise<UserPublic> => api.get<UserPublic>('/v1/user/me'),

  /* 改名 / 换头像。`/v1/user/me` 的 PATCH 一直在，而客户端从来没调过 ——
     也就是绑定微信那一刻定下的昵称，此后再也改不了（docs/FLOW.md 的判据：
     一个资源只有入口没有出口）。
     `wx.request` 不支持 PATCH，后端把 POST 挂在同一个 handler 上，
     所以这里走 POST —— `api.patch` 也是这么做的。 */
  updateMe: (patch: { nickname?: string; avatar_url?: string }): Promise<UserPublic> =>
    api.patch<UserPublic>('/v1/user/me', patch),
}
