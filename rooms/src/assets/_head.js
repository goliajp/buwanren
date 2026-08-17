
/* ══════════════════════════════════════════════════════════════════
   素材库 ASSETS —— 物件资源化(prefab)
   每个物件 = 一份独立资源:自带尺寸 / 底边 baseY / 碰撞 footprint / 绘制函数。
   房间 = 资源实例的列表(id + 坐标 + 变体),因此物件可移动、可拼接、可跨房复用。
   坐标约定:draw() 拿到的 ctx 已 scale(2,2),故内部用 720 系局部坐标(左上角为 0,0);
   而 w/h/base/foot 一律用 1440 系(= 实际像素),避免调用方换算。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  const A = {}

  /* ── 平台缝 ────────────────────────────────────────────────────────
     引擎只依赖【标准 Canvas2D】,既不认识 document,也不认识 wx(台账 D2)。
     宿主之间唯一的差别是「怎么造一张离屏画布」,所以只把这一件事挖成插槽:

       浏览器   document.createElement('canvas')
       小程序   wx.createOffscreenCanvas({ type: '2d', width, height })

     小程序侧在引擎加载后改这一个方法即可,不必也不该去 patch document:
       ENGINE_HOST.createCanvas = (w, h) => wx.createOffscreenCanvas({ type:'2d', width:w, height:h })

     用 globalThis 而不是 window —— 小程序里没有 window。 */
  const HOST = {
    createCanvas(w, h) {
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      return cv
    },
  }
  globalThis.ENGINE_HOST = HOST


