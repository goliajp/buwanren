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
| **P2** | 依赖方向修正 —— SQL 全部收敛进 `unmei-pg`,`unmei-domain` 去 sqlx / 去 http。判据可机械化:`grep -rn 'sqlx\|axum\|http::\|reqwest' unmei-domain/src` 必须为 0(P0 时 215,P1 后 **24**) | ⏳ |

**目标形态**:`unmei-api / unmei-admin-api → unmei-app → unmei-domain ← unmei-pg`,依赖单向。

`unmei-app` 只收**写操作与状态迁移**。列表 / 详情这类只读查询仍在路由里 —— 它们两端不重叠(客户端按 `user_id` 过滤,后台按筛选条件),不存在双写,连同 SQL 一起归 P2。

### 已知欠账

- `unmei-domain` 剩下的 24 处基础设施引用:聚合根上的 `#[derive(sqlx::FromRow)]` / `sqlx::Type`、`outbox.rs` 里的 SQL、`adapters.rs` 的 `http::HeaderMap`。全是 P2 的活
- `AppState.cache`(kevy-embedded)在两个 API crate 里都从未被读 —— admin 进程会开一个自己不用的 Store
- `unmei-api/src/mingli.rs` 的 `QimenLite` / `QimenXun` / `health()` 是死代码
- **`subscription` 表没有 `audit_note` 列**(其它 8 张商业表都有),所以订阅取消只能靠领域事件留痕,库里没有备注。要补需要一次 migration

## 致谢

- UI/UX:借鉴**不完人** / 纳吉(buwanren-2.0)
- 算力:沿用 mingli 21 叶 Rust 实现
- 字体:Noto Serif SC + Noto Sans SC + Inter + JetBrains Mono
