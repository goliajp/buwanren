/* 宿主适配 · 微信小程序那一侧。
 *
 * 共用部分在 host/mount.js —— 这里只回答平台真正不同的三件事。
 * 两个平台的实现摆在一起看(host/web.js)就是这套镜像的全部差异,
 * 差异越小,「在网页版上验过」这句话越值钱。
 *
 * 自带守卫:不在小程序里就整支不装。两支宿主可以一起加载,各认各的平台。
 */
;(function () {
  const wx = globalThis.wx
  // 光有 wx 不够 —— 门禁里的假 wx 也只实现了 createOffscreenCanvas。
  // 认这个方法而不是认 wx 这个名字,别的环境凑巧有个 wx 也不会误装。
  if (!wx || typeof wx.createOffscreenCanvas !== 'function') return
  if (!globalThis.INSTALL_HOST) throw new Error('要先加载 host/mount.js')

  globalThis.INSTALL_HOST({
    // 必须显式写 type:'2d'。不写的话小程序给的是旧版接口对象,
    // 上面没有 getContext,引擎第一次画就抛,而错误信息指向引擎不指向这里。
    createCanvas: function (w, h) {
      return wx.createOffscreenCanvas({ type: '2d', width: w, height: h })
    },
    // 小程序的图要从画布节点上造,不是 new Image()
    createImage: function (node) { return node.createImage() },
    // rAF 挂在画布节点上,不是全局函数
    raf: function (node, cb) { node.requestAnimationFrame(cb) },
  })
})()
