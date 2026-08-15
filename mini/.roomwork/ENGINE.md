# 村民屋引擎 · 权威手册

**这份文档是引擎的唯一权威说明。** 房间脚本能做什么、必须怎么调、什么不许自己写，全在这里。

判断一件事该不该进引擎，只问一句：**第二间房还会不会用到？** 会，它就是引擎能力，不许在房间里各写一份。

> 文档分工：**`WORKFLOW.md` = 开一间房照着走的完整步骤（从那里起步）** · 本文 = 引擎能什么怎么调 · `PLAYBOOK.md` = 跨领域规则与事故模式 · `METHOD.md` = 单间设计手法 · `ENGINE-GAPS.md` = 尚未收编的缺口

---

## 0. 受控边界

房间脚本**只允许**做三件事：

1. **声明数据** —— `window.<NAME>_ROOM`（尺寸 / 表面 / 调色 / 分级 / plan）、行为表 `ACTS`、姿态 `pdef`
2. **推进状态机** —— 谁在哪、在做什么、说什么（逻辑，不是绘制）
3. **调用引擎** —— 下面列的 API

**明令禁止**（`hardcodelint` 逐条检查）：

| 禁 | 因为 |
|---|---|
| `fillRect` / `arc` / `createRadialGradient` 等一切裸绘制 | 复制的绘制代码是 bug 的传播路径 —— 一份气泡代码曾同时打挂三间房 |
| 尺度当参数传（`drawPose(..., 5)`） | 兔子因此只有 40px，用户「一直没见到」 |
| 锚点→脚点的字面量换算（`st.x + 40`） | 曾散在 22 处，改尺寸漏一处就错位 |
| 自建寻路 / 自画影子 / 自画气泡 | 见 §2、§3 |
| 中文台词半角标点、非正式文本结尾句号 | 见 `.claude/CLAUDE.md` |
| 在房间脚本里调 `defineActor` | **房间脚本跑在引擎装载之前**，拿到的是 `undefined`，角色一个都注册不上而且不报错。角色资源一律声明在引擎的角色表里，房间只 `pdef` 姿态并挂 `window.<NAME>_POSES` |
| 两间房共用一个 `<script>` | 门禁按 canvas 切区间，会把隔壁那间的违规算到你头上。**一间房一个 `<script>`** |

---

## 1. 素材与房间

```js
def(id, { name, cat, tags, scope, fromRoom, w, h, base, foot,
          zLayer, wall, walkable, clickable, say, sayDeep,
          light, fx, variant, anchors, draw })
```

| 字段 | 语义 | 坑 |
|---|---|---|
| `w` `h` | 最终屏幕像素 | **`draw` 内坐标 = 最终像素**：`draw` 开头的 `g.scale(0.5,0.5)` 与 `placeAsset` 的 2× 预缩放相抵。按 2 倍写会撑破包围盒（横梁曾画成 920 宽） |
| `foot` | `[ox, oy, w, h]` 占地矩形 = **底面在地面的投影**（角色脚点进不去的区域），不是绘制范围。判据:**角色能不能走到它「上面」?** ⟶ **平放家具**（俯视看到整个顶面:平放桌/九宫格盘/床/垫）占地=整个顶面投影，foot 覆盖几乎全部（九宫格曾只圈底边 8px → 桃桃从牌上穿过）；**立式家具**（正面朝观者:柜/梳妆台/书架/花架/灯）占地=宽×进深，foot 是**底边一条**（薄是对的——人站它前面靠遮挡规则正确压住它，foot 只需挡人绕到它后面）。**attach 附着物**（桌上的抽屉/杯）foot 留 `0` 交给宿主，别重复烧格 |
| `zLayer` | `low` / `sort` / `above` | **按真实世界高度判，不按画出来的尺寸**。落地香炉画 602px 但实高约 1m |
| `wall` | 结构/挂件，不参与地面 y-sort | 承重梁、月洞窗、挂轴 |
| `walkable` | 能踩的（坐垫 / 门垫） | 烧格时跳过，否则寻路把蒲团当墙 |
| `clickable` `say` `sayDeep` | 交互与台词 | `sayDeep` = 连点三次才说的真话 |
| `light` | `{x,y,r,color,flicker}` **或 `state => 同结构\|null`** | 函数形式让灯有开关（补光灯只在开播时亮） |
| `fx(g,t,X,Y)` | 自带动效 | 拿不到 room，读状态用 `window.<NAME>_ROOM.state` |
| `variant(state)` | 返回变体名 | 每变体各栅格化一次走 sprite 缓存，于是**动画家具在 L3 正常排序**（L6 fx 层在角色之后，会盖在人身上） |
| `anchors` | 具名连接点 | `drawLink` 用；避免写死坐标 |
| `patina` | 做旧,**按材质分两种** | `placeAsset` 见 `opt.patina \|\| a.patina` 就换做旧版,缓存一次。**做旧要分材质 ★**:`true`=`makePatina`**蒙尘**(石/织物/铜/沙画:底色留着、表面落斑驳浮尘——大块低频噪声、过高阈值才落、顶面厚、暖灰,**不是均匀降饱和**那会抽底色像蒙灰玻璃);`'wood'`=`makeWeathered`**木头旧化**(木器:区域性氧化加深发红褐 + 几道顺纹裂印,底色留着——木头旧了是变色开裂**不是蒙尘**)。**都不用 `g.filter`**(小程序 canvas 不保证支持)。房间在素材或 plan 摆位上标 |

```js
defSurface(id, { draw(g, W, H, y0, P) })          // 地板 / 墙
// 现有表面:floor_plank / floor_stone / floor_tatami / floor_concrete / floor_bamboo /
//          floor_popo_plank(旧深木板) · wall_wood / wall_stone / wall_plaster /
//          wall_taohua / wall_popo_stone(紫灰石墙)
window.<NAME>_ROOM = { w, h, wallH, extBand, surfaces, palette,
                       gradePreset, plan: [[assetId, x, y, opt?], ...],
                       perform?, state? }
```

**碰撞体从 plan 自动烧制**，不许手工维护一张 `FURN` 表 —— 手工表会与房间实际内容漂移。

---

## 2. 渲染

```js
window.renderRoom(g, room, t, entities)    // 唯一入口
```

图层：`L0 FLOOR → L1 DECAL → L1.5 地面动效 → L2/3/4 SORT(含自动接触阴影) → L5 LIGHT → L6 FX → L7 GRADE → L8 UI`

- L0 有缓存，地板墙不重画 —— 烘焙不是性能来源，删掉反而更快
- **L3 遮挡基准线**：角色在家具的**左·下·右** → 角色遮家具；在家具**上方** → 家具遮角色。
  几何表达：**家具的排序线取占地矩形的顶边 `foot[1]`，角色取脚点**。角色脚点越过家具顶边
  （在下半区或两侧）→ 角色 key 更大 → 后画 → 遮家具；角色脚点在顶边之上（真绕到家具后面）
  → 家具遮角色。`foot[1]` 是家具**与地面接触区的后缘**，不是它的视觉顶端。
- 曾用 `low`/`sort`/`above` 三段 band + **底边** y-sort 来近似这条规则，于是「人站矮柜右侧被柜挡」
  「人站桌下方仍被桌吞」反复出现 —— 那是近似的裂缝，不是一个个孤立 bug。现已按几何统一。
- **矮家具只遮下半身**：家具排在角色前、又声明了 `occludeH`、且角色脚点落在它进深内时，
  在角色之后补画家具下缘 `occludeH` 高的一条，露出角色上半身（避免一张矮桌整个吞人）。
- **飞行角色(`airborne`)不受「上方被家具遮」约束**。那条规则是给**站在地面**的人用的
  （人绕到柜子后面被柜子挡）；飞行的人高于所有地面家具，即使在家具后方也从其**上方**飞过，
  不该被桌面陈设埋掉。`placeActor(..., { airborne: 高度px })` → 身体抬到空中、影子淡而小、
  排序进**飞行层**（`1e9 + baseY`：压住所有地面家具与地面角色，仍在 `above` 前景 2e9 之下）。
  婆婆骑扫帚移动与悬空看球时飞，落地做事（搅锅/织毛衣/坐/睡）不飞。
- **`above`** 永远前景（门帘、近侧栏杆），key = 2e9
- **`attach` 只改 `sortKey`**：附着物（抱枕在床上）保持贴着宿主排序，不参与顶边规则
- **fx 分两层**：地面装饰（`cat:'地面'`，如法阵毯）的 fx 在 **L1.5** 画，会被压在其上的家具正确遮住——否则金线/粒子透过桌面像半透明。火/烟/能量场那类空中效果留在 **L6**（画在实物之后，可盖住角色）

**遮挡的三层心智**：① 站地角色 vs 家具 —— 脚点 vs 家具顶边（左下右人遮、上家具遮）；
② 矮家具遮站地角色时 `occludeH` 只遮下半身；③ 飞行角色 —— 独立飞行层，压住所有地面物。
三层互不干扰：给飞行加层没有动地面规则，站立四方位测试逐帧不变。

---

## 3. 角色 · 道具 · 寻路

```js
defineActor(id, { name, scale, footMode, foot, baseFacing, palette, get poses() })
window.placeActor(id, footX, footY, pose, flip, opt)
window.placeProp(assetId, footX, footY, opt)      // 道具与角色同一排序空间
window.actorSprite(id, pose, flip)
window.actorAnchor(id, pose, x, y)                // 锚点从 sprite 真实宽度取
```

- **`scale` 全局一致**（当前 8）。颗粒不同大，画面就不像一个世界，这条优先于构图
- **小动物不按真实比例**：真猫是人的 1/3，scale 8 下只剩 5 格，画不出猫 —— 放大到约 2/3
- `footMode:'bottom'` 按 sprite 自身底边落地；姿态尺寸有差异时**必须**用它
- `baseFacing` 声明基准朝向，规范是**侧向一律朝右**
- 姿态只在 `pdef` 定义一次，actor 用 getter **引用**（快照会让新姿态静默回退成 `stand`）

```js
window.roomGrid(room)                              // 从 plan 烧 40px 网格（有缓存）
window.gridPath(room, sx, sy, tx, ty)              // 拐点序列
window.walkPose(self, { rate })                    // 朝向 → { pose, flip }
window.idlePose(self, pose, actorId)               // 站姿微动:眨眼/呼吸（角色有该姿态才生效）
window.stepPace(self, [x0, x1], speed)             // 水平踱步往返
```

### 日程调度

```js
window.pickAct(acts, current, { filter })          // 选下一个行为
window.startWalkTo(self, act, room, actorId)       // 起步:寻路到锚点
window.stepWalk(self, speed)                       // 推进一步，返回是否抵达
```

```js
window.stepFly(self, speed)                        // 直线飞行，不寻路
window.stepHop(self, pts, t, { period, height })   // 在一串落点之间【跳】
```

**`stepHop`** —— 梅花桩、踏石过溪、屋顶跳跃都是这个动作:不寻路、不匀速,一跳一落地循环。
桩间直线插值,离地高度走正弦(起跳最低 → 中途最高 → 落点归零)。返回:

| 字段 | 用途 |
|---|---|
| `x` `y` | 当前**脚点**,直接交给 `placeActor` |
| `lift` | 离地高度 → 交给 `placeActor` 的 `airborne`(身子抬起、影子缩小变淡、压过地面家具) |
| `phase` | 本跳进度 0..1 → 房间据此**换姿态**:腾空一个、落桩一个 |
| `landing` | 刚落到点上的那一帧 → 可触发音效 / 台词 |

腾空姿态值得**单画一个**(丹增的 `hop`:臂外展平衡、膝分开收起、**最底一行留空**让脚离开地面基线)——
拿站姿凑合的话,`airborne` 抬得再高也只是「一个站着的人被举起来」。

**走和飞是两种步法，不共用一支**。`stepWalk` 是**轴优先**的：先走完 x 再走 y，于是走出 L 形折线而不是斜穿。改成两轴同时推进会让整个走位观感变掉 —— 这是行为契约，不是实现细节。它同时负责取下一个路径点，返回 `true` 才表示**真的走完了**。

- 权重写在行为的 `w`（缺省 1）；`exclude: true` 的不参与随机 —— 按钮驱动的行为（起课 / 起局）用它，否则会被随机选中并按它的 `dur` 钉住
- **会飞的角色去某处，用 `stepFly`**：走斜线、不寻路。天上没有家具要绕，
  而绕出来的 L 形折线反而暴露了「她其实在走」。婆婆骑扫帚，从屋子另一头到
  水晶球上方**一秒半**；先前让她按走路寻路过去要 20 秒，玩家的判断是按钮坏了
- 房间只保留**自己特有的**筛选条件，用 `opt.filter` 传入（阿云要避开猫当前所在的锚点）。筛空了会自动放宽，不会卡死

**寻路只有这一套。** 手工路网的边是直线、不保证避障 —— 曾造成 18 处穿模。门禁：`pathlint.py`。

---

## 3.55 规范姿态（codex）

```js
defineActor(id, { ..., codex: 'popo' })   // 四向两帧从设计规范 B0 取回
window.codexPoses(specId)                 // → { poses, palette }
window.CODEX                              // { FRONT, SIDE, BACK, WALK }
window.faceOf(dx, dy)                     // 朝向判定，走路与将来任何定向共用
```

**角色的四向两帧在 B0 里已经画好，40 个角色全都有**：`FRONT/SIDE/BACK` 是帧一，
`WALK` 是帧二。B0 写着「此表为**单一数据源**，游戏 sprite 与之对齐」——
`codex` 就是那个「对齐」。房间不该再画第二套，画了规范那句话就成了空话。

**婆婆是现成的教训**。她的三向图本来就骑着扫帚（`side` 左侧那片 `yYYy` 是刷毛、
`NN` 是杆）。我没读规范，判断「她需要一个载具」，另建了一整套载具合成系统
（`defineVehicle` / `riderSprite` / `placeRider` / 三个自画的骑乘姿态 / 一把自画的扫帚），
全部作废删除。**规范先读，再动手**。

**必须在引擎侧合并**。房间脚本先于引擎执行，在房间里写
`window.codexPoses && window.codexPoses('popo')` 拿到的是 `undefined`，
而 `&&` 会把这件事**静默跳过** —— 姿态照旧是自画的那套，页面不报错，
看起来完全正常。所以由 `defineActor` 的 `codex` 字段声明，取不到直接抛错。

## 3.6 表演态 ★ 每间房唯一由玩家发起的行为

```js
room.perform = {
  actor: { x, y, poses, fps, flip, pointer, fly, speed },   // 演出位置与姿态
  props: [[id, x, y], ...],          // 表演时道具归位（起课要用的摆到桌上）
  button, labels: [闲, 演],
  stateKey,                          // 道具的 fx/light 读 room.state[stateKey]
  lines: [...], lineGap,             // 到位即说 + 全程轮播
  onArrive(room, self, t), onLeave(room),
}
window.wirePerform(room)                                   // 首帧接线，接不上抛错
window.stepPerform(room, self, t, { startWalk, pick })     // 状态机每帧一次
window.setPerform(room, on) · room.performPending · room.performing
```

**本套以阿云那版为准升成引擎标准。** 曾经是三套，同一个问题三个答案：

| | 阿云 | 桃桃 | 婆婆 |
|---|---|---|---|
| 不被日程换走 | `dur:[99999,99999]` | `dur:[999,999]`（仍会到点） | 跳过 `until` 检查 |
| 状态存哪 | `room.performing` | 每帧重算 | `room.state.casting` |
| 按钮文案 | `setPerform` 里 | 点击处 | 每帧同步 |
| 道具归位 | **`perform.props`** | 无 | 无 |

三套里只有阿云那套完整，**而且有另外两套都没想到的东西**：`perform.props` ——
起课时历书摊到左手边、卦筹排到右手边。表演不只是人走过去，道具也归位。

婆婆照抄了桃桃那版简化实现，再拿补丁去补它缺的部分。**「她自己跑了」「按钮说着
与画面相反的话」「没台词」不是新 bug，是简化版缺的口子。** 前两个角色顺利，
是因为阿云那套当初一次想清楚了 —— 遇到同类问题，**先找那个做对了的，从它提炼，
不要另起炉灶**（我曾据此另写了第四套 `definePerform`，同样作废）。

引擎保证的不变量：

1. 演出行为**不参与随机日程**
2. **不自动结束** —— 玩家开始的，由玩家结束
3. **按钮文案由状态决定**；与点击分家，界面就会说与画面相反的话
4. **到位那一刻**才置状态、才开口 —— 人还在半路道具就演上了，那是道具自己在演
5. 台词**到位即说 + 全程轮播**，不走日常那套「62% 概率咕哝一句」
6. 喊停时清状态、从原地回日程

**看头要落在大东西上**：婆婆的球 116px，缩到真机 30px，画 3px 的符文等于没画。
改成 580×560 的五芒星阵整个流光才一眼可辨。**用暖金不用冷白** —— 冷白光源会把
整个角落连蜡烛一起洗白，屋子的色温一格都不该动。

## 3.5 效果原语（火 · 烟 · 能量场）

```js
window.fxFlame(g, x, y, { t, w, h, seed, alpha })            // x,y = 焰根
window.fxSmoke(g, x, y, { t, n, rise, r, spread, speed, color, alpha })
window.fxAura (g, x, y, { t, rx, ry, color, alpha, layers }) // 无硬边的能量场
```

**素材不许自己画火和烟。** 曾经每件各画各的，于是灶火是「一个橙色矩形在上下缩放」、烟是「一个方块往上飘」。

三条画法上的道理，**改配色救不回来**：

- **火的关键是形不是色** —— 下宽上尖的舌头，逐行按 `pow(1-f, 0.62)` 收窄，三层焰心各以不同频率摇曳。多簇要**错开 `seed`**，否则整块一起明灭
- **烟必须用圆不用方块** —— 方块升上去像纸片，圆才像气。上升中膨胀、尾段快速淡出、随高度横向漂移
- **能量体不许有硬边** —— 边界由多层径向衰减自己散出来。「像镜子」一半来自那条清晰的轮廓线，另一半来自**中心比边缘亮**（那是抛光金属的打光法，虚空要反过来：中心是整个东西里最黑的地方）

---

## 4. 交互 · 叙事 · 状态

```js
window.attachRoomInteraction(canvas, room, opts)   // 逐像素命中
window.drawInteraction(g, room, canvas, t)         // 反馈：素材自身叠 lighter
window.drawSay(g, anchor, text, opt)               // 气泡（换行 / 边界 / 尾巴）
window.drawEmote(g, name, anchor, t)               // zzz heart sulk note star sweat gamepad
window.defineEmote(name, fn)                       // 扩展表情，不改引擎
window.drawLink(g, from, to, opt)                  // 角色↔物件连线（手柄线 / 牵绳 / 视线）
window.roomState(room, patch)                      // 房间状态，**必须可查询**
```

- **两句都要调**：`attachRoomInteraction` 漏调过一次，49 件素材声明了 `clickable` 却一件点不到
- 反馈**不许画框，也不许用包围盒驱动光晕** —— 按 `max(w,h)` 算半径会照亮一大片空气
- 状态放在 room 而非素材内部，别处（台词 / 色温 / 变体）才读得到

---

## 5. 门禁

| 工具 | 卡什么 | 底线 |
|---|---|---|
| `hardcodelint.js` | 裸绘制 / 尺度参数 / 锚点字面量 / 标点 | **0** |
| `pathlint.py` | 锚点在家具内 / 路径穿家具 | **0** |
| `assetlint.js` | 素材元数据 / 布局 / 通道 | 全绿 |
| `regress.js check` | 视觉回归（**从仓库根跑**） | 全绿 |
| `roomstats.py` | 数据带（见 PLAYBOOK §3.7） | 在带内 |
| `bench.js` | 帧耗时 | < 16.7ms |
| 全 `<script>` 语法 | 逐段 `bun build` | 通过 |
| `poselint.js` | **姿态 vs 设计规范 B0**:四向是否俱全 · 命名是否合规 · 别名是否残留 · 载具朝向是否齐 | 全部符合 |
| `verify.js` | **活的验收**:引擎装载 · 姿态取得回真图 · 素材画得出像素 · 交互接上了 · 寻路可用 · 31 秒无静默异常 | 全部通过 |

**只查一段脚本 ≠ 查了文件** —— 曾只验素材库，房间脚本的缺逗号一路通过。

---

## 6. 环境

`node` 在本机是 nvm 懒加载函数，可能失效。真 runtime 是 **bun**：

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun tools/xxx.js "$PWD/mini/design.html"     # 必须绝对路径
bun tools/regress.js "$PWD/mini/design.html" check   # 文件在前，模式在后
#   写成 `regress.js check` 会把 check 当文件名 → ERR_INVALID_URL，看着像工具坏了
bun build 文件 --outdir /tmp/out                    # 代替 node --check
```

---

## 7. 尚未收编

见 `ENGINE-GAPS.md`。当前：**宠物调度三套实现**（猫 / 狗 / 兔各一套走位）、`stepPursuit` / `drawShadow` / `resolveTarget` 无调用方。

主角调度已收编（`pickAct` / `startWalkTo` / `stepWalk` / `walkPose`）。

**收编一项，就把它从 GAPS 移进本文。** 本文写着的，就是受控的。
