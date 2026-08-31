/* 村民屋 —— 把 rooms/ 里那间房搬到小程序上。
 *
 * 这一页【不画任何东西】。画的是引擎与房间脚本,它们与设计页共用同一份源码
 * (rooms/src),由 `bun rooms/tools/build-engine.js build --emit=mini/miniprogram/engine`
 * 产出到 engine/ 下。那道门禁要求产物在没有 document / window 的环境里
 * 渲得与设计页逐像素相同 —— 所以这一页拿到的是同一个引擎,不是「差不多的那个」。
 *
 * 这一页只负责宿主那三件事:
 *   ① 把 <canvas type="2d"> 的 node 取出来交给 mountRoom
 *   ② 把 bindtap 的坐标转进去(小程序没有 hover,只有 tap)
 *   ③ 表演态那颗按钮 —— WXML 画,文案由引擎写回来
 */

// 这些都是生成物,靠副作用挂到 globalThis 上,没有导出。
// 顺序不能换:引擎 → 宿主适配 → 房间脚本。
//
// 六间房全都 require 进来,不按需加载 —— 小程序的依赖是静态分析的,
// 条件 require 分析不出来,打包时会被漏掉。六支加起来约 130KB。
require('../../engine/engine.js')
require('../../engine/host.js')
require('../../engine/rooms/index.js')
require('../../engine/rooms/ayun.js')
require('../../engine/rooms/bailu.js')
require('../../engine/rooms/popo.js')
require('../../engine/rooms/shenyan.js')
require('../../engine/rooms/tao.js')
require('../../engine/rooms/tenz.js')

/* 名字这里还是手写 —— 这一页不调接口,拿不到服务端的名册。
   但「有没有这间房」不手写:由 engine/rooms/index.js 报,
   那是产物自己生成的,加一间房不用回来改两处。 */
declare const ROOM_INDEX: string[]
const NAMES: Record<string, string> = {
  ayun: '阿云', bailu: '白鹭', popo: '婆婆', shenyan: '沈砚', tao: '桃桃', tenz: '丹增',
}
const DEFAULT_ROOM = 'bailu'

interface RoomHandle {
  stop(): void
  tap(x: number, y: number, dispW?: number): void
}
interface Btn {
  onTap(fn: () => void): void
  getLabel(): string
  setLabel(s: string): void
}
// 引擎挂在 globalThis 上,没有类型声明文件 —— 这里只声明这一页用到的那几个
declare const mountRoom: (
  node: unknown,
  roomId: string,
  opts?: { buttons?: Record<string, Btn> },
) => RoomHandle

// 各页各叫各的名字:这些页面文件没有 import / export,
// tsc 把它们当脚本、作用域是合并的,两处都叫 IData 会互相污染
interface RoomData {
  cssW: number
  cssH: number
  name: string
  castLabel: string
  err: string
}

Page<RoomData, WechatMiniprogram.IAnyObject>({
  data: { cssW: 0, cssH: 0, name: '', castLabel: '', err: '' },

  handle: null as RoomHandle | null,
  // 引擎会来读写按钮文案。它不认识 setData,所以这里给它一个最小对象,
  // 读的是 data.castLabel、写的也是 —— 于是文案由【状态】决定,
  // 跟设计页上那颗 <button> 是同一套规则,不另写一份。
  castBtn: null as Btn | null,
  onCastFn: null as (() => void) | null,

  who: DEFAULT_ROOM,

  onLoad(q: Record<string, string | undefined>) {
    // 从村主屏点进来时带的是谁家。认不出来就回默认那间,不留一个空白页
    const w = (q && q.room) || ''
    this.who = ROOM_INDEX.indexOf(w) >= 0 ? w : DEFAULT_ROOM
    const name = NAMES[this.who] || this.who
    this.setData({ name })
    // 标题统一是「不完人」（2026-08-18 用户定）—— 这里以前会改成「阿云家」，
    // 那会让每间房的标题各不相同。人名仍在页面里（底栏那一行）。
    wx.setNavigationBarTitle({ title: '不完人' })
  },

  onReady() {
    const ROOM_ID = this.who.toUpperCase() + '_ROOM'
    const room = (globalThis as Record<string, unknown>)[ROOM_ID] as
      | { w: number; h: number; perform?: { button?: string; labels?: string[] } }
      | undefined
    if (!room) {
      this.setData({ err: '房间脚本没加载出来：' + ROOM_ID })
      return
    }

    /* 画布按房间的宽高比【整幅放进去】。像素尺寸是房间说了算(mountRoom 里设),
       这里只决定它在屏幕上占多大 —— 两者分开,房间才在所有机型上是同一幅画。

       为什么不铺满屏宽:1440x2560 按 375 宽铺开是 667 高,加上下面那条名字栏
       就超出最矮的机器,于是得纵向裁一刀。设计 V5 确实是这么设想的
       (「长屏往上下各露出更多房间」),但**这批房间的画用满了整张画布**:
       阿云屋梁上的鸟笼与风铃在 y=104,白鹭家门口的鞋与门垫在 y≈2350。
       居中裁会把梁上那两件裁掉,顶对齐会把门口那两件裁掉 —— 裁哪一边都有东西
       点不到,而屋子照样画得出来、动得起来,看不出少了什么。
       所以宁可在最矮的机器上左右各留一点白:少 27px 的宽,换所有物件都够得着。
       (2026-08-23 由镜像新加的「裁掉的两条里不能藏东西」那条量出来。)

       栏子高度写死 96rpx,因为它直接决定画布能有多高 —— 让它随内容浮动的话,
       多一颗按钮就少一截房间。 */
    const win = wx.getWindowInfo()
    const 栏高 = Math.round(win.windowWidth * 96 / 750)   // 96rpx
    const 可用高 = win.windowHeight - 栏高
    const cssW = Math.min(win.windowWidth, Math.floor((可用高 * room.w) / room.h))
    const cssH = Math.round((cssW * room.h) / room.w)
    this.setData({ cssW, cssH })

    const self = this
    this.castBtn = {
      onTap(fn: () => void) { self.onCastFn = fn },
      getLabel() { return self.data.castLabel },
      setLabel(s: string) {
        // 每帧都会调进来,同值不 setData —— 否则每秒二十次跨线程通信
        if (self.data.castLabel !== s) self.setData({ castLabel: s })
      },
    }

    wx.createSelectorQuery()
      .select('#room')
      .fields({ node: true, size: true })
      .exec((res: Array<{ node?: unknown }>) => {
        const node = res && res[0] && res[0].node
        if (!node) {
          this.setData({ err: '取不到画布节点 —— canvas 少了 type="2d"?' })
          return
        }
        const bid = room.perform && room.perform.button
        const buttons: Record<string, Btn> = {}
        if (bid && this.castBtn) buttons[bid] = this.castBtn
        try {
          this.handle = mountRoom(node, ROOM_ID, { buttons })
        } catch (e) {
          // 挂不上就把话说清楚。这里最常见的两种:房间没拆出宿主那一段、
          // 房间声明了按钮而这一页没给 —— 两种引擎都会明说,原样显示出来。
          this.setData({ err: String((e as Error).message || e) })
        }
      })
  },


  /* 回村里。`navigateBack` 的 fail 兜底要留着 —— 直接开这一页时
     页面栈里没有上一页（推送、扫码后跳进来都是这样），
     那时 back 会抛，人就卡在一屏没有出口的画面上。 */
  onBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/village/index' }) } })
  },

  onTap(e: WechatMiniprogram.TouchEvent) {
    // detail.x / y 是相对元素的逻辑像素;画布是 1440 宽,差一个比例。
    // 换算交给适配层做(它知道 node.width),这里只把显示宽度告诉它。
    if (this.handle) this.handle.tap(e.detail.x, e.detail.y, this.data.cssW)
  },

  onCast() {
    if (this.onCastFn) this.onCastFn()
  },

  onUnload() {
    // 不停的话,这一帧接一帧会一直排下去,离开这一页也还在烧电
    if (this.handle) this.handle.stop()
  },
})
