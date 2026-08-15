//! 微信支付 v3 · JSAPI / Native / H5 / 小程序
//!
//! v3 用 SHA256 + RSA 签名 + AES-GCM 回调解密。
//! 文档:<https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml>
//!
//! 当前实现:
//! - **预下单**:已搭好请求体 + URL,签名留 TODO
//! - **回调验签 / 解密**:框架就绪,AES-GCM 解密留 TODO
//!
//! 上线前 Beta 必做(估约 200 行 +5 个 unit test)。

use crate::{Result, WxError, WxSdk};
use serde::{Deserialize, Serialize};

/// JSAPI 预下单请求(简化版,真接入再扩字段)
#[derive(Debug, Serialize)]
pub struct JsapiPrepayReq<'a> {
    pub appid: &'a str,
    pub mchid: &'a str,
    pub description: &'a str,
    pub out_trade_no: &'a str,
    pub notify_url: &'a str,
    pub amount: PrepayAmount,
    pub payer: PrepayPayer<'a>,
}

#[derive(Debug, Serialize)]
pub struct PrepayAmount {
    pub total: i64,            // 单位:分
    pub currency: String,      // CNY
}

#[derive(Debug, Serialize)]
pub struct PrepayPayer<'a> {
    pub openid: &'a str,
}

#[derive(Debug, Deserialize)]
pub struct JsapiPrepayResp {
    pub prepay_id: String,
}

/// 微信回调原始 envelope · 解密后是真业务字段
#[derive(Debug, Deserialize)]
pub struct NotifyEnvelope {
    pub id: String,
    pub create_time: String,
    pub resource_type: String,
    pub event_type: String,
    pub summary: String,
    pub resource: NotifyResource,
}

#[derive(Debug, Deserialize)]
pub struct NotifyResource {
    pub algorithm: String,            // AEAD_AES_256_GCM
    pub ciphertext: String,           // base64
    pub associated_data: Option<String>,
    pub nonce: String,
    pub original_type: String,
}

impl WxSdk {
    /// JSAPI 预下单 · 返回 prepay_id
    ///
    /// TODO Beta1: 签名 (Authorization: WECHATPAY2-SHA256-RSA2048 ...)
    pub async fn pay_jsapi_prepay(&self, req: &JsapiPrepayReq<'_>) -> Result<JsapiPrepayResp> {
        if self.is_mock_pay() {
            return Ok(JsapiPrepayResp {
                prepay_id: format!("mock_prepay_{}", req.out_trade_no),
            });
        }
        // ─── 1. 序列化 body ─────────────────────────────────
        let body = serde_json::to_string(req).map_err(|e| WxError::Internal(e.to_string()))?;

        // ─── 2. 签名(TODO Beta1)─────────────────────────
        // let signature = self.sign_v3("POST", "/v3/pay/transactions/jsapi", &body)?;
        let signature = "TODO".to_string();
        let token = format!(
            "mchid=\"{}\",nonce_str=\"{}\",timestamp=\"{}\",serial_no=\"{}\",signature=\"{}\"",
            self.cfg.pay.mchid,
            crate::util::nonce(32),
            chrono::Utc::now().timestamp(),
            self.cfg.pay.serial_no,
            signature,
        );

        // ─── 3. 发请求 ──────────────────────────────────────
        let resp: JsapiPrepayResp = self
            .http
            .post("https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi")
            .header("Authorization", format!("WECHATPAY2-SHA256-RSA2048 {token}"))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .await?
            .json()
            .await?;
        Ok(resp)
    }

    /// 回调解密 · AEAD_AES_256_GCM(key = api_v3_key)
    ///
    /// TODO Beta1: 用 aes-gcm crate decrypt
    pub fn pay_notify_decrypt(&self, _env: &NotifyEnvelope) -> Result<serde_json::Value> {
        if self.is_mock_pay() {
            return Ok(serde_json::json!({"mock": true, "trade_state": "SUCCESS"}));
        }
        Err(WxError::Internal("pay_notify_decrypt: TODO Beta1".into()))
    }

    fn is_mock_pay(&self) -> bool {
        self.cfg.pay.mchid.is_empty() || self.cfg.pay.merchant_private_key_pem.is_empty()
    }
}
