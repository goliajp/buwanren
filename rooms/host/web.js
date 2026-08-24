/* 宿主适配 · 移动网页版那一侧。
 *
 * 这一支存在的理由:小程序的门禁要真机,而真机这一环没法机检 ——
 * 「一位真实用户从扫码走到问签」这条门禁,在浏览器里可以用无头驱动跑完。
 * 所以网页版是【小程序的镜像】,不是另一个产品:
 *   · 引擎、房间、村子、页面逻辑、接口封装 —— 全部原样复用
 *   · 只有这里不同,而且只有三件事
 * 镜像上验过的东西,真机上才有意义;这一支越薄,那句话越站得住。
 *
 * 自带守卫:没有 document 就整支不装(小程序里就是这种情况)。
 * 两支宿主可以一起加载,各认各的平台。
 */
;(function () {
  if (typeof document === 'undefined') return
  if (!globalThis.INSTALL_HOST) throw new Error('要先加载 host/mount.js')

  globalThis.INSTALL_HOST({
    createCanvas: function (w, h) {
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      return cv
    },
    // 浏览器里造图不需要画布节点,但签名照 wx 那边写 —— 共用那一支只认这一个形状
    createImage: function () { return new Image() },
    // 浏览器的 rAF 是全局函数,不挂在节点上
    raf: function (node, cb) { requestAnimationFrame(cb) },
  })
})()
