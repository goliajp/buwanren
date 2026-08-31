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
import { 脸 } from '../../utils/face'

interface IData {
  name: string
  /** 头一回扫是「住进来了」，重复扫是「早就在了」—— 不是错误，但话要不一样 */
  isNew: boolean
  id: string
  /** 圆牌里那个字。没有美术之前用姓名末字 —— 跟村子、名册同一套占位 */
  face: string
  /** 头像那一段 style。画好脸的人有，没画好的是空串 */
  脸样: string
  /** 他劝你的方向 —— 脸的底色按它挑，四处要一样 */
  direction: string
  /** 收集数跳过那一格了没 —— 跳的一刻数字弹一下 */
  跳过了: boolean
  /** 他搬进来说的第一句。**没写过台词的人是空串** —— 那时就不说，
      不拿一句通用问候顶上;四十位共用一句会当场暴露他们是批量生成的 */
  say: string
  /** 收集进度。这一刻最实在的奖励是那个数往上跳一格 */
  lived: number
  total: number
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { name: '', isNew: true, id: '', face: '', 脸样: '', direction: '', lived: 0, total: 0, 跳过了: false,
          /** 他搬进来说的第一句。没写过台词的人是空串 —— 那时就不说 */
          say: '' },

  onLoad(q: Record<string, string | undefined>) {
    const name = q.name || '他'
    this.setData({
      name,
      face: name.slice(-1),
      脸样: 脸(q.id || ''),
      isNew: q.n !== '0',
      id: q.id || '',
      direction: q.dir || '',
      /* 只有【真的第一次】才说这一句:重复扫那一屏写的是「早就在了」，
         一个早就住着的人不会再自我介绍一遍。 */
      say: q.n !== '0' ? (q.say || '') : '',
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
      (v) => this.数字跳一格(v.found, v.total),
      () => { /* 取不到就不摆那一条 —— 空着比摆一个错的数好 */ },
    )
  },

  /* 收集数【跳一格】给人看。
     这一屏的注释一直写着「收集进度往上跳一格 —— 数字是这一刻最实在的奖励」，
     而代码是一次 setData 把终值放上去:数字直接就是新的了，没有「多了一位」那一下。
     刚扫开御守的人要的正是那一下。

     所以先落到【前一个数】，下一帧再走到新值 —— 进度条有 CSS 过渡，
     数字用一个短计时自己爬。爬完就停，不留计时器（离开这一页要停掉）。 */
  跳着: 0,

  数字跳一格(到: number, 总: number) {
    const 从 = Math.max(0, 到 - 1)
    this.setData({ lived: 从, total: 总 })
    if (从 === 到) return
    // 一格就一格 —— 460ms 走完，跟头像弹入那一下错开，不抢
    setTimeout(() => this.setData({ lived: 到, 跳过了: true }), 460)
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
