//! 微信支付 v3 · JSAPI / Native / H5 / 小程序
//!
//! v3 用 SHA256 + RSA 签名 + AES-GCM 回调解密。
//! 文档:<https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml>
//!
//! 当前实现:
//! - **预下单**:请求体 + URL + 【签名】齐了(`crypto::sign_rsa_sha256`)
//! - **回调解密**:AEAD_AES_256_GCM 齐了(`crypto::decrypt_aes_256_gcm`)
//!
//! 这两件事是纯字节进、纯字节出，对错有唯一答案，所以放在
//! `crypto.rs` 里自己单测到底(自签自验、自加自解),
//! 不需要真凭据、不联网、也不需要真机。
//!
//! **仍然只有真机 + 真商户号才验得到的**:预下单那一跳能不能被微信接受
//! （签名对了不代表商户号、证书序列号、notify_url 都配对了)、
//! 以及回调是不是真的会打到我们这个地址。

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

        /* ─── 2. 签名 ────────────────────────────────────
           上一版这里是 `let signature = "TODO".to_string();` ——
           配了真凭据之后（`is_mock_pay()` 为 false 才走到这儿），
           它会把字面量 TODO 拼进 Authorization 头发给微信。
           微信当然会拒，但这条路径【看起来是实现过的】:
           有请求体、有 URL、有 header，只有那一个值是假的。 */
        let nonce = crate::util::nonce(32);
        let timestamp = chrono::Utc::now().timestamp();
        let signature = crate::crypto::sign_rsa_sha256(
            &self.cfg.pay.merchant_private_key_pem,
            &crate::crypto::sign_message(
                "POST", "/v3/pay/transactions/jsapi", timestamp, &nonce, &body,
            ),
        )?;
        let token = format!(
            "mchid=\"{}\",nonce_str=\"{}\",timestamp=\"{}\",serial_no=\"{}\",signature=\"{}\"",
            self.cfg.pay.mchid,
            nonce,
            timestamp,
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
    /// 解不开就报错。**不返回一个空对象** —— 上游拿到空对象会当成
    /// 「这次回调没有业务内容」，于是一次解密失败变成一次静默丢弃，
    /// 而丢掉的那条可能正是「用户付款成功」。
    pub fn pay_notify_decrypt(&self, env: &NotifyEnvelope) -> Result<serde_json::Value> {
        if self.is_mock_pay() {
            return Ok(serde_json::json!({"mock": true, "trade_state": "SUCCESS"}));
        }
        // 算法字段是微信声明的。它写了别的，说明协议变了 ——
        // 那时候按 GCM 去解会失败，但失败的原因值得当场说清楚。
        if env.resource.algorithm != "AEAD_AES_256_GCM" {
            return Err(WxError::Internal(format!(
                "回调用的是 {}，这里只会解 AEAD_AES_256_GCM",
                env.resource.algorithm
            )));
        }
        let 明文 = crate::crypto::decrypt_aes_256_gcm(
            &self.cfg.pay.api_v3_key,
            &env.resource.nonce,
            env.resource.associated_data.as_deref().unwrap_or(""),
            &env.resource.ciphertext,
        )?;
        serde_json::from_slice(&明文).map_err(|e| {
            // 解开了但不是 JSON —— 那不是密钥问题，是协议对不上，
            // 两种说法混在一起会把排查引到错误的方向
            WxError::Internal(format!("回调解开了，但内容不是 JSON：{e}"))
        })
    }

    fn is_mock_pay(&self) -> bool {
        self.cfg.pay.mchid.is_empty() || self.cfg.pay.merchant_private_key_pem.is_empty()
    }
}
