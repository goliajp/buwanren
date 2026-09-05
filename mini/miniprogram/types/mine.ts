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
  /** 圆牌上那一个字。六枚要一眼分得开，所以它是单独的一列而不是取名字的首字 */
  glyph?: string | null
  icon_url?: string | null
  points: number
  earned: boolean
  earned_at?: string | null
}

export interface Subscription {
  id: string
  plan_id?: string | null
  /** 套餐名。后端 `SELECT p.name AS plan_name` 一直在给，
   *  只是这个类型没声明它，于是屏上打的是 `plan-mg-month`。 */
  plan_name?: string | null
  status: string
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
  /** 这一份订的是哪件商品。「还能订什么」那一块靠它把重复的那件摘掉 */
  product_id?: string | null
  /** 这一档每期发什么（`plan.entitlements_json` 的 `ships`）。
   *  一味香按月送是「十支一盒」—— 有它的时候屏上说的是「下一盒 X 发」，
   *  没有的时候只能说「续到 X」。**不在页面里按 plan_id 写死** */
  ships?: string | null
}
