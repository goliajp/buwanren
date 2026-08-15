//! unmei-wx — WeChat ecosystem SDK
//!
//! 三块能力:
//! 1. **小程序登录** — `wx.login()` 拿 code → 服务端换 openid/unionid/session_key
//! 2. **公众号 / H5 OAuth** — code → access_token + openid/unionid
//! 3. **微信支付 v3** — JSAPI / Native / H5 预下单 + 回调验签 + 解密
//!
//! access_token / jsapi_ticket 等用 [`redis`] 缓存,key 前缀 `unmei:wx:`。

pub mod config;
pub mod error;
pub mod miniprogram;
pub mod oauth;
pub mod pay;
pub mod adapter;
pub mod token;
pub mod util;

pub use config::WxConfig;
pub use error::{Result, WxError};

use kevy_embedded::Store;
use reqwest::Client as HttpClient;

/// 顶层 SDK 入口 · 注入到 axum AppState
///
/// 缓存层用 [`kevy_embedded::Store`] — in-process Redis 协议兼容 KV,
/// 进程级共享单实例(`Store::clone()` 是浅拷贝)。
#[derive(Clone)]
pub struct WxSdk {
    pub cfg: WxConfig,
    pub http: HttpClient,
    pub cache: Store,
}

impl WxSdk {
    pub fn new(cfg: WxConfig, cache: Store) -> Self {
        let http = HttpClient::builder()
            .timeout(std::time::Duration::from_secs(8))
            .build()
            .expect("reqwest client");
        Self { cfg, http, cache }
    }

    /// 是否在 mock 模式 — 未配置 appid/secret 时即 mock,跑通端到端不依赖真微信
    pub fn is_mock(&self) -> bool {
        self.cfg.mp.appid.is_empty() || self.cfg.mp.secret.is_empty()
    }
}
