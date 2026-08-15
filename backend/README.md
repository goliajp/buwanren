# unmei backend

Rust workspace: 3 crates · 2 binaries(`unmei-api` :6028, `unmei-admin-api` :6029)+ 1 shared lib(`unmei-domain`)。

## 准备

```bash
# 1. sqlx-cli (一次性)
cargo install sqlx-cli --no-default-features --features rustls,sqlite

# 2. 数据库 + seed + sqlx prepare
cd ..  # 到仓库根
bash scripts/setup-dev.sh
```

## 跑

```bash
# 业务 API
DATABASE_URL="sqlite:./unmei-api/unmei.db?mode=rwc" \
cargo run -p unmei-api

# 后台 API
DATABASE_URL="sqlite:./unmei-api/unmei.db?mode=rwc" \
cargo run -p unmei-admin-api
```

## 环境变量

| 名 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | `sqlite:./unmei.db?mode=rwc` | sqlx 连接串 |
| `MINGLI_API_BASE` | `http://localhost:6027` | mingli-api 地址 |
| `UNMEI_JWT_SECRET` | dev 串 | 客户端 JWT 密钥 |
| `UNMEI_ADMIN_JWT_SECRET` | dev 串 | 后台 JWT 密钥 |
| `UNMEI_API_BIND` | `127.0.0.1:6028` | unmei-api 监听 |
| `UNMEI_ADMIN_API_BIND` | `127.0.0.1:6029` | admin 监听 |
| `RUST_LOG` | `debug` | tracing-subscriber |

## 端点速查

### unmei-api · `/v1/*`

```
POST   /v1/auth/anonymous
POST   /v1/auth/wechat              # mock,留接入点
GET    /v1/user/me
PATCH  /v1/user/me
GET    /v1/user/natals
POST   /v1/user/natals
DELETE /v1/user/natals/:id
POST   /v1/user/natals/:id/activate
GET    /v1/natal/:id/summary        # 客户端「本命简介卡」一句话
POST   /v1/naji/spin                # ★ 核心:罗盘一抽
GET    /v1/naji/history
GET    /v1/naji/:id
GET    /v1/product?category=&region=&platform=
GET    /v1/activity?category=&region=
GET    /v1/badge
GET    /v1/user/me/badges
GET    /v1/config                    # 启动拉差异化配置
GET    /v1/health
```

### unmei-admin-api · `/admin/*`

```
POST   /admin/auth/login
GET    /admin/dashboard/overview
GET    /admin/users
GET    /admin/users/:id
GET    /admin/quotes
POST   /admin/quotes
PATCH  /admin/quotes/:id
DELETE /admin/quotes/:id              # 实为 archived
GET    /admin/products
POST   /admin/products
PATCH  /admin/products/:id
GET    /admin/activities
GET    /admin/feature_flags
PATCH  /admin/feature_flags/:code
GET    /admin/stats/dau
GET    /admin/stats/naji_distribution
GET    /admin/stats/products_top
GET    /admin/mingli/health           # 转发 mingli-api 健康
GET    /admin/health
```

## 数据库

- 文件:`backend/unmei-api/unmei.db`(SQLite,演示用)
- 生产改 PostgreSQL · 只需改 `DATABASE_URL` + sqlx-cli sqlite → postgres
- migrations 在 `backend/migrations/`,sqlx 自动跑

## 鉴权流程

```
客户端启动:
  1. POST /v1/auth/anonymous { platform, region, locale }
     → 返回 { token, user, expires_in: 30d }
  2. 后续请求 header: Authorization: Bearer <token>

后台:
  1. POST /admin/auth/login { email, password }
     → 返回 { token, name, roles, expires_in: 8h }
  2. 后续请求 header: Authorization: Bearer <token>
     → middleware 解 JWT → 注入 Admin claims
     → 路由内 a.requires_role("content") 校验
```

## 业务核心:`/v1/naji/spin` 5 步

```rust
// routes/naji.rs::spin()
1. 取 user(active_natal_id, platform, region, locale)
2. 取 natal_summary(primary_yongshen, avoid_wuxing)
3. 调 mingli-api /api/cast → 拿真奇门时盘
4. ai_compose::
   - pick_gate_by_yongshen(主用神 + 时辰)
   - pick_quote(主用神 + 八门匹配,top-5 seed)
   - pick_yiji(主用神 favor + 忌神 disfavor,top-8 取 5/3)
   - pick_recommend(主用神 + region + platform 过滤)
5. INSERT naji_record(t_chart 留真盘审计)
   + 检查 badge 规则(count 类同步,streak 类入 worker)
```

## 算力隐式的关键

`natal_summary` 表 = 桥。完整四柱 / 旺衰 / 用神 / 命格 / 神煞 算完后,只提取 5 字段:
- `day_master`(「己土」)
- `strength_level`(「偏强」)
- `primary_yongshen / primary_role`(「木 / 官杀」)
- `avoid_wuxing`(["火","土"])
- `friendly_hint`(「东方 / 青绿 / 文教 …」一句话)

`/v1/natal/:id/summary` 给客户端 — **永不暴露 strength_score / pattern_name / 完整四柱**。

## 测试 / lint

```bash
cargo check -p unmei-api
cargo check -p unmei-admin-api
cargo clippy -p unmei-api --all-targets
cargo clippy -p unmei-admin-api --all-targets
```

## TODO(Beta)

- 支付通道接入(微信 / IAP / Stripe)
- worker crate(streak badge / 推荐重算 / 推送)
- mock 微信改真授权 code → openid
- 国际化:Quote / yiji / gate 多 locale 切换
- PostgreSQL 平移(去 sqlite 特有)
- 速率限制 / WAF 集成
