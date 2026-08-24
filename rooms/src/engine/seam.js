/* 平台缝 —— 引擎与宿主之间唯一的约定。
 *
 * 【必须最先加载】。房间脚本在设计页上排在引擎【前面】,而它们一加载就要用
 * 时钟算「这个动作呆到什么时候」。缝要是跟引擎绑在一起,那时它还不存在,
 * 房间脚本会在那一行中断 —— 房间对象已经建好了,每帧函数还没有,
 * 于是画面出得来、人不动,而且 t=0 的静态渲染完全看不出来。
 * 这不是假设:2026-08-17 就是这么坏了一次,六间房的每帧函数全没了,
 * 视觉回归 24 个场景照样全绿,是 roomaudit 抓到的页面错误。
 */
(function () {
/* ── 平台缝 ────────────────────────────────────────────────────────
   引擎只依赖【标准 Canvas2D】,既不认识 document,也不认识 wx(台账 D2)。
   平台之间的差别全部收在这一个对象里,共三个插槽:

     ① createCanvas —— 怎么造一张离屏画布
          浏览器  document.createElement('canvas')
          小程序  wx.createOffscreenCanvas({ type: '2d', width, height })

     ② onPointer —— 指点怎么进来
          浏览器  addEventListener + getBoundingClientRect 换算
          小程序  WXML 的 bindtap,由页面把坐标喂进来(没有 hover)
          引擎那一侧只认【画布像素】坐标,换算是宿主的事。

     ③ button —— 表演态那颗按钮
          浏览器  <button> + textContent
          小程序  WXML 的按钮 + setData 绑定
          两边差得太远,没法共用 DOM 调用,所以只要一个最小对象:
          能接点击、能读写文案。找不到返回 null,由 wirePerform 去抛 ——
          那道「房间声明了按钮却接不上」的保护不能因为换了平台就消失。

   ①②③ 之外的一切两边共用:命中检测、遮罩、深度排序、追问计数、
   每帧状态机,一行都不该分叉 —— 分叉出来的差异只在真机上看得见。

   小程序侧的实现在 rooms/host/wx.js。用 globalThis 而不是 window —— 小程序里没有。 */
const HOST = {
  createCanvas(w, h) {
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    return cv
  },
  /* 时钟。房间用它算「这个动作呆到什么时候」(st.until),而那个值是拿去跟
     【每帧传进来的时刻】比的 —— 两者必须同源。

     浏览器里 rAF 的时间戳与 performance.now() 同源,所以从前直接写
     performance.now() 也对。但那是巧合不是保证:换个平台,帧时刻的原点
     可能是应用启动、可能是别的,而 until 仍按老时钟算 ——
     差得多了人物就【停在第一个动作上不动】,或者反过来每帧换一个动作。
     两种都不抛错,只在真机上看得见。

     所以时钟收进来做插槽,宿主保证「now() 与它喂给 frame 的时刻是同一个」。 */
  now() { return performance.now() },

  /* 指点。h = { move(x,y)->是否悬停其上, leave(), tap(x,y) },坐标是【画布像素】。
     浏览器这边负责把鼠标事件的视口坐标换算过去,并按 move 的返回值改光标;
     小程序那边没有鼠标也没有 hover,只把 bindtap 的坐标喂进来。 */
  onPointer(canvas, h) {
    const toCanvas = (ev) => {
      const r = canvas.getBoundingClientRect()
      return [(ev.clientX - r.left) / r.width * canvas.width,
              (ev.clientY - r.top) / r.height * canvas.height]
    }
    canvas.addEventListener('mousemove', (ev) => {
      const p = toCanvas(ev)
      canvas.style.cursor = h.move(p[0], p[1]) ? 'pointer' : ''
    })
    canvas.addEventListener('mouseleave', () => h.leave())
    canvas.addEventListener('click', (ev) => { const p = toCanvas(ev); h.tap(p[0], p[1]) })
  },
  button(id) {
    const el = typeof document !== 'undefined' && document.getElementById(id)
    if (!el) return null
    return {
      onTap(fn) { el.addEventListener('click', fn) },
      getLabel() { return el.textContent },
      setLabel(s) { el.textContent = s },
    }
  },
}
globalThis.ENGINE_HOST = HOST
})()
