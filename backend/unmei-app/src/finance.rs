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

    let period_id: String = sqlx::query_scalar(
        "SELECT id FROM accounting_period WHERE kind='month' AND state='open' \
         ORDER BY year DESC, sub DESC LIMIT 1",
    )
    .fetch_one(&mut *tx)
    .await
    .db()?;

    let entry_id = new_id("je");
    sqlx::query(
        r#"INSERT INTO journal_entry(id, period_id, description, posted_by_kind, business_kind, business_ref_id, status)
           VALUES ($1, $2, $3, 'system', 'refund', $4, 'posted')"#,
    )
    .bind(&entry_id)
    .bind(&period_id)
    .bind(format!("退款 {refund_id} 冲销订单 {order_id}"))
    .bind(refund_id)
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
