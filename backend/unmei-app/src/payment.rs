//! 支付用例。
//!
//! 发起支付本身要调 `PaymentAdapter`(渠道 SDK 在 `unmei-wx`),
//! 而 adapter 的挑选依赖各 binary 自己的 registry。所以这里把用例切成两半：
//! 落库的部分在这里，调渠道的部分留给调用方，中间用
//! [`PendingPayment`] / [`record_attempt`] 衔接。这样「写哪些表、幂等怎么做」
//! 仍然只有一份实现。

use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use unmei_domain::commerce::events::DomainEvent;
use unmei_domain::DomainError;

use crate::outbox;
use crate::DbResultExt;
use crate::{new_id, Actor};

/// 已在库里占好位、等着送去渠道下单的一笔支付。
#[derive(Debug, Clone)]
pub struct PendingPayment {
    pub payment_id: String,
    pub order_id: String,
    pub user_id: String,
    pub channel: String,
    pub amount_minor: i64,
    pub currency: String,
    pub expires_at: DateTime<Utc>,
}

/// 为订单发起一笔支付，落 `payment` 行。
///
/// 校验：订单存在 → 属主匹配 → 状态为 `unpaid` → 应付余额 > 0。
/// 金额取 `amount_total_minor - amount_paid_minor`,不信任调用方传的数。
///
/// **同一张单上已有一笔没过期的 pending 时，把那一笔原样还回去，不再建新的。**
///
/// 在这之前它只看订单状态：第一次建完 payment 之后订单仍是 `unpaid`,
/// 于是第二次照样放行。连点两次「去支付」就是两笔独立的 pending,每笔都是全额
/// (2026-08-23 实测：应付 19900 的单子上两笔各 19900)。幂等键挡不住 ——
/// 客户端每次点击生成一个新键，两次点击在服务端就是两次新操作。
///
/// 为什么是「还回去」而不是「拒绝」:用户点第二次的意思是「我要接着付这张单」,
/// 不是「我要再付一笔」。还回同一笔 pending,他拿到的是同一份下单参数，
/// 接着付就是了；拒绝(409)会让放弃支付的人等 30 分钟过期才能重来。
///
/// 换渠道是另一回事 —— 那是明确的动作：把旧的那笔作废，再建新的。
///
/// 并发由数据库兜底：`uq_payment_one_pending` 是 `payment(order_id) WHERE
/// status='pending'` 上的唯一索引。只靠这里「先查再写」的话，两个同时进来的
/// 请求会双双查到「没有 pending」然后双双插入。
pub async fn start(
    pool: &PgPool,
    order_id: &str,
    user_id: &str,
    channel: &str,
    channel_user_ref: Option<&str>,
) -> Result<PendingPayment, DomainError> {
    /* 风控(台账 D7)。这一处是钱真要动的地方，所以两个接线点里它更要紧。

       【规则要的两个字段一直没传进去】（2026-09-04）。
       上一版这里 `amount_minor` 与 `user_age_days` 都写死 `None`，
       而种子里三条规则有两条判的正是它们
       （`amount > 100000 AND user.age_days < 7`、退款那条按次数）——
       `build_env` 里那两个 `if let Some` 于是永远不成立，
       `amount` 跟 `user.age_days` 一次都没进过求值环境。

       也就是说：观察模式跑了，规则一条都命中不了，
       `risk_event` 测试库里实测 0 行 —— 而观察模式的全部意义
       就是「先看看这些规则真开起来会拦掉什么」。
       开关翻开那天，运营看到的命中率是 0，据此拍板。

       两个值都从库里取:金额是这一单的应付，账龄按 app_user.created_at 算。 */
    let 风控用: Option<(i64, i32)> = sqlx::query_as(
        "SELECT o.amount_total_minor,
                GREATEST(0, EXTRACT(DAY FROM NOW() - u.created_at))::int4
           FROM order_record o JOIN app_user u ON u.id = o.user_id
          WHERE o.id = $1",
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await.db()?;
    crate::risk::gate(pool, &crate::risk::RiskEvalContext {
        kind: "pre_pay".into(),
        user_id: Some(user_id.to_string()),
        order_id: Some(order_id.to_string()),
        payment_id: None,
        amount_minor: 风控用.map(|(a, _)| a),
        user_age_days: 风控用.map(|(_, d)| d),
        extras: serde_json::json!({ "channel": channel }),
    }).await?;

    /* 【region 从订单继承】（2026-09-03 第四轮评审 · 工程审计）。
       `payment` / `refund` / `shipment` 三张表都有 region 一列，
       而写它们的七个模块里六个【一次都没提过】这个字段 ——
       库里那一列有默认值 `'cn'`，于是从不报错、永远是 cn。
       后台每条查询按它过滤、11 个 KPI 与月报都按它分组，
       结果是 jp/kr/sea/na 四个区永远是 0，而没有任何东西会红。
       订单是唯一知道这笔生意属于哪个区的地方，从它那儿取。 */
    let order = sqlx::query(
        "SELECT user_id, status, amount_total_minor, amount_paid_minor, currency, region,
                expires_at <= NOW() AS 过期了
         FROM order_record WHERE id=$1",
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await.db()?
    .ok_or_else(|| DomainError::NotFound(format!("order {order_id}")))?;

    let owner: String = order.get("user_id");
    if owner != user_id {
        return Err(DomainError::NotFound(format!("order {order_id}")));
    }
    let status: String = order.get("status");
    if status != "unpaid" {
        return Err(DomainError::Conflict(format!("order status={status}，不可再发起支付")));
    }
    /* 【过了点就别再让人付了】（2026-09-06 三路验证 · 准备花钱的那一路）。
       这里原先只看 `order.status`。而清扫每 30 秒跑一轮 ——
       订单已过 `expires_at`、状态还挂在 `unpaid` 的那一段窗口里，
       支付照发；随后订单被清扫取消，成功回调仍然被接受
       （`Cancelling => Success` 是状态机明写的一条），
       最后由 `refund_orphan_money` 自动退回。
       链路是闭的，钱不会丢 —— 但在那几分钟里，屏上写着「已取消」，
       而人刚在微信里付过钱。那几分钟他会认为自己被吞了钱。
       倒计时是屏上给的承诺，服务端要认同一个时刻。 */
    let 过期了: bool = order.get("过期了");
    if 过期了 {
        return Err(DomainError::Conflict(
            "这一单已经过了三十分钟，付不了了 —— 想要的话再下一单就行".into(),
        ));
    }

    let total: i64 = order.get("amount_total_minor");
    let paid: i64 = order.get("amount_paid_minor");
    let due = total - paid;
    if due <= 0 {
        return Err(DomainError::Validation(format!("应付余额 {due} ≤ 0")));
    }
    let currency: String = order.get("currency");
    let region: String = order.get("region");

    let mut tx = pool.begin().await.db()?;

    /* 这张单上还有没有一笔没过期的 pending。
       `FOR UPDATE` 是为了跟同时进来的另一个请求排队 —— 唯一索引兜的是
       「最终插不进去」,这里排一下队是为了让第二个请求走到「还回去」那一支，
       而不是撞索引报一个看不懂的错。 */
    let live = sqlx::query(
        "SELECT id, channel, amount_minor, currency, expires_at
           FROM payment
          WHERE order_id=$1 AND status='pending' AND expires_at > NOW()
          FOR UPDATE",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await.db()?;

    if let Some(row) = live {
        let old_id: String = row.get("id");
        let old_channel: String = row.get("channel");
        let old_amount: i64 = row.get("amount_minor");

        // 同一个渠道、同样的金额 —— 就是刚才那一笔，原样还回去
        if old_channel == channel && old_amount == due {
            /* 读成非 Option 是有据的：`payment_pending_has_expiry` 保证
               pending / processing 的支付一定有到期时间(2026-09-02 迁移)。
               这一行以前配的是 `expires_at IS NULL OR ...` 的 WHERE ——
               那句话说 NULL 可能存在，而这里读的是非 Option，
               撞上就 panic。删掉 `IS NULL OR` 并把约束写进库之后，
               两处说法才对上。 */
            let expires_at: DateTime<Utc> = row.get("expires_at");
            tx.commit().await.db()?;
            return Ok(PendingPayment {
                payment_id: old_id,
                order_id: order_id.to_string(),
                user_id: user_id.to_string(),
                channel: old_channel,
                amount_minor: old_amount,
                currency: row.get("currency"),
                expires_at,
            });
        }

        /* 渠道换了(或者中间落了一笔部分付款、应付变了)—— 那是另一件事，
           旧的那一笔就此作废。写清为什么：一笔支付凭空变成 expired,
           事后查账的人得看得出是被谁顶掉的。 */
        sqlx::query(
            "UPDATE payment
                SET status='expired',
                    audit_note = CASE WHEN audit_note='' THEN '' ELSE audit_note || ' | ' END
                                 || '被同一张单上新发起的支付顶掉（' || $2 || ' → ' || $3 || '）'
              WHERE id=$1",
        )
        .bind(&old_id)
        .bind(format!("{old_channel}/{old_amount}"))
        .bind(format!("{channel}/{due}"))
        .execute(&mut *tx)
        .await.db()?;
    }

    let payment_id = new_id("pay");
    let expires_at = Utc::now() + Duration::minutes(30);

    sqlx::query(
        r#"INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency, status,
                               channel_user_ref, expires_at, metadata_json, region)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, '{}'::jsonb, $9)"#,
    )
    .bind(&payment_id)
    .bind(order_id)
    .bind(user_id)
    .bind(channel)
    .bind(due)
    .bind(&currency)
    .bind(channel_user_ref)
    .bind(expires_at)
    .bind(&region)
    .execute(&mut *tx)
    .await.db()?;

    tx.commit().await.db()?;

    Ok(PendingPayment {
        payment_id,
        order_id: order_id.to_string(),
        user_id: user_id.to_string(),
        channel: channel.to_string(),
        amount_minor: due,
        currency,
        expires_at,
    })
}

/// 记一次渠道下单往返。调用方拿到 adapter 的返回后调。
pub async fn record_attempt(
    pool: &PgPool,
    payment_id: &str,
    request: Value,
    response: Value,
) -> Result<(), DomainError> {
    sqlx::query(
        r#"INSERT INTO payment_attempt(id, payment_id, attempt_no, request_payload_json, response_payload_json)
           VALUES ($1, $2,
                   COALESCE((SELECT MAX(attempt_no) FROM payment_attempt WHERE payment_id=$2), 0) + 1,
                   $3, $4)"#,
    )
    .bind(new_id("pa"))
    .bind(payment_id)
    .bind(request)
    .bind(response)
    .execute(pool)
    .await.db()?;
    Ok(())
}

/// 后台手工置失败。
pub async fn mark_failed(
    pool: &PgPool,
    payment_id: &str,
    code: &str,
    msg: &str,
    actor: &Actor,
) -> Result<(), DomainError> {
    let cur: Option<String> = sqlx::query_scalar("SELECT status FROM payment WHERE id=$1")
        .bind(payment_id)
        .fetch_optional(pool)
        .await.db()?;
    let cur = cur.ok_or_else(|| DomainError::NotFound(format!("payment {payment_id}")))?;
    if !["pending", "processing", "cancelling"].contains(&cur.as_str()) {
        return Err(DomainError::Conflict(format!("payment status={cur}，不可置失败")));
    }
    /* 【状态条件要写进 UPDATE 里】（2026-09-03 第四轮评审 · 工程审计）。
       上面那句 SELECT 判完状态，这句 UPDATE 却不带任何状态条件，
       两句之间也没有事务 —— 中间渠道回调把它推成 success，
       这句照样把它改成 failed。同一个文件里 `apply_failed`、
       `apply_expired`、`apply_succeeded` 三条都写着 `AND status IN (…)`，
       只有这一条没有。

       条件跟上面那句判据一字对齐；影响行数为 0 就是「中间被人改过了」，
       如实报冲突，不假装成功。 */
    let n = sqlx::query(
        "UPDATE payment SET status='failed', failure_code=$1, failure_msg=$2,
           audit_note = audit_note || E'\\n' || $3
         WHERE id=$4 AND status IN ('pending','processing','cancelling')",
    )
    .bind(code)
    .bind(msg)
    .bind(format!("{} mark_failed", actor.label()))
    .bind(payment_id)
    .execute(pool)
    .await.db()?
    .rows_affected();
    if n == 0 {
        return Err(DomainError::Conflict(format!(
            "payment {payment_id} 在这两步之间被改过了 —— 没有置成失败"
        )));
    }
    Ok(())
}

// ═══════════════════════════ 渠道回调 ═══════════════════════════

/// 渠道回调：支付成功。
///
/// `txn_id` 既可能是渠道流水号也可能是我们自己的 payment_id,
/// 两种都认(旧实现的行为，保留)。
///
/// **幂等**。渠道重推同一笔回调是常态而不是异常 —— 微信支付在 24 小时内
/// 最多重推 15 次，直到拿到成功响应。两道防线：
///
/// 1. `payment_event` 上的 `uq_payment_event_channel_eid`
///    (`(channel, channel_event_id)` 部分唯一索引)配 `ON CONFLICT DO NOTHING`
/// 2. `payment` 的 UPDATE 带 `status IN ('pending','processing')` 前置条件，
///    已经 success 的不会被再加一次钱
///
/// 第 1 条以前漏了 `ON CONFLICT` —— 索引建了、注释也写着「幂等」,但重推会撞
/// 唯一约束直接报错，于是渠道收到 500、继续重推，循环到重试耗尽。
/// 由 `apply_succeeded_moves_order_to_paid_and_is_idempotent` 这条测试钉住。
/// ★ 两个标识各归各位(2026-08-17 修):
/// `our_ref` 是我方单号(= `payment.id`,微信的 `out_trade_no`),**定位用它**;
/// `channel_txn_id` 是渠道流水号(微信的 `transaction_id`),**只用来落档对账**。
///
/// 从前这里只有一个 `txn_id`,匹配写成 `channel_txn_id=$2 OR id=$2`。
/// 真回调传进来的是渠道流水号 —— 它既不等于我方 payment id,
/// `channel_txn_id` 那一列此刻又是 NULL,于是**两个条件都不成立、
/// UPDATE 影响 0 行、这笔支付永远不会入账**。mock 把两者填成同一个值，
/// 所以测试一直全绿，只有真接渠道那天才会暴露。
pub async fn apply_succeeded(
    pool: &PgPool,
    our_ref: &str,
    channel_txn_id: Option<&str>,
    paid_at: DateTime<Utc>,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    // 去重键优先用渠道流水号：渠道重推的是同一笔交易，它才是那一笔的身份。
    // 渠道没给就退回我方单号 —— 一笔支付只成功一次，按单号去重同样成立。
    let event_key = channel_txn_id.unwrap_or(our_ref);
    sqlx::query(
        r#"INSERT INTO payment_event(id, payment_id, kind, channel, channel_event_id, payload_json, received_at)
           SELECT $1, p.id, 'PaymentSucceededByCallback', p.channel, $3, '{}'::jsonb, NOW()
           FROM payment p WHERE p.id = $2
           LIMIT 1
           ON CONFLICT (channel, channel_event_id) WHERE channel_event_id IS NOT NULL
           DO NOTHING"#,
    )
    .bind(new_id("pe"))
    .bind(our_ref)
    .bind(event_key)
    .execute(&mut *tx)
    .await.db()?;

    // 只有**真的**从 pending/processing 翻到 success 的那一次，才动订单金额。
    // RETURNING 把「这次到底改没改到行」变成可判断的值 —— 没有它就只能盲目累加。
    /* 【`cancelling` 也要收】（2026-09-03）。订单取消时这笔支付被转成
       `cancelling`（见 `cancel_in_flight`），而渠道那一侧可能已经把钱收了 ——
       状态机里 `Cancelling => [Cancelled, Success]` 写的就是这条竞态。

       不收的话，那笔钱在系统里【不存在】：payment 停在 cancelling、
       订单金额不动、总账没有它。而钱真的在渠道那边。
       `a_late_success_does_not_resurrect_a_cancelled_order` 这条测试
       钉的正是「订单不复活，但钱要记下来 —— 看不见的钱才是麻烦」。 */
    /* 【`expired` 也要收】（2026-09-07，台账 `pay-channel-switch` 那一条）。
       换支付方式时（微信 jsapi → h5）旧那一笔被就地标成 `expired`
       （见 `start` 里「被同一张单上新发起的支付顶掉」那一段），
       而**渠道那一侧的下单可能已经发出去、用户仍然付得出去**。
       这笔钱回来时，旧判据只认 pending/processing/cancelling，
       于是它落进「渠道重推，已忽略」那一支:`payment_event` 记了一行,
       `channel_txn_id` 不写、订单不入账、接口回 200 ——
       **那笔钱在系统里不存在**，要等第二天对账把它列成
       `missing_in_internal`，再等人去处理。

       `expired` 说的是「我们不等了」，不是「渠道撤单了」——
       渠道说收到了，那钱就是真的。这跟 `cancelling` 当初被加进来
       是同一个理由（上面那段注释:「不收的话，那笔钱在系统里【不存在】」）。

       真要在作废之前把渠道那一笔关掉，得接每个渠道各自的撤单接口、
       而撤单本身会失败 —— 那是独立的一件事。在它之前，
       至少不能让收到的钱查无此笔。 */
    let applied: Option<(String, String, i64)> = sqlx::query_as(
        "UPDATE payment SET status='success', paid_at=$1,
           channel_txn_id=COALESCE($3, channel_txn_id)
         WHERE id=$2 AND status IN ('pending','processing','cancelling','expired')
         RETURNING id, order_id, amount_minor",
    )
    .bind(paid_at)
    .bind(our_ref)
    .bind(channel_txn_id)
    .fetch_optional(&mut *tx)
    .await.db()?;

    let Some((payment_id, order_id, amount_minor)) = applied else {
        // 这笔早就入过账了。渠道重推而已，不是错误 —— 提交空事务，回 200 让它别再推。
        tx.commit().await.db()?;
        tracing::debug!(our_ref, "payment.success 重复回调，已忽略");
        return Ok(());
    };

    // 旧实现这条 UPDATE 挂在 `FROM payment p` 上，没有任何前置条件，
    // 每收到一次回调就往订单上加一次钱。微信 24 小时内最多重推 15 次，
    // 于是一笔 199 元的订单能被记成实付 2985 元。
    // 由 `apply_succeeded_moves_order_to_paid_and_is_idempotent` 钉住。
    /* 金额照加 —— 钱确实到了，那是事实。但**状态只在状态机允许时才动**。
       `OrderStatus::allowed_next` 里 `Cancelled => &[]`：已取消的订单没有
       任何允许的下一个状态。而这条 SQL 原来无条件 `THEN 'paid'`，于是
       「下单 → 发起支付 → 取消 → 迟到的支付成功」会把已取消的订单改写回
       `paid`，接着照常触发履约（2026-08-18 实测：状态 cancelled → paid，
       实付 9900）。

       只有 `Unpaid` 与 `Disputed` 能走到 `Paid`（同一张表里写着），
       所以条件就是这两个。已取消的单会停在 `cancelled` 且实付 > 0 ——
       那正是「钱到了但没有归宿」，该被看见，而不是被一次静默的状态改写抹平
       （台账里那条待拍板说的就是这种钱）。 */
    /* 【这一单吃不下这笔钱的时候】（2026-09-07）。
       `order_paid_not_over_total`（实付 ≤ 应付）是 2026-08-16 那次超收之后
       立的规矩，它是对的:一张单的「实付」不该超过它值多少钱。
       而收 `expired` 那一笔之后，「两笔都付了」这件事变得够得着了 ——
       旧那一笔与新那一笔各付一次，加起来就顶破它。

       旧写法无条件 `+ $1`，指望 CHECK 去炸 —— 一炸整个事务回滚，
       于是这笔支付连 `success` 都记不上，退回到「钱查无此笔」，
       正是这次要修的那件事本身。

       所以分开:**这笔钱是真的，`payment` 那一行照记**（上面已经记了）;
       而订单只吃得下它欠的那部分。吃不下的那部分不往订单上加 ——
       它不是这一单的货款，是我们手上不欠的钱，
       由「收了钱而订单不欠这笔」那条待办去处理（看板上摆着）。
       `RETURNING` 分两种情形，所以先问一句吃不吃得下。 */
    let 吃得下: bool = sqlx::query_scalar(
        "SELECT amount_paid_minor + $1 <= amount_total_minor
           FROM order_record WHERE id = $2",
    )
    .bind(amount_minor)
    .bind(&order_id)
    .fetch_one(&mut *tx)
    .await.db()?;
    if !吃得下 {
        tracing::warn!(
            payment_id, order_id, amount_minor,
            "收到一笔这一单不欠的钱 —— payment 记成 success，订单金额不动，等人处理"
        );
        sqlx::query(
            "UPDATE payment SET audit_note = CASE WHEN audit_note='' THEN ''                                                   ELSE audit_note || ' | ' END                               || '这一单已经付清，这笔是多收的 —— 订单金额未加'               WHERE id=$1",
        )
        .bind(&payment_id)
        .execute(&mut *tx)
        .await.db()?;
        tx.commit().await.db()?;
        return Ok(());
    }
    let order_status: String = sqlx::query_scalar(
        r#"UPDATE order_record SET
             amount_paid_minor = amount_paid_minor + $1,
             status = CASE WHEN amount_paid_minor + $1 >= amount_total_minor
                             AND status IN ('unpaid','disputed')
                           THEN 'paid' ELSE status END,
             paid_at = COALESCE(paid_at, NOW())
           WHERE id = $2
           RETURNING status"#,
    )
    .bind(amount_minor)
    .bind(&order_id)
    .fetch_one(&mut *tx)
    .await.db()?;

    // 订单这一刻才付清 → 发 OrderPaid,下游 dispatcher 据此推进履约。
    //
    // 这条事件原先只有 payment_sweep worker 会发，渠道回调这条路径不发 ——
    // 也就是说真接入微信之后，走 webhook 进来的支付**永远不会触发履约**。
    // 两条路径本来就该是同一件事，所以合并到这里。
    if order_status == "paid" {
        /* 【钱到账了，券这时候才算用掉】。下单时只是锁住 ——
           在付款成功之前核销的话，一笔取消掉的订单会把券吃掉，
           而用户既没花钱也没了券。

           跑在收款这个事务里：钱记上了、券核销了、活动预算也扣了，
           要么一起成、要么一起不成。 */
        let 折扣: i64 = sqlx::query_scalar(
            "SELECT COALESCE(amount_discount_minor, 0) FROM order_record WHERE id=$1",
        )
        .bind(&order_id)
        .fetch_one(&mut *tx)
        .await.db()?;
        let 张数 = crate::coupon::redeem_for_order(&mut tx, &order_id, 折扣).await?;
        if 张数 > 0 {
            tracing::info!(order_id, 张数, 折扣, "优惠券已核销");
        }

        outbox::write(
            &mut *tx,
            &DomainEvent::OrderPaid {
                order_id: order_id.clone(),
                payment_id: Some(payment_id.clone()),
                occurred_at: paid_at,
            },
        )
        .await?;
    }

    tx.commit().await.db()?;
    tracing::info!(our_ref, channel_txn_id, order_id, amount_minor, order_status, "payment.success");
    Ok(())
}

/// 同 [`apply_succeeded`]:按我方单号定位。
pub async fn apply_failed(pool: &PgPool, our_ref: &str, code: &str, msg: &str) -> Result<(), DomainError> {
    // 只翻【还在飞】的那一笔。渠道会乱序、会重推，`payment_sweep` 也可能轮到
    // 一条陈旧的渠道记录 —— 没有这个条件的话，一条迟到的失败回调就能把
    // 已经成功的一笔改成 failed,而订单那边仍然是 paid。对账、退款、后台
    // 看到的都是「付过钱但支付失败」。
    //
    // 这不是新规矩：`apply_succeeded` / `apply_expired` 都带着同样的守卫，
    // 后台手工那条 `mark_failed` 更是直接返回 Conflict。只有这里漏了。
    sqlx::query(
        "UPDATE payment SET status='failed', failure_code=$1, failure_msg=$2
         WHERE id=$3 AND status IN ('pending','processing')",
    )
    .bind(code)
    .bind(msg)
    .bind(our_ref)
    .execute(pool)
    .await.db()?;
    Ok(())
}

/// 该向渠道问一句「这笔到底成没成」的支付。
///
/// 返回 `(payment_id, channel)`，调用方（`payment_query_sweeper`）拿它挨个去问。
/// 这段 SQL 原来长在 worker 里 —— 而它挑的是【哪些钱还够得着】，
/// 是业务判断不是调度细节，所以跟 [`expire_overdue`] 一样搬回用例层，
/// 也才钉得住（worker 那一层没有测试碰得到）。
///
/// 四个状态各有各的理由：
/// - `pending` / `processing` —— 本来就在等回音；
/// - `cancelling` —— 撤到一半，渠道仍可能说「已经付了」，状态机里
///   `Cancelling => [Cancelled, Success]` 写的就是这条竞态；
/// - `expired` —— 换支付方式时被顶掉的那一笔（见 [`start`] 里
///   「被同一张单上新发起的支付顶掉」）。它是我们不等了，不是渠道撤单了，
///   人在旧那一页上照样付得出去。
///
/// 【窗口那一条把两种 `expired` 分开】：被顶掉的那笔 `expires_at` 还在未来
/// （它上一秒还是活的），自然到期的那些是 `expire_overdue` 按
/// `expires_at < NOW()` 翻的状态，落在窗口外 —— 所以不会被永远问下去。
///
/// 一分钟那一条是「先给回调一点时间」，不是节流。
pub async fn to_ask_channel_about(pool: &PgPool) -> Result<Vec<(String, String)>, DomainError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, channel
           FROM payment
          WHERE status IN ('pending','processing','cancelling','expired')
            AND created_at < NOW() - INTERVAL '1 minute'
            AND expires_at > NOW()
          ORDER BY created_at ASC
          LIMIT 50",
    )
    .fetch_all(pool)
    .await.db()?;
    Ok(rows)
}

/// 到点还没结算的，批量置为过期。返回过期了几笔。
///
/// 这段 SQL 原来长在 `unmei-api/src/workers/payment_sweep.rs` 里 —— 那是
/// 业务写操作，只能有一份实现、且该在用例层（`recon.rs` 的注释就是这么写的）。
/// 单笔那条 [`apply_expired`] 走渠道回调，这条走本地超时，两条是同一件事的
/// 两个来源，放在一起才看得出它们用的是同一个状态守卫。
pub async fn expire_overdue(pool: &PgPool) -> Result<u64, DomainError> {
    let n = sqlx::query(
        "UPDATE payment SET status='expired'
         WHERE status IN ('pending','processing')
           AND expires_at IS NOT NULL AND expires_at < NOW()",
    )
    .execute(pool)
    .await.db()?
    .rows_affected();
    Ok(n)
}

/// 撤到一半的支付，窗口过了就是真撤下来了。
///
/// 【`cancelling` 原先是个进得去出不来的状态】（2026-09-04）。
/// 同一天早上加的 `cancel_in_flight` 把在飞的支付转成 `cancelling`，
/// 而状态机里写着 `Cancelling => [Cancelled, Success]` ——
/// `Success` 那条路通（渠道竞态，`apply_succeeded` 认这个状态），
/// 而 **`Cancelled` 全仓没有一处写**：实测 20 笔卡在那儿，其中 18 笔
/// 窗口早过了。这正是这一轮评审里反复遇到的那个形状
/// （状态声明了、没有路走到），而它是我自己当天新造的一个。
///
/// 判据是【窗口过了】：过了窗口渠道就再也不会说这笔成了，
/// 所以「撤下来了」这件事此刻才成为定论。
/// 窗口没过的不动 —— 那两笔还可能被付掉，而那笔钱要记上。
///
/// `expires_at IS NULL` 的也不动:没有窗口就没有「过了」这回事，
/// 硬给它定一个宽限期等于替渠道拍板。这种行今天一笔都没有
/// （建支付时必写 expires_at），真出现了该由它露头来问，不该被这里猜掉。
pub async fn settle_cancelled(pool: &PgPool) -> Result<u64, DomainError> {
    let n = sqlx::query(
        "UPDATE payment SET status='cancelled'
         WHERE status='cancelling'
           AND expires_at IS NOT NULL AND expires_at < NOW()",
    )
    .execute(pool)
    .await.db()?
    .rows_affected();
    if n > 0 {
        tracing::info!(n, "窗口过了，撤到一半的支付落成已撤销");
    }
    Ok(n)
}

/// 订单取消 / 过期时，把这一单上还在飞的支付撤下来。
///
/// 【`order::cancel` 一处都没碰过支付】（2026-09-03 五路评审 · 资金审计）。
/// 它改订单、放券、写事件，而已经发起的那笔 pending 支付原封不动地活着，
/// 最长还能付 30 分钟。付成之后 `apply_succeeded` 的金额那条 UPDATE 是
/// 无条件累加的，于是订单停在 `cancelled` 而 `amount_paid_minor` 变成全额。
///
/// 实测存量：486 单收了钱却是取消状态，合计 ¥48,082，全部 `refunded=0`，
/// 从 2026-08-16 一直到当天（当天新增 64 单）。**钱进账而买家什么都没拿到，
/// 且没有任何一处会说出来** —— 看板 11 个 KPI、风控、对账里都没有这条规则。
///
/// 转成 `cancelling` 而不是直接 `cancelled`：
/// - `payment_sweep` 只查 `pending / processing`，转过去它就不再自动结算
/// - 而 `apply_succeeded` 仍然接受 `cancelling`（状态机里那句注释写着
///   「渠道竞态：取消请求中可能已经被付掉」）—— 钱真到了就还是要记上，
///   那种「钱到了但没有归宿」该被看见，不该被一个状态守卫吞掉
///
/// 跑在调用方的事务里：订单转 cancelled 与支付转 cancelling 要么一起成、
/// 要么一起不成。中间断开的话，取消了的单子上挂着一笔还会自动结算的支付。
pub async fn cancel_in_flight(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    order_id: &str,
    why: &str,
) -> Result<u64, DomainError> {
    let n = sqlx::query(
        "UPDATE payment SET status='cancelling',
           audit_note = COALESCE(audit_note, '') || E'\n' || $2
         WHERE order_id=$1 AND status IN ('pending','processing')",
    )
    .bind(order_id)
    .bind(why)
    .execute(&mut **tx)
    .await.db()?
    .rows_affected();
    if n > 0 {
        tracing::info!(order_id, n, why, "订单没了，把在飞的支付撤下来");
    }
    Ok(n)
}

/// 同 [`apply_succeeded`]:按我方单号定位。
pub async fn apply_expired(pool: &PgPool, our_ref: &str) -> Result<(), DomainError> {
    sqlx::query(
        "UPDATE payment SET status='expired'
         WHERE id=$1 AND status IN ('pending','processing')",
    )
    .bind(our_ref)
    .execute(pool)
    .await.db()?;
    Ok(())
}

/// 支付发起后返回给客户端的载荷，原样透传 adapter 的 outcome。
pub fn outcome_payload(payment_id: &str, outcome: &impl serde::Serialize) -> Result<Value, DomainError> {
    Ok(json!({
        "payment_id": payment_id,
        "outcome": serde_json::to_value(outcome)?,
    }))
}
