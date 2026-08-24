/**
 * 「我的东西」· 对应后端 /v1/user/me/badges 与 /v1/subscriptions
 *
 * 徽章有两条接口：`/v1/badge` 是公开图鉴（`earned` 恒为 false），
 * `/v1/user/me/badges` 带上「我得没得到」。**客户端只用后一条** ——
 * 它是前一条的超集，两条都调只会让「哪一条说了算」变成一个问题。
 */

export interface Badge {
  id: string
  code: string
  name: string
  description?: string | null
  icon_url?: string | null
  points: number
  earned: boolean
  earned_at?: string | null
}

export interface Subscription {
  id: string
  plan_id?: string | null
  status: string
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
}
