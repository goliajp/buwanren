//! 退款用例。

use chrono::Utc;
use sqlx::{PgPool, Row};
use unmei_domain::commerce::events::DomainEvent;
use crate::DbResultExt;
use crate::outbox;
use unmei_domain::DomainError;

use crate::{new_id, Actor};

/// 用户发起退款申请。
///
/// 可退金额 = `amount_paid_minor - amount_refunded_minor`,由服务端算，
/// 不接受调用方传的余额。`payment_id` 缺省时自动挑最近一笔成功支付。
pub async fn request(
    pool: &PgPool,
    order_id: &str,
    user_id: &str,
    payment_id: Option<String>,
    amount_minor: Option<i64>,
    reason_code: &str,
    reason_text: Option<&str>,
) -> Result<String, DomainError> {
    /* 【整段放进事务、锁住订单行】（2026-09-03）。
       上一版这里是三次各自独立的 `pool` 查询：读余额、查支付、插申请。
       两个请求同时进来，都读到同一个余额、都通过、都插一张申请。 */
    let mut tx = pool.begin().await.db()?;

    let order = sqlx::query(
        "SELECT user_id, amount_paid_minor, amount_refunded_minor, currency
         FROM order_record WHERE id=$1 FOR UPDATE",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await.db()?
    .ok_or_else(|| DomainError::NotFound(format!("order {order_id}")))?;

    let owner: String = order.get("user_id");
    if owner != user_id {
        return Err(DomainError::NotFound(format!("order {order_id}")));
    }

    /* 【在途的那些也算已退】（2026-09-03）。
       `amount_refunded_minor` 要到审批才增加 —— 于是同一单先后申请两次，
       第二次读到的余额仍是全额，两张申请都建得起来。

       审批那一步已经拦得住（下面 `approve` 里拿着行锁复核了余额，
       2026-08-18 那次实测的两笔就是它修之前留下的），所以钱退不出去两份。
       但**申请这一步说的是假话**:用户收到「申请成功」，
       后台多出一张永远批不下去的单子，而没有人知道它为什么批不动。
       申请要么建得起来、要么当场说清为什么不行 —— 不留这种半截状态。 */
    let 在途: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount_minor), 0)::int8 FROM refund
         WHERE order_id=$1 AND status IN ('requested','approved','processing')",
    )
    .bind(order_id)
    .fetch_one(&mut *tx)
    .await.db()?;

    let paid: i64 = order.get("amount_paid_minor");
    let refunded: i64 = order.get("amount_refunded_minor");
    let remaining = paid - refunded - 在途;
    let amount = amount_minor.unwrap_or(remaining);
    if amount <= 0 || amount > remaining {
        // 【说清是「为什么退不了」，不是复述两个数】。
        // 上一版这里发出去的是「退款金额 0 超出可退余额 0」——
        // 两个 0 对着看，没有人猜得到是因为上一笔还在审核里。
        return Err(DomainError::Validation(if 在途 > 0 && remaining <= 0 {
            format!("这一单的 {在途} 分已经在退款审核里了，等它有结果再说")
        } else if 在途 > 0 {
            format!(
                "最多还能退 {remaining} 分（已付 {paid}，已退 {refunded}，另有 {在途} 在审核中）"
            )
        } else {
            format!("退款金额 {amount} 超出可退余额 {remaining}")
        }));
    }

    let payment_id = match payment_id {
        /* 【传进来的那个 id 得真属于这张单】（2026-09-02 第四轮评审 · 工程审计）。
           原先是 `Some(p) => p` —— 原样采信。上面只校了「这张单是不是你的」
           和「金额超没超」，没有人问过这笔支付是谁的。
           审计实测：甲对自己的单发起退款、`payment_id` 填乙的，回 200 落库。
           退款走的是支付渠道，那条 id 最终会变成一次真的退款请求。 */
        Some(p) => {
            /* 【「退过一半」的也还能再退】（2026-09-03）。
               判据是【这笔钱收到过】，不是「状态恰好是 success」——
               第一笔退款会把它推成 `refunded_partial`，
               只认 success 的话第二笔就发不起来，而剩下那一半是真的可退。
               `refunded` 是全退完了，那时余额判据（上面那段）自己会拦。 */
            let 属于这张单: Option<String> = sqlx::query_scalar(
                "SELECT id FROM payment WHERE id=$1 AND order_id=$2 \
                   AND status IN ('success','refunded_partial')",
            ).bind(&p).bind(order_id).fetch_optional(&mut *tx).await.db()?;
            属于这张单.ok_or_else(|| DomainError::Validation(
                "这笔支付不属于这张订单，或者它没有收到过钱".into()))?
        }
        None => sqlx::query_scalar(
            // 同上：退过一半的那笔仍然可退
            "SELECT id FROM payment WHERE order_id=$1
               AND status IN ('success','refunded_partial')
             ORDER BY paid_at DESC LIMIT 1",
        )
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await.db()?
        .ok_or_else(|| DomainError::Validation("无成功支付可退".into()))?,
    };

    let currency: String = order.get("currency");
    let refund_id = new_id("rfd");

    sqlx::query(
        // region 从订单取 —— 见 payment.rs 里那段注释：这一列有默认值 'cn'，
        // 不写它永远不会报错，而后台按区分组的每一张表都会永远是空的。
        r#"INSERT INTO refund(id, order_id, payment_id, amount_minor, currency,
                              reason_code, reason_text, actor_kind, actor_id, status, region)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', $8, 'requested',
                   COALESCE((SELECT region FROM order_record WHERE id=$2), 'cn'))"#,
    )
    .bind(&refund_id)
    .bind(order_id)
    .bind(&payment_id)
    .bind(amount)
    .bind(&currency)
    .bind(reason_code)
    .bind(reason_text.unwrap_or_default())
    .bind(user_id)
    .execute(&mut *tx)
    .await.db()?;

    tx.commit().await.db()?;
    Ok(refund_id)
}

/// 后台批准退款。
///
/// 目前是 mock 直推 success —— 真接入后这里改成 `adapter.refund()` 发起、
/// 由渠道 webhook 推到 success。`RefundCompleted` 事件照写，
/// dispatcher 据此做财务复式挂账。
pub async fn approve(pool: &PgPool, refund_id: &str, actor: &Actor) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    let row = sqlx::query(
        "SELECT order_id, payment_id, amount_minor FROM refund
         WHERE id=$1 AND status='requested' FOR UPDATE",
    )
    .bind(refund_id)
    .fetch_optional(&mut *tx)
    .await.db()?
    .ok_or_else(|| DomainError::NotFound(format!("refund {refund_id}（或状态非 requested）")))?;

    let order_id: String = row.get("order_id");
    let payment_id: String = row.get("payment_id");
    let amount: i64 = row.get("amount_minor");

    /* 钱在这一步真的动，所以余额要在【这里、拿着锁】再算一次。
       `request` 那一步也算过，但它算的是【申请时】的余额，而
       `amount_refunded_minor` 要到审批才增加 —— 于是同一单申请两次，
       两次都看到余额未动、都通过；两张都批下去，退款额就是实付的两倍。
       2026-08-18 实测：实付 9900、已退 19800，没有任何一处报错
       （库里也没有「已退 ≤ 已付」的约束，只有「已付 ≤ 应付」那条）。 */
    let bal = sqlx::query(
        "SELECT amount_paid_minor, amount_refunded_minor FROM order_record
         WHERE id=$1 FOR UPDATE",
    )
    .bind(&order_id)
    .fetch_one(&mut *tx)
    .await.db()?;
    let paid: i64 = bal.get("amount_paid_minor");
    let refunded: i64 = bal.get("amount_refunded_minor");
    if refunded + amount > paid {
        return Err(DomainError::Conflict(format!(
            "退款 {amount} 超出可退余额 {}（已付 {paid}，已退 {refunded}）",
            paid - refunded
        )));
    }

    sqlx::query(
        r#"UPDATE refund SET status='success', approved_at=NOW(), approved_by_admin_id=$1,
             processed_at=NOW(), completed_at=NOW(),
             channel_refund_id = 'MOCK_' || id
           WHERE id=$2"#,
    )
    .bind(actor.id.as_deref())
    .bind(refund_id)
    .execute(&mut *tx)
    .await.db()?;

    /* 【按【累计已退】判，不按这一笔】（2026-09-03 第四轮评审 · 工程审计）。
       上一版拿 `$1`（这一笔的金额）跟支付总额比 —— 两笔各退一半，
       每一笔都小于总额，于是这笔支付【永远】停在 `refunded_partial`，
       而订单那一侧用的是累计式、已经翻成 `refunded`。
       同一笔钱两处说法不一致，对账时看到的是「订单全退了、支付没退完」。

       改成从 refund 表把这笔支付上所有 success 的退款加起来 ——
       跟订单那一侧同一套算法。 */
    sqlx::query(
        r#"UPDATE payment p SET status = CASE
             WHEN (SELECT COALESCE(SUM(r.amount_minor), 0) FROM refund r
                    WHERE r.payment_id = p.id AND r.status = 'success')
                  >= p.amount_minor
             THEN 'refunded' ELSE 'refunded_partial' END
           WHERE p.id=$1"#,
    )
    .bind(&payment_id)
    .execute(&mut *tx)
    .await.db()?;

    /* 【已知与状态机不一致，先记下来】：第一个分支不看当前状态，
       所以一笔【已取消】却收到过钱的订单（`apply_succeeded` 现在会记金额、
       不动状态）退款之后会变成 `refunded` —— 而
       `OrderStatus::allowed_next` 里 `Cancelled => &[]`。

       没有顺手改，是因为哪一边才对并不显然：钱确实退回去了，
       把它记成 `refunded` 说得通；而状态机说已取消是终态，也说得通。
       第二个分支（部分退款）本来就带着状态白名单，只有第一个没有。
       要改就要先定「收了钱又被取消的单，最终该停在哪个状态」。 */
    sqlx::query(
        r#"UPDATE order_record SET
             amount_refunded_minor = amount_refunded_minor + $1,
             status = CASE
               WHEN amount_refunded_minor + $1 >= amount_total_minor THEN 'refunded'
               WHEN status IN ('paid','fulfilling','done') THEN 'refund_partial'
               ELSE status END
           WHERE id=$2"#,
    )
    .bind(amount)
    .bind(&order_id)
    .execute(&mut *tx)
    .await.db()?;

    /* 【钱退干净了，东西也要收回来】（2026-09-06 三路验证 · 准备花钱的那一路）。
       在这之前 `approve` 只动 refund / payment / order_record 三张表加一个事件 ——
       客服在后台按下「批」，钱退回去，而**那位村民还住在他村里、
       那份说明书还读得到**。协议写的是「数字内容一经交付不支持退款」，
       订单屏也照这条把按钮换成了说明；而那条规矩此前只靠
       「后台的人不点错」来维持。

       判据是【这一单退干净了】，不是「有一笔退款」：
       部分退款对不上具体哪几行（`refund` 上只有 order_id 与金额，没有行），
       凭一笔部分退款就把人搬走，会把「退了一半」变成「什么都没有了」。
       全额退完没有这个歧义 —— 这一单的每一样东西都退掉了。 */
    let 退干净了: bool = sqlx::query_scalar(
        "SELECT amount_refunded_minor >= amount_paid_minor AND amount_paid_minor > 0
           FROM order_record WHERE id=$1",
    )
    .bind(&order_id)
    .fetch_one(&mut *tx)
    .await.db()?;
    if 退干净了 {
        // 御守：删掉住下的那一行就是搬走。判据是 `source_ref` —— 履约
        // 搬他进来时记的正是这一行，别的行搬进来的人不该被这一单带走
        let 搬走了 = sqlx::query(
            "DELETE FROM villager_residency
              WHERE source_ref IN (SELECT id FROM order_line WHERE order_id=$1)",
        )
        .bind(&order_id)
        .execute(&mut *tx)
        .await.db()?
        .rows_affected();
        // 说明书：不删行（`order_line_id` 是唯一键，删了同一行再履约会重建
        // 一份；对账也要看得见这一册存在过），改成收回那一档
        let 收回了 = sqlx::query(
            "UPDATE report SET status='revoked'
              WHERE status='ready'
                AND order_line_id IN (SELECT id FROM order_line WHERE order_id=$1)",
        )
        .bind(&order_id)
        .execute(&mut *tx)
        .await.db()?
        .rows_affected();
        if 搬走了 > 0 || 收回了 > 0 {
            tracing::info!(order_id, 搬走了, 收回了, "这一单退干净了，交付出去的东西收回");
        }
    }

    outbox::write(
        &mut *tx,
        &DomainEvent::RefundCompleted {
            refund_id: refund_id.to_string(),
            occurred_at: Utc::now(),
        },
    )
    .await?;

    tx.commit().await.db()?;
    Ok(())
}

/// 后台驳回退款。
pub async fn deny(
    pool: &PgPool,
    refund_id: &str,
    reason: &str,
    actor: &Actor,
) -> Result<(), DomainError> {
    let affected = sqlx::query(
        "UPDATE refund SET status='cancelled', audit_note = audit_note || E'\\n' || $1
         WHERE id=$2 AND status IN ('requested','failed')",
    )
    .bind(format!("{} deny: {reason}", actor.label()))
    .bind(refund_id)
    .execute(pool)
    .await.db()?
    .rows_affected();

    // 旧实现不看影响行数：驳回一个不存在的、或已经成功的退款都会返回 ok:true。
    if affected == 0 {
        return Err(DomainError::NotFound(format!(
            "refund {refund_id}（或状态不是 requested/failed）"
        )));
    }
    Ok(())
}

/// 渠道回调：退款成功 / 失败。
pub async fn apply_succeeded(pool: &PgPool, channel_refund_id: &str) -> Result<(), DomainError> {
    // 只改【还在渠道手里】的那笔。渠道会乱序、会重推 —— 没有这个条件的话，
    // 一条迟到的回调就能改写一笔已经结掉的退款。
    //
    // 注意：真接渠道之后 `approve` 应当把状态置为 `processing` 而不是像现在的
    // mock 那样直接 `success`,否则回调进来时这里已经没有可改的行了。
    sqlx::query(
        "UPDATE refund SET status='success', completed_at=NOW()
         WHERE (channel_refund_id=$1 OR id=$1) AND status IN ('approved','processing')",
    )
    .bind(channel_refund_id)
    .execute(pool)
    .await.db()?;
    Ok(())
}

pub async fn apply_failed(
    pool: &PgPool,
    channel_refund_id: &str,
    code: &str,
    msg: &str,
) -> Result<(), DomainError> {
    // 同上，而且后果更具体：一笔已经成功的退款被翻成 `failed` 之后，
    // `deny` 的守卫(`status IN ('requested','failed')`)就重新接受它 ——
    // 钱已经退回去、`amount_refunded_minor` 已经加过，单子却还能被「驳回」。
    sqlx::query(
        "UPDATE refund SET status='failed', failure_code=$1, failure_msg=$2
         WHERE (channel_refund_id=$3 OR id=$3) AND status IN ('approved','processing')",
    )
    .bind(code)
    .bind(msg)
    .bind(channel_refund_id)
    .execute(pool)
    .await.db()?;
    Ok(())
}

// ═══════════════════ 无家可归的钱 ═══════════════════

/// 取消了的订单上收着钱而没退 —— 把它退回去。
///
/// 【这条洞是这一轮评审里最贵的一条】（2026-09-03 资金审计 → 09-04 收口）。
/// 实测存量 486 单、¥48,082 全部 `refunded=0`，从 2026-08-16 一直到当天，
/// 而看板 11 个 KPI、风控、对账里都没有这条规则 ——
/// **钱进账、买家什么都没拿到，且没有任何一处会说出来**。
///
/// 上游那两个口子当天都堵了（订单取消会把在飞的支付撤下来、
/// 撤到一半的支付窗口一过就落成已撤销）。但堵住上游不等于账干净：
/// 渠道竞态仍然会让一笔钱落在已取消的订单上（`Cancelling => Success`
/// 是状态机明写的一条），而那时钱是真的在渠道那边，必须记上。
///
/// **所以闭环放在扫描里，不挂在那条罕见路径上。** 挂钩的写法有两个洞：
/// 进程在「记账已提交、退款未发起」之间死掉，回调不会再来第二次
/// （重复回调会在状态守卫那里早早返回），于是那笔钱永远没人管；
/// 而历史存量本来就不经过任何钩子。扫描两样都收，且跑几遍是同一个结果。
///
/// **为什么系统自己批**：这里没有可判断的东西 —— 订单是取消的，
/// 买家一件东西都没拿到，钱只能回去。人工审批那一档是给「用户申请退款、
/// 运营要不要批」用的，而这一笔的成因在系统自己这一侧。
/// 让它排队等人批，就是把那 486 单又攒一遍。
///
/// 幂等：`status IN ('requested','success','refunded')` 的在途退款算作
/// 「已经在管了」，不再重复发起。
/// 交付不了的那几行，钱退回去。
///
/// 【`failed` 是终态，而终态之后没有人管这笔钱】（2026-09-06 三路验证 ·
/// 准备花钱的那一路）。履约里有两处把行标成 `failed`，两处的注释都写着
/// 「该退这一笔」：
///   · 御守 SKU 没挂村民 —— 交付不了
///   · 这位村民已经住着了，而这一笔又买了他一次
/// 标 `failed` 是对的（留 pending 的话单子永远停在「正在办」）。
/// 问题在下一步：`settle_order_in_tx` 数的是 `NOT IN ('done','failed')`，
/// 于是**一张全部失败的单照样翻成 `done`** —— 屏上写着「已完成」，
/// 钱收着，东西没有，而自动退款那一支只捞已取消的单。
/// 买家唯一的出路是协议里那句「任何一单都能申请」，而他根本不知道要去申请。
///
/// **为什么系统自己批**：跟 `refund_orphan_money` 同一个理由 ——
/// 这里没有可判断的东西。行标 failed 的成因全在系统这一侧
/// （配置错、重复买同一位），不是「买家反悔要不要通融」。
/// 让它排队等人批，等于把这些单攒起来。
///
/// **退多少**：那几行的实收。按 `line_subtotal - applied_discount` 算，
/// 再拿这一单的实收余额封顶 —— 券把一单减到只付一半时，
/// 按行原价退会退出比收到的还多的钱。
///
/// 幂等：跟兄弟那一支同一个判据，这一单上有在途/已成的退款就不再发。
pub async fn refund_undelivered_lines(pool: &PgPool) -> Result<u64, DomainError> {
    let 待退: Vec<(String, String, i64, i64)> = sqlx::query_as(
        "SELECT o.id, o.user_id,
                -- `SUM(bigint)` 在 Postgres 里回的是 NUMERIC，不是 INT8 ——
                -- sqlx 的解码是强类型的，不转一下当场报「mismatched types」
                (SELECT COALESCE(SUM(l.line_subtotal_minor - l.applied_discount_minor), 0)::int8
                   FROM order_line l
                  WHERE l.order_id = o.id AND l.fulfillment_status = 'failed'),
                COALESCE(o.amount_paid_minor,0) - COALESCE(o.amount_refunded_minor,0)
           FROM order_record o
          WHERE o.status IN ('paid','fulfilling','done')
            AND COALESCE(o.amount_paid_minor,0) > COALESCE(o.amount_refunded_minor,0)
            AND EXISTS (SELECT 1 FROM order_line l
                         WHERE l.order_id = o.id AND l.fulfillment_status = 'failed')
            AND NOT EXISTS (
                  SELECT 1 FROM refund r
                   WHERE r.order_id = o.id
                     AND r.status IN ('requested','success','refunded')
                )
          ORDER BY o.paid_at NULLS LAST
          LIMIT 200",
    )
    .fetch_all(pool)
    .await.db()?;

    let mut 退了 = 0u64;
    for (order_id, user_id, 那几行, 余) in 待退 {
        let 该退 = 那几行.min(余);
        if 该退 <= 0 {
            continue;
        }
        // 一单一单地走，一单失败不拖累别的 —— 同 `refund_orphan_money`
        let id = match request(
            pool, &order_id, &user_id, None, Some(该退),
            "undelivered", Some("这一单里有交付不了的东西 —— 系统自动退回那一部分"),
        ).await {
            Ok(id) => id,
            Err(e) => {
                tracing::warn!(order_id, 该退, %e, "交付不了的那几行：发起退款失败");
                continue;
            }
        };
        if let Err(e) = approve(pool, &id, &Actor::system()).await {
            tracing::warn!(order_id, refund_id = id, %e, "交付不了的那几行：退款批不下去");
            continue;
        }
        退了 += 1;
        tracing::info!(order_id, refund_id = id, 该退, "有交付不了的行，那一部分钱已自动退回");
    }
    Ok(退了)
}

pub async fn refund_orphan_money(pool: &PgPool) -> Result<u64, DomainError> {
    let 待退: Vec<(String, String, i64)> = sqlx::query_as(
        "SELECT o.id, o.user_id,
                COALESCE(o.amount_paid_minor,0) - COALESCE(o.amount_refunded_minor,0)
           FROM order_record o
          WHERE o.status='cancelled'
            AND COALESCE(o.amount_paid_minor,0) > COALESCE(o.amount_refunded_minor,0)
            AND NOT EXISTS (
                  SELECT 1 FROM refund r
                   WHERE r.order_id = o.id
                     AND r.status IN ('requested','success','refunded')
                )
          ORDER BY o.cancelled_at NULLS LAST
          LIMIT 200",
    )
    .fetch_all(pool)
    .await.db()?;

    let mut 退了 = 0u64;
    for (order_id, user_id, 余) in 待退 {
        if 余 <= 0 {
            continue;
        }
        /* 一单一单地走，一单失败不拖累别的 —— 这一支是清扫，
           它的价值在于「每一轮都把能退的退掉」，不在于原子性。 */
        let id = match request(
            pool, &order_id, &user_id, None, Some(余),
            "cancelled_with_money", Some("订单已取消而钱收着 —— 系统自动退回"),
        ).await {
            Ok(id) => id,
            Err(e) => {
                tracing::warn!(order_id, 余, %e, "无家可归的钱：发起退款失败");
                continue;
            }
        };
        if let Err(e) = approve(pool, &id, &Actor::system()).await {
            tracing::warn!(order_id, refund_id = id, %e, "无家可归的钱：退款批不下去");
            continue;
        }
        退了 += 1;
        tracing::info!(order_id, refund_id = id, 余, "订单取消了却收着钱，已自动退回");
    }
    Ok(退了)
}
