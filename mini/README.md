# 不完人 · buwanren

微信小程序 · 「五行不均是常态,补什么才有效」

以「缺」为核心 —— 不玄、不算命,只呈现结构。产品的核心不是「运」,是**你长期缺什么、过什么**。

## 3 tab

| tab | 页面 | 干什么 |
|---|---|---|
| 今 | `pages/today` | 今日日期 · 与本命对照的「缺」与「过」 |
| 命 | `pages/natal` | 建生辰 → 五行分布 · 用神(缺) · 忌神(过) |
| 我 | `pages/me` | 微信绑定(chooseAvatar + nickname 授权流) + profile |

## 后端契约

沿用 unmei-api :6028 · 全部 v1 端点:

| endpoint | 用途 |
|---|---|
| `POST /v1/auth/anonymous` | 首次进入 · 匿名 token(不阻塞 UI) |
| `POST /v1/auth/wx/miniprogram` `{code, nickname, avatar_url}` | 用户主动升级为微信身份 |
| `GET/POST /v1/user/natals` | 本命档案 CRUD |
| `POST /v1/user/natals/:id/activate` | 切默认本命 |
| `GET /v1/natal/:id/summary` | 五行分布 + 用神 + 忌神 |

## 打开

1. **微信开发者工具** → 导入 `mini/`(整目录,不是 miniprogram/)
2. AppID 已配 `wxfbe32d3306425f73`(project.config.json)
3. **必开设置**:详情 → 本地设置 → ✅ 不校验合法域名 / TLS / HTTPS 证书
4. 后端起着 `unmei-api :6028`,`.env.local` 已 source WX_MP_APPID/SECRET

**期望首屏**:
- 进入 `今` tab → 无本命 → 大字「先建本命」引导 → 点跳 `命`
- 输入生辰 → 提交 → 朱砂章卡显示大字「缺 · X」 + chip「过 · X X」
- 切 `我` tab → 未绑定微信 → `<button open-type="chooseAvatar">` 选头像 + `<input type="nickname">` 输昵称 → 点「绑定微信」 → 触发 wx.login 换 openid + JWT
- 绑定后头像 + 昵称 + 「微信 · 已绑定」绿章显示

## 品牌 tokens

palette 见 `miniprogram/app.wxss`:paper `#f0ede7` / ink `#1a1a1c` / stamp 朱砂 `#a83428` / 五行五色。

## 凭据 (敏感 · 已 gitignore)

- **AppID** `wxfbe32d3306425f73`(公开,已入 project.config.json)
- **AppSecret** + 上传密钥路径 → `.env.local`(gitignore 拦)

## 下一版

- 摇卦问事(`POST /v1/naji/spin`)
- 每日流年提示(`/v1/naji/history` 汇总)
- 会员订阅(`/v1/products` + `/v1/orders`)
