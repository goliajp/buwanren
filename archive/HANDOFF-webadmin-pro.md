# unmei · webadmin 专业化 · 交接(下个 session 继续)

> 时间:2026-06-26 凌晨
> 状态:webadmin 第一版工具化重写完成,**还需继续打磨**
> 下个 session 入口:读本文 + 打开 http://localhost:6030 看现状

---

## 服务在跑

| 端口 | 服务 | 进程 / 容器 | PID 文件 |
|---|---|---|---|
| 6032 | PostgreSQL 18 | docker container `unmei-postgres` (healthy) | — |
| 6028 | unmei-api | `target/release/unmei-api` | `.claude/pid-registry/unmei-api.pid` (5434) |
| 6029 | unmei-admin-api | `target/release/unmei-admin-api` | `.claude/pid-registry/unmei-admin-api.pid` (12471) |
| 6030 | webadmin | `node node_modules/.bin/vite --port 6030 --host` | `.claude/pid-registry/unmei-webadmin.pid` (14708) |
| —  | kevy-embedded | in-process(api 进程内 AOF `/tmp/unmei-cache`) | — |
| —  | mingli-api :6027 | **未起** · webadmin Engine 页会显示「offline」+ 启动命令 | — |

下个 session 起手先验证:
```bash
docker compose ps
for f in /Users/doracawl/workspace/goliajp/buwanren/.claude/pid-registry/unmei-*.pid; do
  pid=$(cat "$f"); ps -p "$pid" -o pid,command 2>/dev/null | tail -1
done
curl -s http://localhost:6028/v1/health; echo
curl -s http://localhost:6029/admin/health; echo
curl -s -o /dev/null -w "webadmin %{http_code}\n" http://localhost:6030/
```

进程死了就重启:
```bash
# api
cd /Users/doracawl/workspace/goliajp/buwanren/backend
nohup env DATABASE_URL='postgres://unmei:unmei_dev_pwd@localhost:6032/unmei' \
  UNMEI_API_BIND=127.0.0.1:6028 UNMEI_CACHE_DIR=/tmp/unmei-cache \
  MINGLI_API_BASE=http://localhost:6027 \
  ./target/release/unmei-api > /tmp/unmei-api.log 2>&1 < /dev/null &
disown

# admin-api
nohup env DATABASE_URL='postgres://unmei:unmei_dev_pwd@localhost:6032/unmei' \
  UNMEI_ADMIN_API_BIND=127.0.0.1:6029 UNMEI_ADMIN_CACHE_DIR=/tmp/unmei-admin-cache \
  ./target/release/unmei-admin-api > /tmp/unmei-admin.log 2>&1 < /dev/null &
disown

# webadmin
cd /Users/doracawl/workspace/goliajp/buwanren/webadmin
nohup node_modules/.bin/vite --port 6030 --host > /tmp/webadmin.log 2>&1 < /dev/null &
disown
```

PG 数据如果丢了,重灌 seed:
```bash
cd /Users/doracawl/workspace/goliajp/buwanren
docker compose exec -T postgres psql -U unmei -d unmei -f /dev/stdin < backend/seed/seed.sql
docker compose exec -T postgres psql -U unmei -d unmei -f /dev/stdin < backend/seed/seed_more.sql
```

---

## 本轮已落地(webadmin v0.2 工具化)

### 设计 tokens(参考 `design.html` §3 wa-*)

- 字体:`Inter + JetBrains Mono`,完全去 serif
- 色板:`canvas / surface / surface-2/3 / ink-2~5 / gold / jade / vermilion / slate`
  - 注意:Tailwind config 把背景色叫 **`canvas`**(不能叫 `bg`,否则 `bg-bg` 跟 utility prefix 冲突)
- 工具类:`.num` (tabular-nums) / `.mono` / `.uplabel` / `.chip` `.chip-{ok,warn,bad,mute,info}` / `.btn` `.btn-{prim,soft,link,warn}` / `.input` `.select` / `.kpi` / `.panel` `.panel-head` / `.wa-table`(密集表)
- 文件:`tailwind.config.js` / `src/index.css`

### 布局

- `src/components/Layout.tsx` — 200px sidebar + 10px topbar(显示 admin-api / pg / kevy 状态点)
- `src/components/PageHeader.tsx` — 顶部 title/sub + 右侧 stats 行
- `src/components/util.ts` — `rel/ts/yuan/thou/shortId/platformChip/statusChip` 格式化辅助

### 9 个页面(全部 fullwidth + sans + 密集 table)

| route | file | 说明 |
|---|---|---|
| `/` | `pages/Dashboard.tsx` | 8 KPI + DAU area chart + 八门 bar + Recent naji table |
| `/users` | `pages/Users.tsx` | 30 行/页 + platform/region/q 三轴过滤 + 分页边界 |
| `/naji` | `pages/Naji.tsx` | **新页** · user/gate/platform 过滤 · suit/avoid chip · 15s 自动刷新 |
| `/orders` | `pages/Orders.tsx` | **新页** · status/channel 过滤 · paid_revenue 聚合 |
| `/payments` | `pages/Payments.tsx` | **新页** · payment_order 流水 · success_amount 聚合 |
| `/products` | `pages/Products.tsx` | 缩略图 + 上下架 toggle + region/platform chip |
| `/quotes` | `pages/Quotes.tsx` | 正文模糊搜索 + wuxing/gate chip + archive 操作 |
| `/feature_flags` | `pages/FeatureFlags.tsx` | **矩阵 table**:code × 4 platform × 6 region · 点击 cell 切 OFF override |
| `/mingli` | `pages/Mingli.tsx` | 健康探针 + 21 叶 table + 离线时 remediation 命令 |

### 后端新加 3 个 endpoint(都已重 build 重启)

- `GET /admin/naji?page=&size=&user_id=&gate=&platform=` — `backend/unmei-admin-api/src/routes/naji.rs`
- `GET /admin/orders?page=&size=&status=&channel=&user_id=` + `paid_revenue_cents` — `routes/orders.rs`
- `GET /admin/payments?page=&size=&status=&channel=` + `success_amount_cents` — `routes/payments.rs`

`routes/mod.rs` 和 `main.rs` 都已挂载。

---

## 下个 session 继续做的事

用户原话:**「webadmin 太不样子货,要专业工具化的系统」**。本轮做了基础工具化,但还有打磨空间。

### A. 视觉细节(优先级中)

1. **TopBar 加实时时钟**(`<div id="now">—</div>` 现在死的,要 `useEffect setInterval` 更新)
2. **sidebar 加快捷键提示**(原计划 `⌘D` `⌘U` 之类,现在没绑;可上 `react-hotkeys-hook`)
3. **KPI 加趋势**(delta vs yesterday;后端要在 `/admin/dashboard/overview` 加一行)
4. **DAU chart 加 hover tooltip**(SVG `<title>` 或 portal)
5. **table 行点击展开 detail panel**(naji.t_chart / orders.items 完整 JSON / payments.request+notify_payload)
6. **空态 / 错误态 / loading skeleton**(目前是 plain text「loading…」,要 shimmer 或 dot)

### B. 功能补全(优先级高)

1. **Users 详情侧抽屉** — 点 `view →` 调 `GET /admin/users/:id`(后端已有),显示 naji_count/order_count/badges
2. **Naji 详情** — 展开看 `gate_explain` / `t_chart` jsonb tree(可上 `react-json-view`)
3. **Orders/Payments 状态机操作** — 后端要加 `PATCH /admin/orders/:id`(发货 / 退款标记)+ `POST /admin/payments/:id/refund`
4. **Quotes/Products CRUD 完整** — 当前只有 archive/toggle,需要弹出 form 创建/编辑
5. **批量操作** — 表头 checkbox + bulk archive/publish

### C. 数据 / 性能(优先级低)

1. **server-side search debounce** — 现在每次按键都重发请求
2. **react-query stale time** 调整(不要默认 0)
3. **paginate cursor 化** — 大数据集 OFFSET 慢,改 cursor (created_at, id)
4. **CSV/Excel 导出** — Users / Orders / Payments 三页加 `download CSV` 按钮
5. **WebSocket 实时纳吉流** — 现在 polling 15s,可以走 SSE / WS

### D. 后端配套(优先级中)

1. **Admin 操作要写 `audit_log`** — 现在改 feature_flag / archive quote 都没 log,要 wrap mutation
2. **Quotes/Products 创建端点缺真实接入**(`POST /admin/quotes` 后端写了但前端 Quotes.tsx `+ new quote` 按钮还是空 onClick)
3. **Stats 加 cohort / 漏斗 / retention**(`/admin/stats/cohort` / `/funnel`)

### E. UI 库选型决策(优先级低,但要早讨论)

当前是手写 tailwind class,如果后续上更密集的工具控件(数据表格 sort/filter/虚拟滚动 / date picker / 命令面板 ⌘K),可能要引入轻量库:
- **TanStack Table v8**(headless 表格 — 排序/筛选/虚拟滚动)— 推荐,跟现有 react-query 一脉
- **cmdk**(命令面板 ⌘K)— 工具化标配
- **react-day-picker**(date range filter)
- 不推荐:antd / mantine / shadcn(风格太重,跟我们紧凑工作台不符)

---

## 已知 issue / 技术债

1. **`/admin/quotes` 列表 `gate`/`wuxing` 字段在前端有可能 null** — 检查 `r.gate ?? []` 防御
2. **rust-analyzer 报 sqlx prepare 警告** — 不影响 `cargo build`(因为 DATABASE_URL 环境变量在跑时设)
3. **kevy-embedded AOF 没有 GC** — 长跑会涨;改 mock 模式或定期 rewrite
4. **Tailwind v3 用了 5.7MB 全部预编译** — 下个 session 可考虑 JIT mode 限缩(虽然 v3 默认就是 JIT)
5. **Mingli health 当 mingli-api 离线时 reachable=false** — 这是正常的;启了算力源就绿
6. **admin_user password hash**:`admin123` 的 hash 是 argon2id 用 salt `unmei_admin_salt`,见 `seed.sql` line 113

---

## 记忆 / 上下文

- `.claude-profile-3/.../memory/MEMORY.md` 已加 `reference-kevy` 条目
- 仓库根下还有:
  - `architecture.md` v0.2(后端架构,加了 §11 微信生态)
  - `design.html` v0.4(三章融合 · §1 客户端 7 屏 · §2 业务 11 卡 · §3 webadmin 8 MacBook)
  - `QUICKSTART.md` / `README.md`(docker-compose 版)
- 备份:`backend-v0.1-sqlite-archive/`(原 SQLite demo)

下个 session 直接读本文 + 选 §B 优先做即可。
