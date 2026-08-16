//! 订单用例。
//!
//! 合并自两份旧实现,逐条取的是各自对的那一半:
//!
//! | 分歧点 | 旧路由 | 旧 PgOrderService | 这里 |
//! |---|---|---|---|
//! | 币种 | 硬编码 CNY,非 CNY 报错 | 从 price_book 读 | **读 price_book** |
//! | 多行币种不一致 | 未检查 | 未检查(静默取最后一行) | **显式报 Validation** |
//! | ip / ua | 写 NULL | 落库 | **落库** |
//! | `order_meta.contact_json` | 存 contact | 存 receipt(放错列) | **存 contact** |
//! | outbox `OrderCreated` | 不写 | 写 | **写** |
//! | 取消时状态校验 | 硬编码 `["draft","unpaid"]` | `assert_transition` 状态机 | **状态机** |
//! | 取消时 actor | 字面量 `'user'` | 前缀猜 | **调用方传 [`Actor`]** |
//! | 归属校验 | `AND user_id=$2` | 无 | **可选 `owner`,由调用方决定** |

use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use unmei_domain::commerce::enums::OrderStatus;
use unmei_domain::commerce::events::DomainEvent;
use unmei_domain::commerce::outbox;
use unmei_domain::commerce::state_machine::StateTransition;
use unmei_domain::DomainError;

use crate::{new_id, Actor};

// ═══════════════════════════ 建单 ═══════════════════════════

#[derive(Debug, Clone)]
pub struct NewOrderLine {
    pub sku_id: String,
    pub qty: i32,
}

#[derive(Debug, Clone)]
pub struct NewOrder {
    pub user_id: String,
    pub region: String,
    pub channel_origin: String,
    pub lines: Vec<NewOrderLine>,
    pub shipping_address: Option<Value>,
    pub contact: Option<Value>,
    pub coupon_codes: Vec<String>,
    pub note: Option<String>,
    pub ip: Option<String>,
    pub ua: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CreatedOrder {
    pub order_id: String,
    pub amount_total_minor: i64,
    pub currency: String,
    pub status: &'static str,
}

/// 建单。整笔在一个事务里:订单 + 行 + meta + 审计事件 + outbox,失败全回滚。
pub async fn create(pool: &PgPool, req: NewOrder) -> Result<CreatedOrder, DomainError> {
    if req.lines.is_empty() {
        return Err(DomainError::Validation("lines is empty".into()));
    }
    if let Some(bad) = req.lines.iter().find(|l| l.qty <= 0) {
        return Err(DomainError::Validation(format!("qty {} ≤ 0", bad.qty)));
    }

    let mut tx = pool.begin().await?;
    let order_id = new_id("ord");
    let now = Utc::now();

    let mut subtotal: i64 = 0;
    let mut currency: Option<String> = None;
    // (line_id, sku_id, unit_price, qty, line_subtotal, snapshot)
    let mut lines: Vec<(String, String, i64, i32, i64, Value)> = Vec::with_capacity(req.lines.len());

    for l in &req.lines {
        let row = sqlx::query(
            r#"SELECT s.id, s.code, s.name, s.spec_json, s.weight_g,
                      pb.price_minor, pb.currency
               FROM sku s
               LEFT JOIN LATERAL (
                 SELECT price_minor, currency FROM price_book
                 WHERE sku_id = s.id AND status='active'
                   AND effective_from <= NOW()
                   AND (effective_to IS NULL OR effective_to > NOW())
                 ORDER BY effective_from DESC LIMIT 1
               ) pb ON TRUE
               WHERE s.id=$1 AND s.status='active'"#,
        )
        .bind(&l.sku_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| DomainError::NotFound(format!("sku {}", l.sku_id)))?;

        let unit: i64 = row
            .try_get("price_minor")
            .map_err(|_| DomainError::Validation(format!("sku {} 无激活价", l.sku_id)))?;
        let cur: String = row
            .try_get("currency")
            .map_err(|_| DomainError::Validation(format!("sku {} 价格无币种", l.sku_id)))?;

        // 旧的两份都是「后一行覆盖前一行」,混币种下单会算出一笔币种错误的总额。
        // 一笔订单只能有一个币种,不一致就拒绝。
        match &currency {
            None => currency = Some(cur),
            Some(existing) if *existing != cur => {
                return Err(DomainError::Validation(format!(
                    "订单内币种不一致: {existing} vs {cur}"
                )));
            }
            Some(_) => {}
        }

        let line_sub = unit * l.qty as i64;
        subtotal += line_sub;
        lines.push((
            new_id("ol"),
            l.sku_id.clone(),
            unit,
            l.qty,
            line_sub,
            json!({
                "sku_code": row.try_get::<String, _>("code").unwrap_or_default(),
                "sku_name": row.try_get::<String, _>("name").unwrap_or_default(),
                "spec":     row.try_get::<Value, _>("spec_json").unwrap_or(Value::Null),
                "weight_g": row.try_get::<Option<i32>, _>("weight_g").ok().flatten(),
            }),
        ));
    }

    let currency = currency.expect("lines 非空则必有币种");
    let total = subtotal;

    sqlx::query(
        r#"INSERT INTO order_record(
             id, user_id, channel_origin, currency,
             amount_subtotal_minor, amount_total_minor,
             status, source_kind, region, ip, ua, expires_at, audit_note
           ) VALUES ($1, $2, $3, $4, $5, $6, 'unpaid', 'one_shot', $7, $8, $9,
                     NOW() + INTERVAL '30 minutes', $10)"#,
    )
    .bind(&order_id)
    .bind(&req.user_id)
    .bind(&req.channel_origin)
    .bind(&currency)
    .bind(subtotal)
    .bind(total)
    .bind(&req.region)
    .bind(&req.ip)
    .bind(&req.ua)
    .bind(req.note.clone().unwrap_or_default())
    .execute(&mut *tx)
    .await?;

    for (idx, (line_id, sku_id, unit, qty, line_sub, snap)) in lines.iter().enumerate() {
        sqlx::query(
            r#"INSERT INTO order_line(
                 id, order_id, line_no, sku_id, sku_snapshot_json,
                 unit_price_minor, qty, line_subtotal_minor, fulfillment_status
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')"#,
        )
        .bind(line_id)
        .bind(&order_id)
        .bind((idx + 1) as i32)
        .bind(sku_id)
        .bind(snap)
        .bind(unit)
        .bind(qty)
        .bind(line_sub)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        r#"INSERT INTO order_meta(order_id, shipping_address_json, contact_json, extra_json)
           VALUES ($1, $2, $3, '{}'::jsonb)"#,
    )
    .bind(&order_id)
    .bind(&req.shipping_address)
    .bind(&req.contact)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                   before_status, after_status, meta_json)
           VALUES ($1, $2, 'OrderCreated', 'user', $3, NULL, 'unpaid', '{}'::jsonb)"#,
    )
    .bind(new_id("oe"))
    .bind(&order_id)
    .bind(&req.user_id)
    .execute(&mut *tx)
    .await?;

    outbox::write(
        &mut *tx,
        &DomainEvent::OrderCreated {
            order_id: order_id.clone(),
            user_id: req.user_id.clone(),
            amount_total_minor: total,
            currency: currency.clone(),
            occurred_at: now,
        },
    )
    .await?;

    // 优惠券:两份旧实现都只留了 TODO,没有任何一份真的核销过。
    // 不在这里假装处理 —— 明确记录进审计,等 PromotionService 真正接通。
    if !req.coupon_codes.is_empty() {
        tracing::warn!(
            order_id = %order_id,
            codes = ?req.coupon_codes,
            "订单带了优惠券码但折扣引擎尚未接通,本单未核销"
        );
    }

    tx.commit().await?;

    Ok(CreatedOrder {
        order_id,
        amount_total_minor: total,
        currency,
        status: "unpaid",
    })
}

// ═══════════════════════════ 取消 ═══════════════════════════

/// 取消订单。
///
/// `owner` 传 `Some(user_id)` 时同时做归属校验 —— 客户端路径必须传,
/// 后台路径传 `None`。这一条是旧路由对而旧 service 漏掉的。
pub async fn cancel(
    pool: &PgPool,
    order_id: &str,
    reason: &str,
    actor: &Actor,
    owner: Option<&str>,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await?;

    let row = sqlx::query("SELECT status, user_id FROM order_record WHERE id=$1 FOR UPDATE")
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| DomainError::NotFound(format!("order {order_id}")))?;

    let cur_str: String = row.get("status");
    let owner_id: String = row.get("user_id");

    if let Some(uid) = owner {
        if owner_id != uid {
            // 对非属主不透露订单是否存在
            return Err(DomainError::NotFound(format!("order {order_id}")));
        }
    }

    let cur = OrderStatus::from_str_lax(&cur_str)
        .ok_or_else(|| DomainError::Internal(format!("unknown order status {cur_str}")))?;
    // 状态机是唯一判据。旧路由那句硬编码的 ["draft","unpaid"] 和状态机等价,
    // 但状态机改了它不会跟着改 —— 这正是双写的病。
    cur.assert_transition(OrderStatus::Cancelled)?;

    sqlx::query(
        r#"UPDATE order_record SET status='cancelled', cancelled_at=NOW(),
             cancel_reason=$1, cancel_actor=$2 WHERE id=$3"#,
    )
    .bind(reason)
    .bind(actor.kind.as_str())
    .bind(order_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                   before_status, after_status, meta_json)
           VALUES ($1, $2, 'OrderCancelled', $3, $4, $5, 'cancelled', $6)"#,
    )
    .bind(new_id("oe"))
    .bind(order_id)
    .bind(actor.kind.as_str())
    .bind(&actor.id)
    .bind(&cur_str)
    .bind(json!({ "reason": reason }))
    .execute(&mut *tx)
    .await?;

    outbox::write(
        &mut *tx,
        &DomainEvent::OrderCancelled {
            order_id: order_id.to_string(),
            reason: reason.to_string(),
            actor: actor.label(),
            occurred_at: Utc::now(),
        },
    )
    .await?;

    tx.commit().await?;
    Ok(())
}

// ═══════════════════════════ 后台批注 ═══════════════════════════

/// 追加一条审计备注。后台专用。
pub async fn annotate(
    pool: &PgPool,
    order_id: &str,
    note: &str,
    actor: &Actor,
) -> Result<(), DomainError> {
    let affected = sqlx::query(
        "UPDATE order_record SET audit_note = audit_note || E'\\n' || $1 WHERE id=$2",
    )
    .bind(format!("[{}] {note}", actor.label()))
    .bind(order_id)
    .execute(pool)
    .await?
    .rows_affected();

    // 旧的两份都不检查影响行数,批注一个不存在的订单会静默成功。
    if affected == 0 {
        return Err(DomainError::NotFound(format!("order {order_id}")));
    }
    Ok(())
}

// ═══════════════════════════ 过期未付 ═══════════════════════════

/// 把超时未支付的订单标记为取消。sweeper 调用。
pub async fn expire_unpaid(pool: &PgPool) -> Result<u64, DomainError> {
    let res = sqlx::query(
        r#"UPDATE order_record SET status='cancelled', cancelled_at=NOW(),
             cancel_reason='expired', cancel_actor='system'
           WHERE status='unpaid' AND expires_at < NOW()"#,
    )
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}
