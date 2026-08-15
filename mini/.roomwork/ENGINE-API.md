# 村民屋引擎 API 参考

一间房 = **资源库** + **布局数据** + **管线**。房间本身不写绘制代码。

## 1. 素材资源

```js
def('shelf_books', {
  scope: 'generic',        // generic 可跨房复用 / character 角色专属
  name: '书架 · 四层满架', cat: '收纳', tags: ['木','书','靠墙'],
  w: 200, h: 352,          // 1440 系实际像素,须为偶数(像素对齐)
  base: 352,               // 底边(相对自身顶部)→ 决定 y-sort 的 sortKey
  foot: [0, 0, 200, 352],  // 碰撞占地(相对自身)→ 烧进网格
  zLayer: 'sort',          // low / sort / above,★判据是现实高度而非绘制尺寸
  occludeH: 44,            // 可选:部分遮挡高度,齐胸家具用
  light: { x, y, r, color, flicker },   // 可选:自带光源
  clickable: true, say: '……',           // 可选:交互与叙事
  fx(g, t, X, Y) { },                    // 可选:自带动效(烟/火/闪烁)
  draw(g, opt) { }                       // ctx 已 scale(2,2),内部用 720 系局部坐标
})
```

`draw` 内可用原语:`pxCircle pxRing glow box contact dEllipse pxE`(均为局部注入,无需外部依赖)。

## 2. 表面资源(地板 / 墙)

```js
defSurface('floor_stone', { name, tags, draw(g, W, H, y0, palette) })
defSurface('wall_stone',  { name, tags, draw(g, W, hw, palette) })
```
现有:地板 `plank / stone / tatami / concrete`,墙 `wood / stone / plaster`。

## 3. 房间数据

```js
window.AYUN_ROOM = {
  w: 1440, h: 2560, wallH: 450, extBand: 2160,
  surfaces: { floor: 'floor_plank', wall: 'wall_wood' },
  palette: { wall, wallLine, floor, floorAlt, floorSeam, floorNail, skirt },
  gradePreset: 'warm',        // warm/cold/candle/neon/dusk/sterile
  gradeOverride: { tone, strength, vignette, lift },
  plan: [ ['shelf_books', 28, 472], ['body_pillow', 1140, 572, {attach:'bed_couch', zBias:2}] ],
}
```

摆放选项:`attach`(附着宿主排序)、`zBias`、`tint`+`tintAmount`(整体染色)、`swap`(逐像素换色)、`pal`(交给 draw 解释)。

## 4. 渲染

```js
renderRoom(g, room, t, actors)     // L0 烘焙 → L1 → L2 → L3 y-sort → L5 光 → L6 fx/尘 → L7 分级
placeAsset(id, x, y, opt)          // → { cv, x, y, baseY, sortKey, foot, light }
placeActor(id, footX, footY, pose, flip, opt)   // 脚点定位,可 attach
invalidateRoomBake(room)           // 换 surfaces / palette 后调用
```

## 5. 交互

```js
attachRoomInteraction(canvas, room, { onClick })   // 挂热区
drawInteraction(g, room, canvas, t)                // L8 画高亮与气泡
```

## 6. 工具链

| 工具 | 用途 |
|---|---|
| `tools/assetlint.js` | 库合规 + 布局合规 + 作用域统计 + 通道体检 |
| `tools/coverage.js` | fx / light / 交互覆盖盘点 |
| `tools/bench.js` | 冷热帧耗时 |
| `tools/regress.js` | 视觉回归(4 场景确定性指纹)`save` / `check` |
| `tools/facecheck.js` | 像素分析判定 sprite 朝向 |
| `tools/clip.js` `zoom.js` | 原分辨率区域截图 |
| `tools/probe.js` | 引擎接口加载探查 |

## 7. 设计期辅助

```js
layout.againstWall(id, x, room)     layout.rightOf(entry, id, gap)
layout.below(entry, id, gap)        layout.clearance(e1, e2)
layout.tightSpots(room, minGap, minArea)   // 只报大件,过滤成组紧邻噪音
```

## 7.4 角色附属绘制（气泡 / 情绪）

房间**不画**气泡与情绪符号，只声明「谁 · 说什么 · 什么情绪」：

```js
const anc = window.actorAnchor('tao', pose, x, y)   // sprite 顶边中心，自己算
window.drawSay(mainG, anc, '家人们，点个小红心')      // 折行 / 夹边 / 尾巴都在引擎里
window.drawSay(mainG, anc, '汪！', { ink: '#3a2c20', paper: '#f6efdc' })  // 按房配色
window.drawEmote(mainG, 'zzz', anc, t)              // zzz / heart / sulk / note / star
```

新房间要新符号，`defineEmote` 一次即可，不改引擎：

```js
window.defineEmote('sweat', function (g, x, y, t) { /* … */ })
```

**为什么必须是引擎能力**：这段绘制原先被复制进四个房间，所以改一个锚点
变量就同时打挂桃桃、婆婆、丹增三间。复制的绘制代码就是 bug 的传播路径 ——
这是 §3.5「同一物体不许存在两份绘制」在角色侧的翻版。

锚点一律用 `actorAnchor` 从 sprite real width 算，不写 `st.x + 40`：
换算写死过一次，姿态一换宽度就对不上。

---

## 7.5 角色基准朝向

所有**侧向** sprite 一律画成**面朝右**。房间给 `placeActor` / `actorSprite` 的
`flip` 统一表示「朝向行进的反方向」:

```js
flip = (target.x - self.x) < 0        // 目标在左 → 镜像
```

确实无法重画的素材来源,可在角色资源上声明基准朝向,由引擎补一次镜像:

```js
defineActor('someone', { scale: 8, baseFacing: 'left', ... })   // 默认 'right'
```

`baseFacing` 是兜底,不是许可 —— 素材本身该统一。

**校验不许目视**:量眼睛像素的横向质心,`> 0.5` 即朝右
(`tools/facecheck.js`)。基准朝向曾发散成三种,且代码注释写着「默认朝左」
而实测朝右,照注释改会改反。

---

## 8. 硬约束

- UI 遮挡:标题栏盖 y≤180,行动按钮盖 y≥2400 —— `lintRoom` 会检出
- 通道 ≥80px;碰撞体外扩 16px 软边
- 角色脚点 = sprite 左上角 +(40,114);猫 +(30,50)
- 侧身 sprite **默认朝右**,向左走才 flip
