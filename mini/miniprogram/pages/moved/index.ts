/* 他住进来了 —— 扫开御守之后的那一屏（docs/REDESIGN.md R6 / 设计 V6）。
 *
 * 为什么值得单独一屏：这是整条链上**唯一一次实物变成人**。
 * 在此之前它只是一句 toast —— 一闪而过，跟「已复制」用同一种语气。
 * 泡泡玛特把「拆盒那一下」做成了年入十亿的独立小程序（产品设计 08），
 * 我们这一下是同一个位置。
 *
 * **这一屏没有顶栏也没有 tab**：此刻给任何导航都是打断。
 * 出口只有两条，都往前。
 */

import { villageApi } from '../../services/village'

interface IData {
  name: string
  /** 头一回扫是「住进来了」，重复扫是「早就在了」—— 不是错误，但话要不一样 */
  isNew: boolean
  id: string
  /** 圆牌里那个字。没有美术之前用姓名末字 —— 跟村子、名册同一套占位 */
  face: string
  /** 他劝你的方向 —— 脸的底色按它挑，四处要一样 */
  direction: string
  /** 收集进度。这一刻最实在的奖励是那个数往上跳一格 */
  lived: number
  total: number
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { name: '', isNew: true, id: '', face: '', direction: '', lived: 0, total: 0 },

  onLoad(q: Record<string, string | undefined>) {
    const name = q.name || '他'
    this.setData({
      name,
      face: name.slice(-1),
      isNew: q.n !== '0',
      id: q.id || '',
      direction: q.dir || '',
    })
    /* 收集数从服务端取 —— 不从上一页带过来。带过来的是【扫之前】那个数，
       而这一屏要显示的正是「多了一位之后」。差一个人，
       而那正好是这一屏存在的理由。 */
    this.取进度()
  },

  /* 登录完了再取一次。这一屏是【扫开御守之后】跳过来的，多半已经有 token，
     但冷启动时（从推送直接进来）不一定 —— 那时 onLoad 那一次会拿 401，
     而进度条会一直空着。门禁 `check-auth-ready.py` 抓到的正是这一处。 */
  onAuthReady() {
    if (!this.data.total) this.取进度()
  },

  取进度() {
    villageApi.mine().then(
      (v) => this.setData({ lived: v.found, total: v.total }),
      () => { /* 取不到就不摆那一条 —— 空着比摆一个错的数好 */ },
    )
  },

  goVillager() {
    const { id } = this.data
    if (id) wx.redirectTo({ url: '/pages/villager/index?id=' + id })
    else wx.switchTab({ url: '/pages/village/index' })
  },

  goVillage() {
    wx.switchTab({ url: '/pages/village/index' })
  },
})
