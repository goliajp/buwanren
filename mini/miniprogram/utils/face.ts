/* 头像。

   四十位的正面像素图早就画好了（设计册 `charsheet.js` 的 CHARSPEC），
   只是从来没接到小程序这一侧 —— 界面上一直是「圆底 + 姓名末字」，
   四十个占位圆牌。这一支把画好的脸接上来。

   图由 `rooms/tools/export-faces.mjs` 从设计册导出成
   `engine/faces.js`（四十位 base64 PNG 共 9.8 KB，单张一百多字节）。
   那个文件是产物，改它没有意义:下一次导出就覆盖掉了，要改脸去改设计册。

   【为什么不做成自定义组件】移动网页版的垫片不认自定义组件，
   而铁律一是「垫片遇到不认识的东西必须抛」—— 加组件等于让镜像整个抛掉，
   那条动线就验不成了。所以做成函数:一处逻辑，各屏各调一次。

   【为什么留着回落】导出漏了谁、或者新加的人还没画，这里给空串，
   页面照旧显示姓名末字 —— 不显示一个破图，也不显示空白。 */

// 产物，可能还没生成（新克隆的仓库、或者没跑过导出）——
// 那时整张表是空的，全体回落到姓名末字，不抛。
let 表: Record<string, string> = {}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  表 = require('../engine/faces.js') as Record<string, string>
} catch (_) {
  表 = {}
}

/** 这个人的头像有没有画好 */
export function 有脸(id: string): boolean {
  return !!表[id]
}

/** 直接塞进 style 的那一段。没有画好就给空串 —— 页面据此回落到姓名末字 */
export function 脸(id: string): string {
  const 图 = 表[id]
  return 图 ? `background-image:url("${图}")` : ''
}

/* 同色之内的脸纹（渐变角度）。四十张脸接上之后这一套还留着 ——
   头像画好的人用真脸，没画好的仍然是圆底 + 末字，那时同色的人还是会撞。 */
export function 一列脸纹<T extends { direction?: string | null }>(列: T[]): string[] {
  const 数: Record<string, number> = {}
  return 列.map((x) => {
    const d = x.direction || ''
    数[d] = (数[d] || 0) + 1
    return 'fa-' + ((数[d] - 1) % 6)
  })
}
