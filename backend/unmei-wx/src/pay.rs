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
    /// 一次签过名的 v3 请求。**所有微信支付调用都从这儿出去**。
    ///
    /// 【为什么只有一处】。签名这件事有四个容易错的地方（待签串少一个
    /// 换行、URL 里要不要带 query、body 要用发出去的那一份而不是重新
    /// 序列化的、以及 GET 的 body 是空串）—— 抄一遍就多一处会错。
    /// 从前只有预下单一条路是签过的，其余五个端点是 stub，
    /// 也就是说这四个坑还没人踩过。
    ///
    /// `path` 必须带上 query（微信的待签串就是这么定的），
    /// 返回体原样交回去，由调用方决定怎么解 —— 有的端点回 JSON，
    /// 对账单那条回的是一个下载地址。
    async fn pay_v3(
        &self,
        method: &str,
        path: &str,
        body: Option<String>,
    ) -> Result<String> {
        let body_str = body.clone().unwrap_or_default();
        let nonce = crate::util::nonce(32);
        let timestamp = chrono::Utc::now().timestamp();
        let signature = crate::crypto::sign_rsa_sha256(
            &self.cfg.pay.merchant_private_key_pem,
            &crate::crypto::sign_message(method, path, timestamp, &nonce, &body_str),
        )?;
        let token = format!(
            "mchid=\"{}\",nonce_str=\"{}\",timestamp=\"{}\",serial_no=\"{}\",signature=\"{}\"",
            self.cfg.pay.mchid, nonce, timestamp, self.cfg.pay.serial_no, signature,
        );
        let url = format!("{}{}", self.cfg.pay_api_base, path);
        let mut rb = match method {
            "GET" => self.http.get(&url),
            "POST" => self.http.post(&url),
            其他 => return Err(WxError::Internal(format!("没准备好的方法：{其他}"))),
        };
        rb = rb
            .header("Authorization", format!("WECHATPAY2-SHA256-RSA2048 {token}"))
            .header("Accept", "application/json")
            .header("User-Agent", "unmei/1.0");
        if let Some(b) = body {
            rb = rb.header("Content-Type", "application/json").body(b);
        }
        let resp = rb.send().await?;
        let 状态 = resp.status();
        let 文 = resp.text().await?;
        if !状态.is_success() {
            /* 【把微信的原话带上，但只带到这一层】。它的 `code`/`message`
               对排查是决定性的（ORDER_CLOSED 跟 SIGN_ERROR 是两件完全
               不同的事），而它绝不能上屏 —— `check-error-leak` 盯着
               「外部报错原文不进响应体」那一条。 */
            return Err(WxError::Internal(format!("微信支付 {path} 回 {状态}：{文}")));
        }
        Ok(文)
    }

    /// 预下单 · 按子模式走不同的 path，返回微信回的那一份 JSON。
    ///
    /// 三种子模式回的字段不同（jsapi → prepay_id，h5 → h5_url，
    /// native → code_url），所以这里不替调用方挑，原样交回去。
    pub async fn pay_prepay(&self, kind: &str, body: &serde_json::Value) -> Result<serde_json::Value> {
        let path = match kind {
            "jsapi" => "/v3/pay/transactions/jsapi",
            "h5" => "/v3/pay/transactions/h5",
            "native" => "/v3/pay/transactions/native",
            其他 => return Err(WxError::Internal(format!("没有这种下单方式：{其他}"))),
        };
        let 文 = self.pay_v3("POST", path, Some(body.to_string())).await?;
        serde_json::from_str(&文).map_err(|e| WxError::Internal(format!("预下单回的不是 JSON：{e}")))
    }

    /// JSAPI 预下单 · 返回 prepay_id
    pub async fn pay_jsapi_prepay(&self, req: &JsapiPrepayReq<'_>) -> Result<JsapiPrepayResp> {
        let body = serde_json::to_value(req).map_err(|e| WxError::Internal(e.to_string()))?;
        let v = self.pay_prepay("jsapi", &body).await?;
        let prepay_id = v.get("prepay_id").and_then(|x| x.as_str())
            .ok_or_else(|| WxError::Internal(format!("预下单没回 prepay_id：{v}")))?;
        Ok(JsapiPrepayResp { prepay_id: prepay_id.to_string() })
    }

    /// 按我方单号查一笔支付。
    pub async fn pay_query(&self, out_trade_no: &str) -> Result<serde_json::Value> {
        let path = format!(
            "/v3/pay/transactions/out-trade-no/{out_trade_no}?mchid={}",
            self.cfg.pay.mchid
        );
        let 文 = self.pay_v3("GET", &path, None).await?;
        serde_json::from_str(&文).map_err(|e| WxError::Internal(format!("查单回的不是 JSON：{e}")))
    }

    /// 关掉一笔还没付的单。**关单没有回执**（微信回 204 空体）。
    pub async fn pay_close(&self, out_trade_no: &str) -> Result<()> {
        let path = format!("/v3/pay/transactions/out-trade-no/{out_trade_no}/close");
        let body = serde_json::json!({ "mchid": self.cfg.pay.mchid }).to_string();
        self.pay_v3("POST", &path, Some(body)).await?;
        Ok(())
    }

    /// 申请退款。
    pub async fn pay_refund(&self, body: &serde_json::Value) -> Result<serde_json::Value> {
        let 文 = self.pay_v3("POST", "/v3/refund/domestic/refunds", Some(body.to_string())).await?;
        serde_json::from_str(&文).map_err(|e| WxError::Internal(format!("退款回的不是 JSON：{e}")))
    }

    /// 按我方退款单号查一笔退款。
    pub async fn pay_refund_query(&self, out_refund_no: &str) -> Result<serde_json::Value> {
        let path = format!("/v3/refund/domestic/refunds/{out_refund_no}");
        let 文 = self.pay_v3("GET", &path, None).await?;
        serde_json::from_str(&文).map_err(|e| WxError::Internal(format!("查退款回的不是 JSON：{e}")))
    }

    /// 拉某一天的交易账单。两跳：先申请拿下载地址，再去下那份 csv。
    ///
    /// 第二跳**也要签名**（微信的下载域名同属 v3），而且回的是文本不是 JSON。
    pub async fn pay_trade_bill(&self, day: &str) -> Result<String> {
        let path = format!("/v3/bill/tradebill?bill_date={day}&bill_type=SUCCESS");
        let 文 = self.pay_v3("GET", &path, None).await?;
        let v: serde_json::Value = serde_json::from_str(&文)
            .map_err(|e| WxError::Internal(format!("申请账单回的不是 JSON：{e}")))?;
        let url = v.get("download_url").and_then(|x| x.as_str())
            .ok_or_else(|| WxError::Internal(format!("申请账单没回 download_url：{v}")))?;
        // 下载地址是完整 URL，取出 path + query 来签
        let 后半 = url.split_once("://")
            .and_then(|(_, rest)| rest.split_once('/'))
            .map(|(_, p)| format!("/{p}"))
            .ok_or_else(|| WxError::Internal(format!("下载地址看不懂：{url}")))?;
        self.pay_v3("GET", &后半, None).await
    }

    /// 按序列号拿平台公钥，**带缓存**。
    ///
    /// 【为什么必须缓存】。每一次回调都去拉一次证书，等于把回调这条路
    /// 挂在另一条网络调用上 —— 微信那边的重试会因此雪上加霜。
    /// 缓存十二小时:证书有效期是年级别的，而轮换时序列号会变，
    /// 拿不到的时候我们会重拉一次（下面那一句），所以旧的失效不会卡住。
    pub async fn pay_pubkey_for(&self, serial: &str) -> Result<String> {
        let key = format!("unmei:wx:cert:{serial}");
        if let Ok(Some(v)) = self.cache.get(key.as_bytes()) {
            if let Ok(pem) = String::from_utf8(v) {
                if !pem.is_empty() {
                    return Ok(pem);
                }
            }
        }
        // 拿不到就重拉一遍全部 —— 轮换那一刻新序列号第一次出现，就走这儿
        let 证书们 = self.pay_platform_certs().await?;
        let mut 命中 = None;
        for (sn, pem) in 证书们 {
            let _ = self.cache.set_with_ttl(
                format!("unmei:wx:cert:{sn}").as_bytes(), pem.as_bytes(),
                std::time::Duration::from_secs(12 * 3600));
            if sn == serial {
                命中 = Some(pem);
            }
        }
        命中.ok_or_else(|| WxError::Internal(format!(
            "微信说这条回调是用证书 {serial} 签的，而它给的那几张里没有这一张"
        )))
    }

    /// 微信平台证书 —— 验回调签名要用它里面那把公钥。
    ///
    /// 回来的证书是**加密的**（用 APIv3 密钥），这是微信有意的设计：
    /// 拿不到密钥的人即使截下这一跳，也拿不到证书。
    pub async fn pay_platform_certs(&self) -> Result<Vec<(String, String)>> {
        let 文 = self.pay_v3("GET", "/v3/certificates", None).await?;
        let v: serde_json::Value = serde_json::from_str(&文)
            .map_err(|e| WxError::Internal(format!("证书回的不是 JSON：{e}")))?;
        let mut 出 = Vec::new();
        for c in v.get("data").and_then(|x| x.as_array()).cloned().unwrap_or_default() {
            let serial = c.get("serial_no").and_then(|x| x.as_str()).unwrap_or_default().to_string();
            let enc = c.get("encrypt_certificate").cloned().unwrap_or(serde_json::Value::Null);
            let 明文 = crate::crypto::decrypt_aes_256_gcm(
                &self.cfg.pay.api_v3_key,
                enc.get("nonce").and_then(|x| x.as_str()).unwrap_or(""),
                enc.get("associated_data").and_then(|x| x.as_str()).unwrap_or(""),
                enc.get("ciphertext").and_then(|x| x.as_str()).unwrap_or(""),
            )?;
            let pem = String::from_utf8(明文)
                .map_err(|e| WxError::Internal(format!("证书解开了但不是文本：{e}")))?;
            出.push((serial, crate::crypto::pubkey_from_cert_pem(&pem)?));
        }
        if 出.is_empty() {
            return Err(WxError::Internal("微信一张平台证书都没给 —— 回调没法验签".into()));
        }
        Ok(出)
    }

    /// 回调解密 · AEAD_AES_256_GCM(key = api_v3_key)
    ///
    /// 解不开就报错。**不返回一个空对象** —— 上游拿到空对象会当成
    /// 「这次回调没有业务内容」，于是一次解密失败变成一次静默丢弃，
    /// 而丢掉的那条可能正是「用户付款成功」。
    pub fn pay_notify_decrypt(&self, env: &NotifyEnvelope) -> Result<serde_json::Value> {
        /* 【这里原先有一句 `if is_mock_pay() { return {"trade_state":"SUCCESS"} }`】。
           也就是说:没配商户号的时候，**任何人往回调地址上发一个空 JSON，
           这个系统都会当成「付款成功」**。而没配商户号正是这台机器的常态。
           假服务端接上之后这条捷径没有存在的理由了 —— 它照协议加密，
           我们照协议解。 */
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

    /// 商户凭据齐不齐。**不齐就报错，不再悄悄走一条假路** ——
    /// 「没配」与「配好了」必须在行为上分得开，否则忘了配的那天，
    /// 屏上一切正常而一分钱都收不到。
    pub fn pay_ready(&self) -> Result<()> {
        let 缺: Vec<&str> = [
            ("WX_PAY_MCHID", self.cfg.pay.mchid.is_empty()),
            ("WX_PAY_KEY_PATH", self.cfg.pay.merchant_private_key_pem.is_empty()),
            ("WX_PAY_SERIAL_NO", self.cfg.pay.serial_no.is_empty()),
            ("WX_PAY_API_V3_KEY", self.cfg.pay.api_v3_key.is_empty()),
        ].iter().filter(|(_, 空)| *空).map(|(k, _)| *k).collect();
        if 缺.is_empty() {
            Ok(())
        } else {
            Err(WxError::Internal(format!("微信支付凭据没配齐，缺：{}", 缺.join("、"))))
        }
    }
}
