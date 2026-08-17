# rooms · 村民屋工坊

像素村民屋的**生产线**：一间房 = 一个村民的身份说明书。产物是单文件 `design.html`（自包含，只外链 `assets/tilemap_packed.png`）。

> ## ⚠ `design.html` 是构建产物，不要直接改
>
> 2026-08-17 起它由 `src/` 下 34 个源文件拼出来。直接改它，下一次 build 会整个盖掉。
>
> ```bash
> # 改完 src/ 之后
> bun rooms/tools/build.js
> # 查产物与源码树是否同步（CI 也跑这条）
> bun rooms/tools/build.js --check
> ```
>
> 拆包判据是**逐字节相同**：拆完拼回来与拆前 sha256 一致（`81990f63`），
> 比「渲染没变」强 —— 后者只说明看不出差别。

2026-08-16 从 `mini/` 拆出来。此前它和微信小程序工程挤在同一个目录里，两者没有任何代码关系。

## 从哪里起步

**开新房从 [`.roomwork/PLAYBOOK.md`](.roomwork/PLAYBOOK.md) 起步**，那是总纲，串起下面四份：

| 文档 | 管什么 |
|---|---|
| `.roomwork/WORKFLOW.md` | 完整工作流 S0–S8，照着走 |
| `.roomwork/METHOD.md` | 单间怎么设计（S1–S6）+ 手法库 |
| `.roomwork/ENGINE-API.md` | 接口签名与数据结构 |
| `.roomwork/ENGINE-CHECKLIST.md` | 引擎能力清单 + 事故记录 |

## 目录

| 路径 | 是什么 |
|---|---|
| `design.html` | **构建产物**：引擎 + 全部房间 + 素材库，单文件。改 `src/`，别改它 |
| `src/` | 源码树。`bible/` 设计册正文与样式 · `engine/` 引擎 · `assets/` 素材库（按房分文件）· `rooms/` 六间房的 canvas 脚本 · `manifest.json` 拼装顺序 |
| `assets/` | 外部素材（目前只有 tilemap） |
| `tools/` | 42 个门禁 / 诊断 / 出图脚本 |
| `.roomwork/` | 生产文档、角色档案、房间设计稿、视觉回归基准 |
| `.pxwork/` | 像素稿工作区 |
| `.dev/` | 迁移与实验脚本（tao-migration 等） |

## 跑工具

**从仓库根跑**，路径传绝对路径：

```bash
python3 rooms/tools/pathlint.py rooms/design.html            # 走位不穿模
bun rooms/tools/regress.js "$PWD/rooms/design.html" check    # 视觉回归
bun rooms/tools/assetlint.js "$PWD/rooms/design.html"        # 素材 / 布局合规
bun rooms/tools/blobscan.js  "$PWD/rooms/design.html"        # 全库 foot vs 实体
bun rooms/tools/build.js --check                             # 产物与源码树同步
bash rooms/tools/mutationtest.sh                             # 查门禁本身报不报得出红
```

> 2026-08-17 起 31 支 playwright 工具都会自己 `path.resolve`，相对路径也能跑。
> 在那之前传相对路径会得到 `net::ERR_INVALID_URL`（Playwright 把它当 URL 解析），
> 看起来像文件坏了 —— 这是本仓库反复踩的坑之一。
>
> ⚠ `regress.js` 的基准路径相对 CWD，在子目录跑会报「无基准」而基准其实好好的。**工具报零先怀疑工具**。

## 已知欠账

- **视觉回归 12 处与基准不符**（2026-08-16 实测）：`BAILU_ROOM` / `POPO_ROOM` / `TENZ_ROOM` 的 4 个姿态全部漂移；`SHENYAN_ROOM` / `TAO_ROOM` 全绿。已用搬家前的字节相同副本对照验证，**与 `mini/` → `rooms/` 拆分无关**，是既有漂移。要么修房，要么在确认漂移是有意的之后 `regress.js … save` 重设基准
- 台词半角标点：2026-07-20 体检发现 65 条 `say` 中 26 条含半角标点，待修（规则见 `.claude/CLAUDE.md`）
