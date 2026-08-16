# buwanren · 卜万人

> 内部代号 **unmei · 命運**——代码里的 crate / 环境变量 / 镜像名沿用 `unmei` 前缀。
> 微信小程序 + 移动端 + 后端 + 运营后台。算力来自开源仓库 [`goliajp/mingli`](https://github.com/goliajp/mingli) 的 `mingli-api :6027`。
> **docker-compose 一行起全栈。**

## 一句话定位

**UI 极轻**(继承不完人 / buwanren 2.0) · **算力专业隐式**(mingli 真排盘) · **多端多区域可运营**(微信 / WebAdmin / Feature Flag)。

## 与 mingli 的边界

`mingli` 是**开源**的纯算力内核:无业务、无用户、无状态,只吃生辰吐盘面。
本仓库是**私有**的产品侧:用户 / 订单 / 内容 / 支付 / 运营全在这里。
两边**只通过 HTTP 解耦**(`MINGLI_API_BASE`),没有源码依赖——算力升级不需要动业务,业务迭代不污染开源仓库。

## 快速开始(docker-compose 版)

```bash
cd buwanren
cp .env.example .env
docker compose up -d --build
```

详见 [QUICKSTART.md](QUICKSTART.md)。

## 技术栈(v0.2)

| 层 | 选型 |
|---|---|
| **DB** | PostgreSQL 18(jsonb / TIMESTAMPTZ / pg_trgm / citext) |
| **缓存** | kevy-embedded(Rust 自研 in-process KV,goliajp/kevy) |
| **后端** | Rust 1.83 / axum 0.7 / sqlx 0.8 postgres / tokio / tower |
| **微信** | 自研 `unmei-wx` crate(小程序 / 公众号 OAuth / 微信支付 v3) |
| **前端** | React 19 / Vite / Tailwind / react-router 6 / jotai / @tanstack/react-query |
| **部署** | docker-compose + cargo-chef 多阶段镜像 |

## 服务全景

| 端口 | 服务 | 角色 |
|---|---|---|
| 6027 | mingli-api | 21 叶纯算力 Rust(主项目) |
| 6028 | unmei-api | 业务 BFF · 客户端面 + 微信支付 |
| 6029 | unmei-admin-api | 运营后台 API |
| 6030 | unmei-webadmin | React SPA · 8 屏工作台 |
| 6031 | unmei-proto | React 客户端原型 · 7 屏 |
| 6032 | postgres18 | DB |
| — | kevy-embedded | in-process · 无端口 · AOF 落 docker volume |

## 核心心智模型

1. **算力 ≠ 业务** — mingli-api 永远纯算力无状态;unmei-api 才有用户 / 数据 / 业务
2. **极轻 UI** — 客户端面看不到「八字 / 四柱 / 用神」内行词;深度藏在「我」二级一句话
3. **算力隐式个性化** — 罗盘转出的吉门、宜忌、语录都按真生辰 + 真时刻反算
4. **配置驱动差异化** — 多平台 / 多区域差异在 `feature_flag` + `platform_config` 表,变更不发版
5. **运营后台先行** — WebAdmin 12 模块支撑内容 / 商品 / 活动 / 徽章 / 推荐 / 差异化
6. **微信生态优先** — 小程序登录 / 公众号 OAuth / JSAPI 支付 三件套同一 SDK 覆盖(v0.2)

## 微信生态对接

`unmei-wx` crate 三模块覆盖:
- `miniprogram` — `wx.login()` → `jscode2session` → openid / unionid / session_key
- `oauth` — 公众号 / H5 OAuth → 跳转 URL 生成 + code 换 access_token + openid
- `pay` — JSAPI 预下单 + 回调验签 / 解密(签名 / AEAD-GCM 解密 TODO Beta1)

**未配置 appid/secret 时自动 mock**,本地全链路可跑通。详见 [architecture.md](architecture.md) §11。

## 项目结构

```
buwanren/
├── docker-compose.yml          ← 一行起 backend 全栈
├── .env.example                ← 环境变量样板
├── architecture.md             ← 架构 v0.2 · 14 章
├── design.html                 ← UI 设计 v0.4 · 三章融合
├── QUICKSTART.md               ← 30 秒上路
│
├── infra/
│   ├── postgres/init.sql       ← 扩展(uuid / pgcrypto / citext / pg_trgm)
│   ├── Dockerfile.api          ← cargo-chef 多阶段
│   └── Dockerfile.admin-api
│
├── backend/                    ← Rust workspace · PG18
│   ├── unmei-domain/           ← 共享 DTO + commerce 域模型 + Error
│   ├── unmei-wx/               ← 微信 SDK · 见 architecture.md §11
│   ├── unmei-carrier/          ← 物流 adapter(kuaidi100 / manual)
│   ├── unmei-api/      :6028
│   ├── unmei-admin-api/ :6029
│   ├── migrations/             ← PG18 schema(14 业务表 + commerce v2 + wx_msg)
│   └── seed/                   ← PG 兼容 seed
│
├── docs/commerce-architecture.md  ← 商业子系统架构基线 v2.0
│
├── webadmin/  :6030            ← 运营后台 SPA(React 19)
├── proto/     :6031            ← 客户端原型(React)
├── mini/                       ← 微信小程序工程
├── rooms/                      ← 像素村民屋工坊(2026-08-16 从 mini/ 拆出)
└── archive/                    ← 历史设计稿 / 另一条产品线的调研,不参与构建
```

## 当前已落地 ✅

- ✅ docker-compose 一行起 3 服务(pg / api / admin-api;缓存内嵌)
- ✅ PostgreSQL 18 schema · 14 业务表 + payment_order + wx_message_log
- ✅ kevy-embedded 缓存层(in-process,access_token / session / 限流,AOF 持久化)
- ✅ 微信小程序登录(`/v1/auth/wx/miniprogram`)
- ✅ 微信公众号 / H5 OAuth(`/v1/auth/wx/h5/url` + `/callback`)
- ✅ 微信支付 JSAPI 预下单 + 异步回调路由(`/v1/pay/wx/*`)
- ✅ Rust workspace 切 sqlx-postgres
- ✅ cargo-chef 多阶段镜像
- ✅ 9 路由 + 10 admin 路由(SQL 已切 PG dialect)
- ✅ **工作区编译通过 + 19 个单测全绿**(2026-08-16;此前 58 处 `sqlx::query!` 宏因缺 `.sqlx` 缓存从未编译过)
- ✅ **CI**(`.github/workflows/backend.yml`)· check --all-targets + test

## 待续 ⏳(Beta1)

- ⏳ 微信支付 v3 RSA-SHA256 签名 + 平台证书自动轮换
- ⏳ 回调 AEAD_AES_256_GCM 解密
- ⏳ 小程序 mp_decrypt(手机号 / 用户敏感数据)
- ⏳ 模板消息 / 订阅消息(`wx_message_log` 表已就位)
- ⏳ 多支付通道(支付宝 / Apple IAP / Stripe)

## Clean arch · 进行中

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P0** | 让工作区编译 —— 全仓统一到运行期 `sqlx::query()`,不再依赖 `.sqlx` 缓存或活库;补 CI | ✅ 2026-08-16 |
| **P1** | 消双写 —— 新建 `unmei-app` 承载全部写操作用例,两个 API crate 共用;删掉 `unmei-domain` 里 2,810 LOC 的未验证死实现与无人实现的 trait | ✅ 2026-08-16 |
| **P2** | 依赖方向修正 —— `unmei-domain` 去 sqlx / 去 http,成为纯内层 | ✅ 2026-08-16 |

**当前形态**:`unmei-api / unmei-admin-api → unmei-app → unmei-domain`,依赖单向。

`unmei-domain` 的依赖树现在只剩 `serde` / `serde_json` / `chrono` / `uuid` / `thiserror` / `async-trait` —— 没有数据库、没有 HTTP、没有 Web 框架。CI 有一条**硬门禁**盯着这件事(`cargo tree -p unmei-domain` 命中 sqlx/axum/reqwest/hyper/tower 即构建失败),用依赖树而不是 grep 源码,注释骗不过它,间接引入也躲不掉。

`unmei-app` 只收**写操作与状态迁移**。列表 / 详情这类只读查询仍在路由里 —— 它们两端不重叠(客户端按 `user_id` 过滤,后台按筛选条件),不存在双写。

### 待定 · 要不要再抽一个 `unmei-pg`

原计划 P2 还包含「SQL 全部收敛进 `unmei-pg`」。做完前半程后**建议先不做**,理由写在这里等拍板:

抽 `unmei-pg` 意味着在 domain 里定义约 30 个 repository trait 方法,而实现只会有一个(Postgres),也没有测试替身要用它。这正是 P1 刚删掉的 2,810 行的形态 —— 一套没人实现第二遍的接口。等出现第二个驱动方(测试替身 / 只读副本 / 换存储)再抽,那时接口形状由真实需求决定,而不是猜。

现在的切口已经留好了:`unmei-app` 里每个碰库的地方都写着 `.await.db()?`,那一行就是将来的 repository 边界。

### ✅ 已修的资金漏洞 · 渠道重推回调会重复入账

`payment::apply_succeeded` 里,更新订单金额的那条 SQL **没有任何前置条件**,
每收到一次回调就往 `amount_paid_minor` 上加一次。而渠道重推是常态不是异常 ——
微信支付在 24 小时内最多重推 15 次,直到拿到成功响应。一笔 199 元的订单
能被记成实付 2985 元。

同时 `payment_event` 的插入漏了 `ON CONFLICT`,重推会撞
`uq_payment_event_channel_eid`(这个唯一索引**本来就是为幂等建的**)直接报错,
于是渠道收到 500、继续重推,循环到重试耗尽。

两处都已修:插入加 `ON CONFLICT … DO NOTHING`;订单金额改成只在 payment
**真的**从 `pending/processing` 翻到 `success` 那一次才动(用 `RETURNING` 判定)。
由 `apply_succeeded_moves_order_to_paid_and_is_idempotent` 钉住。

这个 bug 是写用例层集成测试时被测出来的,不是读代码读出来的。

顺带挖出**第三份支付入账实现** —— `workers/payment_sweep.rs` 里还有一份,
P1 只审了 `routes/`,漏了 `workers/`。两份的差别全是 bug:
它的订单 UPDATE 同样没有前置条件,payment UPDATE 连状态守卫都没有。
而且它**发 `OrderPaid` 事件而回调那条路不发** —— 意味着真接入微信之后,
走 webhook 进来的支付永远不会触发履约。现在 sweeper 改调同一条用例,
`OrderPaid` 收进 `apply_succeeded`,两条路径合一。

### ✅ 已修的资金漏洞 · 「到期不续」的订阅照样被扣钱

`subscription_billing` worker 的选行条件是:

```sql
WHERE status IN ('active','past_due','trialing')
  AND next_billing_attempt_at <= NOW()
```

**没有 `cancel_at_period_end`**。用户点了「到期不续」只是把这个标打上,
worker 从不看它 —— 到期照样建订单、建支付、延周期。实测当前开发库里
有 **8 条已声明不续的订阅仍符合这个条件**,旧代码会把它们全部扣款。

同一个 worker 另外两处:

- **五步写入没有事务**(建发票 / 建订单 / 建支付 / 改发票 / 改订阅),
  中间挂掉会留下「钱收了但周期没延长」这种状态
- **收不了钱时不清 `next_billing_attempt_at`** —— 没有激活价的订阅会被
  每 5 分钟重新捞出来一次,永远

续费整段搬进 `unmei_app::subscription::renew_due`:一个事务、先认取消标记、
收不了钱就停止重试、补发 `SubscriptionRenewed` 事件(旧实现一条事件都不发,
续费对 dispatcher 和财务是隐形的)。worker 只剩「选出到期的」。

### ✅ 已修 · 退款财务分录不平且会重复入账

`handle_refund_completed` 的分录头与分录行是两次独立写入,后者失败就留下
一条没有明细的 `journal_entry` —— 一本不平的账。而且 outbox 事件会重试,
只要在写分录行时挂过一次,重试就会为同一笔退款再记一整套分录。
现已包进事务,并按 `business_ref_id` 判重。

同一文件里 `OrderFulfilled` 事件的写入结果原本被 `let _ =` 吞掉:
事件写失败订单照样标 done,下游永远收不到。现在让它冒出来交给重试机制。

### ⚠ 未修的资金漏洞 · 同一订单可被重复扣款

**实测复现**(2026-08-16,本机 live 环境):

```
订单 ord-e7587138…  应付 19900  实付 39800  已退 39800   ← 实付是应付的两倍
  pay-387a0aa4…  success   19900
  pay-7e39b28c…  refunded  19900
```

对同一笔未付订单连续调两次 `POST /v1/orders/:id/pay`,会创建**两条独立的 payment**。
`payment::start()` 只校验订单状态是否 `unpaid` —— 第一次支付创建后订单仍是 `unpaid`,
所以第二次照样放行。两笔都被 sweeper 推到 success 后,`apply_succeeded` 逐笔累加
`amount_paid_minor`,系统欣然接受了两倍付款,而且随后把 39800 当作「全额退款」放过。

**这是既有行为**,不是 P1 引入的(旧路由是同一套判断)。修它要选一条支付策略,
是产品决定不是重构,所以留着等拍板。三条路:

| 方案 | 行为 | 代价 |
|---|---|---|
| A · 拒绝并发支付 | 存在未过期的 pending payment 时,第二次 `/pay` 返回 409 | 用户放弃支付后要等 30 分钟过期才能重试 |
| B · 顶掉旧的 | 新建前把旧 pending payment 置 cancelled | 用户可能正在旧的那笔付款页面上付 |
| C · 只在入账时兜底 | `apply_succeeded` 里把 `amount_paid_minor` 封顶到订单总额 | 钱已经收了两次,只是账面不显示 —— 治标不治本 |

顺带:`order_record` 上没有 `amount_paid_minor <= amount_total_minor` 的 CHECK 约束,
加不加也一并拍。

### ⚠ proto 的「物」页面自 commerce v2 起就是坏的

`proto/src/pages/Product.tsx` 请求 `/v1/product`(单数)。**这个端点不存在** ——
commerce v2 把它换成了 `/v1/products`,旧的 `routes/product.rs` 从那时起就是个
空 Router。页面一直拿 404。

不是改个路径就完事,响应形状也变了:

| 页面期望(v0.1 `ProductPublic`) | `/v1/products` 实际返回 |
|---|---|
| `{ items: [...] }` | 裸数组 |
| `price_display` | 无 —— 价格在 SKU 的 price_book 上,不在 product 上 |
| `image_url` | `hero_image_url` |
| `stock_status` | 无 —— 库存是 SKU 级 |
| category 用 incense/sachet/bracelet | seed 里是 report 等 |

**没有直接修**,因为要先决定「商品列表端点该不该带价格」—— 带价格意味着后端要做
SKU 价格汇总(一个 SPU 多个 SKU 时取哪个?最低价?默认 SKU?),那是 API 设计决定。

已核对过全部客户端调用:除这一条外,`proto` 其余 7 条与 `mini` 全部 9 条路径都对得上后端路由。
另外两个客户端**都没有调用任何商业写接口**(`/v1/orders`、`/pay`、`/cancel`、`/refund`),
所以 P1 改的客户端侧语义目前没有在用的消费方。

### 已知欠账

- `AppState.cache`(kevy-embedded)在两个 API crate 里都是未读字段。`unmei-api`
  那份至少 Store 本身给了 `WxSdk` 用;**`unmei-admin-api` 那份彻底没用** ——
  开一个 Store、写一个 AOF 文件、docker 挂一个 volume、`.env.example` 记一个
  `UNMEI_ADMIN_CACHE_DIR`,全为了没人读的东西。删它要连带改
  `state.rs` / `main.rs` / `docker-compose.yml` / `.env.example` / README,
  所以留着等一句话拍板
- **`subscription` 表没有 `audit_note` 列**(其它 8 张商业表都有),所以订阅取消只能靠领域事件留痕,库里没有备注。要补需要一次 migration
- 后台的只读列表查询仍是路由里的直接 sqlx(约 90 处),不是双写,但也不在用例层
- **订阅 dunning 阶梯没实现** —— `subscription_billing` 的文件头注释写着
  「T+0 / T+1d / T+3d / T+7d 重试,attempt_count > 3 → past_due → grace → expired」,
  代码里一条都没有。mock 收款永远成功,所以这条路从没走过。真接入渠道前必须补
- **对账只比流水号,不比金额** —— `recon` 用 `channel_txn_id` 匹配到 payment 就标
  `matched`,金额对不上也照标。而对账的意义正在于抓金额差异
- `subscription` 表没有 `audit_note` 列(其它 8 张商业表都有),订阅相关操作
  只能靠领域事件留痕

## 致谢

- UI/UX:借鉴**不完人** / 纳吉(buwanren-2.0)
- 算力:沿用 mingli 21 叶 Rust 实现
- 字体:Noto Serif SC + Noto Sans SC + Inter + JetBrains Mono
