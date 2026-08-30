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

import { 轻 } from '../../utils/feel'

/* 这一格在村里的哪儿。八排的地理写在 `rooms/src/engine/plots.js` 的
   分排注释里：北边是山与林、中段是村心（广场、铺子）、南边是河、
   过了河是外人 —— 这里只是把那张地图讲成人话。

   **说位置不说人**。四十格原先点进去长得一模一样，而人是从图上
   点着某一格进来的：那一屏答不上「我在哪儿」（标尺 §1.5.4 第一问）。
   位置不是新信息（他刚在图上看见），名字才是。 */
/* 排只给地名，别在里头再带描述 —— 头一版第四排写的是「村心，挨着广场」，
   接上列就成了「村心，挨着广场西头那间」，读到一半得倒回去。 */
const 排 = ['林子边上', '北坡上', '进村口', '村心',
            '村子中间', '村子中间', '河这岸', '过了河']
const 列 = ['西头', '', '', '', '东头']

function 哪一格(row: number, col: number): string {
  const r = 排[row] || ''
  const c = 列[col] || ''
  if (!r) return ''
  return c ? `${r}，${c}那间` : `${r}那间`
}

Page({
  data: { 在哪儿: '' },

  onLoad(q: Record<string, string | undefined>) {
    const row = parseInt(q.row || '', 10)
    const col = parseInt(q.col || '', 10)
    /* 拿不到就不说 —— 编一个位置出来比不说更糟。
       （直接打开这一页、或者哪天村子那边忘了传，都会走到这儿。） */
    if (Number.isInteger(row) && Number.isInteger(col)) {
      this.setData({ 在哪儿: 哪一格(row, col) })
    }
  },

  goInvite() {
    轻()
    wx.navigateTo({ url: '/pages/invite/index' })
  },

  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },
})
