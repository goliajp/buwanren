//! 账务分录。
//!
//! 这一段原先长在 `unmei-api/src/workers/outbox.rs` 里。搬过来的理由跟
//! `subscription::renew_due` 当初一样，仓库里已经写过一次：
//! **业务写操作只能有一份实现，而且放在这里才测得到**
//! —— worker 里的 SQL 没有任何测试够得着。
//!
//! 2026-08-24 核 README「已修的资金漏洞」那几条时发现：这一条标着已修
//! （分录头与分录行包进一个事务、按 `business_ref_id` 判重），
//! 而 `journal_entry` / `business_ref_id` 在整个测试目录里**零命中**。
//! 一个修好的钱 bug 没有测试兜着，它会静静回来。
use sqlx::{PgPool, Row};
use unmei_domain::DomainError;

use crate::{new_id, DbResultExt};

/// 给一笔已完成的退款记账。
///
/// 两条账务上必须有的性质，都在这里：
///
/// **一个事务**。分录头和分录行原本是两次独立写入，后者失败就留下一条
/// 没有明细的 `journal_entry` —— 一本不平的账，而且没人会发现。
///
/// **幂等**。outbox 事件会重试，只要在写分录行时挂过一次，重试就会为同一笔
/// 退款再记一整套分录，账上凭空多出一笔冲销。所以先按 `business_ref_id` 查。
///
/// 退款行不存在时什么都不做（`Ok`）—— 事件比数据先到过一次的话，重试会再来。
pub async fn post_refund_journal(pool: &PgPool, refund_id: &str) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    let posted: Option<String> = sqlx::query_scalar(
        "SELECT id FROM journal_entry WHERE business_kind='refund' AND business_ref_id=$1 LIMIT 1",
    )
    .bind(refund_id)
    .fetch_optional(&mut *tx)
    .await
    .db()?;
    if let Some(existing) = posted {
        tracing::debug!("finance · 退款 {refund_id} 已挂账于 {existing}，跳过");
        return Ok(());
    }

    let row = sqlx::query("SELECT order_id, payment_id, amount_minor, currency FROM refund WHERE id=$1")
        .bind(refund_id)
        .fetch_optional(&mut *tx)
        .await
        .db()?;
    let Some(r) = row else { return Ok(()) };
    let order_id: String = r.get("order_id");
    let amount: i64 = r.get("amount_minor");
    let currency: String = r.get("currency");

    /* 【按【今天是哪个月】取期间，没有就建一个】（2026-09-03 第四轮评审）。
       上一版取的是「最新的 open 月」，而 `accounting_period` 只有
       20260627 那一次迁移插过三行（最新是 2026-06）——
       于是库里 1070 条分录【全部】记在六月账上，而它们的 `posted_at`
       横跨八月十六到九月二日。更糟的是六月一关，
       这里就再也取不到 open 的月份，退款分录从此一条也记不进去、
       outbox 无限重试。

       月份从入账时刻算，不从「库里现有什么」算。
       `ON CONFLICT DO NOTHING` 配 uq_accounting_period(kind, year, sub) ——
       并发两笔同时入账不会建出两个同名期间。
       建出来的是 `open`;关账仍然是人的动作，这里只保证账有地方落。 */
    let 现在 = chrono::Utc::now();
    let (年, 月) = {
        use chrono::Datelike;
        (现在.year(), 现在.month() as i32)
    };
    let period_id = format!("period-{年}-{:02}", 月);
    sqlx::query(
        "INSERT INTO accounting_period (id, kind, year, sub, state) \
         VALUES ($1, 'month', $2, $3, 'open') ON CONFLICT DO NOTHING",
    )
    .bind(&period_id).bind(年).bind(月)
    .execute(&mut *tx)
    .await
    .db()?;
    // 建过了但被人关掉的情况:如实报错，不把账偷偷记进一个关了的期间
    let 状态: String = sqlx::query_scalar(
        "SELECT state FROM accounting_period WHERE id=$1",
    ).bind(&period_id).fetch_one(&mut *tx).await.db()?;
    if 状态 != "open" {
        return Err(DomainError::Conflict(format!(
            "会计期间 {period_id} 是 {状态}，这笔账没有地方落"
        )));
    }

    let entry_id = new_id("je");
    sqlx::query(
        // region 从订单取 —— 见 payment.rs 那段注释:这一列有默认值 'cn'，
        // 不写永远不报错，而按区分的月报会永远只有一个区
        r#"INSERT INTO journal_entry(id, period_id, description, posted_by_kind, business_kind, business_ref_id, status, region)
           VALUES ($1, $2, $3, 'system', 'refund', $4, 'posted',
                   COALESCE((SELECT region FROM order_record WHERE id=$5), 'cn'))"#,
    )
    .bind(&entry_id)
    .bind(&period_id)
    .bind(format!("退款 {refund_id} 冲销订单 {order_id}"))
    .bind(refund_id)
    .bind(&order_id)
    .execute(&mut *tx)
    .await
    .db()?;

    sqlx::query(
        r#"INSERT INTO journal_line(id, entry_id, line_no, account_code, debit_minor, credit_minor, currency, ref_kind, ref_id, note) VALUES
             ($1, $2, 1, '4001', $3, 0, $4, 'refund', $5, '主营业务收入(冲销)'),
             ($6, $2, 2, '1001', 0, $3, $4, 'refund', $5, '银行存款流出')"#,
    )
    .bind(new_id("jl"))
    .bind(&entry_id)
    .bind(amount)
    .bind(&currency)
    .bind(refund_id)
    .bind(new_id("jl"))
    .execute(&mut *tx)
    .await
    .db()?;

    tx.commit().await.db()?;
    tracing::info!(
        "finance · 退款分录 {entry_id} posted: 冲销 ¥{} / 退银行存款",
        amount as f64 / 100.0
    );
    Ok(())
}
