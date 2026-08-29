/**
 * 村子与不完人 API 封装 · 对应后端 /v1/village、/v1/villagers、/v1/omamori/*
 *
 * 两处后端的设计判断,调用方要知道,否则会把它们当 bug 修掉:
 *
 * ① `/v1/village` 返回【全部】不完人,不只住着的 —— 空屋不消失是世界观。
 *    前端要能把空屋画出来、点得到、让它说「这间空着,等人」。
 * ② 没请回家就问签,后端给的是 **404 不是 403** —— 不是权限检查,
 *    御守是入住凭证,没住进来的人跟你之间还没有可说话的关系。
 *    所以这里不该把它当「登录过期」处理。
 */

import { api } from './api'
import type { MyVillage, Reading, ScanReq, ScanResult, VillagerCard } from '../types/village'

export const villageApi = {
  /** 我的村子:住着谁、n/40、空屋 */
  mine: (): Promise<MyVillage> => api.get<MyVillage>('/v1/village'),

  /** 图鉴:不带住没住,未登录也能看 */
  /** 四十位名册。传用神（五行单字）就按「你缺的」排，
   *  不传按原来的规矩（在卖的排前面、再按 id）。
   *  按谁排是后端的事 —— 那是领域判断，客户端只画。 */
  all: (forYongshen?: string): Promise<VillagerCard[]> =>
    api.get<VillagerCard[]>('/v1/villagers' + (forYongshen ? `?for=${encodeURIComponent(forYongshen)}` : '')),

  /** 问签。同一天问同一位,逐字相同 —— 那不是缓存,是设定:今天他已经说过了 */
  ask: (villagerId: string): Promise<Reading> =>
    api.post<Reading>('/v1/villagers/' + villagerId + '/reading', {}),

  /** 扫御守入住 */
  scan: (req: ScanReq): Promise<ScanResult> =>
    api.post<ScanResult>('/v1/omamori/scan', req),
}
