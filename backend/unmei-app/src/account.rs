//! 注销账号。
//!
//! 【隐私政策上写了两遍，而此前一处都做不到】。政策那一屏说：
//!
//! > 存多久：账号在，数据就在。**你退出并删除账号，出生时间与盘会一起
//! > 删掉；订单与支付记录按法律要求保留，那部分只留金额与时间。**
//!
//! > 你能做什么 · 删：在「设置」里退出并删除账号。
//!
//! 而「设置」上那颗按钮是本机的 `logout()` —— 它清掉这台手机上的 token，
//! 服务端一行数据都不动。绑了微信的人下次登录回来东西全在；匿名的人
//! 只是再也够不着自己那个号，数据照旧躺着。**这两句话对谁都不成立。**
//!
//! 这个模块把那两句话变成真的，逐条对上：
//!
//! | 政策那句 | 这里做的 |
//! |---|---|
//! | 出生时间与盘会一起删掉 | 删 `natal`（连带 `natal_summary`）与 `report` |
//! | ——（政策没提，但同属「你留下的话」） | 删问过的签、屋里追问、住着的人、徽章、点过的香、报过的名 |
//! | 订单与支付记录按法律要求保留 | `order_record` / `payment` / `refund` 一行不动 |
//! | 那部分只留金额与时间 | 抹掉 `order_meta` 的收货地址与联系人、`shipment` 的收件人快照 |
//! | 这个号再也进不来 | 清掉微信 openid / 手机号 / 头像，`deleted_at` 落时间 |
//!
//! **一个事务**。删一半的账号比不删更糟：屏上说注销成功，而库里还留着
//! 他的盘，下一次谁去查都查得到。

use chrono::Utc;
use serde::Serialize;
use sqlx::PgPool;

use crate::DbResultExt;
use unmei_domain::DomainError;

/// 注销之后拿掉了些什么 —— 给调用方记日志用，不摆到屏上。
///
/// 【不摆到屏上】：告诉一个刚决定离开的人「已删除 37 条记录」，
/// 读起来像在展示我们收了多少东西。屏上只说「注销好了」。
#[derive(Debug, Clone, Default, Serialize)]
pub struct 拿掉了 {
    pub natal: u64,
    pub report: u64,
    pub naji: u64,
    pub reading: u64,
    pub residency: u64,
    pub badge: u64,
    pub incense: u64,
    pub activity: u64,
    /// 抹掉联系人与地址的订单数（订单本身留着）
    pub 脱敏订单: u64,
}

/// 注销这个人。
///
/// 幂等：已经注销过的再调一次照旧返回 `Ok`（各项都是 0）——
/// 手抖点两下不该报错，而报错会让人以为没注销成功。
pub async fn delete(pool: &PgPool, user_id: &str) -> Result<拿掉了, DomainError> {
    let 在不在: Option<Option<chrono::DateTime<Utc>>> =
        sqlx::query_scalar("SELECT deleted_at FROM app_user WHERE id=$1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .db()?;
    let Some(已注销) = 在不在 else {
        return Err(DomainError::NotFound(format!("没有这个人：{user_id}")));
    };
    if 已注销.is_some() {
        return Ok(拿掉了::default());
    }

    let mut tx = pool.begin().await.db()?;
    let mut 账 = 拿掉了::default();

    /* 【先抹订单那一侧，再删他自己的东西】。顺序无所谓对错，
       但写成「先抹后删」读起来跟政策那句话一个次序:
       留下的先说清留成什么样，再说删掉了什么。 */

    // 订单：行留着，收货地址、联系人、留言抹掉 —— 「只留金额与时间」
    账.脱敏订单 = sqlx::query(
        r#"UPDATE order_meta SET shipping_address_json = NULL,
                                 contact_json = NULL,
                                 gift_note = NULL
            WHERE order_id IN (SELECT id FROM order_record WHERE user_id = $1)"#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .db()?
    .rows_affected();

    /* 包裹上的收件人快照同样是姓名电话地址。
       【不能删整行】：运单号与状态是这一单履约的凭据。 */
    sqlx::query(
        r#"UPDATE shipment SET recipient_snapshot_json = '{}'::jsonb
            WHERE order_id IN (SELECT id FROM order_record WHERE user_id = $1)"#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .db()?;

    /* 他留下的东西，逐张删。
       `natal` 走 CASCADE 带走 `natal_summary`；而 `report.natal_id`
       与 `naji_record.natal_id` 是 SET NULL —— 指望外键替我们做的话，
       `report` 里那份整盘快照会原样留在库里。所以这两张自己删。

       【一张一句，不拿表名拼 SQL】。拼出来的那种 `check-sql` 那一支
       验不动（它只 PREPARE 得了字面量），而这一段每一句都是在
       动别人的数据 —— 正是最该被那一支扫到的地方。 */
    let 删 = |sql: &'static str| sqlx::query(sql).bind(user_id);

    账.report = 删("DELETE FROM report WHERE user_id = $1")
        .execute(&mut *tx).await.db()?.rows_affected();
    账.naji = 删("DELETE FROM naji_record WHERE user_id = $1")
        .execute(&mut *tx).await.db()?.rows_affected();
    账.reading = 删("DELETE FROM villager_reading WHERE user_id = $1")
        .execute(&mut *tx).await.db()?.rows_affected();
    账.residency = 删("DELETE FROM villager_residency WHERE user_id = $1")
        .execute(&mut *tx).await.db()?.rows_affected();
    账.badge = 删("DELETE FROM user_badge WHERE user_id = $1")
        .execute(&mut *tx).await.db()?.rows_affected();
    账.incense = 删("DELETE FROM incense_lit WHERE user_id = $1")
        .execute(&mut *tx).await.db()?.rows_affected();
    账.activity = 删("DELETE FROM activity_registration WHERE user_id = $1")
        .execute(&mut *tx).await.db()?.rows_affected();
    删("DELETE FROM wx_message_log WHERE user_id = $1")
        .execute(&mut *tx).await.db()?;
    // 盘放最后:上面几张里有指着它的（report / naji_record），
    // 虽然那两条外键是 SET NULL，删的次序仍然照「先叶后根」走
    账.natal = 删("DELETE FROM natal WHERE user_id = $1")
        .execute(&mut *tx).await.db()?.rows_affected();

    /* 账号本身:能把他认回来的东西全清掉。
       `nickname` 不留空 —— 后台那张表上一个空名字读起来像数据坏了，
       而「已注销」是一句真话。 */
    sqlx::query(
        r#"UPDATE app_user
              SET wx_mp_openid = NULL, wx_mp_session_key_enc = NULL,
                  wx_unionid = NULL, wx_h5_openid = NULL, wx_official_openid = NULL,
                  openid_apple = NULL, openid_google = NULL,
                  phone_country_code = NULL, phone = NULL,
                  avatar_url = NULL, nickname = '已注销',
                  active_natal_id = NULL,
                  segment_tags = '{}'::jsonb,
                  deleted_at = NOW()
            WHERE id = $1"#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .db()?;

    tx.commit().await.db()?;
    Ok(账)
}
