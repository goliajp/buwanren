/** 后端 `ActivityPublic`（backend/unmei-domain/src/lib.rs）—— 字段一一对着。 */
export interface Activity {
  id: string
  title: string
  sub_title: string | null
  category: string
  banner_url: string | null
  city: string | null
  /** RFC3339。屏上只显示到「几月几号 几点」 */
  start_at: string
  max_participants: number
  /** 已报名多少人。**这是数出来的**，不是存着的一列 —— 见 20260903005 那支迁移 */
  current_count: number
  /** 后端算好的显示串（免费 / ¥49.00）。客户端不再自己拼一次 */
  price_display: string
  status: string
}
