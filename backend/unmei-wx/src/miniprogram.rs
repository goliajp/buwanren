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
        /* 【这里原先在没配 appid 时直接编一个 openid 回去】。
           也就是说：本机上任何一串 code 都能换到一个「登录成功」，
           而 `wx.login` 在网页版上是抛的 —— 于是这条路
           **在真机之外从来没有真的跑过一次**，包括它的错误分支。
           现在它照常去问；本机问的是 `scripts/fake-wx.py`，
           那一头按微信的协议回话，连 errcode 都照着回。 */
        if self.cfg.mp.appid.is_empty() || self.cfg.mp.secret.is_empty() {
            return Err(WxError::Config("小程序 appid / secret 没配"));
        }
        let url = format!(
            "{base}/sns/jscode2session\
             ?appid={appid}&secret={secret}&js_code={code}&grant_type=authorization_code",
            base = self.cfg.api_base,
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

/// 订阅消息 · 发一条
///
/// 【小程序的推送只有这一种】。它不是「推送通知」——用户必须
/// **每一条都单独授权**（`wx.requestSubscribeMessage`，只有真机有），
/// 授权一次只能发一条。所以这里发不出去是常态，而常态不该被当成故障：
/// 微信的 43101 就是「用户没订阅 / 授权已用掉」。
///
/// 【为什么现在才有】。`wx_message_log` 这张表从建库起就在，
/// 而全仓只有注销那一处在删它 —— 建了表、没有人写，
/// 正是这个仓反复出现的那个形状（能力做好了，两头没接上）。
#[derive(Debug, Clone)]
pub struct 订阅消息<'a> {
    pub openid: &'a str,
    pub template_id: &'a str,
    /// 点进去落在哪一页。空串就不跳
    pub page: &'a str,
    /// 微信要的形状是 `{"thing1": {"value": "…"}}` —— 这里收的是
    /// 扁平的 `{"thing1": "…"}`，拼装在下面做，调用方不用记那层壳
    pub data: serde_json::Value,
}

/// 发出去之后微信怎么说。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum 发的结果 {
    /// 发出去了
    发了,
    /// 用户没订阅、或者那一次授权已经用掉了 —— **不是故障**
    他没订,
    /// 别的错，原样带上 errcode，让人看得出是配置还是内容
    没发成 { errcode: i32, errmsg: String },
}

impl WxSdk {
    pub async fn mp_send_subscribe(&self, 要发的: 订阅消息<'_>) -> Result<发的结果> {
        let token = self.mp_access_token().await?;
        let mut data = serde_json::Map::new();
        for (k, v) in 要发的.data.as_object().cloned().unwrap_or_default() {
            let 文 = match v {
                serde_json::Value::String(s) => s,
                其他 => 其他.to_string(),
            };
            data.insert(k, serde_json::json!({ "value": 文 }));
        }
        let mut body = serde_json::json!({
            "touser": 要发的.openid,
            "template_id": 要发的.template_id,
            "data": data,
        });
        if !要发的.page.is_empty() {
            body["page"] = serde_json::Value::String(要发的.page.to_string());
        }
        let url = format!(
            "{base}/cgi-bin/message/subscribe/send?access_token={token}",
            base = self.cfg.api_base,
        );
        let r: serde_json::Value = self.http.post(&url).json(&body).send().await?.json().await?;
        let code = r.get("errcode").and_then(|x| x.as_i64()).unwrap_or(-1) as i32;
        let msg = r.get("errmsg").and_then(|x| x.as_str()).unwrap_or("").to_string();
        Ok(match code {
            0 => 发的结果::发了,
            // 43101：用户拒收或那一次授权已用掉。这是这条路的常态
            43101 => 发的结果::他没订,
            其他 => 发的结果::没发成 { errcode: 其他, errmsg: msg },
        })
    }
}
