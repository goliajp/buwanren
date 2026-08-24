//! 订阅用例。

use chrono::{DateTime, Duration, Utc};
use sqlx::{PgPool, Row};
use unmei_domain::commerce::enums::BillingPeriod;
use unmei_domain::commerce::events::DomainEvent;
use crate::DbResultExt;
use crate::outbox;
use unmei_domain::DomainError;

use crate::{new_id, Actor};

/// 取消订阅。
///
/// `immediate=false`(默认)只打「到期不续」的标,当前周期照常服务;
/// `immediate=true` 立即终止。
///
/// 旧实现两条分支都不写领域事件,`reason` 与 `admin` 两个参数拿到手就
/// `let _ = ...` 丢掉了 —— 订阅被谁在什么时候为什么取消,查不到。
/// 这里补上 `SubscriptionCancelled` 事件,把操作人与原因带进 payload。
///
/// 注意:`subscription` 表**没有 `audit_note` 列**(其它 8 张商业表都有),
/// 所以审计只能走事件,不能像别处那样追加备注。要在库里也留痕需要加列 ——
/// 那是一次 migration,不在本次范围内。
pub async fn cancel(
    pool: &PgPool,
    subscription_id: &str,
    immediate: bool,
    reason: Option<&str>,
    actor: &Actor,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    let affected = if immediate {
        sqlx::query(
            "UPDATE subscription SET status='cancelled', cancelled_at=NOW() WHERE id=$1",
        )
        .bind(subscription_id)
        .execute(&mut *tx)
        .await.db()?
        .rows_affected()
    } else {
        sqlx::query("UPDATE subscription SET cancel_at_period_end=true WHERE id=$1")
            .bind(subscription_id)
            .execute(&mut *tx)
            .await.db()?
            .rows_affected()
    };

    if affected == 0 {
        return Err(DomainError::NotFound(format!("subscription {subscription_id}")));
    }

    // 只有立即终止才是真的「已取消」;到期不续要等周期结束,
    // 由 billing worker 在那时落事件。
    if immediate {
        outbox::write(
            &mut *tx,
            &DomainEvent::SubscriptionCancelled {
                subscription_id: subscription_id.to_string(),
                occurred_at: Utc::now(),
            },
        )
        .await?;
    }

    tracing::info!(
        subscription_id,
        immediate,
        actor = %actor.label(),
        reason = reason.unwrap_or("-"),
        "subscription.cancel"
    );

    tx.commit().await.db()?;
    Ok(())
}

// ═══════════════════════════ 续费 ═══════════════════════════

/// 一次续费尝试的结果。
#[derive(Debug, Clone, PartialEq)]
pub enum RenewOutcome {
    /// 续上了,周期已延长
    Renewed { invoice_id: String, order_id: String, period_end: DateTime<Utc> },
    /// 用户之前点过「到期不续」,到点了 —— 不收钱,置 cancelled
    StoppedAtPeriodEnd,
    /// 套餐没有激活价,收不了 —— 不再重试
    Unpriced,
    /// 已经不在可续费状态(并发下被别的动作改掉了)
    NotDue,
}

/// 给一笔到期的订阅续费。
///
/// 原本这段在 `unmei-api/src/workers/subscription_billing.rs` 里,有三个问题:
///
/// 1. **不看 `cancel_at_period_end`** —— 用户点了「到期不续」,到期照样扣钱。
///    `cancel(immediate=false)` 只是把标打上,真正要在这里被认。
/// 2. **整个流程没有事务** —— 建发票、建订单、建支付、改订阅五步分开做。
///    中间任何一步挂掉,都可能留下「钱收了但周期没延长」这种状态。
/// 3. **收不了钱时不推 `next_billing_attempt_at`** —— 没有激活价的订阅会被
///    每 5 分钟重新选出来一次,永远。
///
/// 这里三条一起解决:全程一个事务,先认取消标记,收不了就把重试时间清掉。
///
/// 目前仍是 mock 收款(直接建一条 success 的 payment),所以这里【不会】失败。
/// 真接入之后改成 `adapter.create_payment(off_session)`,收不上来就调
/// [`record_renewal_failure`] —— 阶梯已经在了(T+1d / T+3d / T+7d → past_due
/// → grace → expired),今天由 worker 在 `renew_due` 报错时调用。
/// 续一期并收钱。
///
/// **「到期了没有」不由这里判断** —— 它信调用方。`workers/subscription_billing.rs`
/// 筛的是 `next_billing_attempt_at <= NOW()`，而这里只复核状态与「到期不续」标记。
/// 现有测试也钉着这个语义：fixture 给的是【未到期】的订阅，期待续费成功。
///
/// 后果要知道：**同一笔订阅并发调两次，会开出两张发票、两笔订单**
/// （2026-08-18 实测）。`FOR UPDATE OF s` 只保证两次串行，不保证第二次
/// 会因为「刚才已经续过」而退出 —— 因为这里根本没有那一问。
///
/// 今天够不着：那个 worker 单实例、顺序处理，一个 id 一轮只取一次。
/// 但**新调用方要自己带上到期判断**，否则这就是一次重复扣款。
pub async fn renew_due(pool: &PgPool, subscription_id: &str) -> Result<RenewOutcome, DomainError> {
    let mut tx = pool.begin().await.db()?;

    // FOR UPDATE:同一笔订阅不会被两个 tick 同时续
    let row = sqlx::query(
        r#"SELECT s.user_id, s.status, s.current_period_end, s.cancel_at_period_end,
                  p.billing_period, p.sku_id,
                  pb.price_minor, pb.currency
           FROM subscription s
           JOIN plan p ON p.id = s.plan_id
           LEFT JOIN LATERAL (
             SELECT price_minor, currency FROM price_book
             WHERE sku_id = p.sku_id AND status='active'
               AND effective_from <= NOW()
               AND (effective_to IS NULL OR effective_to > NOW())
             ORDER BY effective_from DESC LIMIT 1
           ) pb ON TRUE
           WHERE s.id = $1
           FOR UPDATE OF s"#,
    )
    .bind(subscription_id)
    .fetch_optional(&mut *tx)
    .await.db()?
    .ok_or_else(|| DomainError::NotFound(format!("subscription {subscription_id}")))?;

    let status: String = row.get("status");
    if !["active", "past_due", "trialing"].contains(&status.as_str()) {
        tx.commit().await.db()?;
        return Ok(RenewOutcome::NotDue);
    }

    // ─── 先认取消标记,再谈收钱 ───────────────────────────────
    let cancel_at_period_end: bool = row.get("cancel_at_period_end");
    if cancel_at_period_end {
        // 状态机:Active → Cancelled 允许(Active → Expired 不允许)
        sqlx::query(
            "UPDATE subscription SET status='cancelled', cancelled_at=NOW(),
               next_billing_attempt_at=NULL WHERE id=$1",
        )
        .bind(subscription_id)
        .execute(&mut *tx)
        .await.db()?;

        // `cancel(immediate=false)` 当时刻意不发事件,说好「到期时由 billing worker 发」。
        // 就是这里。
        outbox::write(
            &mut *tx,
            &DomainEvent::SubscriptionCancelled {
                subscription_id: subscription_id.to_string(),
                occurred_at: Utc::now(),
            },
        )
        .await?;

        tx.commit().await.db()?;
        tracing::info!(subscription_id, "订阅到期不续，已停止");
        return Ok(RenewOutcome::StoppedAtPeriodEnd);
    }

    let amount_minor: Option<i64> = row.get("price_minor");
    let Some(amount_minor) = amount_minor.filter(|a| *a > 0) else {
        // 清掉重试时间,否则这条会被每个 tick 重新捞出来
        sqlx::query("UPDATE subscription SET next_billing_attempt_at=NULL WHERE id=$1")
            .bind(subscription_id)
            .execute(&mut *tx)
            .await.db()?;
        tx.commit().await.db()?;
        tracing::warn!(subscription_id, "套餐无激活价，已停止续费尝试");
        return Ok(RenewOutcome::Unpriced);
    };

    let user_id: String = row.get("user_id");
    let currency: String = row.get("currency");
    let billing_period: String = row.get("billing_period");
    let period_start: DateTime<Utc> = row.get("current_period_end");
    /* 走枚举，不是裸字符串。原先 `_ => 30 天` 把「认不出的周期」跟「月付」
       归成同一件事 —— 认不出的时候按月开一张发票，是拿钱去赌一个猜测。
       这个值来自 `plan.billing_period`，那一列有 CHECK，只允许这四个 ——
       也就是说这条错误路径**今天够不到**，它是纵深防御，不是缺测试。
       `scripts/check-enum-check.py` 守着「枚举跟那条 CHECK 一字不差」。
       真认不出就是数据坏了，报错让 worker 接进 dunning 阶梯：
       有限次、有间隔、有终点，而不是每 5 分钟按月再扣一次。 */
    let period = BillingPeriod::from_str_lax(&billing_period).ok_or_else(|| {
        DomainError::Validation(format!(
            "subscription {subscription_id} 的 billing_period 认不出：{billing_period}"
        ))
    })?;
    let period_end = period_start
        + match period {
            BillingPeriod::Month => Duration::days(30),
            BillingPeriod::Quarter => Duration::days(90),
            BillingPeriod::Year => Duration::days(365),
            BillingPeriod::Lifetime => Duration::days(365 * 100),
        };

    // 复用尚未结清的发票,不重复开
    let invoice_id: String = match sqlx::query_scalar(
        "SELECT id FROM subscription_invoice WHERE subscription_id=$1 AND status='open' LIMIT 1",
    )
    .bind(subscription_id)
    .fetch_optional(&mut *tx)
    .await.db()?
    {
        Some(id) => id,
        None => {
            let id = new_id("inv");
            sqlx::query(
                r#"INSERT INTO subscription_invoice(
                     id, subscription_id, period_start, period_end, amount_minor, currency,
                     status, attempt_count, next_attempt_at
                   ) VALUES ($1, $2, $3, $4, $5, $6, 'open', 0, NOW())"#,
            )
            .bind(&id)
            .bind(subscription_id)
            .bind(period_start)
            .bind(period_end)
            .bind(amount_minor)
            .bind(&currency)
            .execute(&mut *tx)
            .await.db()?;
            id
        }
    };

    let order_id = new_id("ord-renew");
    sqlx::query(
        r#"INSERT INTO order_record(
             id, user_id, channel_origin, currency,
             amount_subtotal_minor, amount_total_minor, amount_paid_minor,
             status, source_kind, source_ref_id, region, expires_at, paid_at
           ) VALUES ($1, $2, 'system', $3, $4, $4, $4, 'paid', 'subscription_renew', $5,
                     'cn', NOW() + INTERVAL '30 minutes', NOW())"#,
    )
    .bind(&order_id)
    .bind(&user_id)
    .bind(&currency)
    .bind(amount_minor)
    .bind(&invoice_id)
    .execute(&mut *tx)
    .await.db()?;

    let payment_id = new_id("pay-renew");
    sqlx::query(
        r#"INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency,
                               status, paid_at, metadata_json)
           VALUES ($1, $2, $3, 'wechat_mp', $4, $5, 'success', NOW(),
                   '{"subscription":true}'::jsonb)"#,
    )
    .bind(&payment_id)
    .bind(&order_id)
    .bind(&user_id)
    .bind(amount_minor)
    .bind(&currency)
    .execute(&mut *tx)
    .await.db()?;

    sqlx::query(
        r#"UPDATE subscription_invoice SET status='paid', payment_id=$1,
             attempt_count = attempt_count + 1, last_attempt_at=NOW(), next_attempt_at=NULL
           WHERE id=$2"#,
    )
    .bind(&payment_id)
    .bind(&invoice_id)
    .execute(&mut *tx)
    .await.db()?;

    sqlx::query(
        r#"UPDATE subscription SET status='active',
             current_period_start=$1, current_period_end=$2, next_billing_attempt_at=$2
           WHERE id=$3"#,
    )
    .bind(period_start)
    .bind(period_end)
    .bind(subscription_id)
    .execute(&mut *tx)
    .await.db()?;

    // 旧实现完全不发事件,续费对 dispatcher / 财务是隐形的
    outbox::write(
        &mut *tx,
        &DomainEvent::SubscriptionRenewed {
            subscription_id: subscription_id.to_string(),
            period_end,
            occurred_at: Utc::now(),
        },
    )
    .await?;

    tx.commit().await.db()?;
    tracing::info!(subscription_id, %order_id, amount_minor, "订阅已续费");

    Ok(RenewOutcome::Renewed { invoice_id, order_id, period_end })
}

// ═══════════════════════════ dunning 阶梯 ═══════════════════════════

/// 扣款失败之后走到了哪一级。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DunningStep {
    /// 还在重试窗口内,下次什么时候再试
    Retry { attempt: i32, next_attempt_at: DateTime<Utc> },
    /// 三次重试用完,置 past_due 并发事件
    PastDue { attempt: i32, next_attempt_at: DateTime<Utc> },
    /// 宽限期
    Grace { attempt: i32, next_attempt_at: DateTime<Utc> },
    /// 放弃:订阅 expired,账单 uncollectible
    Expired { attempt: i32 },
}

/// 失败第 n 次之后:隔几天再试、要不要改状态。
///
/// T+0 那次是第 1 次尝试,它失败后按这张表往下走 —— 于是重试点落在
/// T+1d / T+3d / T+7d,正好是三次重试。三次用完还收不到,才动订阅状态。
/// 表尾之后放弃。
///
/// 写成表而不是一串 if:阶梯是产品参数,改它不该动控制流。
const LADDER: &[(i32, i64, Option<&str>)] = &[
    //  第几次失败, 隔几天再试, 改成什么状态
    (1, 1, None),
    (2, 3, None),
    (3, 7, None),
    (4, 3, Some("past_due")),
    (5, 3, Some("grace")),
];

/// 记一次续费扣款失败,按阶梯往下走一级。
///
/// **没有这个阶梯的时候,一次扣款失败就是永久失联**:`renew_due` 出错时事务回滚,
/// `next_billing_attempt_at` 原地不动,worker 每 5 分钟把这条订阅重新选出来一次,
/// 直到有人去库里手改。这里把「再试」变成有限次、有间隔、有终点的事。
pub async fn record_renewal_failure(
    pool: &PgPool,
    subscription_id: &str,
    reason: &str,
) -> Result<DunningStep, DomainError> {
    let mut tx = pool.begin().await.db()?;

    // 当期那张还没收上来的账单。没有的话说明失败发生在建账单之前
    // (多半是库层面的临时故障),按第 1 次失败处理 —— 退一天再试,
    // 总之不能留在「5 分钟一次」上。
    let invoice: Option<(String, i32)> = sqlx::query_as(
        "SELECT id, attempt_count FROM subscription_invoice \
         WHERE subscription_id = $1 AND status = 'open' \
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(subscription_id)
    .fetch_optional(&mut *tx)
    .await
    .db()?;

    let attempt = invoice.as_ref().map(|(_, n)| n + 1).unwrap_or(1);
    let rung = LADDER.iter().find(|(n, _, _)| *n == attempt);

    let step = match rung {
        Some((_, days, new_status)) => {
            let next = Utc::now() + Duration::days(*days);
            if let Some((inv_id, _)) = &invoice {
                sqlx::query(
                    "UPDATE subscription_invoice SET attempt_count = $1, \
                       last_attempt_at = NOW(), next_attempt_at = $2 WHERE id = $3",
                )
                .bind(attempt)
                .bind(next)
                .bind(inv_id)
                .execute(&mut *tx)
                .await
                .db()?;
            }
            match new_status {
                Some(s) => {
                    sqlx::query(
                        "UPDATE subscription SET status = $1, next_billing_attempt_at = $2, \
                           updated_at = NOW() WHERE id = $3",
                    )
                    .bind(s)
                    .bind(next)
                    .bind(subscription_id)
                    .execute(&mut *tx)
                    .await
                    .db()?;
                    if *s == "past_due" {
                        outbox::write(
                            &mut *tx,
                            &DomainEvent::SubscriptionPastDue {
                                subscription_id: subscription_id.to_string(),
                                occurred_at: Utc::now(),
                            },
                        )
                        .await?;
                        DunningStep::PastDue { attempt, next_attempt_at: next }
                    } else {
                        // grace 没有对应的领域事件。不硬塞一个 —— 事件是给下游用的,
                        // 现在没有下游需要区分 grace 与 past_due。真需要时再加。
                        DunningStep::Grace { attempt, next_attempt_at: next }
                    }
                }
                None => {
                    sqlx::query(
                        "UPDATE subscription SET next_billing_attempt_at = $1, updated_at = NOW() \
                         WHERE id = $2",
                    )
                    .bind(next)
                    .bind(subscription_id)
                    .execute(&mut *tx)
                    .await
                    .db()?;
                    DunningStep::Retry { attempt, next_attempt_at: next }
                }
            }
        }
        // 走完阶梯:不再扣款,订阅到此为止,账单标为收不上来
        None => {
            if let Some((inv_id, _)) = &invoice {
                sqlx::query(
                    "UPDATE subscription_invoice SET status = 'uncollectible', \
                       attempt_count = $1, last_attempt_at = NOW(), next_attempt_at = NULL \
                     WHERE id = $2",
                )
                .bind(attempt)
                .bind(inv_id)
                .execute(&mut *tx)
                .await
                .db()?;
            }
            sqlx::query(
                "UPDATE subscription SET status = 'expired', next_billing_attempt_at = NULL, \
                   updated_at = NOW() WHERE id = $1",
            )
            .bind(subscription_id)
            .execute(&mut *tx)
            .await
            .db()?;
            outbox::write(
                &mut *tx,
                &DomainEvent::SubscriptionExpired {
                    subscription_id: subscription_id.to_string(),
                    occurred_at: Utc::now(),
                },
            )
            .await?;
            DunningStep::Expired { attempt }
        }
    };

    tx.commit().await.db()?;
    tracing::info!(subscription_id, attempt, reason, ?step, "订阅续费失败，dunning 前进一级");
    Ok(step)
}
