/* 宿主适配的【共用部分】—— 两个平台一字不差的那些。
 *
 * 平台之间真正不同的只有三件事,由各自那一支传进来:
 *   createCanvas(w, h)   怎么造一张离屏画布
 *   createImage(node)    怎么造一张图(村子的贴图要它)
 *   raf(node, cb)        谁来排下一帧
 * 其余全在这里:表演态按钮、时钟、指点、mountRoom、mountVillage。
 *
 * 为什么要抽出来:小程序与移动网页版是【互为镜像】的关系,镜像的价值全在
 * 「两边是同一个东西」。把 mountRoom 抄成两份,抄的那天是一样的,
 * 改的那天就不是了,而不一样的地方恰恰是「在网页上验过所以放心」的那部分 ——
 * 那种放心是假的。
 *
 * 加载顺序:engine.js → 这一支 → host-wx.js / host-web.js → 房间或村子脚本。
 */
;(function () {
  if (!globalThis.ENGINE_HOST) throw new Error('要先加载 engine.js,再加载这一支')

  /* 表演态那颗按钮。
     两个平台都没有「引擎能直接操作的按钮」:小程序是 WXML + setData,
     网页版是 DOM,但页面照样把它包成同一个最小对象递进来 —— 镜像要的就是这个。

     查不到就返回 null,引擎那边会抛「表演态找不到按钮」。这道保护是
     婆婆那颗连 id 都没有的按钮换来的,不能因为换了平台就消失。 */
  const BUTTONS = {}
  globalThis.ENGINE_HOST.button = function (id) { return BUTTONS[id] || null }

  /* 时钟。引擎要求一件事:now() 与喂给 frame 的时刻【必须同源】。
     所以这里用 Date.now(),并且下面驱动帧时【不用 rAF 给的时间戳】——
     那个时间戳的原点由平台定,跟 Date.now() 不是一回事,混用的话
     房间的「呆到什么时候」会算错,人物停住或者每帧乱换动作,而且不抛错。
     rAF 在这里只当「该画下一帧了」的信号,不当时钟用。 */
  globalThis.ENGINE_HOST.now = function () { return Date.now() }

  /* 指点。两个平台都只接 tap:小程序没有鼠标,而网页版是【小程序的镜像】,
     接了 hover 就不是镜像了 —— 在网页上看着能用的东西,真机上没有。

     坐标换算在 tap() 里做:事件给的是相对元素的逻辑像素,引擎要的是画布像素。
     房间是 1440 宽而屏幕可能是 375,不换算的话点哪儿都点不中。 */
  globalThis.ENGINE_HOST.onPointer = function (canvas, h) { canvas.__pointer = h }

  globalThis.INSTALL_HOST = function (P) {
    globalThis.ENGINE_HOST.createCanvas = P.createCanvas

    /* 把一间房挂到页面上的画布节点上。
       node   —— 页面查询出来的那个画布节点
       roomId —— 'BAILU_ROOM' / 'AYUN_ROOM' …
       opts.buttons —— { <按钮id>: { onTap, getLabel, setLabel } },房间声明了才需要

       房间的每帧逻辑在 globalThis.<ID>_FRAME(ctx, t, canvas) 里,与设计页共用同一支。

       返回 { stop, tap }:stop 在页面卸载时调(否则这一帧接一帧会一直排下去),
       tap 由页面的点击事件转进来。 */
    globalThis.mountRoom = function (node, roomId, opts) {
      Object.assign(BUTTONS, (opts && opts.buttons) || {})
      const room = globalThis[roomId]
      if (!room) throw new Error('没有这间房:' + roomId + '(房间脚本加载了吗?)')
      const frame = globalThis[roomId.replace(/_ROOM$/, '') + '_FRAME']
      if (!frame) throw new Error(roomId + ' 没有 _FRAME —— 这间房还没拆出宿主那一段')

      // 画布的像素尺寸照房间的声明来,不照屏幕。缩放交给样式那一层,
      // 让房间在所有机型上是同一幅画,而不是每台机器一个构图。
      node.width = room.w
      node.height = room.h
      const g = node.getContext('2d')

      let live = true
      ;(function loop() {
        if (!live) return
        P.raf(node, loop)
        frame(g, globalThis.ENGINE_HOST.now(), node)
      })()

      /* tap(x, y, dispW) —— 页面的点击事件里调。
         dispW 是元素在屏幕上的显示宽度(逻辑像素)。不传就按 1:1,
         那只在画布与元素同宽时才对。 */
      function tap(x, y, dispW) {
        const p = node.__pointer
        if (!p) return
        const k = dispW ? node.width / dispW : 1
        p.tap(x * k, y * k)
      }

      return { stop: function () { live = false }, tap: tap }
    }

    /* 把村子挂上去。跟房间的差别只有一处:村子要一张贴图,而
       【加载一张图】在两个平台上完全是两件事,画法却一样。
       所以引擎那边的 VILLAGE_INIT 只收一张【已经加载好】的图,异步那半在这里。 */
    globalThis.mountVillage = function (node, tilesSrc, onSub) {
      if (!globalThis.VILLAGE_INIT) throw new Error('村子脚本没加载出来(village.js)')
      // 尺寸从村子那边读,不在这写死 —— 村子扩过一次地(1408 → 1920),
      // 写死的话适配这边不跟着改,画出来就少一截,而且不报错。
      // 取不到就抛:兜一个旧尺寸的话,画面少一截而没人知道,比直接坏更难查。
      const size = globalThis.VILLAGE_SIZE
      if (!size) throw new Error('village.js 没挂出 VILLAGE_SIZE —— 版本对不上?')
      node.width = size.w
      node.height = size.h
      const g = node.getContext('2d')

      let live = true
      let sub = null
      const img = P.createImage(node)
      img.onload = function () {
        globalThis.VILLAGE_INIT(img)
        ;(function loop() {
          if (!live) return
          P.raf(node, loop)
          globalThis.VILLAGE_FRAME(g, globalThis.ENGINE_HOST.now())
          // 副标题是引擎算好的,写到哪儿是页面的事;同值不回调,
          // 否则每秒二十次跨线程通信
          if (onSub && globalThis.VILLAGE_SUB !== sub) {
            sub = globalThis.VILLAGE_SUB
            onSub(sub)
          }
        })()
      }
      img.onerror = function () { throw new Error('贴图加载不了:' + tilesSrc) }
      img.src = tilesSrc

      /* 村子这一屏也要能点 —— 与房间同一套换算。
         第一版忘了给村子加 tap,页面直接调引擎的 VILLAGE_HIT 自己换算了一遍,
         那就是第二份换算逻辑。 */
      function tap(x, y, dispW) {
        const p = node.__pointer
        if (!p) return
        const k = dispW ? node.width / dispW : 1
        p.tap(x * k, y * k)
      }

      return { stop: function () { live = false }, tap: tap }
    }
  }
})()
