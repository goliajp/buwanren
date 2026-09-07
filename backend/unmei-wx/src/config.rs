//! 配置加载 · 从 env 注入
//!
//! 缺省值都给空 — `WxSdk::is_mock()` 据此判 mock。

#[derive(Clone, Debug, Default)]
pub struct WxConfig {
    pub mp: MiniProgramConfig,
    pub h5: H5Config,
    pub pay: PayConfig,
    /// 微信开放接口的根地址（`/sns/*`、`/cgi-bin/*`）。
    ///
    /// 【为什么可配】。这两个根地址原先写死在调用点上，于是
    /// **整条链只有真机 + 真凭据才走得到一次** —— 而「走不到」
    /// 跟「走通了」在这台机器上长得一模一样：桩直接返回成功。
    /// 可配之后，本机那个照协议说话的 `scripts/fake-wx.py`
    /// 能把我方这一侧的每一个字节都跑一遍（签名、验签、加解密、
    /// 回调、对账单），只有对面那一端是假的。
    ///
    /// 这跟「桩」是两件事:桩替我们的代码回答，假服务端让我们的代码
    /// 自己去问、自己去验 —— 我方代码里没有一行是为测试而写的分支。
    pub api_base: String,
    /// 微信支付 v3 的根地址
    pub pay_api_base: String,
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
        // 不配就是真微信。假服务端要显式指过去 —— 反过来（默认本机）
        // 会让「忘了配」变成「悄悄打到一个假的」，那种错上线才发现。
        let api_base = {
            let v = get("WX_API_BASE");
            if v.is_empty() { "https://api.weixin.qq.com".to_string() } else { v }
        };
        let pay_api_base = {
            let v = get("WX_PAY_API_BASE");
            if v.is_empty() { "https://api.mch.weixin.qq.com".to_string() } else { v }
        };
        Self {
            api_base,
            pay_api_base,
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
