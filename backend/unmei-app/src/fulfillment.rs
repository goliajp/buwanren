//! 履约推进用例。
//!
//! 两个入口都是 outbox handler 调的,**重试是设计内行为**,所以幂等不是加分项
//! 而是前提。原实现(`workers/outbox.rs` 的 `handle_order_paid` /
//! `handle_shipment_delivered`)在这上面漏了四处:
//!
//! 1. 建 shipment 的 `ON CONFLICT DO NOTHING` 是**空守卫** —— shipment 表只有
//!    主键唯一,而每次插入的 id 都是新 uuid,永远不冲突。INSERT 和标 line
//!    `processing` 又不同事务:两者之间挂掉,重试就给同一条 line 发两个包裹。
//!    现在用 `WHERE NOT EXISTS(该 line 已有 shipment)` 防重,且整个推进在一个事务里。
//! 2. 收件快照从 `FROM order_meta WHERE order_id=…` 来 —— 订单没有 meta 行时
//!    INSERT **静默插入 0 行**,line 却照样标 processing:包裹从此不存在,
//!    line 永远 processing。改成子查询 COALESCE,meta 缺行照样建单。
//! 3. `lines.is_empty()` 时提前 return —— 重试时若第一次挂在「订单状态结算」前,
//!    行已全处理、订单永远停在 paid。现在空行也走结算。
//! 4. 订单翻到 done 时发 `OrderFulfilled`,但只有 instant 路径发;shipping 路径
//!    经 `ShipmentDelivered` 推到 done 时**不发**。统一发,且用 RETURNING 判定
//!    「这次真的翻转了」才发 —— 重试不重复发(履约通知跑两遍就是发两次货的邻居)。

use chrono::Utc;
use sqlx::{PgPool, Row};
use unmei_domain::commerce::events::DomainEvent;
use unmei_domain::DomainError;

use crate::outbox;
use crate::DbResultExt;
use crate::new_id;

#[derive(Debug, Clone, PartialEq)]
pub enum FulfillmentOutcome {
    /// 所有行履约完成,订单已翻到 done
    Done,
    /// 还有行在途(shipping / manual),订单标 fulfilling
    Fulfilling { pending_lines: i64 },
    /// 订单不在可推进状态(已 done / 已取消 / …),什么都没做
    NotApplicable,
}

/// OrderPaid → 推进每条 pending 行的履约。
///
/// instant / async_compute:直接标 done(mock;真实现是调 mingli-api 排盘)。
/// shipping:建 shipment(preparing,等运营录单号),行标 processing。
/// manual:行标 processing,等人工。
pub async fn apply_order_paid(pool: &PgPool, order_id: &str) -> Result<FulfillmentOutcome, DomainError> {
    let mut tx = pool.begin().await.db()?;

    // 锁订单行:两个 dispatcher tick 同时处理同一事件时,后到的等前面提交后
    // 看到的是已推进的状态,不会双跑
    let status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM order_record WHERE id=$1 FOR UPDATE",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await.db()?;
    let Some(status) = status else {
        return Err(DomainError::NotFound(format!("order {order_id}")));
    };
    if !["paid", "fulfilling"].contains(&status.as_str()) {
        tx.commit().await.db()?;
        return Ok(FulfillmentOutcome::NotApplicable);
    }

    // user_id 与 villager_id 一起取回来:御守行要靠它们写入住。
    // 分两次查的话,中间那段时间足够订单被改掉。
    let lines = sqlx::query(
        r#"SELECT ol.id, p.fulfillment_kind, p.report_kind, s.villager_id, o.user_id
           FROM order_line ol
           JOIN sku s          ON s.id = ol.sku_id
           JOIN product p      ON p.id = s.product_id
           JOIN order_record o ON o.id = ol.order_id
           WHERE ol.order_id=$1 AND ol.fulfillment_status='pending'"#,
    )
    .bind(order_id)
    .fetch_all(&mut *tx)
    .await.db()?;

    for l in &lines {
        let line_id: String = l.get("id");
        let kind: String = l.get("fulfillment_kind");
        match kind.as_str() {
            "instant" => {
                sqlx::query(
                    "UPDATE order_line SET fulfillment_status='done',
                       fulfillment_ref=jsonb_build_object('mocked', true, 'kind', $1)
                     WHERE id=$2",
                )
                .bind(&kind)
                .bind(&line_id)
                .execute(&mut *tx)
                .await.db()?;
            }
            // 报告:出一册,把 mingli 排的整盘冻进去。
            // 以前这条跟 instant 走同一支,标 done + `{"mocked":true}` ——
            // 订单显示「已完成」而买家手上什么都没有。
            //
            // 生辰还没填的话行**不标 done**:那一单确实还没完成,
            // 而 done 会让它从「我买过的」里以完成态消失,买家再也想不起
            // 还差自己一步。停在 processing,订单那一屏说得出「还差你的生辰」。
            "async_compute" => {
                let user_id: String = l.get("user_id");
                /* 出【哪一种】册子是商品说了算,不是这里的常量。
                   写死过一版 `bazi_deep`,于是买合婚、买问事一卦的人
                   都拿到一份自己的八字册子 —— 答非所问比什么都不给更糟,
                   因为买家会以为这就是他买的东西。

                   商品没标 / 标了一种我们还做不出来的 → **不出册子**,
                   行留在 pending。后台看得见,人能去把它补上或者下架。
                   跟御守 SKU 没有 villager_id 那条同一个处理:
                   配置错误不许被一句 done 盖过去。 */
                let report_kind: Option<String> = l.get("report_kind");
                let Some(kind) = report_kind.filter(|k| crate::report::出得了(k)) else {
                    tracing::error!(order_id, line_id, kind = ?l.get::<Option<String>, _>("report_kind"),
                                    "这件商品没说出哪一种册子，或者那一种还做不出来 —— 行留在 pending");
                    continue;
                };
                let out = crate::report::ensure_for_line(&mut tx, &user_id, &line_id, &kind).await?;
                let status = if out.is_ready() { "done" } else { "processing" };
                sqlx::query(
                    "UPDATE order_line SET fulfillment_status=$1,
                       fulfillment_ref=jsonb_build_object('kind','report','report_id',$2)
                     WHERE id=$3",
                )
                .bind(status)
                .bind(out.report_id())
                .bind(&line_id)
                .execute(&mut *tx)
                .await.db()?;
            }
            "shipping" => {
                sqlx::query(
                    r#"INSERT INTO shipment(id, order_id, order_line_ids, carrier_code, status,
                                            recipient_snapshot_json, shipping_method)
                       SELECT $1, $2, ARRAY[$3]::text[], 'manual', 'preparing',
                              COALESCE((SELECT shipping_address_json FROM order_meta
                                        WHERE order_id=$2), '{}'::jsonb),
                              'standard'
                       WHERE NOT EXISTS (
                         SELECT 1 FROM shipment
                         WHERE order_id=$2 AND $3 = ANY(order_line_ids)
                       )"#,
                )
                .bind(new_id("shp"))
                .bind(order_id)
                .bind(&line_id)
                .execute(&mut *tx)
                .await.db()?;
                sqlx::query("UPDATE order_line SET fulfillment_status='processing' WHERE id=$1")
                    .bind(&line_id)
                    .execute(&mut *tx)
                    .await.db()?;
            }
            // 御守:付了钱,这位不完人就住进你的村子。走同一条履约管线,不另开一条。
            "residency" => {
                let villager_id: Option<String> = l.get("villager_id");
                let user_id: String = l.get("user_id");
                let Some(villager_id) = villager_id else {
                    // SKU 没标是谁的御守 —— 这是配置错误,不能默默把行标成 done。
                    // 留在 pending,后台看得见,人能去把 sku.villager_id 补上。
                    tracing::error!(order_id, line_id, "御守 SKU 没有 villager_id，行留在 pending");
                    continue;
                };
                let out = crate::residency::move_in_from_line(&mut tx, &user_id, &villager_id, &line_id).await?;
                sqlx::query(
                    "UPDATE order_line SET fulfillment_status='done',
                       fulfillment_ref=jsonb_build_object('kind','residency','villager_id',$1,'new',$2)
                     WHERE id=$3",
                )
                .bind(&villager_id)
                .bind(out.is_new())
                .bind(&line_id)
                .execute(&mut *tx)
                .await.db()?;
            }
            "manual" => {
                sqlx::query("UPDATE order_line SET fulfillment_status='processing' WHERE id=$1")
                    .bind(&line_id)
                    .execute(&mut *tx)
                    .await.db()?;
            }
            other => {
                tracing::warn!(order_id, line_id, kind = other, "未知 fulfillment_kind，行留在 pending");
            }
        }
    }

    let outcome = settle_order_in_tx(&mut tx, order_id).await?;
    tx.commit().await.db()?;
    Ok(outcome)
}

/// ShipmentDelivered → 该运单覆盖的行标 done,全部完成则订单翻 done。
pub async fn apply_shipment_delivered(
    pool: &PgPool,
    shipment_id: &str,
    order_id: &str,
) -> Result<FulfillmentOutcome, DomainError> {
    let mut tx = pool.begin().await.db()?;

    let status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM order_record WHERE id=$1 FOR UPDATE",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await.db()?;
    if status.is_none() {
        return Err(DomainError::NotFound(format!("order {order_id}")));
    }

    sqlx::query(
        r#"UPDATE order_line SET fulfillment_status='done'
           WHERE order_id=$1 AND id = ANY(
             SELECT unnest(order_line_ids) FROM shipment WHERE id=$2
           )"#,
    )
    .bind(order_id)
    .bind(shipment_id)
    .execute(&mut *tx)
    .await.db()?;

    let outcome = settle_order_in_tx(&mut tx, order_id).await?;
    tx.commit().await.db()?;
    Ok(outcome)
}

/// 报告出册了 → 那条行标 done,全部完成则订单翻 done。
///
/// 跟 [`apply_shipment_delivered`] 同构:包裹签收和册子出好都是「等的那件事
/// 到了」。买家先买后填生辰的那一半走的就是这条 ——
/// 履约当时行停在 processing,生辰补上才走到这里。
pub async fn apply_report_ready(pool: &PgPool, order_line_id: &str) -> Result<FulfillmentOutcome, DomainError> {
    let mut tx = pool.begin().await.db()?;

    // 锁订单:跟 apply_order_paid 用同一把,两条路同时推进同一单时排队
    let order_id: Option<String> = sqlx::query_scalar(
        r#"SELECT o.id FROM order_record o
           JOIN order_line ol ON ol.order_id = o.id
           WHERE ol.id = $1 FOR UPDATE OF o"#,
    )
    .bind(order_line_id)
    .fetch_optional(&mut *tx)
    .await.db()?;
    let Some(order_id) = order_id else {
        return Err(DomainError::NotFound(format!("order_line {order_line_id}")));
    };

    sqlx::query("UPDATE order_line SET fulfillment_status='done' WHERE id=$1 AND fulfillment_status<>'done'")
        .bind(order_line_id)
        .execute(&mut *tx)
        .await.db()?;

    let outcome = settle_order_in_tx(&mut tx, &order_id).await?;
    tx.commit().await.db()?;
    Ok(outcome)
}

/// 结算订单状态:行全部到终态 → done + `OrderFulfilled`;否则 fulfilling。
///
/// `RETURNING` 保证事件只在**真的**翻转那一次发 —— 重试时 UPDATE 改不到行,
/// 就不再发。事件写在同一个事务里,和业务状态同生共死。
async fn settle_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    order_id: &str,
) -> Result<FulfillmentOutcome, DomainError> {
    let pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM order_line WHERE order_id=$1 AND fulfillment_status NOT IN ('done','failed')",
    )
    .bind(order_id)
    .fetch_one(&mut **tx)
    .await.db()?;

    if pending == 0 {
        let flipped: Option<String> = sqlx::query_scalar(
            "UPDATE order_record SET status='done', fulfilled_at=NOW()
             WHERE id=$1 AND status IN ('paid','fulfilling')
             RETURNING id",
        )
        .bind(order_id)
        .fetch_optional(&mut **tx)
        .await.db()?;

        if flipped.is_some() {
            outbox::write(
                &mut **tx,
                &DomainEvent::OrderFulfilled {
                    order_id: order_id.to_string(),
                    occurred_at: Utc::now(),
                },
            )
            .await?;
            tracing::info!(order_id, "履约完成，订单 done");
        }
        Ok(FulfillmentOutcome::Done)
    } else {
        sqlx::query("UPDATE order_record SET status='fulfilling' WHERE id=$1 AND status='paid'")
            .bind(order_id)
            .execute(&mut **tx)
            .await.db()?;
        Ok(FulfillmentOutcome::Fulfilling { pending_lines: pending })
    }
}
