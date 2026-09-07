//! 给人发一句话 —— 目前只有微信小程序的订阅消息这一条路。
//!
//! 【它跟推送通知不是一回事】。小程序的订阅消息要用户**每一条都单独
//! 授权**（`wx.requestSubscribeMessage`，只有真机有），授权一次只发得出
//! 一条。所以「发不出去」是常态，不是故障 —— 这一层的每一处都按这个
//! 前提写：没有授权就安静地不发，并且把这件事记下来。
//!
//! 【为什么现在需要它】。2026-09-07 之后按月送变成了「每期我们开一张单、
//! 你来付」—— 人不打开 app 就不知道该付了。在这之前这个产品对
//! 「怎么让人回来」这件事只有一个答案：他自己想起来。
//!
//! 【这一层不碰网络】。真去发的那一步在 `unmei-api`（它有 SDK）——
//! 这里只管「该发给谁、发哪一条、发过没有」。同 `refund` 那一族：
//! I/O 在外面，判断在里面。

use serde_json::Value;
use sqlx::{PgPool, Row};

use unmei_domain::DomainError;

use crate::{new_id, DbResultExt};

/// 一条该发出去的消息。
#[derive(Debug, Clone)]
pub struct 要发的一条 {
    pub grant_id: String,
    pub openid: String,
    pub template_id: String,
    pub page: String,
    pub data: Value,
}

/// 记下一次授权。同一个人同一条模板可以攒好几次 —— 微信就是这么算的。
pub async fn 记下授权(
    pool: &PgPool, user_id: &str, template_id: &str, region: &str,
) -> Result<(), DomainError> {
    /* openid 从账号上取，不收客户端报上来的 —— 客户端报的话，
       它可以报别人的，而这一条消息是要发到那个 openid 上的。 */
    let openid: Option<String> = sqlx::query_scalar(
        "SELECT COALESCE(wx_mp_openid, '') FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await.db()?;
    let Some(openid) = openid.filter(|s| !s.is_empty()) else {
        /* 没绑微信的人给不出授权 —— 匿名账号没有 openid。
           这不是错误:他就是发不到，如实说，不要记一条永远发不出去的授权。 */
        return Err(DomainError::Validation(
            "这个账号还没绑微信 —— 绑了才收得到提醒".into()));
    };
    sqlx::query(
        "INSERT INTO wx_subscribe_grant(id, user_id, openid, template_id, region)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(new_id("wxg"))
    .bind(user_id)
    .bind(&openid)
    .bind(template_id)
    .bind(region)
    .execute(pool)
    .await.db()?;
    Ok(())
}

/// 这个人这条模板还有没有没用掉的授权。有就取一条出来（**并标记用掉**）。
///
/// 【为什么取的时候就标用掉】。微信那一侧的额度在**发出去那一刻**扣掉，
/// 而发出去这件事我们可能不知道结果（超时）。宁可少发一条，
/// 不可拿同一次授权发两条 —— 后者微信会拒，而拒的时候我们已经
/// 以为发过了。
pub async fn 取一次授权(
    pool: &PgPool, user_id: &str, template_id: &str,
) -> Result<Option<(String, String)>, DomainError> {
    let row = sqlx::query(
        "UPDATE wx_subscribe_grant SET used_at = NOW()
          WHERE id = (SELECT id FROM wx_subscribe_grant
                       WHERE user_id = $1 AND template_id = $2 AND used_at IS NULL
                       ORDER BY granted_at ASC LIMIT 1
                       FOR UPDATE SKIP LOCKED)
        RETURNING id, openid",
    )
    .bind(user_id)
    .bind(template_id)
    .fetch_optional(pool)
    .await.db()?;
    Ok(row.map(|r| (r.get("id"), r.get("openid"))))
}

/// 发过什么、微信怎么说，都记下来。
///
/// 【`wx_message_log` 这张表从建库起就在，而没有人写过它】。
/// 发不出去是这条路的常态，所以「为什么没发出去」必须查得到 ——
/// 否则运营看到的只有「他没收到」。
pub async fn 记一笔(
    pool: &PgPool,
    user_id: &str,
    template_id: &str,
    payload: &Value,
    status: &str,
    response: &Value,
) -> Result<(), DomainError> {
    sqlx::query(
        "INSERT INTO wx_message_log(id, user_id, channel, template_id, payload, status, response, sent_at)
         VALUES ($1, $2, 'mp_subscribe', $3, $4, $5, $6,
                 CASE WHEN $5 = 'sent' THEN NOW() ELSE NULL END)",
    )
    .bind(new_id("wxm"))
    .bind(user_id)
    .bind(template_id)
    .bind(payload)
    .bind(status)
    .bind(response)
    .execute(pool)
    .await.db()?;
    Ok(())
}
