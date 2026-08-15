# unmei · QUICKSTART(docker-compose 版)

> 标杆栈:**PostgreSQL 18 + kevy-embedded(in-process Redis 协议) + Rust/axum + 微信生态**。
> 一行起 backend,前端开发期用 npm run dev。

## 前置

- macOS / Linux
- Docker Desktop ≥ 4.30(含 Compose v2)
- Node ≥ 20(给前端开发期用)
- Rust ≥ 1.80(可选;只在不用 docker 构建后端时需要)
- 主项目 `mingli` 的 `mingli-api :6027` 跑在宿主(算力源)

## 30 秒上路

```bash
cd buwanren

# 1. env 样板
cp .env.example .env
# 真接微信前可保持空,自动走 mock

# 2. 起 backend 全套(pg18 / unmei-api / unmei-admin-api;缓存 in-process,无独立容器)
docker compose up -d --build

# 3. 看健康
curl http://localhost:6028/v1/health
curl http://localhost:6029/admin/health
```

## 端口表

| 端口 | 服务 | 角色 |
|---|---|---|
| 6027 | mingli-api | 21 叶纯算力(主项目,跑在宿主) |
| 6028 | unmei-api | 业务 BFF · 客户端面 |
| 6029 | unmei-admin-api | 运营后台 API |
| 6030 | webadmin | React WebAdmin(开发期 npm run dev) |
| 6031 | proto | React 客户端原型 |
| 6032 | postgres18 | DB(宿主映射) |
| — | kevy-embedded | in-process · 无独立端口 · AOF 落 docker volume |

## 起前端(可选)

```bash
( cd webadmin && npm install && npm run dev )   # :6030
( cd proto    && npm install && npm run dev )   # :6031
```

WebAdmin 默认账号:`admin@unmei.local` / `admin123`。

## 接入微信(可选)

在 `.env` 填上后 `docker compose up -d` 自动重起:

```dotenv
# 小程序
WX_MP_APPID=wx1234567890
WX_MP_SECRET=xxx

# 公众号 / H5 OAuth(可同一 appid)
WX_H5_APPID=wx1234567890
WX_H5_SECRET=xxx

# 微信支付 v3(JSAPI)
WX_PAY_MCHID=1900000000
WX_PAY_KEY_PATH=/etc/unmei/wxpay/apiclient_key.pem
WX_PAY_SERIAL_NO=ABCDEF...
WX_PAY_API_V3_KEY=32 字节 API v3 密钥
WX_PAY_NOTIFY_URL=https://your-domain.com/v1/pay/wx/notify
```

未填即 mock — 端到端跑通,登录返回稳定的 fake openid,支付返 fake prepay_id。

## 端点速查

### 鉴权(unmei-api)

```
POST /v1/auth/anonymous          匿名 token
POST /v1/auth/wx/miniprogram     小程序 wx.login code → token
GET  /v1/auth/wx/h5/url          生成公众号授权跳转 URL
POST /v1/auth/wx/h5/callback     H5 OAuth code 回调
```

### 微信支付

```
POST /v1/pay/wx/jsapi/prepay     JSAPI 预下单 → prepay_id + 客户端调起参数
POST /v1/pay/wx/notify           微信支付异步回调
GET  /v1/pay/order/:id           查我方流水状态
```

### 其他(原状)

```
POST /v1/naji/spin               核心 · 罗盘抽吉(调 mingli-api 算真奇门)
GET  /v1/natal/:id/summary       本命简介一句话(隐式算力)
...
```

## 故障排查

| 现象 | 解决 |
|---|---|
| `docker compose build` 失败 | 检查 Docker 版本 / 网络;Rust 镜像首次拉满吃流量 |
| `sqlx::query!` 编译报错 | 当前 query! 用编译期检查 → 需 .sqlx 离线缓存;先 `cargo sqlx prepare`(连 :6032 PG)再 build |
| `mingli-api 502` | 宿主上 mingli-api 没起,容器内通过 `host.docker.internal:6027` 访问 |
| webadmin 登录 401 | 检查 admin_user 表 seed 有没跑(看 unmei-api 启动日志) |
| 微信支付返 `TODO` | mock 模式;真接需在 .env 填 WX_PAY_* + 实现签名(unmei-wx 内有 TODO 标) |
| 数据库要清空重做 | `docker compose down -v && docker compose up -d` |

## 当前已落地 ✅ / 待续 ⏳

**已落地**
- ✅ docker-compose 一行起 4 服务
- ✅ PG18 schema(14 表 + 微信 + 支付流水)
- ✅ kevy-embedded(access_token / session,进程内)
- ✅ 微信小程序登录(jscode2session)
- ✅ 微信公众号 / H5 OAuth 骨架
- ✅ 微信支付 JSAPI 预下单 + 回调路由(签名/解密留 TODO)
- ✅ Cargo workspace 切 PostgreSQL

**待续(Beta1)**
- ⏳ 微信支付 v3 RSA 签名 + AES-GCM 回调解密(unmei-wx::pay 内 TODO)
- ⏳ 小程序敏感数据解密(unmei-wx::miniprogram::mp_decrypt)
- ⏳ sqlx prepare 离线缓存 + 真 cargo build 跑通(本轮未验证)
- ⏳ 模板消息 / 订阅消息发送
- ⏳ 真支付证书 + 平台证书自动轮换

## 项目结构

```
buwanren/
├── docker-compose.yml          ← 一行起 backend 全栈
├── .env.example                ← 环境变量样板
├── infra/
│   ├── postgres/init.sql       ← 扩展 + 时区
│   ├── Dockerfile.api          ← cargo-chef 多阶段
│   └── Dockerfile.admin-api
│
├── backend/                    ← Rust workspace(已切 PG18)
│   ├── unmei-domain/           ← 共享 DTO + Error
│   ├── unmei-wx/      NEW      ← 微信 SDK(mp / h5 / pay)
│   ├── unmei-api/      :6028
│   ├── unmei-admin-api/ :6029
│   ├── migrations/             ← PG18 schema(14 业务表 + payment + wx_msg)
│   └── seed/                   ← PG 兼容 seed
│
├── backend-v0.1-sqlite-archive/  ← 备份 · 上版 SQLite demo
│
├── webadmin/  :6030            ← React 19 后台
├── proto/     :6031            ← React 19 客户端原型
├── mini/ ios/ android/         ← 多端派生(占位)
└── design.html · architecture.md
```

详细业务架构见 [architecture.md](architecture.md);UI/UX 见 [design.html](design.html)。
