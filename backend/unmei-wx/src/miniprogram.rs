//! 小程序登录 · `wx.login()` → code → 服务端 jscode2session
//!
//! 文档:<https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html>

use crate::{Result, WxError, WxSdk};
use serde::{Deserialize, Serialize};

/// jscode2session 返回
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct Code2SessionResp {
    pub openid: String,
    pub unionid: Option<String>,
    /// base64 字符串,服务端解密手机号/敏感数据要用
    pub session_key: String,
}

#[derive(Deserialize)]
struct RawResp {
    openid: Option<String>,
    unionid: Option<String>,
    session_key: Option<String>,
    errcode: Option<i32>,
    errmsg: Option<String>,
}

impl WxSdk {
    /// 小程序 code → openid + session_key
    ///
    /// `mock=true` 时(未配置 appid/secret)返回稳定的 fake openid 用于本地开发。
    pub async fn mp_jscode2session(&self, code: &str) -> Result<Code2SessionResp> {
        if self.is_mock() {
            return Ok(Code2SessionResp {
                openid: format!("mock_openid_{code}"),
                unionid: Some(format!("mock_unionid_{code}")),
                session_key: "mock_session_key".into(),
            });
        }
        let url = format!(
            "https://api.weixin.qq.com/sns/jscode2session\
             ?appid={appid}&secret={secret}&js_code={code}&grant_type=authorization_code",
            appid = self.cfg.mp.appid,
            secret = self.cfg.mp.secret,
        );
        let r: RawResp = self.http.get(&url).send().await?.json().await?;
        match (r.openid, r.session_key) {
            (Some(openid), Some(sk)) => Ok(Code2SessionResp {
                openid,
                unionid: r.unionid,
                session_key: sk,
            }),
            _ => Err(WxError::Api {
                errcode: r.errcode.unwrap_or(-1),
                errmsg: r.errmsg.unwrap_or_default(),
            }),
        }
    }

    /// 解密手机号 / 用户敏感数据(AES-128-CBC,PKCS#7)
    ///
    /// 见微信文档「加密数据解密算法」
    /// <https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html>
    ///
    /// TODO: 接 aes / cbc / Pkcs7 实现(Beta 1.0 必做)
    pub fn mp_decrypt(
        &self,
        _session_key_b64: &str,
        _encrypted_b64: &str,
        _iv_b64: &str,
    ) -> Result<serde_json::Value> {
        Err(WxError::Internal("mp_decrypt: TODO Beta1".into()))
    }
}
