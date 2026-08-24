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
    /// 允不允许「没配微信凭据也能登录」。见 `AppState::new` 里那段。
    pub allow_wx_mock: bool,
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
    pub fn new(wx: Arc<WxSdk>, stub_autosettle: bool) -> Self {
        Self {
            wechat_jsapi:  Arc::new(WechatAdapter::new(wx.clone(), Mode::Jsapi,  stub_autosettle)),
            wechat_mp:     Arc::new(WechatAdapter::new(wx.clone(), Mode::Mp,     stub_autosettle)),
            wechat_h5:     Arc::new(WechatAdapter::new(wx.clone(), Mode::H5,     stub_autosettle)),
            wechat_native: Arc::new(WechatAdapter::new(wx,         Mode::Native, stub_autosettle)),
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
        /* 没设环境变量就用内置默认 —— 而那个默认**写在仓库里**，
           谁都能拿它伪造 token（管理员的也一样）。保留兜底是为了本机开发，
           但必须让它**响**：启动时喊一声，照 `main.rs` 对微信未配置那条的做法。
           2026-08-18 查到时，代码、docker-compose、.env.example 三层都带着
           同一个开发密钥，忘了设的部署会**照常启动**，一点异常都看不出来。 */
        let jwt_from_env = std::env::var("UNMEI_JWT_SECRET").ok();
        let jwt_is_default = jwt_from_env.is_none();
        let jwt_secret = jwt_from_env
            .unwrap_or_else(|| "unmei-dev-secret-CHANGE-IN-PROD".to_string())
            .into_bytes();
        if jwt_is_default {
            tracing::warn!("⚠ UNMEI_JWT_SECRET 没设，用的是仓库里那个公开的开发密钥 —— 上线前必须换");
        }

        /* 支付回调地址同样有个「看起来能用」的兜底。它在
           `routes/commerce.rs` 发起支付时才取，取不到就用 localhost ——
           于是生产忘了设的后果是：微信被告知回调到 localhost，
           **回调永远不来、支付永远不结算**，而下单那一步照样返回 200。
           在启动时喊一次，别等到第一笔钱丢了才发现。 */
        if std::env::var("UNMEI_PUBLIC_BASE").is_err() {
            tracing::warn!("⚠ UNMEI_PUBLIC_BASE 没设，支付回调会指向 localhost —— 真收钱前必须设");
        }

        /* 第三个「看起来能用」的兜底，而这个是认证。
           没配 `WX_MP_APPID` / `WX_MP_SECRET` 时，`mp_jscode2session` 回的是
           `mock_openid_{code}` —— 也就是说 `POST /v1/auth/wx/miniprogram`
           拿任意 code 都能登进去，同一个 code 每次都是**同一个账号**
           （2026-08-19 实测：code=alice 两次拿到同一个 user id）。
           部署忘了配凭据，这个端点就是按名字发号。

           所以从「静默可用」改成「必须明说要它」：`UNMEI_WX_MOCK=1` 才放行。
           开发照旧 —— `.env.example` 与 docker-compose 里都带着这一行；
           唯一会被挡住的，正是既没有真凭据、也没写这一行的那种部署。

           **这是我（实现方）拿的主意**，跟当初那条强制幂等键一样：
           不同意就把这个判断删掉，或者在部署里设上 `UNMEI_WX_MOCK=1`。
           见 docs/OPEN.md。 */
        let allow_wx_mock = std::env::var("UNMEI_WX_MOCK").as_deref() == Ok("1");

        /* 同一族里最贵的那个。`WechatAdapter::query_payment` 还是桩，而它回的是
           **「已支付」** —— `payment_query_sweeper` 每 30 秒问一次，于是每一笔
           待付支付都会在 90 秒内被结成已付，一分钱没收，履约照跑。
           只有这一个适配器，配没配真凭据都走它。
           要它这么干得明说；`scripts/e2e.sh` 那条全链路就是靠它跑通的。 */
        let stub_autosettle = std::env::var("UNMEI_PAY_STUB_AUTOSETTLE").as_deref() == Ok("1");
        if stub_autosettle {
            tracing::warn!(
                "⚠ UNMEI_PAY_STUB_AUTOSETTLE=1：支付查询走的是桩，\
                 每一笔待付支付都会被自动结成已付 —— 只该在开发机上"
            );
        }
        if wx.is_mock() && !allow_wx_mock {
            tracing::warn!(
                "⚠ 微信凭据没配，而 UNMEI_WX_MOCK 也没设 —— \
                 /v1/auth/wx/miniprogram 会直接报错，不会放任意 code 登录"
            );
        }
        let wx_arc = Arc::new(wx.clone());
        Self {
            allow_wx_mock,
            db,
            cache,
            mingli_base: Arc::new(mingli_base),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("reqwest client"),
            jwt_secret: Arc::new(jwt_secret),
            wx,
            payment_adapters: Arc::new(PaymentAdapterRegistry::new(wx_arc, stub_autosettle)),
            carrier_adapters: Arc::new(CarrierAdapterRegistry::default()),
        }
    }
}
