//! Kuaidi100 适配器 · 国内 200+ 快递聚合查询(快递100 实时查询接口)。
//!
//! 文档:<https://api.kuaidi100.com/document/5f0e1885bc8da837cbd8aa5e.html>
//!
//! 接口路径:
//! - 实时查询 POST `https://poll.kuaidi100.com/poll/query.do`
//! - 推送订阅(可选)POST `/poll`
//! - webhook(callback)我方 endpoint 接收,验签:`sign = md5(param + key)`
//!
//! 配置(env):
//! - `KUAIDI100_CUSTOMER` 8 字节客户编号
//! - `KUAIDI100_KEY`      授权 key
//!
//! 注意:
//! - kuaidi100 的 carrier_code 用它自家的 `com` 字段(顺丰=`shunfeng` / 京东=`jd` / 中通=`zhongtong`)。
//!   本 crate 接收我方标准化 carrier_code(`sf` / `jd` / `zto` / …),内部 map 到 kuaidi100。
//! - 离线测试 / dev 环境:env 没配则进入 **mock 模式**,query_trace 返回少量假数据,不调外部。

use async_trait::async_trait;
use chrono::{DateTime, NaiveDateTime, Utc};
use http::HeaderMap;
use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};
use std::env;
use unmei_domain::commerce::adapters::{
    AdapterError, CarrierAdapter, CarrierCapabilities, TraceEvent, TraceWebhookEvent,
};

const POLL_QUERY_URL: &str = "https://poll.kuaidi100.com/poll/query.do";

/// 我方 carrier_code → 快递100 `com` 字段
fn map_carrier(code: &str) -> Option<&'static str> {
    match code {
        "sf"     => Some("shunfeng"),
        "ems"    => Some("ems"),
        "jd"     => Some("jd"),
        "zto"    => Some("zhongtong"),
        "yto"    => Some("yuantong"),
        "yunda"  => Some("yunda"),
        "sto"    => Some("shentong"),
        "youzheng" => Some("youzhengguonei"),
        _ => None,
    }
}

#[derive(Debug, Clone)]
pub struct Kuaidi100Adapter {
    customer: Option<String>,
    key: Option<String>,
    http: reqwest::Client,
}

impl Default for Kuaidi100Adapter {
    fn default() -> Self { Self::from_env() }
}

impl Kuaidi100Adapter {
    pub const PROVIDER: &'static str = "kuaidi100";

    /// 从 env 读 `KUAIDI100_CUSTOMER` + `KUAIDI100_KEY`;
    /// 任一缺失就进入 **mock 模式**(本地 / CI 无密钥可用)。
    pub fn from_env() -> Self {
        Self {
            customer: env::var("KUAIDI100_CUSTOMER").ok(),
            key: env::var("KUAIDI100_KEY").ok(),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(8))
                .user_agent("unmei-carrier/0.2")
                .build()
                .expect("reqwest client"),
        }
    }

    pub fn with_credentials(customer: impl Into<String>, key: impl Into<String>) -> Self {
        Self {
            customer: Some(customer.into()),
            key: Some(key.into()),
            ..Self::from_env()
        }
    }

    fn is_mock(&self) -> bool { self.customer.is_none() || self.key.is_none() }

    /// 计算实时查询的 sign:`md5(param + key + customer)`,大写
    fn sign(&self, param: &str) -> String {
        let key = self.key.as_deref().unwrap_or("");
        let cus = self.customer.as_deref().unwrap_or("");
        let mut h = Md5::new();
        h.update(param.as_bytes());
        h.update(key.as_bytes());
        h.update(cus.as_bytes());
        format!("{:X}", h.finalize())
    }

    async fn live_query(&self, com: &str, no: &str) -> Result<Vec<TraceEvent>, AdapterError> {
        let param = ParamPayload { com, num: no, phone: "", from: "", to: "", resultv2: "0", show: "0", order: "desc" };
        let param_str = serde_json::to_string(&param).map_err(|e| AdapterError::Internal(e.to_string()))?;
        let sign = self.sign(&param_str);

        let form = [
            ("customer", self.customer.as_deref().unwrap_or("")),
            ("sign", &sign),
            ("param", &param_str),
        ];
        let resp = self.http.post(POLL_QUERY_URL).form(&form).send().await
            .map_err(|e| AdapterError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(AdapterError::Network(format!("HTTP {}", resp.status())));
        }
        let body: QueryResp = resp.json().await.map_err(|e| AdapterError::Internal(e.to_string()))?;

        // 失败结构:{"result":false,"message":"..."} 或 {"returnCode":"500","message":"..."}
        if body.result == Some(false) {
            return Err(AdapterError::ChannelRejected {
                code: body.return_code.clone().unwrap_or_else(|| "k100_fail".into()),
                msg: body.message.clone().unwrap_or_default(),
            });
        }
        Ok(body.data.into_iter().enumerate().map(|(i, d)| {
            let event_at = NaiveDateTime::parse_from_str(&d.time, "%Y-%m-%d %H:%M:%S")
                .or_else(|_| NaiveDateTime::parse_from_str(&d.ftime, "%Y-%m-%d %H:%M:%S"))
                .map(|t| t.and_utc())
                .unwrap_or_else(|_| Utc::now());
            TraceEvent {
                event_at,
                kind: translate_status(d.status.as_deref()),
                location: d.location.clone(),
                description: d.context,
                raw_event_id: Some(format!("k100-{}-{}", no, i + 1)),
            }
        }).collect())
    }

    fn mock_trace(&self, no: &str) -> Vec<TraceEvent> {
        let now = Utc::now();
        vec![
            TraceEvent {
                event_at: now - chrono::Duration::hours(15),
                kind: "picked_up".into(), location: Some("揽件网点".into()),
                description: "已揽件(mock)".into(),
                raw_event_id: Some(format!("k100-{no}-mock-1")),
            },
            TraceEvent {
                event_at: now - chrono::Duration::hours(12),
                kind: "departed".into(), location: Some("发件集散中心".into()),
                description: "已发出(mock)".into(),
                raw_event_id: Some(format!("k100-{no}-mock-2")),
            },
            TraceEvent {
                event_at: now - chrono::Duration::hours(2),
                kind: "in_transit".into(), location: Some("收件分拨中心".into()),
                description: "运输中(mock)".into(),
                raw_event_id: Some(format!("k100-{no}-mock-3")),
            },
        ]
    }
}

#[async_trait]
impl CarrierAdapter for Kuaidi100Adapter {
    fn provider(&self) -> &'static str { Self::PROVIDER }
    fn supported_carriers(&self) -> &'static [&'static str] {
        &["sf","ems","jd","zto","yto","yunda","sto","youzheng"]
    }
    fn capabilities(&self) -> CarrierCapabilities {
        CarrierCapabilities { supports_webhook: true, supports_label_purchase: false }
    }

    async fn query_trace(
        &self,
        carrier_code: &str,
        tracking_no: &str,
    ) -> Result<Vec<TraceEvent>, AdapterError> {
        let com = map_carrier(carrier_code)
            .ok_or_else(|| AdapterError::Config(format!("unsupported carrier: {carrier_code}")))?;

        if self.is_mock() {
            tracing::debug!("kuaidi100 mock mode for {carrier_code} {tracking_no}");
            return Ok(self.mock_trace(tracking_no));
        }
        self.live_query(com, tracking_no).await
    }

    async fn verify_webhook(
        &self,
        _headers: &HeaderMap,
        body: &[u8],
    ) -> Result<TraceWebhookEvent, AdapterError> {
        let payload: CallbackBody = serde_json::from_slice(body)
            .map_err(|e| AdapterError::Signature(format!("body parse: {e}")))?;

        // 验签:sign = MD5(param + salt)
        // kuaidi100 推送的签名规则与查询接口不同,这里给出通用 fail-fast。
        // 文档参考:https://api.kuaidi100.com/document/5fde5a335a7e5d4d6ff84c11.html
        if !self.is_mock() {
            let salt = self.key.clone().unwrap_or_default();
            let expected = {
                let mut h = Md5::new();
                h.update(payload.param.as_bytes());
                h.update(salt.as_bytes());
                format!("{:X}", h.finalize())
            };
            if payload.sign.eq_ignore_ascii_case(&expected) {
                tracing::trace!("kuaidi100 webhook signature OK");
            } else {
                return Err(AdapterError::Signature("kuaidi100 sign mismatch".into()));
            }
        }

        let inner: CallbackInner = serde_json::from_str(&payload.param)
            .map_err(|e| AdapterError::Signature(format!("param parse: {e}")))?;
        let no = inner.lastResult.nu.clone();
        let com = inner.lastResult.com.clone();
        let events = inner.lastResult.data.into_iter().enumerate().map(|(i, d)| {
            let event_at: DateTime<Utc> = NaiveDateTime::parse_from_str(&d.time, "%Y-%m-%d %H:%M:%S")
                .map(|t| t.and_utc())
                .unwrap_or_else(|_| Utc::now());
            TraceEvent {
                event_at,
                kind: translate_status(d.status.as_deref()),
                location: d.location,
                description: d.context,
                raw_event_id: Some(format!("k100-cb-{}-{}", no, i + 1)),
            }
        }).collect();
        Ok(TraceWebhookEvent { carrier_code: com, tracking_no: no, events })
    }
}

fn translate_status(k100: Option<&str>) -> String {
    // kuaidi100 状态 code 对照(见 https://api.kuaidi100.com/document/5fcdc3411c25f81b6b78b75e.html):
    //   0: 在途   1: 揽收   2: 疑难   3: 已签收   4: 退签   5: 派件
    //   6: 退回   7: 转投   ...
    match k100.unwrap_or("0") {
        "1" => "picked_up".into(),
        "5" => "out_for_delivery".into(),
        "3" => "delivered".into(),
        "2" | "6" | "4" => "exception".into(),
        _   => "in_transit".into(),
    }
}

// ─── kuaidi100 请求 / 响应结构 ────────────────────────────────────────
#[derive(Serialize)]
struct ParamPayload<'a> {
    com: &'a str,
    num: &'a str,
    phone: &'a str,
    from: &'a str,
    to: &'a str,
    resultv2: &'a str,
    show: &'a str,
    order: &'a str,
}

#[derive(Deserialize)]
struct QueryResp {
    #[serde(default)]
    result: Option<bool>,
    #[serde(default, rename = "returnCode")]
    return_code: Option<String>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    data: Vec<TraceLine>,
}

#[derive(Deserialize, Default)]
struct TraceLine {
    #[serde(default)]
    time: String,
    #[serde(default)]
    ftime: String,
    #[serde(default)]
    context: String,
    #[serde(default)]
    location: Option<String>,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Deserialize)]
struct CallbackBody {
    param: String,
    sign:  String,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct CallbackInner {
    lastResult: CallbackResult,
}

#[derive(Deserialize)]
struct CallbackResult {
    nu: String,
    com: String,
    #[serde(default)]
    data: Vec<TraceLine>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn mock_query_returns_3_events() {
        let a = Kuaidi100Adapter::default();
        // 无 env → mock
        let r = a.query_trace("sf", "SF1234").await.unwrap();
        assert_eq!(r.len(), 3);
        assert_eq!(r[0].kind, "picked_up");
    }

    #[test]
    fn translate_status_maps_correctly() {
        assert_eq!(translate_status(Some("1")), "picked_up");
        assert_eq!(translate_status(Some("3")), "delivered");
        assert_eq!(translate_status(Some("5")), "out_for_delivery");
        assert_eq!(translate_status(Some("2")), "exception");
        assert_eq!(translate_status(Some("0")), "in_transit");
        assert_eq!(translate_status(None), "in_transit");
    }

    #[tokio::test]
    async fn unsupported_carrier_rejected() {
        let a = Kuaidi100Adapter::default();
        let r = a.query_trace("dhl", "DHLXX").await;
        assert!(matches!(r, Err(AdapterError::Config(_))));
    }
}
