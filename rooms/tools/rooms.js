// 房间自动发现 —— 工具不再硬编码房间清单。
//
// 事故模式 14 的根治:pathlint / verify / assetprobe 曾各自写死
// ['AYUN_ROOM','TAO_ROOM'],加婆婆房时三个工具全打印「合计 0 处」的假绿;
// 加丹增房时 verify 又漏了它,整间房从未被验过而门禁天天报「全部通过」。
// 36 间村民房进来时这个手工补丁模式必然再塌一次,所以清单必须自己长出来。
//
// 约定(村民房同样遵守,不遵守就发现不到 —— 这是特性,门禁会立刻说房间缺失):
//   房间对象  window.<NAME>_ROOM   且带 plan 数组
//   画布      <name>Canvas
//   主角      <name>              (defineActor 的 id)
//
// 用法:const { DISCOVER } = require('./rooms')
//      const rooms = await page.evaluate(DISCOVER)

const DISCOVER = () => {
  return Object.keys(window)
    .filter(k => /^[A-Z][A-Z0-9]*_ROOM$/.test(k))
    .filter(k => window[k] && Array.isArray(window[k].plan))
    .map(k => {
      const base = k.replace(/_ROOM$/, '').toLowerCase()
      return {
        key: k,
        base,
        canvasId: base + 'Canvas',
        actor: base,
        hasCanvas: !!document.getElementById(base + 'Canvas'),
        hasActor: !!(window.ACTORS && window.ACTORS[base]),
        plan: window[k].plan.length,
      }
    })
    .sort((a, b) => a.key < b.key ? -1 : 1)
}

module.exports = { DISCOVER }
