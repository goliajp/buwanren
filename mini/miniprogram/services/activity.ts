/**
 * 线下活动 · 看得见的三场，和报名这件事。
 *
 * 【`/v1/activity` 后端一直在，客户端一个人都没调】——
 * 台账 `scripts/orphan-routes.json` 上记着「活动这块做不做还没定」，
 * 而那句话记了很久:表在、种子在、后台报名率在算，
 * 屏上写着「48/100 已报名」，却没有任何人能成为其中一个。
 *
 * 2026-09-03 服务端把整条链接上了（报名 / 退订 / 名单 / 签到 + 到过场那枚
 * 徽章），这一支是它在客户端这一侧的出口。
 */

import { api } from './api'
import type { Activity } from '../types/activity'

export const activityApi = {
  /** 还没办完的那几场。区域由后端按用户判，这里不传 */
  list: (): Promise<Activity[]> =>
    api.get<{ items: Activity[] }>('/v1/activity').then((r) => r.items),

  /** 我报了哪些。用来把按钮从「报名」换成「已报名」 */
  mine: (): Promise<string[]> =>
    api.get<{ activity_ids: string[] }>('/v1/activity/mine').then((r) => r.activity_ids),

  register: (id: string): Promise<{ registration_id: string }> =>
    api.post<{ registration_id: string }>('/v1/activity/' + id + '/register', {}),

  cancel: (id: string): Promise<{ ok: boolean }> =>
    api.post<{ ok: boolean }>('/v1/activity/' + id + '/cancel', {}),
}
