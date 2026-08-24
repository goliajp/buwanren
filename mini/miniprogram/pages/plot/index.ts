/* 一格空宅基（docs/REDESIGN.md R2 / 设计 V3）。
 *
 * **它不说是谁的。** 空屋不消失是世界观，而「还没请回来的人，
 * 连名字都还不该知道」—— 所以这一屏只能把人带到「谁能来」去自己挑，
 * 不能直接指向某一位。这条跟 `scripts/orphan-routes.json` 里
 * `village.all` 那条是同一个设定。
 *
 * 设计稿上写的是「这里住着无名」。**那是稿子把两件事混了**：
 * 无名（`anonymous`）是四十位里实打实的一位，有自己的号（空屋的主人）、
 * 自己的缺（名字）、自己的一格宅基，跟别人一样。
 * 他不是「所有空屋的代称」。已按真实设定改。
 */

Page({
  data: {},

  goInvite() {
    wx.navigateTo({ url: '/pages/invite/index' })
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
