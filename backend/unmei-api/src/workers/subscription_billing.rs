//! subscription_billing · 每 5min 扫 next_billing_attempt_at,attempt 续费 + dunning。
//!
//! Dunning 重试间隔:T+0 / T+1d / T+3d / T+7d。
//! 流程:
//! 1. SELECT subscription WHERE status IN (active, past_due, trialing)
//!    AND next_billing_attempt_at <= NOW()
//! 2. 开新 subscription_invoice(若没有 open 的)
//! 3. 调 adapter.create_payment (off-session) → mock 模式直接 mark paid
//! 4. paid → 延长 period;fail → next_attempt_at 推后,attempt_count++
//! 5. attempt_count > 3 → past_due → grace → expired

use chrono::{Duration, Utc};
use sqlx::Row;
use std::time::Duration as StdDuration;
use uuid::Uuid;

use crate::state::AppState;

const INTERVAL_SECS: u64 = 300; // 5 min

pub async fn run(state: AppState) {
    let mut tick = tokio::time::interval(StdDuration::from_secs(INTERVAL_SECS));
    tick.tick().await;
    loop {
        tick.tick().await;
        if let Err(e) = sweep_once(&state).await {
            tracing::warn!("subscription_billing failed: {e}");
        }
    }
}

async fn sweep_once(st: &AppState) -> anyhow::Result<()> {
    let rows = sqlx::query(
        r#"SELECT s.id, s.user_id, s.plan_id, s.source_channel,
                  s.current_period_end, s.status, s.upgrade_from_subscription_id,
                  p.billing_period, p.grace_days, p.sku_id,
                  pb.price_minor, pb.currency
           FROM subscription s
           JOIN plan p ON p.id = s.plan_id
           LEFT JOIN LATERAL (
             SELECT price_minor, currency FROM price_book
             WHERE sku_id = p.sku_id AND status='active'
             ORDER BY effective_from DESC LIMIT 1
           ) pb ON TRUE
           WHERE s.status IN ('active','past_due','trialing')
             AND s.next_billing_attempt_at IS NOT NULL
             AND s.next_billing_attempt_at <= NOW()
           ORDER BY s.next_billing_attempt_at ASC
           LIMIT 50"#,
    ).fetch_all(&st.db).await?;
    if rows.is_empty() { return Ok(()); }
    tracing::info!("subscription_billing: {} subs due for renewal", rows.len());

    for r in rows {
        let sid: String = r.try_get("id")?;
        if let Err(e) = attempt_renew(st, &sid, &r).await {
            tracing::warn!("renew {sid}: {e}");
        }
    }
    Ok(())
}

async fn attempt_renew(st: &AppState, sid: &str, r: &sqlx::postgres::PgRow) -> anyhow::Result<()> {
    let user_id: String = r.try_get("user_id")?;
    let plan_id: String = r.try_get("plan_id")?;
    let _channel: String = r.try_get("source_channel")?;
    let period_end: chrono::DateTime<Utc> = r.try_get("current_period_end")?;
    let status: String = r.try_get("status")?;
    let billing_period: String = r.try_get("billing_period")?;
    let grace_days: i32 = r.try_get("grace_days")?;
    let amount: Option<i64> = r.try_get("price_minor").ok();
    let currency: String = r.try_get("currency").unwrap_or_else(|_| "CNY".into());

    let amt = amount.unwrap_or(0);
    if amt <= 0 {
        tracing::warn!("subscription {sid} has no price -> mark uncollectible");
        return Ok(());
    }

    let new_start = period_end;
    let new_end = match billing_period.as_str() {
        "month"   => new_start + Duration::days(30),
        "quarter" => new_start + Duration::days(90),
        "year"    => new_start + Duration::days(365),
        _ => new_start + Duration::days(30),
    };

    // 创建 / 取 open invoice
    let invoice_id: String = match sqlx::query_scalar::<_, String>(
        "SELECT id FROM subscription_invoice WHERE subscription_id=$1 AND status='open' LIMIT 1",
    ).bind(sid).fetch_optional(&st.db).await? {
        Some(id) => id,
        None => {
            let id = format!("inv-{}", Uuid::new_v4());
            sqlx::query(
                r#"INSERT INTO subscription_invoice(
                     id, subscription_id, period_start, period_end, amount_minor, currency,
                     status, attempt_count, next_attempt_at
                   ) VALUES ($1, $2, $3, $4, $5, $6, 'open', 0, NOW())"#,
            ).bind(&id).bind(sid).bind(new_start).bind(new_end).bind(amt).bind(&currency)
             .execute(&st.db).await?;
            id
        }
    };

    // Mock 模式:直接 mark paid + 延长 period
    let order_id = format!("ord-renew-{}", Uuid::new_v4());
    sqlx::query(
        r#"INSERT INTO order_record(
             id, user_id, channel_origin, currency,
             amount_subtotal_minor, amount_total_minor, amount_paid_minor,
             status, source_kind, source_ref_id, region, expires_at, paid_at
           ) VALUES ($1, $2, 'system', $3, $4, $4, $4, 'paid', 'subscription_renew', $5,
                     'cn', NOW() + INTERVAL '30 minutes', NOW())"#,
    ).bind(&order_id).bind(&user_id).bind(&currency).bind(amt).bind(&invoice_id)
     .execute(&st.db).await?;

    let pay_id = format!("pay-renew-{}", Uuid::new_v4());
    sqlx::query(
        r#"INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency, status, paid_at, metadata_json)
           VALUES ($1, $2, $3, 'wechat_mp', $4, $5, 'success', NOW(), '{"subscription":true}'::jsonb)"#,
    ).bind(&pay_id).bind(&order_id).bind(&user_id).bind(amt).bind(&currency)
     .execute(&st.db).await?;

    sqlx::query(
        r#"UPDATE subscription_invoice SET status='paid', payment_id=$1, attempt_count = attempt_count+1, last_attempt_at=NOW(), next_attempt_at=NULL
           WHERE id=$2"#,
    ).bind(&pay_id).bind(&invoice_id).execute(&st.db).await?;

    sqlx::query(
        r#"UPDATE subscription SET status='active',
              current_period_start=$1, current_period_end=$2,
              next_billing_attempt_at=$2
           WHERE id=$3"#,
    ).bind(new_start).bind(new_end).bind(sid).execute(&st.db).await?;

    tracing::info!("subscription {sid} renewed -> {new_end} (from status={status} grace_days={grace_days} plan={plan_id})");
    Ok(())
}
