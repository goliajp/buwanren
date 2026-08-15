# 最后整理 · 让引擎尽可能完备

两轮审计（引擎层 + 三房应用 + 素材库）后的收尾整理。目标：三房 100% 靠引擎、引擎零房间特化、素材库规范一致。含高风险操作。

## 已完成（前几轮）
- 表演态三套合一（以阿云版为准）· 小动物寻路躲家具 · 遮挡按顶边+飞行层
- 引擎死代码清理 · 素材 fx 泛用化（读 room 参数不读全局）
- idlePose / stepPace 收编 · 地面 fx 移到 L1.5 被家具遮

## 本轮阶段

### 阶段 1 — 引擎绘制原语补齐 ✅ 完成
共享原语集 `PRIM` 只有 `pxC/pxR/bx`，缺 `pxE`（椭圆，素材里 96 份拷贝）、`glow`（发光，43 份）。补进 `PRIM`，引擎提供完整像素原语。
**不强迁旧素材 draw**：它们 self-contained、且 tao/popo 素材无回归保护（regress 只快照 AYUN_ROOM），逐个重写风险 >> 收益。新素材有完整原语可用即可。

### 阶段 2 — 阿云素材命名规范化 ✅ 完成（56 素材，regress 指纹不变）
阿云 57 个素材用旧命名（`shelf_books` 无前缀、单引号 def），违反命名规则。
- 全部加 `ayun_` 前缀 + 单引号→双引号
- 同步全部引用：plan / attach / anchor / perform.props / actorAnchor / roomAnchorOf
- 跨房引用（婆婆房用了 4 个 generic：broom/cloak_hook/crates_stack/cushion_round）同步
- `tao_swing`（异常单引号）只改双引号，名不变
**验证**：regress（阿云 4 场景）抓 id 漏引用；婆婆房出图确认 4 件仍在

### 阶段 3 — 收尾 ✅ 完成
全门禁 + 三房出图 + ENGINE.md/WORKFLOW 更新

## 命名规则（本轮确立，记入 WORKFLOW）
- 素材 id = `<出生房前缀>_<物件>`，前缀 = `fromRoom`（ayun_/tao_/popo_）
- **generic 也带出生房前缀** —— 前缀是溯源（哪个房首次创建），`scope` 才决定能否跨房复用
- def 一律**双引号**
- 姿态 `pdef` 用角色姿态名（stand/walkside1/blink），不带房间前缀

## 明确不做（越权/低收益/无保护）
- 强迁 133 处 draw 到共享原语（tao/popo 无回归保护）
- 删 8 个未引用 generic 素材（有效资源，库=可选目录）
- 重构 tao_/popo generic 去前缀（现规范就是带前缀，改动大）
- 丹增房上引擎（独立大工程，另立）
