/* 名字（docs/REDESIGN.md R5 · M6）。
 *
 * 从「我的」里抽出来单独一屏，两个理由：
 *
 * ① 名字在这个产品里不是账户字段，是**村里的人怎么称呼你**。
 *    所以这一屏要给出「叫起来是什么样」的预览 —— 那在一行 input 旁边放不下。
 * ② 「我的」在最矮的机器上超出一屏 314px（web/oversize-pages.json）。
 *    把这一段搬走是往回收的一步。
 *
 * 改名对谁都开着：匿名用户也有名字（服务端给的是「过客」），
 * 而绑定微信那一刻定下的昵称此后再也改不了 —— 那是只有入口没有出口。
 */

import { mineApi } from '../../services/mine'
import { 脸 } from '../../utils/face'
import { storage } from '../../services/storage'
import { 一句 } from '../../utils/say'

interface IData {
  /** 婆婆与苏合的头像那一段 style。她们的脸画好了就有 */
  婆脸: string
  苏脸: string
  nickname: string
  draft: string
  note: string
  saving: boolean
}

Page<IData, WechatMiniprogram.IAnyObject>({
  data: {
    /* 这两句预览是婆婆和苏合说的 —— 那就用她们的脸。
       原先是写死的「婆」「苏」两个字。 */
    婆脸: 脸('popo'),
    苏脸: 脸('suhe'), nickname: '', draft: '', note: '', saving: false },

  onShow() {
    const u = getApp<IAppOption>().globalData.user || storage.getUser()
    const n = (u && u.nickname) || '过客'
    this.setData({ nickname: n, draft: n })
  },

  onAuthReady() {
    this.onShow()
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ draft: e.detail.value, note: '' })
  },

  save() {
    const n = (this.data.draft || '').trim()
    if (!n) { this.setData({ note: '名字不能是空的' }); return }
    if (n === this.data.nickname) { this.setData({ note: '跟原来一样' }); return }
    this.setData({ saving: true, note: '' })
    mineApi.updateMe({ nickname: n }).then(
      (u) => {
        storage.setUser(u)
        getApp<IAppOption>().globalData.user = u
        this.setData({ saving: false, nickname: u.nickname || '过客', note: '存下了' })
      },
      (e) => this.setData({ saving: false, note: '没存上：' + (一句(e)) }),
    )
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/me/index' }) } })
  },
})
