# 架构设计：可插拔的「信物 → 身份 → 承接 → 内容」管线

> 项目代号暂用 **Omamori**（御守）。事实底座见 [`00-background-research.md`](./00-background-research.md)。
> 设计目标：**每一个环节都是可替换的 Adapter**——NFC 可换 RFID/QR/BLE/NFT，承接可换 LINE/PWA/原生，内容可换 AI/规则/真人神职，支付可换 PayPay/Stripe。

---

## 0. 架构基石：身份与载体解耦（Carrier-agnostic Identity）

整个「环节可换」能成立，靠的是一条业界成熟原则（[GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link) / [W3C DID](https://www.w3.org/TR/did-1.0/) / [W3C UORA](https://www.w3.org/community/uora/) / [EU DPP](https://en.wikipedia.org/wiki/EU_Digital_Product_Passport) 都建在它上面）：

> **不变量放在「规范身份记录」上，可变量留给「载体」。标识符与物理编码分离。**

也就是说，系统里有且仅有一条**稳定的核心身份** —— 我们叫它 **`OmamoriIdentity`（御守身份记录）**。NFC 的 UID+签名、QR 的序列号、链上的 token id，**都只是指向同一条 `OmamoriIdentity` 的「载体凭证」**。换载体 = 换一个 Adapter，核心身份和它之上的一切（绑定、内容、变现）纹丝不动。

这条基石决定了下面的分层：管线从「物理一碰」到「玩法变现」，每一层都只依赖**端口（Port，稳定接口）**，不依赖具体实现（Adapter）。

```
 物理世界                          数字世界
┌─────────┐  scan   ┌──────────────────────────────────────────────┐
│ 御守实体 │ ──────► │ ① 载体层 → ② 验真/解析层 → ③ 身份/绑定层      │
│ (NFC等) │         │                ↓ OmamoriIdentity (核心不变量)  │
└─────────┘         │ ④ 承接层(落地界面) ⑤ 内容/仪式层 ⑥ 变现层      │
                    │                ↑ ⑦ 合规/信任层(横切，贯穿全栈)  │
                    └──────────────────────────────────────────────┘
```

---

## 1. 分层与端口（每层一个可换插槽）

下面每一层给出：**职责 / 端口(Port) / 可换 Adapter / 推荐默认 / 三分类归属**（石头·钢筋·水泥见 `methodology`）。

### ① 载体层 Carrier Layer 【水泥→石头混合】
- **职责**：用户「一碰/一扫」后产生一段原始凭证（raw payload + 载体类型）。
- **端口** `CarrierCredential { type, rawPayload, scannedAt }`
- **可换 Adapter**：
  | 载体 | 手机原生可扫 | 防伪 | 单价 | 适用 |
  |---|---|---|---|---|
  | **NTAG 424 DNA**（带 SUN/CMAC 动态签名） | ✅ | **强**（每碰一次密文不同，不可克隆） | ~0.6 EUR | **防伪溯源首选** |
  | NTAG213/215/216（静态 NDEF） | ✅ | 弱（可逐位克隆，有「魔术卡」） | $0.2–1.2 | 低价非安全场景 |
  | QR 二维码 | ✅ | 弱（需配防复制图案） | ≈印刷成本 | 兜底/超低成本 |
  | UHF RFID | ❌ 手机读不了 | 弱 | $0.05–0.25 | **御守场景淘汰**（需专用读卡器） |
  | BLE Beacon | 需App | 弱 | 成品 $8+ | 不划算 |
  | 链上 NFT（physical-backed） | 经扫码 | 强（链上唯一） | gas+芯片 | 收藏向高端款 |
- **推荐默认**：**NTAG 424 DNA**（唯一同时满足「手机原生可扫 + 强防伪」）。低端/促销款可降级 NTAG215 或 QR。
- 来源：[NXP NTAG21x](https://www.nxp.com/products/NTAG213_215_216)、[NTAG424 AN12196](https://www.nxp.com/docs/en/application-note/AN12196.pdf)、[GoToTags 424定价](https://store.gototags.com/nfc-tags/nfc-tags-by-use/nxp-ntag-424-dna-nfc-tags/)

### ② 验真/解析层 Verification & Resolver 【石头】
- **职责**：验证载体凭证真伪 → 解析为 `OmamoriIdentity`。**防伪逻辑全在这层。**
- **端口**
  - `CarrierVerifier.verify(CarrierCredential) → VerifiedCarrier | Rejected`
  - `IdentityResolver.resolve(VerifiedCarrier) → OmamoriIdentity`
- **可换 Adapter（按载体）**：
  - `NFC424Verifier`：服务端持同一 AES-128 密钥，解密 PICCData 取 UID + tap 计数器，重算 CMAC 比对；**计数器单调递增检测克隆/重放**。有成熟开源后端（[sdm-backend](https://github.com/nfc-developer/sdm-backend)、[ntag424-backend](https://github.com/lucashenning/ntag424-backend)）。
  - `NFC21xVerifier`：仅校 UID（弱，标注「低保真」）。
  - `QRVerifier`：序列号 + HMAC 签名。
  - `NFTVerifier`：查链上 owner / [Azuki PBT](https://medium.com/kong-land-embassy/the-physical-backed-token-standard-1c8f853597b) 自认证。
- **`OmamoriIdentity` 规范身份记录**（核心不变量，建议用 GS1 Digital Link URL 或 DID 表达）：
  ```
  OmamoriIdentity {
    id            // 规范ID（载体无关）
    shrineId      // 归属神社
    seriesId      // 御守款式/批次（安产/合格/交通安全…）
    issuedAt
    carrierRefs[] // 当前绑定的载体凭证（可多载体指向同一身份）
    status        // active / 已焚化(burned) / 已转让
  }
  ```
- **关键设计**：NTAG 424 的 **Key Diversification（Master Key + UID 派生每标签独有密钥）** 让「UID+签名」天然成为后端统一可验证凭证。换任何载体只要实现 `CarrierVerifier`+`IdentityResolver` 两个接口。

### ③ 身份/绑定层 Identity & Binding 【钢筋】
- **职责**：把 `OmamoriIdentity` ↔ 用户账号绑定（1:1 守护关系，或 1:N 转让/赠予）。这一层赋予御守「魂」（那吉缺失、Tamagotchi 致胜的一环）。
- **端口**
  - `UserIdentityProvider.authenticate() → UserId`（用户身份来源，可换）
  - `BindingService.bind(OmamoriIdentity, UserId)` / `transfer()` / `unbind()`
- **可换 Adapter（用户身份来源）**：
  - **`LINELogin`（日本默认）**：取 ID token 验签得 `sub`(=userId)。**userId 在同一 provider 下跨设备稳定**，可做绑定主键；`openid` 可走「[Channel consent simplification](https://developers.line.biz/en/docs/line-mini-app/develop/channel-consent-simplification/)」近乎免感登录（**日本新建 channel 2026-01-08 起强制启用**）。
  - `PayPayAuth`、`EmailPasskey`、`WalletAuth`（ERC-4337 账户抽象，邮箱/passkey 登录，给 NFT 款）。
- **硬边界**：LINE userId 是 **per-provider**，必须固定在同一 provider 下；用户删号重建后旧绑定失效需重绑。**绑定主键用 userId，绝不用会变的 display name/picture。**
- 来源：[LINE userId 稳定性](https://developers.line.biz/en/docs/messaging-api/getting-user-ids/)、[verify ID token](https://developers.line.biz/en/docs/line-login/verify-id-token/)

### ④ 承接层 Host / Entry 【水泥】
- **职责**：用户扫完落到哪个界面、怎么进去。
- **端口** `HostEnvironment`（渲染面 + 深链入口解析）
- **可换 Adapter**：
  | 承接 | 日本触达 | 审核 | 支付 | 适配性 |
  |---|---|---|---|---|
  | **LINE MINI App / LIFF**（默认） | MAU破亿，全年代90%+ | LY审核~1–2周 | 嵌外部 | **日本正统首选** |
  | PayPay 미니앱 | 注册7000万+ | ~2周–1月 | PayPay原生 | 并行/备选 |
  | 独立 PWA/Web | 自前获客 | 无 | 自接PSP | **兜底**（NFC落浏览器时） |
  | 原生 App | 商店分发 | Apple/Google | 自实现 | 重度玩法时 |
  | 微信小程序 | **日本人几乎不用** | — | — | **对华inbound才用** |
- **推荐默认**：**LINE MINI App**（`https://liff.line.me/{liffId}`），**PWA 作兜底**。
- ⚠️ **两个硬约束（写进架构，别假设）**：
  1. **NFC 唤起 LINE 不保证**：NFC 把 https URL 交给 OS，靠 iOS Universal Link / Android App Link 命中 LINE，**iOS 端常落 Safari 而非 LINE，LINE 官方明确「不保证打开环境」**。→ 必须设计「落到浏览器」的兜底体验，承接层做**入口环境探测 + 优雅降级**。
  2. **微信在日不可行**（与那吉最大的环境差异）。
- 来源：[LIFF opening](https://developers.line.biz/en/docs/liff/opening-liff-app/)、[NFC iOS背景读取](https://seritag.com/news/apple-adds-iphone-background-nfc-tag-reading-in-core-nfc)、[LINE MAU破亿](https://www.lycorp.co.jp/ja/news/release/020058/)

### ⑤ 内容/仪式层 Content & Ritual 【钢筋(领域) + 水泥(文案)】
- **职责**：御守绑定后的玩法 —— 命理、祈福、求签、推荐、神社仪式。
- **端口** `RitualEngine.perform(OmamoriIdentity, UserContext, ritualType) → RitualResult`
- **可换 Adapter（玩法引擎）**：
  - **`ShichuSuimeiEngine`（四柱推命，日式）** —— ⚠️ **不是中式八字**，体系不同结果可能相反，必须用日本本地算法/内容。
  - `OmikujiEngine`（数字御神签，源出中国签占但已被神道神圣化为「向神问询」，文化上最贴神社）。
  - `LLMEngine`（大模型解读，注意那吉式「随机数+巴纳姆话术」是反面教材，要做真实个性化 + 记忆）。
  - `RealPriestEngine`（**人工祈祷/祈願**，对接真实神职 —— 这是日本「重可信度」客群和神社神圣性的正解，也是高客单合规路径）。
  - `RecommendationEngine`（运势 → 推荐御守款/参拜建议/能量景点）。
  - `TarotEngine` / `AstrologyEngine`（年轻女性向，可选）。
- **设计**：`ritualType` 枚举（占い/おみくじ/祈願/厄除け/御朱印/推荐），引擎可按神社、按款式、按用户世代热插拔。
- 来源见 `00-background-research.md` §1/§4/§5。

### ⑥ 变现层 Monetization 【钢筋 + 水泥】
- **职责**：收钱。
- **端口** `PaymentProvider.charge()` / `Subscription`
- **可换 Adapter**：
  - ⚠️ **LINE Pay 在日本已于 2025-04-30 全部停服**（LY 把日本国内决济统一到 PayPay）。**绝不要把 LINE Pay 写进方案。**
  - **`PayPayPayment`（默认）** —— [PayPay for Developers](https://about.paypay.ne.jp/en/pr/20250715/01/) 在线支付 API，注册7000万+、扫码支付份额~7成。
  - `StripePayment` —— LIFF webview 内 Stripe Elements 托管表单（信用卡）。
- **变现模型（合规约束下，见⑦）**：
  - ✅ 卖实体御守（初穂料形态）、御守满1年更新、数字御朱印、月额订阅（日本习惯 ~300円/月）、按字数解读、**在线祈願/厄除け（高客单走真人神职）**。
  - ❌ **禁用**：中国式「切香肠解锁焦虑」「邀3友裂变」「三级分销」「499大师」—— 与神社神圣性强冲突，日本高压线。
- 来源：[LINE Pay 停服官方公告](https://www.lycorp.co.jp/en/news/release/008632/)

### ⑦ 合规/信任层 Compliance & Trust 【横切，一等公民】
- **职责**：贯穿全栈的合规闸门，**不是事后补丁**。
- **端口** `ConsentGate` / `ShrineAuthorization` / `AntiResalePolicy`
- **必须落地的闸门**：
  - **APPI 要配慮個人情報**：占卜要生辰 + 涉「信仰/宗教」= 法定敏感信息，**取得前必须明示同意、禁止 opt-out 向第三方提供**。`ConsentGate` 在收集生辰/绑定宗教信息前强制弹同意，且默认不外传。
  - **神社授权**：每个 `shrineId` 的数字化/玩法/变现需该神社认可（本厅无统一立场，风险在单社+宗教感情）。
  - **反转售**：御守转售是日本最明确雷区 → 绑定层 `transfer()` 要么禁用、要么做「御魂抜き」语义（转让即失效需重新祈愿）。
  - **税务**：按商价牟利的数字商品易被认定收益事业课税，与神社「初穂料（喜捨/非课税）」要在账务上分清。
  - **游戏化克制**：御朱印「集章打卡感」已引发神职反弹 → 养成/集章玩法要避开亵渎神域的观感。
- 来源见 `00-background-research.md` §3。

---

## 2. 一次完整请求流（端到端）

```
用户碰御守(NFC)
  → ① 载体层产出 CarrierCredential(NFC424, picc+enc+cmac)
  → ② NFC424Verifier 验 CMAC + 计数器 → IdentityResolver → OmamoriIdentity
  → ④ 落地：OS 经 Universal Link 尝试唤起 LINE MINI App（失败则 PWA 兜底）
  → ③ LINELogin 取 userId；首次则 BindingService.bind(OmamoriIdentity, userId)
  → ⑦ ConsentGate：首次收集生辰前弹 APPI 明示同意
  → ⑤ RitualEngine.perform(身份, 用户, ritualType=おみくじ/占い/祈願)
  → ⑥ 如需付费 → PayPayPayment.charge()
  → 返回结果 + 推荐
```

每个箭头后的实现都可独立替换，因为它们只跨**端口**通信。

---

## 3. 与三分类方法论的对应（石头·钢筋·水泥）

| 层 | 分类 | 理由 |
|---|---|---|
| ② 验真/解析（CMAC验签、Resolver、ID方案） | **石头** | 业务无关、纯密码学/标识、可跨项目复用、放大半径全栈 → 单元+fuzz+audit |
| ③ 身份/绑定、⑤ RitualEngine 端口、神社领域模型 | **钢筋** | 感知「御守/神社/仪式」领域但不绑死具体业务流 |
| ④ LINE MINI App 具体UI、⑤ 具体占い文案、各神社 onboarding、landing | **水泥** | 与具体业务流/页面/神社强耦合，用过即丢 |

**施工顺序**（提质时）：先孵石头（验真层做到 fuzz/audit 级）→ 强钢筋（端口抽象稳、消冗余）→ polish 石头钢筋 → 最后 e2e 看水泥。

---

## 4. 建议的 MVP 与演进（待你拍板，非我替你砍）

这一节是**选项陈述**，scope 取舍权在你。我只给「做得动/难在哪」的判断：

- **MVP 最小可跑闭环**：NTAG215（先不上 424，省成本）+ QR 兜底 → LINE MINI App → LINELogin 绑定 → Omikuji/四柱推命（LLM）→ PayPay。先验证「实体引流→留存→付费」是否成立。
- **第二阶段（护城河）**：换 NTAG 424 DNA 上强防伪（解决那吉「无护城河」） + 加「守护养成」（解决那吉「内容空心」，对标 Tamagotchi）+ 接真人神职在线祈願（解决日本「重可信度」+ 高客单合规）。
- **第三阶段（可选高端线）**：physical-backed NFT 收藏款（日本「纯NFT」靠 FSA 两条标准——单价>¥1,000 或总量<100万 + 禁支付用途——规避加密资产监管；UX 用 ERC-4337 邮箱登录免助记词）。

**因为每层是 Adapter，这三阶段不是重写，是逐个换插件。** 这正是你要的「环节可换」。

---

## 5. 已定方向（2026-06 拍板）

| 决策 | 选择 | 对架构的影响 |
|---|---|---|
| **承接层** | LINE MINI App 为主 + PWA 兜底 | 默认实现锁 `LINEHost`，`PWAHost` 作降级；④ 入口环境探测必做 |
| **商业模式** | **D2C 起步 → 案例驱动 B2B2C**（混合） | ⑦ 合规层须**双模式**：D2C 阶段公司全量遵守 APPI（不享宗教法人除外）、账务把御守商品收入与初穂料分清；B2B2C 阶段 `ShrineAuthorization` 升级为多租户（每 `shrineId` 独立授权/账务/品牌） |
| **内容主调** | **神圣体验做信任底座 + 命理养成做增长**（分层并存） | ⑤ `RitualEngine` 多引擎并存：`OmikujiEngine`+`RealPriestEngine` 撑信任与高客单，`ShichuSuimeiEngine`(日式四柱推命，**非中式八字**)+ 守护养成撑增长与留存；按神社/世代热插拔。养成玩法须避开御朱印「集章打卡」式亵渎观感 |
| **NFT/链上** | **第三阶段可选插件** | 一期**砍掉** `NFTVerifier` / `WalletAuth`，聚焦 NFC+LINE；端口预留，三期作 Adapter 后接（届时按 FSA 两标准做「纯NFT」合规 + ERC-4337 邮箱登录免助记词） |

### 据此修订的演进路线
- **一期（D2C 验证内容闭环）**：NTAG215 + QR 兜底 → LINE MINI App → LINELogin 绑定 → おみくじ + 日式四柱推命(LLM) → PayPay。验证「实体引流→绑定留存→付费」。**不上 NFT、不上 424、不接真人神职。**
- **二期（护城河 + 信任 + B2B2C）**：换 NTAG 424 DNA 强防伪；加守护养成(对标 Tamagotchi)；接 `RealPriestEngine` 真人在线祈願(高客单+信任底座)；`ShrineAuthorization` 升多租户，拿一期案例去 BD 真实神社。
- **三期（高端线，可选）**：physical-backed NFT 收藏款，`NFTVerifier`/`WalletAuth` 作插件后接。

**因为每层是 Adapter，三期演进不是重写，是逐个换/加插件。**

---

## 6. 命理引擎与 AI 应用（深入）

这一节深入第 ⑤ 层 `RitualEngine` 的内部，是项目「内容内核」的技术核心。

### 6.0 核心铁律：「算」与「说」分离

那吉的根本架构错误：`输入生辰 → 随机数种子 → 大模型直接生成文案`。三个致命缺陷：① 没有真实排盘（不可复现，同生辰多次结果靠随机数飘）；② 没有知识库（内容是大模型臆造的巴纳姆话术）；③ 无记忆无个性化。

**正解 = 三段式分层**：确定性排盘（同生辰永远同盘）→ 结构化知识库释义（可溯源）→ LLM 只把结构化释义讲人话+个性化。**LLM 绝不碰推算逻辑。**

### 6.1 命理引擎三段式（算 → 释 → 说）

| 段 | 层 | 职责 | 端口 | 三分类 |
|---|---|---|---|---|
| A | 排盘/起局 Casting | 生辰/抽签/朝向 → 命盘/牌阵/签号。纯计算、确定性、可复现、可 fuzz、可复用 | `CastingEngine.cast(input) → Chart` | **石头** |
| B | 释义/知识 Interpretation | 盘面 → 含义。结构化知识库 + 规则引擎，输出带 sourceRef 的释义片段 | `InterpretationEngine.interpret(Chart, domain) → Interpretation[]` | **钢筋** |
| C | 表达/生成 Expression | 释义 → 自然语言、个性化、口吻控制。LLM 主战场，只表达不推算 | `ExpressionEngine.render(Interpretation[], UserAstroProfile, memory) → Reading` | **水泥 + AI 编排** |

**精度命门（A 层）**：四柱推命需农历转换·二十四节气·**真太阳时**·时区/经度修正；占星需天文星历(ephemeris)。算错节气 = 整盘错 = 石头层 bug 全栈放大 → 必须 audit / 与既有权威排盘校验。

**数据模型**：
```
Chart            { system, pillars/houses/cards, elements, casterVersion, deterministic:true }
Interpretation   { topic, verdict, sourceRef }
UserAstroProfile { birth, focusAreas, history[] }
Reading          { text, citations[], recommendations[] }
```

### 6.2 各命理/风水体系 × 排盘要素（收敛到统一三段式）

| 体系 | 排盘输入 | 确定性输出(Chart) | 历法/精度依赖 | 排盘层分类 |
|---|---|---|---|---|
| 四柱推命（日式·≠中式八字） | 生年月日时+出生地 | 四柱干支·五行旺衰·十神·大运流年 | 农历·节气·真太阳时·时区 | 石头 |
| 紫微斗数 | 同上 | 命盘十二宫·主星辅星·四化 | 农历·时辰 | 石头 |
| 御神签 おみくじ | 抽签动作 | 签番号→签文(大吉…凶)·和歌 | 可审计随机种子 | 钢筋(签文库) |
| 塔罗 | 抽牌+牌阵 | 牌面·正逆位·位置义 | 可审计随机种子 | 钢筋 |
| 西洋占星 | 生年月日时+地点 | 星盘·宫位·相位 | 天文星历 ephemeris | 石头 |
| 风水（飞星/方位） | 朝向·建筑·生辰 | 飞星盘·方位吉凶·三元九运 | 罗盘方位·节气换运 | 钢筋 |

每个体系 = 一组 `CastingEngine` + `InterpretationEngine` adapter，但都收敛到「算→释→说」与 `RitualEngine` 端口。随机类（签/塔罗）用**可审计随机种子**（存档可复查）而非黑箱随机数 —— 这正是与那吉的分界。

### 6.3 AI 应用栈（LLM = 嘴与编排，不是神谕）

请求流：`① 排盘(确定性) → ② RAG 检索(知识库) → ③ LLM 生成(表达+个性化) → ④ 自检(一致性校验) → ⑤ 推荐/转介 → ↩ 写回记忆`

- **角色边界**：LLM 只做表达层 + 编排层，不做核心推算（推算交给确定性引擎，避免幻觉污染结论）。
- **RAG**：命理典籍/释义知识库向量化，LLM 引用片段而非凭空生成 → 降幻觉、可溯源(`Reading.citations`)、风格一致。知识库是**钢筋资产**，按体系/流派/神社可换。
- **Prompt 架构**：`system`(人设/口吻/边界：不做医疗·法律·投资断言) + `context`(排盘结果+知识片段+用户档案+历史记忆) + `guardrails`(禁恐吓·禁绝对预言)。排盘结果以结构化 JSON 注入，**LLM 不得改写盘面数字**。
- **个性化 & 记忆**：`UserAstroProfile` 持久化 + 向量库存历史对话 → 跨会话的持续关系（对标 Co-Star 长期陪伴、Tamagotchi 养成留存）。补那吉**无记忆**缺口。
- **反巴纳姆**：用真实排盘差异驱动内容差异，而非随机数。同用户同日结果稳定（确定性），不同用户结果真不同（盘不同）。可复现是信任与复购底层。
- **Agentic 多步 & 自检**：排盘→检索→生成→**自检（一致性校验：生成不得与盘矛盾）**→推荐。自检是把 LLM 幻觉挡在用户之前的关键闸。可编排为 tool-calling agent。
- **多模态**：手相/面相（图像识别，须合规+「仅供娱乐」）、语音解读 TTS（对标 こまいぬAI神社）、生成御守视觉/数字护符。图像类对准确性主张尤其克制。
- **真人神职协同(human-in-the-loop)**：AI 出初稿/初步解读，真人神职审核并主持高客单祈愿 = 信任底座 + 合规 + 高单价；AI 同时辅助神职提效。
- **模型选型**：需日语强模型（Claude / GPT / 日本国产 ELYZA·Swallow）。四柱推命等日式知识靠 RAG/微调补足（通用模型对日式命理薄弱）。成本参考：那吉用国内大模型 API ~¥1/次，毛利空间大。

### 6.4 AI 合规红线（重点，补充第 ⑦ 层）

- **霊感商法 高压线**：日本特商法 / 消費者契約法严管「用占卜恐吓推销高价物」（2022 后强化）。**AI 绝不能做恐吓式升单**（如「不买此御守会有灾」）。这是日本特有、且因 AI 规模化而风险放大的高压线。
- AI 不得做绝对预言 / 医疗 / 法律 / 投资断言；「仅供娱乐」声明常驻。
- 宗教敏感：AI 生成的「神谕 / 签文」须标注为 AI；神社正式祈愿走真人神职，不被 AI 亵渎。
- APPI：生辰 + 信仰 = 要配慮個人情報，`ConsentGate` 前置同意（见第 ⑦ 层）。

### 6.5 架构落点

`CastingEngine` / `InterpretationEngine` 是**石头·钢筋**（精度命门，大量 audit/校验）；`ExpressionEngine`(LLM) 是**水泥 + AI 编排**（文案易改、可换模型）。因此「换占卜体系」「换 LLM」「加多模态」都是换 Adapter，与第 ⑤ 层 `RitualEngine` 端口一致 —— **AI 本身也是「可换的一环」**。
