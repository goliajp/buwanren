//! ManualAdapter · 运营在 webadmin 手填 trace,不调外部接口。
//!
//! 适用:偏远地区平邮、自取、特殊渠道(校验性收件)。
//! query_trace 永远返回空列表(让 sweeper 不动这条);webhook 不支持。

use async_trait::async_trait;
use unmei_domain::commerce::adapters::WebhookHeaders;
use unmei_domain::commerce::adapters::{
    AdapterError, CarrierAdapter, CarrierCapabilities, TraceEvent, TraceWebhookEvent,
};

#[derive(Debug, Clone, Default)]
pub struct ManualAdapter;

impl ManualAdapter {
    pub const PROVIDER: &'static str = "manual";
    pub fn new() -> Self { Self }
}

#[async_trait]
impl CarrierAdapter for ManualAdapter {
    fn provider(&self) -> &'static str { Self::PROVIDER }
    fn supported_carriers(&self) -> &'static [&'static str] { &["manual"] }
    fn capabilities(&self) -> CarrierCapabilities {
        CarrierCapabilities { supports_webhook: false, supports_label_purchase: false }
    }

    async fn query_trace(
        &self,
        _carrier_code: &str,
        _tracking_no: &str,
    ) -> Result<Vec<TraceEvent>, AdapterError> {
        // 不查外部:有意为空,运营在 webadmin 手填。
        Ok(Vec::new())
    }

    async fn verify_webhook(
        &self,
        _headers: &WebhookHeaders,
        _body: &[u8],
    ) -> Result<TraceWebhookEvent, AdapterError> {
        Err(AdapterError::Unsupported)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn query_returns_empty() {
        let a = ManualAdapter::new();
        let r = a.query_trace("manual", "ANY").await.unwrap();
        assert!(r.is_empty());
    }
}
