# archive · 历史物

这里放**不再参与构建、但仍有再读价值**的东西。纯死代码不进这里，直接删（在 git 历史里）。

| 目录 / 文件 | 是什么 | 为什么留 |
|---|---|---|
| `design-history/design.v0.1.html` | UI 设计稿 v0.1 | 设计演进的起点，v0.2 / v0.3 的取舍要回头对照 |
| `design-history/design.v0.2.html` | UI 设计稿 v0.2 · 借鉴不完人 UI/UX | 同上 |
| `design-history/design.v0.4-stitched.html` | v0.3 三章融合的另一版拼接稿 | 与根目录现役 `design.html` 同标题、内容有差异，保留待比对 |
| `design-history/design-admin.v0.2.html` | webadmin 工作台设计稿 v0.2 | webadmin 21 页面的视觉来源 |
| `HANDOFF-webadmin-pro.md` | webadmin v0.2 的交接文档 | 已被 `docs/commerce-architecture.md` 的多区域章节超越，留作历史 |
| `omamori-research/00-background-research.md` | NFC 御守（Omamori）产品的事实调研 | 另一条产品线的调研，不属于 buwanren 主线 |
| `omamori-research/01-architecture.md` | 同上的可插拔管线架构设计 | 「载体 / 身份解耦」的 Adapter 思路对实物商品线仍有参考价值 |
| `omamori-research/omamori-dossier.html` | 御守档案（英文） | 同上 |
| `omamori-research/omamori-dossier-zh.html` | 御守档案（中文） | 同上 |

## 已删除，不在此处

以下是纯死代码，`git rm` 掉了，要看去 git 历史：

- `backend-v0.1-sqlite-archive/` —— v0.1 的 SQLite demo 后端，与 `backend/` 结构一一对应，已被 PG18 版整体取代
- `android/` `ios/` —— 空目录占位
- `backend/unmei-admin-api/src/routes/{orders,payments,products,users,stats,dashboard}.rs` —— 各 4 行的空 Router，功能已由 `routes/commerce.rs` 承接
