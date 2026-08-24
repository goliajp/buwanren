/**
 * 登录服务 · 两阶段
 *
 * 阶段 1 · onLaunch 自动: `ensureLogin()` → POST /v1/auth/anonymous
 *   目的:秒起,不阻塞首屏,让所有查询/展示可用。
 *   platform 传 'mini' 是为了后端在 wxmp 升级时 upsert 到同一个 user 行。
 *
 * 阶段 2 · 用户主动: `upgradeToWx({nickname, avatar_url})`
 *   由 pages/me 里的「绑定微信」按钮触发。
 *   流程:选头像(open-type=chooseAvatar) → 输昵称(input type=nickname)
 *        → wx.login 拿 code → POST /v1/auth/wx/miniprogram
 *        → 后端 jscode2session 换 openid + JWT。
 */

import { api } from './api'
import { storage } from './storage'
import { CONFIG } from '../config/index'
import type { AuthOut, UserPublic } from '../types/auth'

export type AuthSource = 'wxmp' | 'anonymous'

export interface LoginResult {
  user: UserPublic
  source: AuthSource
}

function wxLoginCode(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) resolve(res.code)
        else reject(new Error(res.errMsg ?? 'wx.login: 无 code'))
      },
      fail(res) {
        reject(new Error(res.errMsg ?? 'wx.login 失败'))
      },
    })
  })
}

/** 主登录入口 · 幂等 · 已有本地 session 直接返回;否则匿名建 */
export async function ensureLogin(): Promise<LoginResult> {
  const existingToken = storage.getToken()
  const existingUser = storage.getUser<UserPublic>()
  if (existingToken && existingUser) {
    const src: AuthSource =
      existingUser.platform === 'mini' && !existingUser.is_anonymous ? 'wxmp' : 'anonymous'
    return { user: existingUser, source: src }
  }

  const out = await api.post<AuthOut>('/v1/auth/anonymous', {
    platform: 'mini',
    region: CONFIG.DEFAULT_REGION,
    locale: CONFIG.DEFAULT_LOCALE,
  })
  storage.setToken(out.token)
  storage.setUser(out.user)
  return { user: out.user, source: 'anonymous' }
}

/**
 * 微信升级 · 用户主动触发。
 * 替换本地 anonymous token,后端把匿名 openid + 用户资料 upsert 到 wxmp user。
 */
export async function upgradeToWx(profile: {
  nickname: string
  avatar_url: string | null
}): Promise<LoginResult> {
  const code = await wxLoginCode()
  const out = await api.post<AuthOut>('/v1/auth/wx/miniprogram', {
    code,
    nickname: profile.nickname,
    avatar_url: profile.avatar_url,
    region: CONFIG.DEFAULT_REGION,
  })
  storage.setToken(out.token)
  storage.setUser(out.user)
  return { user: out.user, source: 'wxmp' }
}

/** 清本地会话 · 后端 JWT 自然过期 · 不 revoke */
export function logout(): void {
  storage.clearAll()
}
