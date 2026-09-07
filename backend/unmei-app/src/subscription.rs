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
    /// 这一期的单开出来了，**钱还没收**（2026-09-07 起）。
    ///
    /// 【为什么不是「续上了」】。这里原先直接插一条 `status='success'` 的
    /// payment —— 渠道那边一分钱都没动过，而系统说收到了：订单翻 paid、
    /// 香照发、账上记一笔收入。那是今早修的那个洞的镜像，
    /// 而且这一面更糟:白送东西，账还说收过钱。
    ///
    /// 【为什么不自动扣】。微信小程序支付**没有**通用的免密代扣 ——
    /// 要签「委托扣款」那套，需要单独的商户产品与签约。
    /// `unmei-wx` 自己也是这么说的：`capabilities().off_session_charge = false`，
    /// 而那个字段在 2026-09-07 之前全仓没有一处读过它。
    ///
    /// 所以这一档的真实形态是：**每一期我们开一张单，人来付，付了才发那一盒**。
    /// 屏上也照这个说（product / confirm / policy / subs 四处同日改）。
    /// 哪天真有渠道能自动扣，接的是「拿这张单去扣」那一步 ——
    /// 开单这件事不用改，那才是这一层该管的事。
    AwaitingPayment { invoice_id: String, order_id: String, amount_minor: i64 },
    /// 用户之前点过「到期不续」,到点了 —— 不收钱,置 cancelled
    StoppedAtPeriodEnd,
    /// 套餐没有激活价,收不了 —— **订阅到此为止**（2026-09-04 起）。
    ///
    /// 这一行原先写的是「不再重试」，而那句话只描述了它止住的东西：
    /// 重试止住了，服务没止住 —— 订阅留在 active，人照用、钱不再收，
    /// 而止住重试之后它再也不会被任何东西看到一眼。
    Unpriced,
    /// 这一档是「按你缺的那一样配」的，而他还没填出生时间 ——
    /// **这一期不扣钱、不建单**（2026-09-07）。
    ///
    /// 收了钱按默认款发出去，正是这一轮反复遇到的那个形状：
    /// 屏上答应「按你缺的那一味配」，而箱子里装的是通货。
    /// 不扣钱也不能就此不管 —— 走的是跟扣款失败同一道阶梯
    /// （明天再试 / 三天 / 七天 → past_due → grace → expired），
    /// 屏上照 `last_failure_code` 说清楚该他做什么。
    NeedsYongshen,
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
/// **「到期了没有」在这里判断**（2026-08-25 改）。周期还没走完就返回
/// [`RenewOutcome::NotDue`]，一分钱不收、什么都不建。
///
/// 原先它信调用方：`workers/subscription_billing.rs` 筛
/// `next_billing_attempt_at <= NOW()`，这里只复核状态与「到期不续」标记。
/// 后果是同一笔订阅连着调两次会开出两张发票、两笔订单，也就是扣两次
/// （2026-08-24 实测）。`FOR UPDATE OF s` 只保证两次串行，不保证第二次
/// 会因为「刚才已经续过」而退出 —— 因为根本没有那一问。
///
/// 当时没出事，只是因为那个 worker 单实例、顺序处理，一个 id 一轮只取一次。
/// **那是部署形态在兜底，不是代码在兜底** —— 多起一个实例、或者后台加一颗
/// 「立即续费」按钮，这就是一次重复扣款。一个只在某种部署下成立的不变式，
/// 迟早会在换部署的那天塌掉，而塌下来的形态是扣两次钱。
///
/// 数据库那一侧再说一遍同一件事：`uq_sub_invoice_period` 是
/// `subscription_invoice(subscription_id, period_start)` 上的唯一索引。
///
/// 「到期不续」的判定排在这一问【后面】：那句话的意思是「到期时停」，
/// 不是「现在就停」。没到期就调它，订阅照旧活着。
pub async fn renew_due(pool: &PgPool, subscription_id: &str) -> Result<RenewOutcome, DomainError> {
    let mut tx = pool.begin().await.db()?;

    // FOR UPDATE:同一笔订阅不会被两个 tick 同时续
    /* 【续费取价要跟下单一样看区与平台】（2026-09-03 五路评审 · 资金审计）。
       上一版这段 LATERAL 只按 sku_id 取价，不带 region、不带 platform ——
       而下单那条路（`order::create`）两个都带。同一个 sku 在两个区
       挂着两条在架价时，`ORDER BY effective_from DESC` 挑到哪一条
       全看谁后生效:一笔 jp 订阅按 cn 的价扣钱，而且币种也跟着错。

       今天库里订阅 sku 的在架价恰好只有 `cn`/`all` 一种，所以还没扣错过 ——
       但那是数据碰巧，不是代码守住了。多开一个区就当场错。 */
    let row = sqlx::query(
        r#"SELECT s.user_id, s.status, s.current_period_end, s.cancel_at_period_end,
                  s.region, s.source_channel,
                  p.billing_period, p.sku_id,
                  pb.price_minor, pb.currency
           FROM subscription s
           JOIN plan p ON p.id = s.plan_id
           LEFT JOIN LATERAL (
             SELECT price_minor, currency FROM price_book
             WHERE sku_id = p.sku_id AND status='active'
               AND region IN (s.region, 'global')
               AND platform IN (s.source_channel, 'all')
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
    let 区: String = row.get("region");
    if !["active", "past_due", "trialing"].contains(&status.as_str()) {
        tx.commit().await.db()?;
        return Ok(RenewOutcome::NotDue);
    }

    /* 这一期走完了没有。走完了才谈收钱 —— 见上面文档里那一段。
       续费失败的重试够得着：失败时 current_period_end 没有前进，仍然在过去。 */
    let current_period_end: DateTime<Utc> = row.get("current_period_end");
    if current_period_end > Utc::now() {
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
        /* 【无价 = 收不了钱 = 服务不能继续】（2026-09-04）。
           上一版只清掉重试时间就返回，订阅【留在 active】——
           而走到这一行时周期已经过了（上面那道 `current_period_end > now`
           已经把没到期的挡掉了）。也就是说：套餐没价，而人还在用，
           永远不再扣一分钱，也永远不会到期。

           这一支原先看着是对的，因为「清掉重试时间」确实止住了每 5 分钟
           重试到永远那个毛病 —— 止住的是重试，不是服务。
           而止住重试之后，这条订阅就再也不会被任何东西看到一眼
           （worker 的捞取条件同一天才补上「周期过了也捞」）。

           终局是 `cancelled`:状态机里 `Active => [PastDue, Cancelled, Paused]`，
           Active 到不了 Expired。用户已经付过的那一期照旧用完 ——
           走到这里说明它已经用完了。
           事件照发:「停了」这件事下游要知道，跟到期不续那一支一样。 */
        sqlx::query(
            "UPDATE subscription SET status='cancelled', cancelled_at=NOW(),
               next_billing_attempt_at=NULL WHERE id=$1",
        )
            .bind(subscription_id)
            .execute(&mut *tx)
            .await.db()?;
        outbox::write(
            &mut *tx,
            &DomainEvent::SubscriptionCancelled {
                subscription_id: subscription_id.to_string(),
                occurred_at: Utc::now(),
            },
        )
        .await?;
        tx.commit().await.db()?;
        tracing::warn!(subscription_id, "套餐无激活价，收不了钱 —— 订阅到此为止");
        return Ok(RenewOutcome::Unpriced);
    };

    let user_id: String = row.get("user_id");
    let currency: String = row.get("currency");
    let billing_period: String = row.get("billing_period");
    let period_start: DateTime<Utc> = current_period_end;
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
                // region 从订阅取 —— 见 payment.rs 那段注释
                r#"INSERT INTO subscription_invoice(
                     id, subscription_id, period_start, period_end, amount_minor, currency,
                     status, attempt_count, next_attempt_at, region
                   ) VALUES ($1, $2, $3, $4, $5, $6, 'open', 0, NOW(),
                             COALESCE((SELECT region FROM subscription WHERE id=$2), 'cn'))"#,
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

    /* 【续费这一期也要知道他缺什么】（2026-09-07 · 门禁 check-yongshen-recorded
       在一轮全量上抓到 `ord-renew-c925…`）。
       下单那条路 2026-09-07 早上接上了用神，而续费这条路**不经过 `order::create`**
       —— 它自己拼 order_record + order_line，于是第一盒记着照谁的盘配，
       之后每一盒都不记：钱照扣，装箱的人照默认款发。

       拿不到就【这一期不扣】。理由跟下单那侧整单拒掉是同一条：
       按默认款发出去比不发更糟，因为买家会以为这就是他买的东西。 */
    let sku_id: String = row.get("sku_id");
    let 额外 = match crate::order::配的是哪一样(&mut tx, &user_id, &[sku_id.clone()]).await? {
        crate::order::配法::不用配 => serde_json::json!({}),
        crate::order::配法::就配这个(v) => v,
        crate::order::配法::还不知道你缺什么 => {
            /* 【明天再来问一次，别五分钟一次】。这不是扣款失败，
               所以不走 dunning 那道阶梯（那道阶梯的终点是 expired，
               而这一份订阅没有欠费，凭什么到期）——
               它等的是一件人随时能补上的事，补上了下一轮就续得动。
               屏上照 `last_failure_code` 说清该他做什么，不叫他干等。 */
            sqlx::query(
                "UPDATE subscription
                    SET next_billing_attempt_at = NOW() + INTERVAL '1 day',
                        last_failure_code = 'need_yongshen',
                        last_failure_reason = '这一档按用神配，而他没有在用的本命（或那一份还没排出盘）',
                        updated_at = NOW()
                  WHERE id = $1",
            )
            .bind(subscription_id)
            .execute(&mut *tx)
            .await.db()?;
            tx.commit().await.db()?;
            tracing::warn!(subscription_id, "这一档要按用神配，而他没有在用的本命 —— 这一期不扣钱");
            return Ok(RenewOutcome::NeedsYongshen);
        }
    };

    /* 【这一期的单已经开过就还那一张】。发票是复用的（上面那一段），
       而订单原先每调一次就新建一张 —— 从前看不出来，是因为那时
       第一次调用就把周期推到了未来，第二次进不到这儿。
       现在周期要等钱到才动，「同一期被问两次」变成了常态
       （worker 每天问一次，人也可能自己按「去付这一期」）。 */
    let 已经开过: Option<String> = sqlx::query_scalar(
        "SELECT id FROM order_record
          WHERE source_kind='subscription_renew' AND source_ref_id=$1
            AND status IN ('unpaid','paid','fulfilling','done')
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&invoice_id)
    .fetch_optional(&mut *tx)
    .await.db()?;
    if let Some(order_id) = 已经开过 {
        tx.commit().await.db()?;
        return Ok(RenewOutcome::AwaitingPayment { invoice_id, order_id, amount_minor });
    }

    let order_id = new_id("ord-renew");
    sqlx::query(
        /* 【开出来是待付的】（2026-09-07）。这里原先直接写 `'paid'` 并把
           实付写满 —— 配合底下那条凭空造的 success payment，
           一张没人付过钱的单从建出来就是「已付」。 */
        r#"INSERT INTO order_record(
             id, user_id, channel_origin, currency,
             amount_subtotal_minor, amount_total_minor, amount_paid_minor,
             status, source_kind, source_ref_id, region, expires_at
           ) VALUES ($1, $2, 'system', $3, $4, $4, 0, 'unpaid', 'subscription_renew', $5,
                     $6, NOW() + INTERVAL '7 days')"#,
        // region 写死 'cn' 的那一版，把每一笔续费订单都记在 cn 账上 ——
        // 分区报表里 jp 的订阅收入会整个消失在 cn 那一行下面。
        // 订阅自己说了它属于哪个区，照它写。
        //
        // 到期给七天，不是三十分钟：三十分钟是「人正站在收银台前」那种单，
        // 而这一张是我们主动开给他的，他下次打开 app 才看得见。
    )
    .bind(&order_id)
    .bind(&user_id)
    .bind(&currency)
    .bind(amount_minor)
    .bind(&invoice_id)
    .bind(&区)
    .execute(&mut *tx)
    .await.db()?;

    /* 【续费订单要有行，否则这一期什么都不发】（2026-09-05 · 一味香按月送）。
       这里原先只建 `order_record`,**一行 order_line 都不插** ——
       于是每期扣了钱，履约那一侧无事可做:`apply_order_paid` 取的正是
       `order_line`,取到空数组就直接去结算订单。
       黄金会员「买了什么也不发生」的机械原因有两层，这是第二层
       （第一层是压根没有开通，见 fulfillment.rs 那一段）。

       发的就是套餐自己那个 sku —— 它的商品是 shipping，所以履约那一支
       会给这一期开一张包裹。也正因为走的是同一个 sku，那边才需要
       「已经订着就不再开一份」那道守卫。 */
    sqlx::query(
        r#"INSERT INTO order_line(id, order_id, line_no, sku_id, sku_snapshot_json,
                                  unit_price_minor, qty, line_subtotal_minor)
           SELECT $1, $2, 1, $3,
                  jsonb_build_object('sku_name', s.name, 'renewal', true),
                  $4, 1, $4
             FROM sku s WHERE s.id = $3"#,
    )
    .bind(new_id("oli-renew"))
    .bind(&order_id)
    .bind(&sku_id)
    .bind(amount_minor)
    .execute(&mut *tx)
    .await.db()?;

    /* 配法记在 `order_meta.extra_json` 上 —— 跟下单那条路同一个位置，
       装箱的人只认一处（`check-yongshen-recorded` 也只看那一处）。 */
    if 额外 != serde_json::json!({}) {
        sqlx::query(
            r#"INSERT INTO order_meta(order_id, extra_json) VALUES ($1, $2)
               ON CONFLICT (order_id) DO UPDATE SET extra_json = EXCLUDED.extra_json"#,
        )
        .bind(&order_id)
        .bind(&额外)
        .execute(&mut *tx)
        .await.db()?;
    }

    /* 【这里原先凭空造一笔 success 的 payment】（2026-09-07 拆掉）。
       渠道那边一分钱没动过，而系统说收到了 —— 订单翻 paid、香照发、
       总账记一笔收入。今早修的洞是「钱在渠道里而系统说没有」，
       这一处是它的镜像，且更糟：白送东西，账还说收过钱。

       现在这一步什么都不做。单开出来了，钱等人来付
       （`order::pay` → 渠道 → 回调 → `apply_succeeded` → OrderPaid），
       而周期与发票在**钱真到了**的时候才动（`这一期到账了`）。
       付款那条链一步都不新造 —— 用的就是第一次买那条。 */
    sqlx::query(
        /* 这一期该他付了。屏上照这个码说人话，并把「去付这一期」摆出来。

           【明天再问一次，不走 dunning 那道阶梯】。阶梯的终点是 expired，
           而这里没有「扣不成」这回事 —— 单开着，人什么时候付都算数。
           协议上那句写的也正是这个：「都不成就停在那儿等你来补」。
           发票只有一张（`status='open'` 时复用），订单也只有一张
           （上面那道「已经开过就还那一张」），所以「一直问」问的始终是同一期。 */
        r#"UPDATE subscription
              SET last_failure_code = 'needs_your_pay',
                  last_failure_reason = '这一期的单开出来了，等人来付（这个渠道不支持免密代扣）',
                  next_billing_attempt_at = NOW() + INTERVAL '1 day',
                  updated_at = NOW()
            WHERE id = $1"#,
    )
    .bind(subscription_id)
    .execute(&mut *tx)
    .await.db()?;

    tx.commit().await.db()?;
    tracing::info!(subscription_id, %order_id, amount_minor, "这一期的单开出来了，等他来付");

    Ok(RenewOutcome::AwaitingPayment { invoice_id, order_id, amount_minor })
}

/// 这一期的钱真到了 —— 周期往前推，发票结清。
///
/// 【为什么周期不在开单那一刻推】。推了就等于「收到了」：
/// 人没付钱，屏上却写着「续到下个月」，而香也照发。
/// 开单与到账是两件事，中间隔着一个人要不要掏钱的决定。
///
/// 由 `OrderPaid` 那条事件驱动（`workers/outbox.rs`）——
/// 跟履约、记账挂在同一条事件上，三者对同一笔钱说的是同一件事。
///
/// 幂等：`WHERE status='open'` 那一条挡住重复到账
/// （回调重推、sweeper 与 webhook 撞上）。
pub async fn 这一期到账了(pool: &PgPool, order_id: &str) -> Result<bool, DomainError> {
    let mut tx = pool.begin().await.db()?;
    /* 这一单是哪一期的。`source_ref_id` 在续费单上写的就是发票号
       （见上面建 order_record 那一段），不是订阅号 —— 认错了会把
       同一笔钱记到别的期上。 */
    let 这一期: Option<(String, String, DateTime<Utc>, DateTime<Utc>)> = sqlx::query_as(
        "SELECT i.id, i.subscription_id, i.period_start, i.period_end
           FROM order_record o
           JOIN subscription_invoice i ON i.id = o.source_ref_id
          WHERE o.id = $1 AND o.source_kind = 'subscription_renew' AND i.status = 'open'
          FOR UPDATE OF i",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await.db()?;
    let Some((invoice_id, subscription_id, period_start, period_end)) = 这一期 else {
        tx.commit().await.db()?;
        return Ok(false);
    };

    let payment_id: Option<String> = sqlx::query_scalar(
        "SELECT id FROM payment WHERE order_id=$1 AND status='success'
          ORDER BY paid_at DESC NULLS LAST LIMIT 1",
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await.db()?;

    sqlx::query(
        r#"UPDATE subscription_invoice SET status='paid', payment_id=$1,
             last_attempt_at=NOW(), next_attempt_at=NULL
           WHERE id=$2"#,
    )
    .bind(&payment_id)
    .bind(&invoice_id)
    .execute(&mut *tx)
    .await.db()?;

    sqlx::query(
        // 收上来一期就把「该你付了」那句话清掉 —— 留着的话屏上会一直
        // 挂着一句早就不成立的话
        r#"UPDATE subscription SET status='active',
             current_period_start=$1, current_period_end=$2, next_billing_attempt_at=$2,
             last_failure_code='', last_failure_reason='', updated_at=NOW()
           WHERE id=$3"#,
    )
    .bind(period_start)
    .bind(period_end)
    .bind(&subscription_id)
    .execute(&mut *tx)
    .await.db()?;

    outbox::write(
        &mut *tx,
        &DomainEvent::SubscriptionRenewed {
            subscription_id: subscription_id.clone(),
            period_end,
            occurred_at: Utc::now(),
        },
    )
    .await?;

    tx.commit().await.db()?;
    tracing::info!(%subscription_id, %order_id, "这一期收上来了，周期往前推");
    Ok(true)
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

    /* 【原因要落库】（2026-09-07）。这个参数从 2026-08 起就收着，
       而函数体里一次都没用它 —— 原因随那一行 warn 留在日志里，
       屏上「这期没扣成」没有下文，后台也答不出为什么。
       原文只给后台看：渠道那边的话可能很长、也可能带内部细节，
       上屏那一句由页面照 `last_failure_code` 自己说（check-error-leak）。 */
    sqlx::query(
        "UPDATE subscription
            SET last_failure_code = 'charge_failed',
                last_failure_reason = LEFT($1, 500),
                updated_at = NOW()
          WHERE id = $2",
    )
    .bind(reason)
    .bind(subscription_id)
    .execute(&mut *tx)
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
