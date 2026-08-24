//! 公众号 / H5 OAuth · code → openid + unionid
//!
//! 流程:
//! 1. H5 跳转 `https://open.weixin.qq.com/connect/oauth2/authorize?...`
//! 2. 用户授权 → 回调 `redirect_uri?code=xxx`
//! 3. 服务端 `sns/oauth2/access_token` 拿 access_token + openid
//! 4. (可选)`sns/userinfo` 拿头像昵称
//!
//! 文档:<https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/Wechat_webpage_authorization.html>

use crate::{Result, WxError, WxSdk};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct H5AuthResult {
    pub openid: String,
    pub unionid: Option<String>,
    pub access_token: String,
    pub refresh_token: String,
    pub scope: String,
}

#[derive(Deserialize)]
struct RawTokenResp {
    access_token: Option<String>,
    refresh_token: Option<String>,
    openid: Option<String>,
    unionid: Option<String>,
    scope: Option<String>,
    errcode: Option<i32>,
    errmsg: Option<String>,
}

impl WxSdk {
    /// 生成授权跳转 URL · 客户端跳转用
    pub fn h5_authorize_url(&self, redirect_uri: &str, state: &str, scope_userinfo: bool) -> Result<String> {
        if self.cfg.h5.appid.is_empty() {
            return Err(WxError::Config("h5 appid"));
        }
        let scope = if scope_userinfo { "snsapi_userinfo" } else { "snsapi_base" };
        let redirect_uri_enc = urlencoding_lite(redirect_uri);
        Ok(format!(
            "https://open.weixin.qq.com/connect/oauth2/authorize\
             ?appid={appid}&redirect_uri={uri}&response_type=code\
             &scope={scope}&state={state}#wechat_redirect",
            appid = self.cfg.h5.appid,
            uri = redirect_uri_enc,
            scope = scope,
            state = state,
        ))
    }

    /// code → access_token + openid
    pub async fn h5_code_to_access(&self, code: &str) -> Result<H5AuthResult> {
        if self.is_mock_h5() {
            return Ok(H5AuthResult {
                openid: format!("mock_h5_openid_{code}"),
                unionid: Some(format!("mock_h5_unionid_{code}")),
                access_token: "mock_token".into(),
                refresh_token: "mock_refresh".into(),
                scope: "snsapi_base".into(),
            });
        }
        let url = format!(
            "https://api.weixin.qq.com/sns/oauth2/access_token\
             ?appid={appid}&secret={secret}&code={code}&grant_type=authorization_code",
            appid = self.cfg.h5.appid,
            secret = self.cfg.h5.secret,
        );
        let r: RawTokenResp = self.http.get(&url).send().await?.json().await?;
        match (r.access_token, r.openid) {
            (Some(t), Some(openid)) => Ok(H5AuthResult {
                openid,
                unionid: r.unionid,
                access_token: t,
                refresh_token: r.refresh_token.unwrap_or_default(),
                scope: r.scope.unwrap_or_default(),
            }),
            _ => Err(WxError::Api {
                errcode: r.errcode.unwrap_or(-1),
                errmsg: r.errmsg.unwrap_or_default(),
            }),
        }
    }

    fn is_mock_h5(&self) -> bool {
        self.cfg.h5.appid.is_empty() || self.cfg.h5.secret.is_empty()
    }
}

/// 轻量 urlencoding · 只 escape 必要字符,避免引入 crate
fn urlencoding_lite(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}
