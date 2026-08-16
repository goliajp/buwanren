# unmei backend

Rust workspace · **5 crate · 2 binary**。PostgreSQL 18 + kevy-embedded(in-process KV)。

| crate | 角色 |
|---|---|
| `unmei-domain` | 共享 DTO + commerce v2 域模型(聚合根 / 状态机 / 领域事件 / port trait)+ Error |
| `unmei-wx` | 微信生态 SDK(小程序登录 / 公众号 OAuth / 支付 v3) |
| `unmei-carrier` | 物流 adapter(kuaidi100 / manual) |
| `unmei-api` | 业务 BFF · :6028 · 客户端面 + webhook + 后台 worker |
| `unmei-admin-api` | 运营后台 API · :6029 |

> 依赖方向目前不干净:`unmei-domain` 里还有 11 个 `PgXxxService`(sqlx 落地)+ 聚合根 `#[derive(sqlx::FromRow)]`。
> 目标形态与收敛计划见仓库根 `README.md` 的「Clean arch · 进行中」。

## 跑起来

### 用 docker-compose(推荐)

```bash
cd ..                       # 仓库根
cp .env.example .env
docker compose up -d --build
```

pg / unmei-api / unmei-admin-api / webadmin 一起起。详见 `../QUICKSTART.md`。

### 只起 pg,后端本地 cargo run

```bash
bash ../scripts/setup-dev.sh          # 起 pg18 容器并等健康
cargo run -p unmei-api                # :6028
cargo run -p unmei-admin-api          # :6029
```

**migrations 与 seed 不用手动跑** —— 两个 binary 启动时自己 `sqlx::migrate!` + 灌 `seed/seed.sql`（幂等 `ON CONFLICT DO NOTHING`）。

### 编译与测试

```bash
SQLX_OFFLINE=true cargo check --workspace --all-targets
SQLX_OFFLINE=true cargo test --workspace          # 25 个单测,不需要数据库

# 需要 pg + 两个服务在跑:
bash ../scripts/e2e.sh                # happy path:下单 → 支付 → sweep → 履约
bash ../scripts/verify-semantics.sh   # 边界:该拒的拒了吗、该 404 的 404 了吗
```

两个集成脚本分工不同,别只跑一个:`e2e.sh` 证明**能走通**,`verify-semantics.sh` 证明**走不通的地方真的走不通**(混币种下单、越权取消、已付订单直接取消、幽灵 ID 的写操作)。

全仓统一用**运行期** `sqlx::query()` / `query_as()` / `query_scalar()`，**不用 `query!` 宏**，所以编译不连库、也不需要 `.sqlx` 缓存。CI 用 `SQLX_OFFLINE=true` 把这条约定钉死:谁重新引入 `query!` 宏，构建当场失败。

代价说明白:这 58 处放弃了编译期 SQL 校验，换来的是「没有数据库也能构建」。SQL 正确性由 `scripts/e2e.sh` 的端到端 happy path 兜。

## 环境变量

| 名 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgres://unmei:unmei_dev_pwd@localhost:6032/unmei` | PG 连接串 |
| `MINGLI_API_BASE` | `http://localhost:6027` | mingli-api 算力源 |
| `UNMEI_CACHE_DIR` | `./data/cache` | kevy-embedded AOF 落盘目录 |
| `UNMEI_ADMIN_CACHE_DIR` | `./data/admin-cache` | admin 进程的同上 |
| `UNMEI_JWT_SECRET` | dev 串 | 客户端 JWT 密钥 |
| `UNMEI_ADMIN_JWT_SECRET` | dev 串 | 后台 JWT 密钥 |
| `UNMEI_API_BIND` | `0.0.0.0:6028` | unmei-api 监听 |
| `UNMEI_ADMIN_API_BIND` | `0.0.0.0:6029` | admin 监听 |
| `WX_MP_APPID` / `WX_MP_SECRET` | 空 | 留空则微信走 mock，本地全链路仍可跑通 |
| `KUAIDI100_CUSTOMER` / `KUAIDI100_KEY` | 空 | 留空则物流走 mock |
| `RUST_LOG` | `info,...=debug,sqlx=warn` | tracing-subscriber |

## 端点

`unmei-api` 30 条 `/v1/*`，`unmei-admin-api` 58 条 `/admin/*`。清单不在这里手抄（抄了就会漂），直接从代码取：

```bash
grep -rh '\.route("' unmei-api/src/routes/*.rs       | sed 's/.*\.route(//;s/,.*//' | tr -d '"' | sort -u
grep -rh '\.route("' unmei-admin-api/src/routes/*.rs | sed 's/.*\.route(//;s/,.*//' | tr -d '" ' | sort -u
```

商业子系统的端点契约见 `../docs/commerce-architecture.md` §6。

## 鉴权

```
客户端:
  POST /v1/auth/anonymous { platform, region, locale }   → { token, user, expires_in: 30d }
  或 POST /v1/auth/wx/miniprogram { code, nickname, avatar_url }
  后续 header: Authorization: Bearer <token>

后台:
  POST /admin/auth/login { email, password }             → { token, name, roles, region_scope, expires_in: 8h }
  后续 header: Authorization: Bearer <token>
  路由内 a.requires_role("content") 校验角色;region_scope 控制 6 cell 可见范围
```

dev 默认管理员:`admin@unmei.local` / `admin123`。

## 业务核心 · `/v1/naji/spin`

`routes/naji.rs::spin()`：

1. 取 `app_user`(active_natal_id / platform / region / locale)
2. 取 `natal_summary`(primary_yongshen / avoid_wuxing)
3. 调 mingli-api `/api/cast` 拿真奇门时盘，落 `naji_record.t_chart` 留审计
4. `ai_compose::` 按主用神 + 时辰打分抽取 —— `pick_gate_by_yongshen` / `pick_quote` / `pick_yiji`
5. 写 `naji_record` + 触发 count 类徽章

seed 固定为 `hash(user_id, 年月日时)`，所以同一用户同一时辰结果稳定，跨时辰才换。

## 后台 worker

常驻 `unmei-api` 进程（`workers::spawn_all`）：`outbox` 事件分发 · `payment_sweep` 支付轮询 · `recon` 对账 · `shipment_trace` 物流追踪 · `subscription_billing` 订阅续费。
