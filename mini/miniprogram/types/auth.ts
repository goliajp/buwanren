/**
 * 对应后端 unmei-domain 的 UserPublic / AuthOut。
 * 字段与 Rust struct 一一对齐;后端加字段时同步这里(TS 严格模式会 catch 缺失)。
 */

export interface UserPublic {
  id: string
  nickname: string
  avatar_url: string | null
  platform: string
  region: string
  locale: string
  active_natal_id: string | null
  is_anonymous: boolean
}

export interface AuthOut {
  token: string
  user: UserPublic
  expires_in: number
}
