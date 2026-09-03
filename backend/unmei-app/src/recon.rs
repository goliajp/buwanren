//! 对账用例。
//!
//! 从渠道拉回来的账单逐笔与 `payment` 比对,落 `recon_batch` + `recon_record`。
//!
//! **比金额,容差 0**(台账 D9)。从前只用 `channel_txn_id` 匹配,匹配上就标
//! `matched` —— 金额差多少都不看。那等于把对账做成了「这笔交易存在吗」,
//! 而对账的意义恰恰是抓金额差异:流水号对得上、金额对不上,才是最需要人看的一种。
//! 差一分即 `amount_mismatch`,进差异清单等人工处理,**不做自动容差**。
//!
//! `status_mismatch` 这个取值 schema 里有、这里仍没用:渠道状态与内部状态的
//! 对应关系是另一件事(渠道说 refunded 而我们说 succeeded 该怎么判),
//! D9 只拍了金额这一条,不顺手扩。

use chrono::NaiveDate;
use sqlx::{PgPool, Row};
use unmei_domain::DomainError;

use crate::{new_id, Actor};
use crate::DbResultExt;

/// 渠道账单里的一行。
#[derive(Debug, Clone)]
pub struct SettlementRow {
    pub channel_txn_id: String,
    pub amount_minor: i64,
    pub status: String,
}

/// 一批对账的结果。分项计数是给日志与后台看的 —— 只报一个「有差异」
/// 说不出是缺了单还是金额不符,这两种要走的处理完全不同。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReconOutcome {
    pub batch_id: String,
    pub total_count: i32,
    pub matched: i32,
    pub amount_mismatch: i32,
    pub missing_in_internal: i32,
    /// `matched` 或 `has_discrepancy`
    pub status: &'static str,
    /// 当天这个渠道已经对过账,这次什么都没做
    pub skipped: bool,
}

/// 已经为 (channel, batch_date) 拉过账单了吗。
pub async fn already_pulled(
    db: &PgPool,
    channel: &str,
    batch_date: NaiveDate,
) -> Result<bool, DomainError> {
    let found: Option<String> = sqlx::query_scalar(
        "SELECT id FROM recon_batch \
         WHERE channel = $1 AND batch_date = $2 AND source = 'channel_pulled' LIMIT 1",
    )
    .bind(channel)
    .bind(batch_date)
    .fetch_optional(db)
    .await
    .db()?;
    Ok(found.is_some())
}

/// 落一批对账。整批一个事务 —— 写了一半的批次比没写更难处理:
/// 后台看到的是一个数目对不上的批次,而它并不是真的对不上。
pub async fn ingest_settlement(
    db: &PgPool,
    channel: &str,
    batch_date: NaiveDate,
    currency: &str,
    rows: &[SettlementRow],
) -> Result<ReconOutcome, DomainError> {
    if already_pulled(db, channel, batch_date).await? {
        return Ok(ReconOutcome {
            batch_id: String::new(),
            total_count: 0,
            matched: 0,
            amount_mismatch: 0,
            missing_in_internal: 0,
            status: "matched",
            skipped: true,
        });
    }

    let mut tx = db.begin().await.db()?;

    let batch_id = new_id("rb");
    let total_count = rows.len() as i32;
    let total_amount: i64 = rows.iter().map(|r| r.amount_minor).sum();

    sqlx::query(
        "INSERT INTO recon_batch \
           (id, channel, batch_date, source, total_count, total_amount_minor, currency, status, pulled_at) \
         VALUES ($1, $2, $3, 'channel_pulled', $4, $5, $6, 'pulled', NOW())",
    )
    .bind(&batch_id)
    .bind(channel)
    .bind(batch_date)
    .bind(total_count)
    .bind(total_amount)
    .bind(currency)
    .execute(&mut *tx)
    .await
    .db()?;

    let (mut matched, mut amount_mismatch, mut missing) = (0, 0, 0);

    for r in rows {
        // 取金额一起回来 —— 只取 id 的话就只能回答「这笔在不在」
        let hit = sqlx::query("SELECT id, amount_minor FROM payment WHERE channel_txn_id = $1 LIMIT 1")
            .bind(&r.channel_txn_id)
            .fetch_optional(&mut *tx)
            .await
            .db()?;

        let (payment_id, state) = match hit {
            None => {
                missing += 1;
                (None, "missing_in_internal")
            }
            Some(row) => {
                let pid: String = row.get("id");
                let ours: i64 = row.get("amount_minor");
                if ours == r.amount_minor {
                    matched += 1;
                    (Some(pid), "matched")
                } else {
                    // 金额不符也要把 payment_id 记上:人工处理时第一件事就是
                    // 打开这笔支付看差在哪,不该让他再查一次流水号
                    amount_mismatch += 1;
                    (Some(pid), "amount_mismatch")
                }
            }
        };

        sqlx::query(
            "INSERT INTO recon_record \
               (id, batch_id, channel_txn_id, channel_amount_minor, channel_status, \
                matched_payment_id, match_state) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(new_id("rr"))
        .bind(&batch_id)
        .bind(&r.channel_txn_id)
        .bind(r.amount_minor)
        .bind(&r.status)
        .bind(payment_id)
        .bind(state)
        .execute(&mut *tx)
        .await
        .db()?;
    }

    let status = if amount_mismatch + missing > 0 { "has_discrepancy" } else { "matched" };
    sqlx::query("UPDATE recon_batch SET status = $1, matched_at = NOW() WHERE id = $2")
        .bind(status)
        .bind(&batch_id)
        .execute(&mut *tx)
        .await
        .db()?;

    tx.commit().await.db()?;

    Ok(ReconOutcome {
        batch_id,
        total_count,
        matched,
        amount_mismatch,
        missing_in_internal: missing,
        status,
        skipped: false,
    })
}

/// 结掉一条对不上的账。
///
/// 【`recon_record` 建表时就留了三列等人来结，而一直没有那条路】——
/// 本机库里 1432 条对不上的账（716 条金额不符 ¥111,518、
/// 716 条渠道有我们没有 ¥2,058），`resolved_at` 全是空。
/// 对账页的活儿是「找出对不上的」，找出来之后是个死胡同。
///
/// **结法必须说清是哪一种**。四个动作对应四种真实情形:
/// 渠道错了 / 我们漏记了 / 只是跨了日切 / 差的是已知手续费。
/// 少了这个区分，「已处理」就退化成「已看过」——
/// 而下个月同一类差异再来时，没人知道上次是怎么判的。
///
/// 已经结过的不许再结:结论要能追溯到一个人和一个时刻，
/// 覆盖一次就少一次记录。
pub async fn resolve_record(
    pool: &PgPool,
    record_id: &str,
    action: &str,
    note: &str,
    actor: &Actor,
) -> Result<String, DomainError> {
    use unmei_domain::commerce::enums::ReconResolveAction;

    let act = ReconResolveAction::from_str_lax(action).ok_or_else(|| {
        DomainError::Validation(format!(
            "结法 {action} 不认识 —— 只能是 channel_wrong / ours_missing / timing_only / known_fee"
        ))
    })?;
    if note.trim().is_empty() {
        /* 【结论要有一句话】。「渠道错了」不说清哪里错，
           下个月同一笔再对不上时，这条记录帮不上任何忙。 */
        return Err(DomainError::Validation("说一句是怎么查的 —— 空的结论等于没结".into()));
    }

    let mut tx = pool.begin().await.db()?;

    let row = sqlx::query(
        "SELECT match_state, resolved_at FROM recon_record WHERE id=$1 FOR UPDATE",
    )
    .bind(record_id)
    .fetch_optional(&mut *tx)
    .await.db()?
    .ok_or_else(|| DomainError::NotFound(format!("对账记录 {record_id}")))?;

    let 现状: String = row.get("match_state");
    if 现状 == "matched" {
        return Err(DomainError::Validation(
            "这一条本来就对得上，没有要结的东西".into()));
    }
    let 结过: Option<chrono::DateTime<chrono::Utc>> = row.get("resolved_at");
    if 结过.is_some() {
        return Err(DomainError::Conflict(format!("{record_id} 已经结过了")));
    }

    sqlx::query(
        "UPDATE recon_record SET resolved_action=$1, resolved_by_admin_id=$2,
                resolved_at=NOW(), resolved_note=$3
         WHERE id=$4",
    )
    .bind(act.as_str())
    .bind(actor.id.as_deref())
    .bind(note.trim())
    .bind(record_id)
    .execute(&mut *tx)
    .await.db()?;

    /* 【整批都结完了，批次才算结】。
       批次上的 `resolved_at` 是「这一批不用再看了」——
       还剩一条没结就不能这么说。 */
    let batch_id: String = sqlx::query_scalar("SELECT batch_id FROM recon_record WHERE id=$1")
        .bind(record_id)
        .fetch_one(&mut *tx)
        .await.db()?;
    let 还剩: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::int8 FROM recon_record
         WHERE batch_id=$1 AND match_state<>'matched' AND resolved_at IS NULL",
    )
    .bind(&batch_id)
    .fetch_one(&mut *tx)
    .await.db()?;
    if 还剩 == 0 {
        sqlx::query("UPDATE recon_batch SET resolved_at=NOW() WHERE id=$1 AND resolved_at IS NULL")
            .bind(&batch_id)
            .execute(&mut *tx)
            .await.db()?;
    }

    tx.commit().await.db()?;
    tracing::info!(record_id, action = act.as_str(), 还剩, "对账差异已结");
    Ok(batch_id)
}
