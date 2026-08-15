//! 配置加载 · 从 env 注入
//!
//! 缺省值都给空 — `WxSdk::is_mock()` 据此判 mock。

#[derive(Clone, Debug, Default)]
pub struct WxConfig {
    pub mp: MiniProgramConfig,
    pub h5: H5Config,
    pub pay: PayConfig,
}

#[derive(Clone, Debug, Default)]
pub struct MiniProgramConfig {
    pub appid: String,
    pub secret: String,
}

#[derive(Clone, Debug, Default)]
pub struct H5Config {
    pub appid: String,
    pub secret: String,
}

#[derive(Clone, Debug, Default)]
pub struct PayConfig {
    pub mchid: String,
    pub api_v3_key: String,            // AES-GCM 解密回调用
    pub serial_no: String,             // 商户证书序列号
    pub merchant_private_key_pem: String, // 商户私钥(签名请求)
    pub notify_url: String,
}

impl WxConfig {
    /// 从环境变量加载 · 字段缺失自动留空(进入 mock)
    pub fn from_env() -> Self {
        fn get(k: &str) -> String { std::env::var(k).unwrap_or_default() }
        let key_pem_path = get("WX_PAY_KEY_PATH");
        let merchant_private_key_pem = if key_pem_path.is_empty() {
            String::new()
        } else {
            std::fs::read_to_string(&key_pem_path).unwrap_or_default()
        };
        Self {
            mp: MiniProgramConfig {
                appid: get("WX_MP_APPID"),
                secret: get("WX_MP_SECRET"),
            },
            h5: H5Config {
                appid: get("WX_H5_APPID"),
                secret: get("WX_H5_SECRET"),
            },
            pay: PayConfig {
                mchid: get("WX_PAY_MCHID"),
                api_v3_key: get("WX_PAY_API_V3_KEY"),
                serial_no: get("WX_PAY_SERIAL_NO"),
                merchant_private_key_pem,
                notify_url: get("WX_PAY_NOTIFY_URL"),
            },
        }
    }
}
