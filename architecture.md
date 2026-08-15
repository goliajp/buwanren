# unmei · 后端架构 v0.2

> 与 [`design.html`](design.html) v0.4「三章融合」对齐。
> 复盘:**算力在后,产品在前;UI 极轻,后端撑得起多平台 / 多区域 / 微信生态 / 运营后台**。

---

## 0. v0.2 关键变更 · 商业级标杆

vs v0.1(SQLite demo):

| 维度 | v0.1 | v0.2 |
|---|---|---|
| **DB** | SQLite | **PostgreSQL 18**(jsonb / TIMESTAMPTZ / BOOLEAN / pg_trgm / citext) |
| **缓存** | 无 | **kevy-embedded**(自研 Rust in-process Redis 协议 KV · `goliajp/kevy`)|
| **部署** | cargo run 多终端 | **docker-compose 一行起 3 服务**(pg / api / admin-api;缓存内嵌)|
| **构建** | 本地 cargo | **cargo-chef 多阶段镜像**(deps 缓存层 + slim runtime) |
| **微信生态** | mock | `unmei-wx` crate · **小程序登录 · 公众号 OAuth · 微信支付 v3 骨架** |
| **支付** | 无 | `payment_order` 流水表 + 状态机 · 预下单 / 异步回调闭环路由 |
| **用户表** | `user` | **`app_user`**(避开 PG 保留字)+ wx_mp_openid / wx_unionid / wx_h5_openid / wx_official_openid / wx_subscribe_official |
| **审计** | 仅 admin | `audit_log` + `wx_message_log`(模板 / 订阅消息发送审计) |

详细微信对接见 §11。

---

## 1. 总览 · 分层 vs 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                      多端 (Multi-Platform)                          │
│   proto(mobile-web) · mini(微信) · iOS · Android · webadmin(运营)  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS · JSON
        ┌──────────────────────▼──────────────────────┐
        │       BFF / API Gateway (Cloudflare)        │
        │  · TLS · WAF · 速率限制 · 区域路由 · CDN     │
        └──────────────────────┬──────────────────────┘
                               │
         ┌────────────────────┴────────────────────┐
         │                                         │
   ┌─────▼─────────────┐                ┌──────────▼─────────────┐
   │   unmei-api (业务)│                │  unmei-admin-api (运营)│
   │   :6028 (新)      │                │  :6029 (新)            │
   │                   │                │                        │
   │  · auth / session │                │  · 用户 / 内容 / 商品  │
   │  · naji / 历史    │                │  · 统计 / 风控 / 差异化 │
   │  · 商品 / 活动    │                │  · 客服 / 财务         │
   │  · 徽章 / 推荐    │                │                        │
   └──┬────┬───────────┘                └────────┬───────────────┘
      │    │                                     │
      │    │ 内部 RPC / HTTP                     │
      │    └─────────┐                           │
      │              │                           │
┌─────▼────────┐  ┌──▼────────────────────────┐  │
│ mingli-api   │  │  PostgreSQL · Redis · S3  │◄─┘
│ :6027 (已存) │  │  · 业务持久化              │
│              │  │  · session / 缓存          │
│ 21 叶纯算力  │  │  · 图 / 音 / 数据导出      │
│ 无状态       │  └────────────────────────────┘
│ 无用户       │
└──────────────┘

边界守则:
─ mingli-api 不存任何用户数据,无 session 概念,可水平复制 N 份
─ unmei-api / admin-api 都共享 PostgreSQL(逻辑独立,物理同库不同 schema)
─ 客户端直接调 BFF,不直连 mingli-api(避免暴露算力细节给前端逆向)
```

---

## 2. 服务划分

| 服务 | 角色 | 状态 | 技术栈 | 端口 |
|---|---|---|---|---|
| `mingli-api` | 21 叶算力,无状态 | ✅ 已存 | Rust + axum + tokio | 6027 |
| `unmei-api` | 业务核心 BFF | ⏳ 新建 | Rust + axum + sqlx + redis-rs | 6028 |
| `unmei-admin-api` | 运营后台 API | ⏳ 新建 | Rust + axum 或 Python FastAPI(BI 易写) | 6029 |
| `unmei-worker` | 异步任务(预算盘 / 推送 / 推荐重算 / 报表) | ⏳ 新建 | Rust + tokio + redis stream | — |
| `unmei-webadmin` | 运营后台前端 SPA | ⏳ 新建 | React 19 + Tailwind + jotai + react-router + tanstack-query | — |

**为什么 Rust 主导?**
- mingli-api 已 Rust,共享 crate 生态;
- axum 适合高并发,内存占用低;
- 业务模型经 sqlx 静态检查,避免 SQL 注入。

**例外:WebAdmin BI**:如要快速做报表 / 数据导出 / 图表,可考虑 Python FastAPI + pandas,但 v1 先用 Rust 保统一。

---

## 3. 数据模型 · ER

### 3.1 核心实体

```
┌────────┐     ┌────────┐     ┌──────────────┐     ┌────────────┐
│  User  │──┐  │ Natal  │──┐  │ NatalSummary │     │ NajiRecord │
└────────┘  │  └────────┘  │  └──────────────┘     └────────────┘
            │              │
            │              └──────► 1:1 预算缓存
            │
            │              ┌────────┐  ┌─────────┐  ┌────────────┐
            ├──1:N────────►│ Order  │  │ Activity│  │ UserBadge  │
            │              └────────┘  │   Reg   │  └────────────┘
            │                          └─────────┘
            │              ┌────────┐
            └──1:N────────►│ Address│
                           └────────┘

           ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
内容池:    │  Quote   │  │ GateWord │  │ YiJiWord │  │  Badge   │
           └──────────┘  └──────────┘  └──────────┘  └──────────┘
           按 wuxing/region/platform tag

           ┌──────────┐  ┌──────────┐  ┌──────────┐
商业:      │ Product  │  │ Activity │  │ Order    │
           └──────────┘  └──────────┘  └──────────┘

           ┌────────────┐  ┌──────────────┐  ┌──────────┐
运营:      │FeatureFlag │  │PlatformConfig│  │AdminUser │
           └────────────┘  └──────────────┘  └──────────┘
```

### 3.2 字段表(简版)

#### `user`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| openid_wx / apple / google / phone | text nullable | 多渠道登录 |
| nickname | text | |
| avatar_url | text | |
| platform | enum(mini, ios, android, web) | 主要平台 |
| region | enum(cn, hk, tw, jp, us, eu, other) | |
| locale | text | `zh-CN/zh-TW/en-US/ja-JP` |
| active_natal_id | uuid fk natal | 当前生效本命 |
| created_at, last_active_at | timestamp | |
| segment_tags | jsonb | A/B 分群打标 |

#### `natal` — 本命盘原始输入
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk | |
| label | text | 「我」「李太太的盘」… |
| year, month, day, hour, minute | int | |
| tz | float | 时区 |
| gender | enum(male, female, unknown) | |
| birth_lat, birth_lon | float | |
| birth_city | text | |
| true_solar_time | bool | |
| subject_type | enum(person, company, product, event) | |
| is_default | bool | |
| created_at, updated_at | timestamp | |

#### `natal_summary` — 预算缓存(支持 design.html 的「本命简介卡」)
| 字段 | 类型 | 说明 |
|---|---|---|
| natal_id | uuid pk fk | |
| day_master | text | 「己土」 |
| strength_level | text | 「偏强」 |
| strength_score | int | 0–100(内部用) |
| primary_yongshen | text | 「木」 |
| primary_role | text | 「官杀」 |
| secondary_yongshen | text nullable | |
| avoid_wuxing | text[] | `["火","土"]` |
| pattern_name | text | 「暗食神格」(内部用) |
| friendly_hint | text | 「东方 / 青绿 / 文教 / 律法」 |
| computed_at | timestamp | |
| mingli_version | text | 算力版本号,变化触发重算 |

> 🔒 `natal_summary` **永不**直接给客户端 — 客户端只看 `friendly_hint` + `day_master + strength_level + primary_yongshen + avoid_wuxing`,不看 score / pattern_name。

#### `naji_record` — 每次纳吉的快照
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk | |
| natal_id | uuid fk nullable | 无生辰时 null |
| asked_at | timestamp | 当时的时刻 |
| location_lat / lon | float nullable | |
| t_chart_gz | jsonb | t 时刻奇门时盘(年/月/日/时柱 + 旬首 + 旬空 + 值符,内部 audit 用) |
| gate | text | 「休门」 |
| direction | text | 「东方」 |
| gate_explain | text | benefit 文 |
| suit_words | text[] | 5 个宜 |
| avoid_words | text[] | 3 个忌 |
| quote_id | uuid fk | |
| recommended_product_id | uuid fk nullable | |
| ai_explanation_id | uuid fk nullable | 「AI 详细释义」生成的长文(异步) |
| seed | bigint | 复现用 |

#### `quote` — 语境句库
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| book | text | 「庄子」「道德经」「论语」 |
| chapter | text | 「列御寇」 |
| text | text | 「巧者劳而智者忧…」 |
| length | int | 字数 |
| locale | text | `zh-CN/zh-TW/ja-JP/en-US` |
| wuxing_affinity | text[] | `["木","水"]` 适合什么用神语境时推 |
| time_period_affinity | text[] | `["夜","秋"]` 时刻偏好 |
| gate_affinity | text[] | `["休门","开门"]` |
| sensitivity_score | int | 0–10,越高越敏感 |
| platform_allow | text[] | `["mini","ios"]` 哪些平台允许 |
| status | enum(draft, published, archived) | |
| created_by | uuid fk admin_user | |

#### `yiji_word` — 宜忌词库
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| type | enum(yi, ji) | 宜 / 忌 |
| word | text | 「读书」「动土」 |
| category | text | 文 / 武 / 行 / 居 |
| favor_when_main_wuxing | text[] | `["木","水"]` 主用神为这些时推荐 |
| disfavor_when_avoid_wuxing | text[] | 忌神为这些时归入「忌」 |
| time_period | text[] | nullable |
| locale | text | |
| status | enum(draft, published, archived) | |

#### `gate_word` — 八门解释词
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| gate | enum(休门, 生门, 伤门, 杜门, 景门, 死门, 惊门, 开门) | |
| direction | text | 该门对应方位 |
| benefit_text | text | 「利休养静心 / 修身养性」 |
| locale | text | |
| version | int | 版本 |
| status | enum(draft, published, archived) | |

#### `product`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| name | text | |
| category | enum(incense, sachet, bracelet, censer, other) | |
| price_cn | int(分) | |
| price_hk / tw / jp / us | int nullable | 多区域定价 |
| iap_product_id | text nullable | iOS 专用 |
| stock | int | |
| image_urls | jsonb | |
| desc | text | |
| recommend_when_main_wuxing | text[] | 对应主用神时推荐 |
| regions_avail | text[] | `["cn","hk"]` |
| platforms_avail | text[] | `["mini","ios","android"]` |
| status | enum(draft, on_sale, off_sale) | |

#### `activity`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| title | text | |
| category | enum(market, course, energy) | |
| banner_url | text | |
| location | text | |
| city | text | 「杭州」 |
| start_at / end_at | timestamp | |
| max_participants | int | |
| price | int(分) | nullable 免费 |
| regions_avail | text[] | |
| status | enum(draft, open, closed) | |

#### `badge`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid pk | |
| code | text uk | 「first_naji」「continous_7」 |
| name | text | 「初入道门」 |
| desc | text | |
| icon_url | text | |
| rule_dsl | jsonb | 规则定义(DSL,见 §6.4) |
| points | int | 积分奖励 |
| status | enum(active, deprecated) | |

#### `feature_flag` / `platform_config`
| 字段 | 类型 | 说明 |
|---|---|---|
| code | text pk | 「show_ai_explanation」 |
| default_on | bool | |
| by_platform | jsonb | `{"mini": false, "ios": true}` |
| by_region | jsonb | `{"cn": true, "us": false}` |
| by_user_segment | jsonb | `{"vip": true}` |
| desc | text | |

---

## 4. 核心业务流程(5 条)

### 4.1 流程 A · 中心罗盘抽吉(unauth → naji)

```
[mobile]                [unmei-api]              [mingli-api]      [PostgreSQL]
   │                        │                        │                  │
   │ POST /v1/auth/anonymous│                        │                  │
   ├───────────────────────►│                        │                  │
   │                        │   生成 anon user       │                  │
   │                        ├───────────────────────────────────────────►│
   │ ◄──────────token───────┤                        │                  │
   │                        │                        │                  │
   │  点中心「纳吉」按钮     │                        │                  │
   │ POST /v1/naji/spin     │                        │                  │
   │ {time_now, loc?}       │                        │                  │
   ├───────────────────────►│                        │                  │
   │                        │ 查 user.active_natal_id│                  │
   │                        ├───────────────────────────────────────────►│
   │                        │ ◄────── natal? ──────────────────────────┤
   │                        │                        │                  │
   │                        │ if natal:              │                  │
   │                        │   POST /api/qimen      │                  │
   │                        ├───────────────────────►│                  │
   │                        │ ◄── qimen 时盘 ────────┤                  │
   │                        │                        │                  │
   │                        │   POST /api/fortune-at │                  │
   │                        ├───────────────────────►│                  │
   │                        │ ◄── 当前用神供给度 ────┤                  │
   │                        │                        │                  │
   │                        │   按 natal_summary 选: │                  │
   │                        │   - quote(用神/时刻匹配)                  │
   │                        │   - gate(真奇门吉门 + 区域语言)            │
   │                        │   - 宜忌词(用神反算)                       │
   │                        │   - 推荐商品(用神 + 历史购买)              │
   │                        │                        │                  │
   │                        │   else (无生辰):        │                  │
   │                        │   - 池中随机抽(同 buwanren)                │
   │                        │                        │                  │
   │                        │ INSERT naji_record     │                  │
   │                        ├───────────────────────────────────────────►│
   │                        │ 检查徽章规则           │                  │
   │                        │ INSERT user_badge(if)  │                  │
   │ ◄── NajiResult ────────┤                        │                  │
```

**响应载荷 `NajiResult`**:

```json
{
  "id": "...",
  "asked_at": "2026-06-25T15:24:00+08:00",
  "time_label": "申时 · 15:24",
  "quote": { "text": "...", "source": "庄子 · 列御寇" },
  "gate": "休门",
  "direction": "东方",
  "gate_explain": "「休则养正,正则气盈」利读书、会谈、文教、修养。东向青绿色之处更宜。",
  "suit": ["读书", "会谈", "静坐", "东行", "文教"],
  "avoid": ["动土", "争辩", "入火"],
  "recommend": {
    "type": "product",
    "id": "...",
    "name": "不完人线香 · 沉香",
    "sub": "安神静心 · 助眠修身",
    "price_display": "¥128",
    "image_url": "..."
  }
}
```

### 4.2 流程 B · 输入生辰

```
POST /v1/user/natals { y, m, d, h, min, tz, gender, lat, lon, ... }
  → 校验
  → INSERT natal
  → 标 is_default = true
  → 异步入 worker queue「计算 natal_summary」
worker:
  → POST mingli-api /api/bazi → 拿四柱 + 旺衰 + 用神 + 命格
  → 提取 day_master / strength_level / primary_yongshen / avoid_wuxing
  → 生成 friendly_hint(用 GPT 或模板:见 §6.5)
  → UPSERT natal_summary
  → 推送 user(可选)「本命已生成」
```

### 4.3 流程 C · 购买商品(支付)

```
GET /v1/product?category=incense&region=cn&platform=mini
  → 按 region/platform 过滤 product
  → 用户当前 natal_summary 时,「优先级排序」按 recommend_when_main_wuxing
POST /v1/order { items, address_id }
  → 校验库存 + 价格
  → 创建 order(unpaid)
  → 调支付渠道:
      - mini → 微信支付
      - ios → Apple IAP(price_cn 转 iap_product_id)
      - android → 支付宝 / Google Play
      - web → Stripe / Alipay
  → 支付回调 → mark order paid
  → 触发徽章「香缘之人」(first purchase)
  → 影响推荐(已购品不再推同款)
```

### 4.4 流程 D · 活动报名

```
GET /v1/activity?region=cn
POST /v1/activity/:id/register
  → 校验 user.region in activity.regions_avail
  → 校验 current_count < max_participants
  → INSERT activity_registration
  → INC activity.current_count(REDIS 计数避锁)
  → 异步发推送提醒
```

### 4.5 流程 E · 徽章发放(异步)

```
worker(每分钟扫):
  → 检查 user.last_action(naji / purchase / activity / login)
  → 对每个 badge 运行 rule_dsl
  → 命中 + 未持有 → INSERT user_badge
  → 推送 / 弹窗
```

---

## 5. API 边界(分组)

### 5.1 unmei-api · 客户端用

```
# === 认证 ===
POST   /v1/auth/anonymous            # 匿名(无生辰也能玩)
POST   /v1/auth/wechat               # 微信小程序
POST   /v1/auth/apple                # iOS Sign in with Apple
POST   /v1/auth/google               # Google Sign-In
POST   /v1/auth/phone/send           # 短信验证码
POST   /v1/auth/phone/verify
POST   /v1/auth/refresh
POST   /v1/auth/logout

# === 用户 ===
GET    /v1/user/me
PATCH  /v1/user/me                   # 改 nickname / avatar / locale
GET    /v1/user/natals
POST   /v1/user/natals               # 加新 natal
PATCH  /v1/user/natals/:id           # 编辑
DELETE /v1/user/natals/:id
POST   /v1/user/natals/:id/activate  # 切活动 natal

# === 本命简介(给「我」二级展开) ===
GET    /v1/natal/:id/summary
       # 响应:{ day_master, strength_level, primary_yongshen, avoid_wuxing, friendly_hint }
       # 不暴露 score / pattern_name / 完整四柱

# === 纳吉 ===
POST   /v1/naji/spin                 # 核心:一抽
GET    /v1/naji/history?page=1&size=20
GET    /v1/naji/:id
POST   /v1/naji/:id/ai_explanation   # 异步生成长文释义,SSE 推回

# === 活动 ===
GET    /v1/activity?category=market&page=1
GET    /v1/activity/:id
POST   /v1/activity/:id/register
DELETE /v1/activity/:id/register

# === 商品 + 订单 ===
GET    /v1/product?category=incense&page=1
GET    /v1/product/:id
GET    /v1/cart
POST   /v1/cart/items
DELETE /v1/cart/items/:id
POST   /v1/order                     # 下单
GET    /v1/order?status=paid
GET    /v1/order/:id
POST   /v1/order/:id/pay             # 拿支付参数
POST   /v1/order/:id/cancel

# === 徽章 ===
GET    /v1/badge                     # 全部徽章定义
GET    /v1/user/me/badges            # 我的徽章

# === 配置 ===
GET    /v1/config                    # 平台 / 区域 / feature flag(客户端启动拉)
GET    /v1/quotes/random             # 备用:无生辰时也能抽句子
```

### 5.2 unmei-admin-api · 运营后台用

```
# === 鉴权 ===
POST   /admin/auth/login             # 邮箱 + 密码 + TOTP
POST   /admin/auth/refresh

# === 仪表盘 ===
GET    /admin/dashboard/overview     # 总览
GET    /admin/dashboard/dau          # DAU 时序
GET    /admin/dashboard/funnel       # 漏斗

# === 用户管理 ===
GET    /admin/users?platform=mini&region=cn&page=1
GET    /admin/users/:id
PATCH  /admin/users/:id               # 改 segment / 禁用 / 客服备注
GET    /admin/users/:id/naji_history
GET    /admin/users/:id/orders
POST   /admin/users/:id/refund        # 退款

# === 内容管理 ===
GET    /admin/quotes?book=庄子&status=published
POST   /admin/quotes
PATCH  /admin/quotes/:id
DELETE /admin/quotes/:id
POST   /admin/quotes/batch_import     # 批量导入(CSV/JSON)

GET    /admin/yiji_words
POST   /admin/yiji_words
...

GET    /admin/gate_words
POST   /admin/gate_words
...

# === 商品管理 ===
GET    /admin/products
POST   /admin/products
PATCH  /admin/products/:id            # 上下架 / 改价 / 改库存
DELETE /admin/products/:id
POST   /admin/products/:id/sku/iap    # 配 iOS IAP product id

# === 活动管理 ===
GET    /admin/activities
POST   /admin/activities
PATCH  /admin/activities/:id
GET    /admin/activities/:id/registrations
POST   /admin/activities/:id/checkin/:user_id

# === 徽章管理 ===
GET    /admin/badges
POST   /admin/badges
PATCH  /admin/badges/:id
GET    /admin/badges/:id/earners      # 持有者列表

# === 推荐运营 ===
GET    /admin/recommendations
POST   /admin/recommendations
GET    /admin/recommendations/:id/ab_results  # A/B 测试效果

# === 差异化配置 ===
GET    /admin/feature_flags
PATCH  /admin/feature_flags/:code
GET    /admin/platform_configs
PATCH  /admin/platform_configs/:key

# === 统计 ===
GET    /admin/stats/sales?from=2026-06-01&group=day
GET    /admin/stats/naji_count?group=platform
GET    /admin/stats/products/top?days=30
GET    /admin/stats/activities/registration_rate
GET    /admin/stats/badges/earn_rate
GET    /admin/stats/quotes/usage      # 哪个 quote 出现最多
GET    /admin/stats/retention?cohort=2026-05
GET    /admin/stats/funnel/checkout   # 商品转化漏斗

# === 算力监控 ===
GET    /admin/mingli/health           # 21 叶健康
GET    /admin/mingli/qps              # 每叶 QPS
GET    /admin/mingli/latency_p99

# === 风控 ===
GET    /admin/audit/sensitive_words   # 待审核敏感内容
POST   /admin/audit/:id/approve
POST   /admin/audit/:id/reject
GET    /admin/audit/risk_users        # 高频 / 异常用户

# === 资产 ===
GET    /admin/assets
POST   /admin/assets/upload           # S3 multipart
DELETE /admin/assets/:id

# === 管理员 ===
GET    /admin/admins
POST   /admin/admins
PATCH  /admin/admins/:id/roles        # 运营 / 客服 / 财务 / 内容
```

---

## 6. WebAdmin 模块

### 6.1 模块清单

| 模块 | 角色 | 关键页面 |
|---|---|---|
| **仪表盘** | 总览 | DAU/MAU 曲线 · 漏斗 · 收入 · 实时活跃 |
| **用户管理** | 客服 / 运营 | 用户列表 · 详情(纳吉历史 / 订单 / 客诉) · 封禁 |
| **内容运营** | 内容编辑 | 句库 / 宜忌 / 八门词 · 批量导入 · 多语言审核 |
| **商品管理** | 运营 / 仓储 | SKU · 库存 · 上下架 · 多平台定价(IAP / 微信) |
| **活动管理** | 运营 | 活动 CRUD · 报名管理 · 签到 · 名单导出 |
| **徽章 / 推荐** | 运营 | 徽章 DSL · 推荐配置 · A/B 测试 |
| **统计中心** | 数据 / 老板 | 销售 / 留存 / 漏斗 / 内容效果 · 自定义看板 |
| **多端差异化** | 运营 / 技术 | Feature Flag · 平台 / 区域配置 · 灰度发布 |
| **算力监控** | 技术 / 运维 | mingli-api 健康 / 21 叶 QPS / 慢查询 |
| **风控合规** | 风控 | 敏感词审核 · 高频用户 · 退款异常 · 平台审核警示 |
| **资产管理** | 技术 / 内容 | 图 / 音 / 视频上传 / CDN 失效 |
| **管理员管理** | 超管 | 角色 · 权限 · 操作日志 · 双因素 |

### 6.2 角色 / 权限

| 角色 | 权限 |
|---|---|
| 超管 | 全部 + 管理员管理 |
| 运营 | 用户(只读)/ 商品 / 活动 / 推荐 / 内容 / 统计 |
| 内容编辑 | 句库 / 宜忌 / 八门词 / 资产 |
| 客服 | 用户详情 / 订单 / 退款 / 客诉处理 |
| 财务 | 订单 / 销售统计 / 对账 |
| 风控 | 敏感词 / 异常用户 / 平台合规 |
| 技术 | 算力监控 / Feature Flag / 部署 |

### 6.3 统计中心要给的指标(MVP)

**业务核心**:
- DAU / WAU / MAU(按平台 / 区域分)
- 新增用户(按渠道 / 平台 / 区域)
- 留存:D1 / D7 / D30(按 cohort 周)
- 用户分群:有 natal vs 无 natal 留存差异

**纳吉行为**:
- 抽吉总次数 / 人均(按平台)
- 各吉门分布(看是否过度集中)
- 抽吉时段分布(早 / 中 / 晚)
- 命中徽章规则的速度

**商业转化**:
- 商品 GMV / 客单价 / 复购率
- 商品销售 Top 10
- 推荐点击率(CTR) / 推荐转化率(CVR)
- 活动报名率 / 签到率

**内容效果**:
- Quote 使用频次 Top
- 各 gate 命中频次(应分布相对均匀)
- 宜忌词使用频次

**算力**:
- mingli-api QPS / 错误率 / p99 延迟
- 各叶调用频次(qimen / bazi / fortune 是否最热)
- 缓存命中率(natal_summary / qimen 时盘)

### 6.4 徽章规则 DSL(jsonb)

```json
// 「连续纳吉 7 天」
{
  "type": "streak",
  "action": "naji.spin",
  "days": 7
}

// 「首次购买」
{
  "type": "count",
  "action": "order.paid",
  "threshold": 1
}

// 「累计购买香道类 ≥ 3 件」
{
  "type": "count",
  "action": "order.paid",
  "filter": { "product.category": "incense" },
  "threshold": 3
}

// 「参加 1 次线下活动」
{
  "type": "count",
  "action": "activity.checkin",
  "threshold": 1
}

// 「同时持有徽章 A / B」(组合)
{
  "type": "combo",
  "required_badges": ["first_naji", "first_purchase"]
}
```

### 6.5 「friendly_hint」生成规则(隐藏算力的桥)

输入:`natal_summary` 全字段
输出:一句话给用户看的 `friendly_hint`

**算法**(模板法):

```python
# 伪代码
def friendly_hint(s):
    benefits = WUXING_TO_DAILY_LIFE[s.primary_yongshen]  
    # 木 → ["东方", "青绿色", "文教", "律法"]
    # 火 → ["南方", "红黄色", "礼仪", "明亮"]
    # ...
    avoids   = WUXING_TO_AVOID_CONTEXT[s.avoid_wuxing[0]]
    season   = season_match(s.avoid_wuxing)  # 「火盛之季」
    return (
      f"{', '.join(benefits[:4])}之事顺势而行。"
      f"{season}/{avoids}宜静守。"
    )

# 或:用 GPT 调 LLM 一次生成(prompt 锁死「不可出现『八字 / 四柱 / 命格』字眼」)
```

---

## 7. 多平台差异化

### 7.1 差异矩阵

| 维度 | proto (mobile-web) | mini (微信小程序) | iOS | Android | webadmin |
|---|---|---|---|---|---|
| 登录方式 | 邮箱 / 微信 OAuth | 微信授权 | Sign in with Apple / 邮箱 | Google / 邮箱 | 邮箱 + TOTP |
| 支付 | Stripe / Alipay | 微信支付 | **Apple IAP** | Google Play / 支付宝 | — |
| 商品定价 | `price_cn` | `price_cn` | `iap_product_id`(套餐固定) | `price_cn` | — |
| 词敏感度 | 低 | **高**(不能「算命 / 风水 / 占卜」) | 中(避商店关键词) | 中 | 不限 |
| AI 释义 | 全文 | **简版**(< 100 字) | 全文 | 全文 | — |
| 商品销售 | ✓ | 需小程序商城备案 | **必走 IAP**,虚拟物可,实物需走 Web | ✓ | — |
| 线下活动 | ✓ | ✓ | ✓(报名链接外跳) | ✓ | 管理 |
| 推送 | Web Push | 模板消息 | APNs | FCM | 邮件 |
| 用户分享 | URL | 微信内卡片 | iOS share sheet | Android share intent | — |

### 7.2 实现方式

**所有差异都在后端配置,不写客户端 hardcode**:

```json
// PlatformConfig
{
  "key": "show_ai_explanation_full",
  "by_platform": {
    "mini": false,
    "ios": true,
    "android": true,
    "web": true
  }
}

// FeatureFlag
{
  "code": "sensitive_terms_strict",
  "by_platform": { "mini": true }
}

// Product
{
  "id": "...",
  "name": "沉香线香",
  "platforms_avail": ["mini", "ios", "android", "web"],
  "price_cn": 12800,
  "iap_product_id": "com.unmei.incense.chen128"  // iOS 用
}

// Quote
{
  "id": "...",
  "text": "巧者劳而智者忧",
  "platform_allow": ["mini", "ios", "android", "web"],
  "sensitivity_score": 2  // mini 平台只允许 ≤ 3
}
```

客户端启动时 `GET /v1/config` 拉一份合并好的配置,据此渲染。

### 7.3 平台特殊处理

**微信小程序(mini)**:
- 内容审核严格 — 「算命」「风水」「占卜」一律不出
- 我们用「纳吉」「修行」「时辰」「方位」等中性词
- `sensitive_terms_strict = true` 时,后端 `naji.spin` 响应做二次清洗
- 商品销售需小程序商家资质 + 微信支付商户

**iOS**:
- 虚拟商品(AI 释义解锁 / 高级徽章) — 必走 IAP
- 实体商品(线香) — 走 Web 视图外链
- App Store 商品描述避开「fortune-telling / divination」

**Android**:
- 国内 / Google Play 双包
- 国内包走支付宝,Google Play 走 IAP
- 海外版需翻译 + 双语

### 7.4 端的「客户端」职责对照

| 端 | 关注 | 不关注 |
|---|---|---|
| proto | UI / 交互 / Jotai 状态 / 调 API | 后端业务,后端给啥渲染啥 |
| mini | 同上 + 微信能力(支付 / 分享 / 推送 / 授权) | 业务规则 |
| ios / android | 同上 + 原生能力(IAP / 推送 / 相册 / 地图) | 业务规则 |
| webadmin | 内部工具,React + 表格 / 图表 / 表单 | 公开业务 |

---

## 8. 多区域差异化

### 8.1 区域矩阵

| 区域 | 主语 / 副语 | 货币 | 支付 | 日历 | 文化适配 |
|---|---|---|---|---|---|
| **cn** 中国大陆 | zh-CN | CNY ¥ | 微信 / 支付宝 / IAP | 公历 + 农历 | 完整 |
| **hk** 港 | zh-TW | HKD HK$ | Apple Pay / Octopus / IAP | 公历 + 农历 | 简繁双语 |
| **tw** 台 | zh-TW | TWD NT$ | 街口 / Apple Pay / 信用卡 | 公历 + 农历 | 同上 |
| **jp** 日本 | ja-JP(品牌 `うんめい`) | JPY ¥ | LINE Pay / Stripe | 公历 | 日式禅修(茶道 / 神社) |
| **us** 美 | en-US | USD $ | Stripe / Apple Pay | 公历 | **西方友好**(无东方迷信感) |
| **eu** 欧 | en-US + de/fr | EUR € | Stripe / SEPA | 公历 | 同上 + GDPR |
| **other** | en-US | USD | Stripe | 公历 | 国际通用 |

### 8.2 国际化策略

**内容**:
- `quote` / `gate_word` / `yiji_word` / `product.name` / `badge.name` 都有 `locale` 字段
- 后端按 `user.locale` 返回匹配版本
- 缺译时 fallback 到 `zh-CN`(开发期) → `en-US`(正式期)

**UI**:
- 前端用 i18n key,内容从后端拉(动态)
- 字体:`Noto Serif SC` 中文 / `Noto Serif JP` 日文 / `EB Garamond` 拉丁

**支付**:
- 用户 `region` 决定支付通道
- 每个 `product` 多区域价格表

**法规**:
- 大陆:实名 / 商品广告法 / 不下「吉凶」直接断言(平台审核)
- 欧盟:GDPR / 数据导出 / 删除请求
- 美:CCPA 类似
- 全球:生辰 = 敏感个人数据,默认本地存储 + 用户主动同意才上传

### 8.3 区域路由(CDN)

```
www.unmei.app     → Cloudflare → 自动按 GeoIP 路由:
  中国大陆        → 阿里云北京     → unmei-api-cn
  港澳台 / 日本    → 阿里云香港     → unmei-api-asia
  欧美            → AWS us-east-1  → unmei-api-global
```

数据库:每区域独立 PostgreSQL,跨区不同步(隐私 / 合规);只有 `quote` / `gate_word` / `yiji_word` / `product` 等内容库做异步复制。

---

## 9. 部署拓扑

### 9.1 国内

```
┌────────────────────────────────────────────────┐
│  Alibaba Cloud · 北京 / 深圳                    │
│                                                 │
│  SLB → unmei-api (k8s · 3 replica)             │
│         │                                        │
│         ├─► mingli-api (k8s · 2 replica, GPU 无)│
│         └─► RDS PostgreSQL(主从 + 备份)         │
│         └─► Redis 集群                          │
│         └─► OSS(图 / 音 / 报表导出)             │
│                                                 │
│  unmei-admin-api(独立 ingress, IP 白名单)       │
│  unmei-worker(k8s · 1-2 replica)                │
│  Prometheus + Grafana + Loki                    │
└────────────────────────────────────────────────┘
```

### 9.2 海外

```
┌────────────────────────────────────────────────┐
│  AWS us-east-1 / Frankfurt(双 region)         │
│                                                 │
│  CloudFront → ALB → unmei-api (ECS)            │
│                      │                          │
│                      ├─► mingli-api (ECS)       │
│                      └─► RDS PostgreSQL         │
│                      └─► ElastiCache Redis      │
│                      └─► S3                     │
│                                                 │
│  CloudWatch + Datadog                          │
└────────────────────────────────────────────────┘
```

---

## 10. 路线 · MVP → Beta → GA

### MVP(目标 6 周)
- proto + 移动 web 跑通
- unmei-api 5 端点(auth / naji / natal / product 列表 / config)
- mini 平台同步(走微信小程序审核)
- webadmin 4 模块(用户 / 内容 / 商品 / 仪表盘)
- 单区域(cn)
- 商品列表纯展示,不打通支付
- 算力调真 mingli-api,但 fallback 池中抽

### Beta(目标 +6 周)
- ios + android 上线
- 支付通道全打通(微信 / 支付宝 / IAP)
- 徽章规则上线
- webadmin 加统计中心 + 差异化配置
- 活动报名 + 签到
- AI 释义异步生成 + SSE

### GA(目标 +3 个月)
- 加 hk / tw / jp 三区域
- A/B 测试框架
- 推荐 ML 模型(替换规则)
- 海外多语言
- 复盘:加 PQ 轨其它意图(fortune / synastry / election)

---

## 11. 风险与边界

| 风险 | 应对 |
|---|---|
| 微信小程序审核被拒 | 内容多版本 · sensitive_score 二次过滤 · 字眼避坑 |
| iOS 商店审核被拒 | 商品改虚拟 IAP 套餐 / 实物外跳 / 描述无敏感词 |
| GDPR / CCPA | 数据导出 / 删除接口 · 生辰本地优先存 |
| mingli-api 算力不足 | 算力结果缓存 redis 7 天 · 时盘按 t 维度缓存 |
| 算力错误传到用户面 | LLM 出口前敏感词扫 + 内部抽样审核 |
| 退款 / 客诉 | webadmin 退款流程 + 操作日志 + 财务对账 |
| 海外文化适配 | 区域差异化矩阵 · LLM prompt 按 locale 切 |
| 平台政策变更 | 配置驱动客户端,变更不发版 |
| 数据泄漏 | 字段级加密(生辰)· 操作日志 · 审计 |

---

## 12. 路线对应的服务搭建顺序

```
Week 1-2:
  ├─ unmei-api 骨架(axum + sqlx + redis-rs)
  ├─ PostgreSQL schema(user / natal / natal_summary / naji_record / quote)
  ├─ 接 mingli-api 算 bazi / qimen / fortune
  └─ /v1/auth/anonymous + /v1/naji/spin 跑通(无生辰版)

Week 3-4:
  ├─ /v1/auth/wechat + /v1/user/natals + /v1/natal/summary
  ├─ natal_summary 预算 worker
  ├─ /v1/config + 平台差异化
  └─ Quote 库 + YiJi 词库导入

Week 5-6:
  ├─ unmei-admin-api 骨架
  ├─ webadmin 4 模块 MVP
  ├─ /v1/product /v1/activity /v1/badge 列表端点
  └─ 上线 alpha,内测 50 人

Week 7-12 (Beta):
  ├─ 支付通道
  ├─ 徽章规则
  ├─ 多端打包
  ├─ 统计中心
  ├─ 推荐运营
  └─ Beta 公测

Week 13-24 (GA):
  ├─ 海外区域
  ├─ AI 释义 + SSE
  ├─ A/B 框架
  └─ 上线 GA
```

---

## 13. 与 mingli 的关系

```
mingli (算力,21 叶 Rust)
    ├─ mingli-api :6027  ◄────┐
    ├─ mingli-engine          │
    ├─ mingli-bazi            │ HTTP
    ├─ mingli-qimen           │
    ├─ ... (18 其它叶)         │
    │                         │
    └─ web/  (桌面 web)       │
                              │
unmei (业务 + 移动)            │
    ├─ unmei-api :6028 ───────┤
    ├─ unmei-admin-api :6029  │
    ├─ unmei-worker           │
    ├─ unmei-webadmin (SPA)   │
    └─ proto / mini / ios / android(客户端)
```

- `mingli` 永远是**算力源**,无业务,无用户;
- `unmei` 是**产品**,所有业务沉淀在此;
- 两者**独立部署 / 独立发布**,接口稳定;
- `mingli` 升级算力 → unmei 调用方升 `mingli_version` 字段,触发 natal_summary 重算。

---

## 14. 文件位置(v0.2)

```
buwanren/
├── docker-compose.yml          ← pg18 + api + admin-api(缓存内嵌)
├── .env.example
├── architecture.md             ← 本文件 v0.2
├── design.html                 ← UI 设计 v0.4
│
├── infra/
│   ├── postgres/init.sql       ← 扩展(uuid / pgcrypto / citext / pg_trgm)
│   # 缓存层 kevy-embedded 跑在 api 进程内 · 无独立配置
│   ├── Dockerfile.api          ← cargo-chef 多阶段
│   └── Dockerfile.admin-api
│
├── backend/
│   ├── Cargo.toml              ← workspace · sqlx postgres + redis + 微信 crate
│   ├── unmei-domain/
│   ├── unmei-wx/      NEW      ← 微信 SDK · 见 §11
│   ├── unmei-api/      :6028
│   ├── unmei-admin-api/ :6029
│   ├── migrations/
│   │   └── 20260626_000_initial.sql   ← PG18 schema
│   └── seed/seed.sql
│
├── backend-v0.1-sqlite-archive/  ← 备份
│
├── webadmin/  :6030
├── proto/     :6031
└── mini/ ios/ android/
```


---


## 11. 微信生态对接(v0.2 新增)

### 11.1 渠道总览

| 渠道 | 标识字段 | 登录 / 授权 | 支付 |
|---|---|---|---|
| 小程序 | `wx_mp_openid` + `wx_unionid` | `wx.login()` → code → `jscode2session` | JSAPI |
| 公众号 / H5 | `wx_h5_openid` / `wx_official_openid` + `wx_unionid` | OAuth `snsapi_base` / `userinfo` | JSAPI / H5 |
| 网页扫码 | `wx_h5_openid` + `wx_unionid` | 开放平台 `oauth2/authorize` | Native(可选) |

unionid 是同一主体下跨渠道的稳定标识,**只要拿到就以 unionid 为主键合并用户**;否则按各渠道 openid 区分。

### 11.2 小程序登录闭环

```
proto (mini)              unmei-api               weixin api
   │                          │                       │
   │ wx.login()               │                       │
   │ ──► code                 │                       │
   │                          │                       │
   │ POST /v1/auth/wx/miniprogram                     │
   │   { code, nickname?, avatar_url? }               │
   │ ─────────────────────────►                       │
   │                          │ GET jscode2session   │
   │                          │ ──────────────────►   │
   │                          │ ◄── openid/unionid/sk │
   │                          │                       │
   │                          │ upsert app_user      │
   │                          │  · 优先 unionid 合并 │
   │                          │  · 次按 wx_mp_openid │
   │                          │                       │
   │                          │ issue JWT 30d         │
   │ ◄──── { token, user, expires_in }                │
```

### 11.3 公众号 / H5 OAuth

```
浏览器                       unmei-api                  weixin
   │ GET /v1/auth/wx/h5/url?redirect_uri=... │            │
   │ ────────────────────────────────────► │            │
   │ ◄── { url, state }                    │            │
   │                                       │            │
   │ 跳 url (open.weixin.qq.com)            │            │
   │ ──────────────────────────────────────────────────►│
   │              用户授权                              │
   │ ◄── redirect 回 redirect_uri?code=... │            │
   │                                       │            │
   │ POST /v1/auth/wx/h5/callback { code } │            │
   │ ────────────────────────────────────► │            │
   │                  GET sns/oauth2/access_token       │
   │                  ─────────────────────────────────►│
   │                  ◄── access_token + openid (unionid)
   │                  upsert + issue JWT              │
   │ ◄──── { token, user }                            │
```

### 11.4 微信支付 v3 · JSAPI 闭环

```
proto                  unmei-api              weixin pay v3
  │ POST /v1/pay/wx/jsapi/prepay              │
  │  { order_id, openid? }                    │
  │ ───────────────────────►                  │
  │                  load order_record         │
  │                  INSERT payment_order      │
  │                    status=pending          │
  │                                            │
  │                  POST /v3/pay/transactions/jsapi
  │                   + Authorization (RSA 签名)
  │                  ──────────────────────────►│
  │                  ◄── { prepay_id }         │
  │                                            │
  │                  UPDATE third_party_prepay │
  │                                            │
  │ ◄── { payment_id, prepay_id, appid,        │
  │      timestamp, nonceStr, package, paySign} │
  │                                            │
  │ wx.requestPayment(...)                     │
  │ ────────────────────────────────────────►  │
  │                                            │
  │ ◄────────── 用户支付成功                   │
  │                                            │
  │                  ◄── POST /v1/pay/wx/notify(异步)
  │                  ─ pay_notify_decrypt      │
  │                  ─ 幂等更新 payment_order   │
  │                  ─ 联动 order_record.paid_at
  │                  → SUCCESS                 │
```

### 11.5 缓存策略(kevy-embedded)

| key | TTL | 用途 |
|---|---|---|
| `unmei:wx:mp:access_token` | 6900s | 小程序 cgi-bin/token |
| `unmei:wx:h5:access_token` | 6900s | 公众号 cgi-bin/token |
| `unmei:wx:pay:platform_cert:<serial>` | 24h | 微信支付平台证书(验签用) |
| `unmei:session:<uid>` | 30d | 用户 session 反查(踢线) |
| `unmei:rate:<ip>:<route>` | 60s | 路由级 IP 限流计数 |

### 11.6 当前进度 · TODO 标

完整:
- ✅ `unmei-wx::miniprogram::mp_jscode2session`
- ✅ `unmei-wx::oauth::h5_authorize_url` + `h5_code_to_access`
- ✅ `unmei-wx::token::mp_access_token` + `h5_access_token`(kevy-embedded 缓存)
- ✅ `unmei-wx::pay::pay_jsapi_prepay`(请求体 / URL / 路由完整,签名 TODO)
- ✅ `payment_order` 表 + 路由 `POST /v1/pay/wx/jsapi/prepay` + `POST /v1/pay/wx/notify` + `GET /v1/pay/order/:id`

Beta1 TODO:
- ⏳ WX-pay v3 RSA-SHA256 签名(`Authorization: WECHATPAY2-SHA256-RSA2048`)
- ⏳ 回调验签(取 Wechatpay-Serial header + 平台证书 + RSA 公钥 verify)
- ⏳ 回调 AEAD_AES_256_GCM 解密
- ⏳ 小程序 mp_decrypt(手机号 / 用户敏感数据 AES-128-CBC + Pkcs7)
- ⏳ 平台证书自动拉取 + 缓存轮换


