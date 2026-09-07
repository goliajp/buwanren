//! WechatAdapter · 实现 `unmei_domain::commerce::adapters::PaymentAdapter`
//!
//! 一个 struct 覆盖 wechat_jsapi / wechat_mp / wechat_h5 / wechat_native 四个子模式,
//! 内部按 [`Mode`] 走不同 trade_type 和 outcome 形态。
//!
//! 当前实现:
//! - **创建预下单**:调 [`crate::WxSdk::pay_jsapi_prepay`] 或对应子模式
//! - **回调验签 / 解密**:调 [`crate::WxSdk::pay_notify_decrypt`],翻译成 [`WebhookEvent`]
//! - **退款 / 查询 / 拉账单**:留 stub,后续 Beta 接通真实接口
//!
//! 上线前 Beta 必做:HMAC + RSA 签名、平台证书校验、JSAPI paySign 计算、Native code_url 等。

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use unmei_domain::commerce::adapters::WebhookHeaders;
use std::sync::Arc;
use unmei_domain::commerce::adapters::{
    AdapterCapabilities, AdapterError, ChannelTxnRow, CreatePaymentParam, CreatePaymentResp,
    PaymentAdapter, RefundParam, RefundResp, WebhookEvent,
};

use crate::pay::{JsapiPrepayReq, JsapiPrepayResp, NotifyEnvelope, PrepayAmount, PrepayPayer};
use crate::WxSdk;

/// 微信支付子模式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Jsapi,
    Mp,
    H5,
    Native,
}

impl Mode {
    pub const fn channel_str(self) -> &'static str {
        match self {
            Self::Jsapi  => "wechat_jsapi",
            Self::Mp     => "wechat_mp",
            Self::H5     => "wechat_h5",
            Self::Native => "wechat_native",
        }
    }
}

/// PaymentAdapter 实现
#[derive(Clone)]
pub struct WechatAdapter {
    pub sdk: Arc<WxSdk>,
    pub mode: Mode,
}

impl WechatAdapter {
    /* 【`stub_autosettle` 撤了】（2026-09-07）。它是用来关住 `query_payment`
       那个「无条件说已支付」的桩的 —— 而桩本身已经换成真的查单。
       一个只为关住桩而存在的开关，留着就是在说「那条路还有另一种行为」。 */
    pub fn new(sdk: Arc<WxSdk>, mode: Mode) -> Self {
        Self { sdk, mode }
    }
}

#[async_trait]
impl PaymentAdapter for WechatAdapter {
    fn channel(&self) -> &'static str { self.mode.channel_str() }

    fn capabilities(&self) -> AdapterCapabilities {
        AdapterCapabilities {
            partial_refund: true,
            subscription: matches!(self.mode, Mode::Jsapi | Mode::Mp), // 合约扣款只支持 JSAPI/MP
            off_session_charge: false,
            cancel_pending: true,
            three_d_secure: false,
            settlement_pull: true,
            max_amount_minor: Some(100_000_000),
        }
    }

    fn supported_currencies(&self) -> &'static [&'static str] { &["CNY"] }

    async fn create_payment(&self, req: CreatePaymentParam) -> Result<CreatePaymentResp, AdapterError> {
        if req.currency != "CNY" {
            return Err(AdapterError::Unsupported);
        }
        self.sdk.pay_ready().map_err(|e| AdapterError::Config(e.to_string()))?;
        let openid = req.channel_user_ref.as_deref().unwrap_or("");
        match self.mode {
            Mode::Jsapi | Mode::Mp => {
                let amt = PrepayAmount { total: req.amount_minor, currency: "CNY".into() };
                let payer = PrepayPayer { openid };
                let jsapi = JsapiPrepayReq {
                    appid: &self.sdk.cfg.mp.appid,
                    mchid: &self.sdk.cfg.pay.mchid,
                    description: &req.description,
                    out_trade_no: &req.payment_id,
                    notify_url: &req.notify_url,
                    amount: amt,
                    payer,
                };
                let JsapiPrepayResp { prepay_id } = self.sdk.pay_jsapi_prepay(&jsapi).await
                    .map_err(|e| AdapterError::ChannelRejected { code: "wx_pay_create".into(), msg: e.to_string() })?;
                /* 【这五个字段是客户端唤起支付的全部】。在这之前
                   `paySign` 是字面量 `TODO_paySign_beta` —— 配上真商户号
                   之后微信当场拒，也就是说这个产品一分钱都收不到，
                   而这台机器上一切都是绿的（桩替它答了）。
                   待签串是四行，跟请求签名那五行不是一回事（`crypto.rs`）。 */
                let nonce = crate::util::nonce(16);
                let ts = Utc::now().timestamp().to_string();
                let pkg = format!("prepay_id={prepay_id}");
                let pay_sign = crate::crypto::sign_rsa_sha256(
                    &self.sdk.cfg.pay.merchant_private_key_pem,
                    &crate::crypto::pay_sign_message(&self.sdk.cfg.mp.appid, &ts, &nonce, &pkg),
                ).map_err(|e| AdapterError::Config(e.to_string()))?;
                let params = serde_json::json!({
                    "appId":     self.sdk.cfg.mp.appid,
                    "timeStamp": ts,
                    "nonceStr":  nonce,
                    "package":   pkg,
                    "signType":  "RSA",
                    "paySign":   pay_sign,
                });
                Ok(CreatePaymentResp::Jsapi { params })
            }
            Mode::H5 => {
                /* H5 要 `scene_info.payer_client_ip` —— 少了它微信直接拒。
                   拿不到真实 IP 时填回环:那是**我们这一侧发起的**这件事
                   的实话，而编一个像模像样的公网 IP 是在给风控喂假数据。 */
                let body = serde_json::json!({
                    "appid": self.sdk.cfg.h5.appid,
                    "mchid": self.sdk.cfg.pay.mchid,
                    "description": req.description,
                    "out_trade_no": req.payment_id,
                    "notify_url": req.notify_url,
                    "amount": { "total": req.amount_minor, "currency": "CNY" },
                    "scene_info": {
                        "payer_client_ip": req.metadata.get("ip").and_then(|x| x.as_str())
                            .unwrap_or("127.0.0.1"),
                        "h5_info": { "type": "Wap" }
                    }
                });
                let v = self.sdk.pay_prepay("h5", &body).await
                    .map_err(|e| AdapterError::ChannelRejected { code: "wx_pay_create_h5".into(), msg: e.to_string() })?;
                let url = v.get("h5_url").and_then(|x| x.as_str())
                    .ok_or_else(|| AdapterError::ChannelRejected {
                        code: "wx_pay_create_h5".into(), msg: format!("没回 h5_url：{v}") })?;
                Ok(CreatePaymentResp::Redirect { url: url.to_string() })
            }
            Mode::Native => {
                let body = serde_json::json!({
                    "appid": self.sdk.cfg.mp.appid,
                    "mchid": self.sdk.cfg.pay.mchid,
                    "description": req.description,
                    "out_trade_no": req.payment_id,
                    "notify_url": req.notify_url,
                    "amount": { "total": req.amount_minor, "currency": "CNY" },
                });
                let v = self.sdk.pay_prepay("native", &body).await
                    .map_err(|e| AdapterError::ChannelRejected { code: "wx_pay_create_native".into(), msg: e.to_string() })?;
                let code_url = v.get("code_url").and_then(|x| x.as_str())
                    .ok_or_else(|| AdapterError::ChannelRejected {
                        code: "wx_pay_create_native".into(), msg: format!("没回 code_url：{v}") })?;
                Ok(CreatePaymentResp::NativeQr { code_url: code_url.to_string() })
            }
        }
    }

    async fn query_payment(&self, payment_id: &str) -> Result<WebhookEvent, AdapterError> {
        /* 【这里原先是个说「已支付」的桩】。`payment_query_sweeper` 每 30 秒
           问它一次，于是任何一笔待付支付都会在 90 秒内被结成已付，
           一分钱没收、履约照跑 —— 配没配真凭据都一样，因为只有这一个适配器。
           那时只好拿 `UNMEI_PAY_STUB_AUTOSETTLE=1` 把它关起来，
           而「关着的桩」意味着这条路在本机从来没跑过。

           现在它真去问渠道。本机跑的是 `scripts/fake-wx.py` ——
           那一头照微信的协议说话（验我们的签名、按 v3 回话），
           所以我方这一侧的每一个字节都真的走了一遍。 */
        self.sdk.pay_ready().map_err(|e| AdapterError::Config(e.to_string()))?;
        let v = self.sdk.pay_query(payment_id).await
            .map_err(|e| AdapterError::ChannelRejected { code: "wx_pay_query".into(), msg: e.to_string() })?;
        Ok(译一笔支付(&v))
    }

    async fn cancel_payment(&self, payment_id: &str) -> Result<(), AdapterError> {
        self.sdk.pay_ready().map_err(|e| AdapterError::Config(e.to_string()))?;
        self.sdk.pay_close(payment_id).await
            .map_err(|e| AdapterError::ChannelRejected { code: "wx_pay_close".into(), msg: e.to_string() })
    }

    async fn refund(&self, req: RefundParam) -> Result<RefundResp, AdapterError> {
        self.sdk.pay_ready().map_err(|e| AdapterError::Config(e.to_string()))?;
        /* 【按我方单号退，不按渠道流水号】。两个都能用，而我方单号是
           我们自己发的、一定有；`channel_txn_id` 在「渠道说成了但回调
           还没回来」那一刻是空的，而退款恰恰可能发生在那之后不久。 */
        let body = serde_json::json!({
            "out_trade_no": req.payment_id,
            "out_refund_no": req.refund_id,
            "reason": req.reason,
            "notify_url": req.notify_url,
            "amount": {
                "refund": req.amount_minor,
                "total": req.total_amount_minor,
                "currency": "CNY",
            },
        });
        let v = self.sdk.pay_refund(&body).await
            .map_err(|e| AdapterError::ChannelRejected { code: "wx_refund".into(), msg: e.to_string() })?;
        let channel_refund_id = v.get("refund_id").and_then(|x| x.as_str())
            .ok_or_else(|| AdapterError::ChannelRejected {
                code: "wx_refund".into(), msg: format!("没回 refund_id：{v}") })?;
        Ok(RefundResp {
            channel_refund_id: channel_refund_id.to_string(),
            // 微信的 status：SUCCESS / CLOSED / PROCESSING / ABNORMAL
            status_hint: v.get("status").and_then(|x| x.as_str()).unwrap_or("PROCESSING").to_lowercase(),
        })
    }

    async fn query_refund(&self, refund_id: &str) -> Result<WebhookEvent, AdapterError> {
        /* 【这里原先无条件说「退成了，金额 0」】。也就是说:一笔实际没退成
           的退款，查一次就被记成已退 —— 而金额 0 会让对账那一侧
           怎么算都对不上，却又不报错。 */
        self.sdk.pay_ready().map_err(|e| AdapterError::Config(e.to_string()))?;
        let v = self.sdk.pay_refund_query(refund_id).await
            .map_err(|e| AdapterError::ChannelRejected { code: "wx_refund_query".into(), msg: e.to_string() })?;
        let amount = v.get("amount").and_then(|a| a.get("refund")).and_then(|x| x.as_i64()).unwrap_or(0);
        let st = v.get("status").and_then(|x| x.as_str()).unwrap_or("");
        Ok(match st {
            "SUCCESS" => WebhookEvent::RefundSucceeded { refund_id: refund_id.to_string(), amount_minor: amount },
            "PROCESSING" => WebhookEvent::Unknown {
                kind: "REFUND.PROCESSING".into(), raw: v.clone(),
            },
            其他 => WebhookEvent::RefundFailed {
                refund_id: refund_id.to_string(),
                code: 其他.to_string(),
                msg: v.get("status").and_then(|x| x.as_str()).unwrap_or("").to_string(),
            },
        })
    }

    async fn verify_webhook(&self, headers: &WebhookHeaders, body: &[u8]) -> Result<WebhookEvent, AdapterError> {
        /* 【在这之前一次都没验过签】。这个方法的注释里写着要做三件事
           （验头、验签、解密），而代码只做了第三件 —— 也就是说：
           知道回调地址的人发一个能解开的包，我们就当成微信说的。
           APIv3 密钥泄露一次，签名这一层本来是第二道锁，而它不存在。

           微信的四个头：Wechatpay-Serial（用哪张平台证书签的）、
           Wechatpay-Timestamp、Wechatpay-Nonce、Wechatpay-Signature。
           待签串三行:时间戳、随机串、**原始报文**（不是重新序列化的）。 */
        self.sdk.pay_ready().map_err(|e| AdapterError::Config(e.to_string()))?;
        let 头 = |k: &str| headers.get(k).unwrap_or("").to_string();
        let (serial, ts, nonce, sig) = (
            头("Wechatpay-Serial"), 头("Wechatpay-Timestamp"),
            头("Wechatpay-Nonce"), 头("Wechatpay-Signature"),
        );
        if serial.is_empty() || ts.is_empty() || nonce.is_empty() || sig.is_empty() {
            return Err(AdapterError::Signature(
                "回调少了 Wechatpay-Serial / Timestamp / Nonce / Signature 里的某个头".into()));
        }
        /* 【时间戳要看】。签名重放攻击靠的就是把同一个包再发一次 ——
           包和签名都是真的，只是过期了。微信自己的建议是五分钟。 */
        let 现在 = Utc::now().timestamp();
        let t: i64 = ts.parse().map_err(|_| AdapterError::Signature(format!("时间戳看不懂：{ts}")))?;
        if (现在 - t).abs() > 300 {
            return Err(AdapterError::Signature(format!("回调时间戳差了 {} 秒 —— 当重放挡掉", 现在 - t)));
        }
        let 原文 = std::str::from_utf8(body)
            .map_err(|e| AdapterError::Signature(format!("回调报文不是 UTF-8：{e}")))?;
        let 公钥 = self.sdk.pay_pubkey_for(&serial).await
            .map_err(|e| AdapterError::Signature(e.to_string()))?;
        crate::crypto::verify_rsa_sha256(
            &公钥,
            &crate::crypto::notify_sign_message(&ts, &nonce, 原文),
            &sig,
        ).map_err(|e| AdapterError::Signature(e.to_string()))?;

        let env: NotifyEnvelope = serde_json::from_slice(body)
            .map_err(|e| AdapterError::Signature(format!("envelope parse: {e}")))?;
        let inner = self.sdk.pay_notify_decrypt(&env)
            .map_err(|e| AdapterError::Signature(e.to_string()))?;

        // 两个号各归各位。从前这里是「先取 transaction_id,取不到才退 out_trade_no」,
        // 于是成功回调里填的永远是渠道流水号 —— 而下游拿它当我方单号去定位,
        // 一条也匹配不上。定位要用 out_trade_no,对账才用 transaction_id。
        let trade_state = inner.get("trade_state").and_then(|v| v.as_str()).unwrap_or("");
        let amt = inner.get("amount").and_then(|a| a.get("total")).and_then(|v| v.as_i64()).unwrap_or(0);

        Ok(match (env.event_type.as_str(), trade_state) {
            ("TRANSACTION.SUCCESS", _) | (_, "SUCCESS") => 译一笔支付(&inner),
            ("REFUND.SUCCESS", _) => WebhookEvent::RefundSucceeded {
                refund_id: inner.get("out_refund_no").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                amount_minor: inner.get("amount").and_then(|a| a.get("refund"))
                    .and_then(|v| v.as_i64()).unwrap_or(amt),
            },
            ("REFUND.ABNORMAL", _) | ("REFUND.CLOSED", _) => WebhookEvent::RefundFailed {
                /* 【退款回调里的我方单号是 out_refund_no】。这里原先读的是
                   `refund_id`，那是**微信那一侧**的号 —— 下游拿它去
                   `WHERE id = $1` 查我们自己的退款表，一条也查不到，
                   于是每一笔失败的退款都静静地什么都没发生。 */
                refund_id: inner.get("out_refund_no").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                code: trade_state.to_string(),
                msg: env.summary.clone(),
            },
            (k, _) => WebhookEvent::Unknown { kind: k.to_string(), raw: inner },
        })
    }

    async fn pull_settlement(&self, day: chrono::NaiveDate, _currency: &str) -> Result<Vec<ChannelTxnRow>, AdapterError> {
        /* 【这里原先回一个空 Vec】。而对账那一支拿「渠道说有这几笔」
           跟我们自己的账比 —— 渠道那一侧永远是空的时候，
           「missing_in_channel」永远是 0，也就是**这个产品最重要的
           一道资金护栏从来没有真的比过一次**。

           微信的交易账单是 csv：第一行表头、最后两行是汇总（以 `总交易单数`
           开头），中间每行一笔。列名按表头找，不按位置数 ——
           微信加过列，按位置数的解析会在那天悄悄错位。 */
        self.sdk.pay_ready().map_err(|e| AdapterError::Config(e.to_string()))?;
        let csv = self.sdk.pay_trade_bill(&day.format("%Y-%m-%d").to_string()).await
            .map_err(|e| AdapterError::ChannelRejected { code: "wx_bill".into(), msg: e.to_string() })?;
        Ok(解交易账单(&csv))
    }
}

/// 微信交易账单（csv）→ 对账要的那几列。
///
/// 微信在每个字段前加了一个反引号（防 Excel 把长数字变成科学计数法），
/// 解析时要剥掉 —— 不剥的话每一个渠道流水号都对不上我们自己的记录。
fn 解交易账单(csv: &str) -> Vec<ChannelTxnRow> {
    let mut 行们 = csv.lines();
    let Some(表头) = 行们.next() else { return Vec::new() };
    let 列: Vec<String> = 表头.split(',').map(剥反引号).collect();
    let 找 = |名: &str| 列.iter().position(|c| c == 名);
    let (Some(i流水), Some(i金额), Some(i状态), Some(i时间)) =
        (找("微信订单号"), 找("应结订单金额"), 找("交易状态"), 找("交易时间"))
        else { return Vec::new() };
    let mut 出 = Vec::new();
    for 行 in 行们 {
        if 行.trim().is_empty() {
            continue;
        }
        let f: Vec<String> = 行.split(',').map(剥反引号).collect();
        /* 【末尾那两行是汇总，不是流水】。判据是【列数不够】，
           不是「以某几个字开头」—— 汇总行的第一行确实是
           「总交易单数,应结订单总金额」，而第二行是两个数字，
           按字判会把它当成一笔流水，而那一笔的金额是当天的总额。 */
        if f.len() < 列.len() { continue }
        // 账单里的金额是元，我们的账一律用分
        let Ok(元) = f[i金额].parse::<f64>() else { continue };
        let paid_at = chrono::NaiveDateTime::parse_from_str(&f[i时间], "%Y-%m-%d %H:%M:%S")
            .ok()
            .map(|t| DateTime::<Utc>::from_naive_utc_and_offset(t - chrono::Duration::hours(8), Utc));
        出.push(ChannelTxnRow {
            channel_txn_id: f[i流水].clone(),
            amount_minor: (元 * 100.0).round() as i64,
            currency: "CNY".into(),
            status: f[i状态].clone(),
            paid_at,
        });
    }
    出
}

fn 剥反引号(s: &str) -> String {
    s.trim().trim_start_matches('`').trim().to_string()
}

/// 微信说的一笔支付 → 我们这边的事件。查单与回调共用一份翻译 ——
/// 两处各写一份的话，「查出来的」跟「推过来的」会对同一笔钱说两件事。
fn 译一笔支付(v: &serde_json::Value) -> WebhookEvent {
    let our_ref = v.get("out_trade_no").and_then(|x| x.as_str()).unwrap_or("UNKNOWN").to_string();
    let channel_txn_id = v.get("transaction_id").and_then(|x| x.as_str()).map(str::to_string);
    let amt = v.get("amount").and_then(|a| a.get("total")).and_then(|x| x.as_i64()).unwrap_or(0);
    let st = v.get("trade_state").and_then(|x| x.as_str()).unwrap_or("");
    let paid_at = v.get("success_time").and_then(|x| x.as_str())
        .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
        .map(|t| t.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);
    match st {
        "SUCCESS" => WebhookEvent::PaymentSucceeded { our_ref, channel_txn_id, paid_at, raw_amount_minor: amt },
        "CLOSED" | "REVOKED" | "PAYERROR" => WebhookEvent::PaymentFailed {
            our_ref,
            code: st.to_string(),
            msg: v.get("trade_state_desc").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        },
        // NOTPAY / USERPAYING —— 还在等，什么都别改
        其他 => WebhookEvent::Unknown { kind: format!("TRADE.{其他}"), raw: v.clone() },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 微信交易账单长这样：每个字段前一个反引号（防 Excel 把长数字变成
    /// 科学计数法），末尾两行是汇总。**这一份是照真格式写的** ——
    /// 解析这一段原先根本不存在（`pull_settlement` 回的是空 Vec），
    /// 于是对账那一侧「渠道说有这几笔」永远是空的:
    /// missing_in_channel 恒为 0，这道资金护栏一次都没真比过。
    #[test]
    fn 交易账单解得出那几列() {
        let csv = "\
交易时间,公众账号ID,商户号,微信订单号,商户订单号,交易状态,应结订单金额\n\
`2026-09-07 10:20:30,`wxapp,`1900000000,`4200001234,`pay-abc,`SUCCESS,`199.00\n\
`2026-09-07 11:00:00,`wxapp,`1900000000,`4200005678,`pay-def,`SUCCESS,`88.50\n\
总交易单数,应结订单总金额\n\
`2,`287.50\n";
        let 出 = 解交易账单(csv);
        assert_eq!(出.len(), 2, "汇总那两行被当成流水了，或者流水被吃掉了");
        assert_eq!(出[0].channel_txn_id, "4200001234", "反引号没剥干净 —— 流水号一条也对不上");
        assert_eq!(出[0].amount_minor, 19900, "账单是元，我们的账是分");
        assert_eq!(出[1].amount_minor, 8850, "带小数的那笔算错了");
        assert_eq!(出[0].status, "SUCCESS");
        assert!(出[0].paid_at.is_some(), "时间没解出来");
    }

    /// 列名按表头找，不按位置数 —— 微信加过列，按位置数的解析会悄悄错位。
    #[test]
    fn 账单多一列也不会错位() {
        let csv = "\
交易时间,公众账号ID,新加的一列,商户号,微信订单号,商户订单号,交易状态,应结订单金额\n\
`2026-09-07 10:20:30,`wxapp,`x,`1900000000,`4200001234,`pay-abc,`SUCCESS,`199.00\n";
        let 出 = 解交易账单(csv);
        assert_eq!(出.len(), 1);
        assert_eq!(出[0].channel_txn_id, "4200001234", "多一列就错位了 —— 那是按位置数的下场");
        assert_eq!(出[0].amount_minor, 19900);
    }

    /// 表头认不出来就【什么都不给】，不给半份。
    #[test]
    fn 表头对不上就不硬解() {
        assert!(解交易账单("完全不认识的东西\n`1,`2\n").is_empty());
        assert!(解交易账单("").is_empty());
    }
}
