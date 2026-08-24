//! access_token 缓存 · 公众号 / 小程序共用 cgi-bin/token
//!
//! 微信侧 token 有效期 7200s,刷新前 ~5min 不安全;我们设 6900s TTL。
//! 用 [`kevy_embedded::Store`] 做 in-process 缓存。

use crate::{Result, WxError, WxSdk};
use std::time::Duration;

const KEY_MP_TOKEN: &[u8] = b"unmei:wx:mp:access_token";
const KEY_H5_TOKEN: &[u8] = b"unmei:wx:h5:access_token";
const TTL: Duration = Duration::from_secs(6900);

#[derive(serde::Deserialize)]
struct TokenResp {
    access_token: Option<String>,
    #[allow(dead_code)] expires_in: Option<i64>,
    errcode: Option<i32>,
    errmsg: Option<String>,
}

impl WxSdk {
    /// 拿小程序 access_token(缓存命中则用)
    pub async fn mp_access_token(&self) -> Result<String> {
        self.cgi_bin_token(KEY_MP_TOKEN, &self.cfg.mp.appid, &self.cfg.mp.secret).await
    }

    /// 拿公众号 access_token
    pub async fn h5_access_token(&self) -> Result<String> {
        self.cgi_bin_token(KEY_H5_TOKEN, &self.cfg.h5.appid, &self.cfg.h5.secret).await
    }

    async fn cgi_bin_token(&self, key: &[u8], appid: &str, secret: &str) -> Result<String> {
        if appid.is_empty() || secret.is_empty() {
            return Err(WxError::Config("appid / secret not configured"));
        }
        // 命中缓存
        if let Ok(Some(bytes)) = self.cache.get(key) {
            if let Ok(s) = String::from_utf8(bytes) { return Ok(s); }
        }
        let url = format!(
            "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={appid}&secret={secret}"
        );
        let resp: TokenResp = self.http.get(&url).send().await?.json().await?;
        if let Some(t) = resp.access_token {
            self.cache.set_with_ttl(key, t.as_bytes(), TTL)
                .map_err(|e| WxError::Internal(format!("kevy: {e}")))?;
            Ok(t)
        } else {
            Err(WxError::Api {
                errcode: resp.errcode.unwrap_or(-1),
                errmsg: resp.errmsg.unwrap_or_default(),
            })
        }
    }
}
