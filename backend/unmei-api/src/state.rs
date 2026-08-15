use kevy_embedded::Store;
use sqlx::PgPool;
use std::sync::Arc;
use unmei_wx::{adapter::{Mode, WechatAdapter}, WxSdk};
use unmei_carrier::{kuaidi100::Kuaidi100Adapter, manual::ManualAdapter};
use unmei_domain::commerce::adapters::{CarrierAdapter, PaymentAdapter};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cache: Store,
    pub mingli_base: Arc<String>,
    pub http: reqwest::Client,
    pub jwt_secret: Arc<Vec<u8>>,
    pub wx: WxSdk,
    pub payment_adapters: Arc<PaymentAdapterRegistry>,
    pub carrier_adapters: Arc<CarrierAdapterRegistry>,
}

/// 注册按 channel string 派发的 PaymentAdapter。
pub struct PaymentAdapterRegistry {
    pub wechat_jsapi:  Arc<dyn PaymentAdapter>,
    pub wechat_mp:     Arc<dyn PaymentAdapter>,
    pub wechat_h5:     Arc<dyn PaymentAdapter>,
    pub wechat_native: Arc<dyn PaymentAdapter>,
}

impl PaymentAdapterRegistry {
    pub fn new(wx: Arc<WxSdk>) -> Self {
        Self {
            wechat_jsapi:  Arc::new(WechatAdapter::new(wx.clone(), Mode::Jsapi)),
            wechat_mp:     Arc::new(WechatAdapter::new(wx.clone(), Mode::Mp)),
            wechat_h5:     Arc::new(WechatAdapter::new(wx.clone(), Mode::H5)),
            wechat_native: Arc::new(WechatAdapter::new(wx,         Mode::Native)),
        }
    }

    pub fn pick(&self, channel: &str) -> Option<Arc<dyn PaymentAdapter>> {
        Some(match channel {
            "wechat_jsapi"  => self.wechat_jsapi.clone(),
            "wechat_mp"     => self.wechat_mp.clone(),
            "wechat_h5"     => self.wechat_h5.clone(),
            "wechat_native" => self.wechat_native.clone(),
            _ => return None,
        })
    }
}

/// CarrierAdapter registry · 按 provider 字符串派发。
pub struct CarrierAdapterRegistry {
    pub kuaidi100: Arc<dyn CarrierAdapter>,
    pub manual:    Arc<dyn CarrierAdapter>,
}

impl CarrierAdapterRegistry {
    pub fn new() -> Self {
        Self {
            kuaidi100: Arc::new(Kuaidi100Adapter::default()),
            manual:    Arc::new(ManualAdapter::new()),
        }
    }

    pub fn pick(&self, provider: &str) -> Option<Arc<dyn CarrierAdapter>> {
        Some(match provider {
            "kuaidi100" => self.kuaidi100.clone(),
            "manual"    => self.manual.clone(),
            _ => return None,
        })
    }
}

impl Default for CarrierAdapterRegistry {
    fn default() -> Self { Self::new() }
}

impl AppState {
    pub fn new(
        db: PgPool,
        cache: Store,
        mingli_base: String,
        wx: WxSdk,
    ) -> Self {
        let jwt_secret = std::env::var("UNMEI_JWT_SECRET")
            .unwrap_or_else(|_| "unmei-dev-secret-CHANGE-IN-PROD".to_string())
            .into_bytes();
        let wx_arc = Arc::new(wx.clone());
        Self {
            db,
            cache,
            mingli_base: Arc::new(mingli_base),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("reqwest client"),
            jwt_secret: Arc::new(jwt_secret),
            wx,
            payment_adapters: Arc::new(PaymentAdapterRegistry::new(wx_arc)),
            carrier_adapters: Arc::new(CarrierAdapterRegistry::default()),
        }
    }
}
