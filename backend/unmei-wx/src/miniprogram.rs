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

    /* 【这里【没有】解手机号那个函数，是故意的】（2026-09-03）。
       原本挂着一个 `mp_decrypt`（AES-128-CBC 解微信的敏感数据）+
       一句「TODO Beta 1.0 必做」，没有任何调用方。

       而绑定页上写的是:
         「我们不读取你的手机号或其它信息 · 只换一个微信给的匿名编号，
           再存你自己填的头像和昵称」

       留着那个待办事项跟这句承诺是矛盾的。更要紧的是:
       **一条 TODO 读起来像是「该做」** —— 下一个人会去把它实现掉，
       而不会先回头问产品答不答应。要读手机号是产品决定，
       那天再连同这段注释一起改。 */
}
