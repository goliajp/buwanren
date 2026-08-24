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

interface IData {
  name: string
  /** 头一回扫是「住进来了」，重复扫是「早就在了」—— 不是错误，但话要不一样 */
  isNew: boolean
  id: string
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: { name: '', isNew: true, id: '' },

  onLoad(q: Record<string, string | undefined>) {
    this.setData({
      name: q.name || '他',
      isNew: q.n !== '0',
      id: q.id || '',
    })
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
