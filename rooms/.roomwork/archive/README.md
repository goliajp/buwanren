# .roomwork/archive —— 只读存档

这里放**已经无法直接套用、但不该消失**的历史工作产物。不要试图 `git apply` 里面的东西。

## 2026-07-19-orlando-rebuild.patch

奥兰多（orlando）房间重建的未完成改动，877 行 diff，只动 `design.html` 一个文件（+349 / −514）。

> patch 里的路径写的是 `mini/design.html` —— 那是 2026-08-16 工坊从 `mini/` 拆到 `rooms/` 之前的旧位置。
> 这份 patch 本来就不能直接 apply（见下），路径不改，保持与 diff 头一致。

**来历**：这原本是 `labs/lab32-mingli` 仓库里的一个 git stash（`stash@{0}: On develop: orlando-rebuild-uncommitted`，2026-07-19 09:53 创建），从未提交过。2026-08-15 立项拆分、删除 lab32 目录时导出成 patch 存到这里，否则会随目录一起消失。

**基线**：stash 的父提交是 `1595742 rooms: method reset — revert all D2.0 density layers, add planlint gate, rebuild shenyan on validated floor plan`（2026-07-19 09:45，即 method reset 之后 8 分钟）。所以它是**在校验过的新方法之上**做的重建，不是被否掉的 D2.0 老稿。

**为什么不能直接应用**：
- patch 期望的 `design.html` blob 是 `7251b47`，而当前文件是另一份——那 137 个 commit 的村民房工作后来被整体回退到 `6b4d975`（见 [[project-villager-rooms-rolled-back]]）
- 当前 `design.html` 里**根本没有 `FULLROOMS` 这个结构**，patch 的每一个 hunk 都无处落脚
- 原仓库已删除，找不回基线快照

**还能用来干什么**：重做奥兰多房时，把它当**参考读物**——里面有巴黎沙龙风的紫罗兰墙 + 金线护墙板、掌纹挂轴（五指 / 三主线 / 命运线 / 七丘 / 星纹 / 腕线）、椭圆金匾、鎏金壁烛台等具体画法。照 [[feedback-no-template-layout]] 的要求，布局拓扑仍要重新设计，不许照抄。
