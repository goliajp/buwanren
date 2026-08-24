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
    /// 允不允许 `query_payment` 那个桩直接把支付结成已付。见它自己的注释。
    pub stub_autosettle: bool,
}

impl WechatAdapter {
    /// `stub_autosettle` 由调用方决定（`unmei-api` 读一次环境变量）——
    /// 这个 crate 不读环境，它是库。
    pub fn new(sdk: Arc<WxSdk>, mode: Mode, stub_autosettle: bool) -> Self {
        Self { sdk, mode, stub_autosettle }
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
                // 客户端发起支付时所需的 paySign 五元组(实际计算见 Beta1):
                let nonce = crate::util::nonce(16);
                let ts = Utc::now().timestamp().to_string();
                let pkg = format!("prepay_id={prepay_id}");
                let pay_sign_stub = "TODO_paySign_beta".to_string();
                let params = serde_json::json!({
                    "appId":     self.sdk.cfg.mp.appid,
                    "timeStamp": ts,
                    "nonceStr":  nonce,
                    "package":   pkg,
                    "signType":  "RSA",
                    "paySign":   pay_sign_stub,
                });
                Ok(CreatePaymentResp::Jsapi { params })
            }
            Mode::H5 => {
                // H5:预下单返回 mweb_url(浏览器跳),签名 + URL 拼接见 Beta1。
                Ok(CreatePaymentResp::Redirect {
                    url: format!("https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=MOCK_{}", req.payment_id),
                })
            }
            Mode::Native => {
                Ok(CreatePaymentResp::NativeQr {
                    code_url: format!("weixin://wxpay/bizpayurl?pr=MOCK_{}", req.payment_id),
                })
            }
        }
    }

    async fn query_payment(&self, payment_id: &str) -> Result<WebhookEvent, AdapterError> {
        /* 真接入:GET /v3/pay/transactions/out-trade-no/{payment_id}?mchid=xxx

           这里还是桩（模块头写着「退款 / 查询 / 拉账单:留 stub」）。要紧的不是
           「有桩」，是**这个桩说的是「已支付」** —— `payment_query_sweeper`
           每 30 秒问它一次，于是任何一笔待付支付都会在 90 秒内被结成已付，
           一分钱没收，履约照跑。配没配真凭据都一样，因为只有这一个适配器。

           所以要它自动结算，得明说：`UNMEI_PAY_STUB_AUTOSETTLE=1`。
           `scripts/e2e.sh` 那条全链路正是靠它跑通的，起后端时带上即可。
           不带的话这里如实报「没接通」，支付就停在 pending 等真回调 —— 没有
           真回调就永远不结算，那是「什么都没发生」，比「凭空结算」安全。 */
        if !self.stub_autosettle {
            return Err(AdapterError::Config(format!(
                "wechat query_payment 还是桩，没接真实接口；\
                 要让它把 {payment_id} 直接结成已付，设 UNMEI_PAY_STUB_AUTOSETTLE=1"
            )));
        }
        // mock:查的就是我方单号,渠道流水号无从得知 —— 如实填 None,
        // 不拿 payment_id 冒充它(那正是从前那个 bug 藏身的地方)。
        Ok(WebhookEvent::PaymentSucceeded {
            our_ref: payment_id.to_string(),
            channel_txn_id: None,
            paid_at: Utc::now(),
            raw_amount_minor: 0,
        })
    }

    async fn cancel_payment(&self, payment_id: &str) -> Result<(), AdapterError> {
        // 真接入:POST /v3/pay/transactions/out-trade-no/{payment_id}/close
        tracing::info!("wechat cancel_payment stub: {payment_id}");
        Ok(())
    }

    async fn refund(&self, req: RefundParam) -> Result<RefundResp, AdapterError> {
        // 真接入:POST /v3/refund/domestic/refunds
        tracing::info!("wechat refund stub: refund_id={} pay={} amount={}", req.refund_id, req.payment_id, req.amount_minor);
        Ok(RefundResp { channel_refund_id: format!("WX_REFUND_MOCK_{}", req.refund_id), status_hint: "pending".into() })
    }

    async fn query_refund(&self, refund_id: &str) -> Result<WebhookEvent, AdapterError> {
        Ok(WebhookEvent::RefundSucceeded {
            refund_id: refund_id.to_string(),
            amount_minor: 0,
        })
    }

    async fn verify_webhook(&self, _headers: &WebhookHeaders, body: &[u8]) -> Result<WebhookEvent, AdapterError> {
        // 真接入:
        //  1. 验 v3 头(Wechatpay-Serial / Wechatpay-Signature / Wechatpay-Timestamp / Wechatpay-Nonce)
        //  2. RSA-PSS / RSA-PKCS1v15 + SHA256 验签(平台证书)
        //  3. AES-256-GCM 解密 resource.ciphertext(key = api_v3_key)
        let env: NotifyEnvelope = serde_json::from_slice(body)
            .map_err(|e| AdapterError::Signature(format!("envelope parse: {e}")))?;
        let inner = self.sdk.pay_notify_decrypt(&env)
            .map_err(|e| AdapterError::Signature(e.to_string()))?;

        // 两个号各归各位。从前这里是「先取 transaction_id,取不到才退 out_trade_no」,
        // 于是成功回调里填的永远是渠道流水号 —— 而下游拿它当我方单号去定位,
        // 一条也匹配不上。定位要用 out_trade_no,对账才用 transaction_id。
        let our_ref = inner.get("out_trade_no").and_then(|v| v.as_str())
            .unwrap_or("UNKNOWN").to_string();
        let channel_txn_id = inner.get("transaction_id").and_then(|v| v.as_str()).map(str::to_string);
        let trade_state = inner.get("trade_state").and_then(|v| v.as_str()).unwrap_or("");
        let amt = inner.get("amount").and_then(|a| a.get("total")).and_then(|v| v.as_i64()).unwrap_or(0);
        let paid_at_str = inner.get("success_time").and_then(|v| v.as_str()).unwrap_or("");
        let paid_at = DateTime::parse_from_rfc3339(paid_at_str).map(|t| t.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now());

        Ok(match (env.event_type.as_str(), trade_state) {
            ("TRANSACTION.SUCCESS", _) | (_, "SUCCESS") =>
                WebhookEvent::PaymentSucceeded { our_ref, channel_txn_id, paid_at, raw_amount_minor: amt },
            ("REFUND.SUCCESS", _) => WebhookEvent::RefundSucceeded {
                refund_id: inner.get("refund_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                amount_minor: amt,
            },
            ("REFUND.ABNORMAL", _) | ("REFUND.CLOSED", _) => WebhookEvent::RefundFailed {
                refund_id: inner.get("refund_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                code: trade_state.to_string(),
                msg: env.summary.clone(),
            },
            (k, _) => WebhookEvent::Unknown { kind: k.to_string(), raw: inner },
        })
    }

    async fn pull_settlement(&self, day: chrono::NaiveDate, _currency: &str) -> Result<Vec<ChannelTxnRow>, AdapterError> {
        // 真接入:申请账单 → 下载 csv → 解析
        // POST /v3/bill/tradebill?bill_date=YYYY-MM-DD
        tracing::info!("wechat pull_settlement stub: {day}");
        Ok(Vec::new())
    }
}
