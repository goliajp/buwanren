//! 真把那一条订阅消息发出去。
//!
//! 【判断在用例层，I/O 在这儿】——同 `refund` 那一族的分法。
//! `unmei_app::notify` 管「该发给谁、发哪一条、发过没有」；
//! 这里管「拿着 SDK 去发，并把微信怎么说记下来」。
//!
//! 【模板号是配置，不是常量】。它来自微信后台，每个小程序不一样；
//! 没配就**不发**，并且如实记一条 —— 而不是编一个模板号发出去
//! （那会被微信拒，而拒的原因在日志里长得像「用户没订阅」）。

use serde_json::json;
use unmei_app::notify as app_notify;
use unmei_wx::miniprogram::{发的结果, 订阅消息};

use crate::state::AppState;

/// 「这一期的单开出来了，付了就发这一盒」。
///
/// 【为什么这一条是必需品】。2026-09-07 之后按月送变成了
/// 「每期我们开一张单、你来付」—— 人不打开 app 就不知道该付了，
/// 而这个产品对「怎么让人回来」原本只有一个答案：他自己想起来。
/// 改成要人动手却不告诉他，等于把订阅悄悄断掉。
pub async fn 这一期该付了(
    st: &AppState, user_id: &str, order_id: &str, amount_minor: i64,
) {
    let 模板 = std::env::var("WX_TPL_SUB_BILL").unwrap_or_default();
    if 模板.is_empty() {
        // 没配模板号就不发。**记一笔**——「没配」跟「用户没订阅」
        // 是两件完全不同的事，而它们在日志里长得一样
        let _ = app_notify::记一笔(&st.db, user_id, "（未配置）", &json!({"order_id": order_id}),
                                   "no_template", &json!({"why": "WX_TPL_SUB_BILL 没配"})).await;
        return;
    }
    let 有授权 = match app_notify::取一次授权(&st.db, user_id, &模板).await {
        Ok(v) => v,
        Err(e) => { tracing::warn!("取订阅授权失败：{e}"); return }
    };
    let Some((_grant, openid)) = 有授权 else {
        // 他没授权过（或者上一次已经用掉了）。这是常态，不是故障
        let _ = app_notify::记一笔(&st.db, user_id, &模板, &json!({"order_id": order_id}),
                                   "no_grant", &json!({"why": "他没授权过，或者上一次已经用掉了"})).await;
        return;
    };
    let data = json!({
        "character_string1": order_id,
        "amount2": format!("{}.{:02} 元", amount_minor / 100, amount_minor % 100),
        "thing3": "一味香按月送",
        "thing4": "在「我的 › 订着的」里付，付了就发这一盒",
    });
    let 结果 = st.wx.mp_send_subscribe(订阅消息 {
        openid: &openid,
        template_id: &模板,
        page: "pages/subs/index",
        data: data.clone(),
    }).await;
    let (状态, 回话) = match 结果 {
        Ok(发的结果::发了) => ("sent", json!({"errcode": 0})),
        Ok(发的结果::他没订) => ("refused", json!({"errcode": 43101})),
        Ok(发的结果::没发成 { errcode, errmsg }) =>
            ("failed", json!({"errcode": errcode, "errmsg": errmsg})),
        Err(e) => ("failed", json!({"errmsg": e.to_string()})),
    };
    let _ = app_notify::记一笔(&st.db, user_id, &模板, &data, 状态, &回话).await;
}
