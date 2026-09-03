//! 订单用例。
//!
//! 合并自两份旧实现，逐条取的是各自对的那一半：
//!
//! | 分歧点 | 旧路由 | 旧 PgOrderService | 这里 |
//! |---|---|---|---|
//! | 币种 | 硬编码 CNY,非 CNY 报错 | 从 price_book 读 | **读 price_book,且按 region / platform 挑** |
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
use crate::DbResultExt;
use crate::outbox;
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

/// 建单。整笔在一个事务里：订单 + 行 + meta + 审计事件 + outbox,失败全回滚。
///
/// **取价必须带 region 与 platform**。`price_book` 是按区域分行的：同一个 sku
/// 在 cn 是 CNY 4900、在 jp 是 JPY 1200。这里原先只按 `effective_from DESC`
/// 取最新的一行 —— 于是 `region=cn` 的用户下单下出一笔 **JPY 1200**,
/// 而商品页上写着 ¥49.00(2026-08-19 实测)。用户看到的价和被记的账不是同一个，
/// 这比报错糟得多：两边都「成功」了。
///
/// 挑法照 `routes/commerce.rs::get_product` 一直在用的那套：
/// `region IN (那个区， 'global')` + `platform IN (那个端， 'all')`。
/// 挑不出价就是 `sku 无激活价`,报错，不退到别的区的价上。
pub async fn create(pool: &PgPool, req: NewOrder) -> Result<CreatedOrder, DomainError> {
    if req.lines.is_empty() {
        return Err(DomainError::Validation("lines is empty".into()));
    }
    if let Some(bad) = req.lines.iter().find(|l| l.qty <= 0) {
        return Err(DomainError::Validation(format!("qty {} ≤ 0", bad.qty)));
    }

    /* ── 收了钱交不出东西的两笔，在这儿拦住 ────────────────────────
       两笔都不需要任何异常条件，正常点几下就到，而屏上还会告诉买家
       「这单到此为止」（2026-09-02 第三轮评审 · 转化路实跑到的）。

       一、【同一位不能请两回】。`residency::move_in_from_line` 是
          `ON CONFLICT (user_id, villager_id) DO NOTHING`，第二次回
          `AlreadyHome`;而 fulfillment.rs 只把 `is_new()` 写进
          `fulfillment_ref`，行照样标 `done` —— 钱收了，什么都没发生。

       二、【一条行只出一册，所以数量只能是 1】。`report::ensure_for_line`
          从头到尾没读过 `qty`。而确认屏对非 residency 的商品照常摆数量 ——
          说明书买两份，按两份收钱，出一份。

       【为什么在这儿，不在下面的定价循环里】。定价循环在事务里，
       而它前面还有一段「同一件东西已经有一笔没付的就还回去」的复用分支 ——
       写在循环里的话，已经住着的人再下单会被**还回一张旧的未付单**，
       守卫一次都不会跑到（这是写完第一版、测试当场红出来的）。
       拦截要在任何一条早退之前。

       为什么不在履约那一侧兜：那时钱已经收了，剩下的只有退款，而退款要人工。
       能在收钱之前说清楚的事，不该留到收钱之后。 */
    /* 【同一张单里不许出现同一位村民两次】（2026-09-02 第四轮评审 · 工程审计）。
       下面那个循环是【逐行独立】判的：每一行各自查「这位是不是已经住着」。
       而阿云名下在架的 SKU 有三百多件 —— 两个不同的 sku 都指着他，
       两行各自都合法，加起来收 ¥198 只搬进来一个人。
       审计实测：`sku-oma-t46166-11` + `sku-oma-t25287-13` 回 19800。
       所以在逐行判之前，先把这一单内部的重复挑出来。 */
    let mut 这单里的村民: Vec<String> = Vec::new();
    for l in &req.lines {
        let 谁: Option<String> = sqlx::query_scalar(
            "SELECT s.villager_id FROM sku s JOIN product p ON p.id = s.product_id
              WHERE s.id = $1 AND p.fulfillment_kind = 'residency'",
        ).bind(&l.sku_id).fetch_optional(pool).await.db()?.flatten();
        if let Some(v) = 谁 {
            if 这单里的村民.contains(&v) {
                return Err(DomainError::Validation(format!(
                    "villager {v} appears twice in one order — one villager, one house"
                )));
            }
            这单里的村民.push(v);
        }
    }

    for l in &req.lines {
        let 这一件 = sqlx::query(
            "SELECT p.fulfillment_kind, s.villager_id,
                    EXISTS (SELECT 1 FROM villager_residency r
                             WHERE r.user_id = $2 AND r.villager_id = s.villager_id)
                      AS already_home
               FROM sku s JOIN product p ON p.id = s.product_id
              WHERE s.id = $1",
        )
        .bind(&l.sku_id)
        .bind(&req.user_id)
        .fetch_optional(pool)
        .await.db()?;
        // 认不出这个 sku 的事交给下面的定价循环报（那儿的话更准）
        let Some(这一件) = 这一件 else { continue };
        let kind: String = 这一件.try_get("fulfillment_kind").unwrap_or_default();
        if kind == "residency" {
            if 这一件.try_get::<Option<bool>, _>("already_home").ok().flatten().unwrap_or(false) {
                let who: Option<String> = 这一件.try_get("villager_id").ok().flatten();
                return Err(DomainError::Conflict(format!(
                    "villager {} already lives with this user",
                    who.unwrap_or_else(|| l.sku_id.clone())
                )));
            }
            if l.qty != 1 {
                return Err(DomainError::Validation(
                    "residency line qty must be 1 — one villager, one house".into(),
                ));
            }
        }
        if kind == "async_compute" && l.qty != 1 {
            return Err(DomainError::Validation(
                "report line qty must be 1 — one line produces one report".into(),
            ));
        }
    }

    // 风控(台账 D7)。默认观察模式：规则照跑、事件照落、一单不拦 ——
    // 开关在 `risk::enforcing()`,由运营看过真实命中率之后再翻。
    crate::risk::gate(pool, &crate::risk::RiskEvalContext {
        kind: "pre_order".into(),
        user_id: Some(req.user_id.clone()),
        order_id: None,
        payment_id: None,
        amount_minor: None,
        user_age_days: None,
        extras: serde_json::json!({ "lines": req.lines.len(), "region": req.region }),
    }).await?;

    /* 【同一个人、同一件东西，已经有一笔没付的，就把那一笔还给他】。
       在这之前：确认屏每次 `onLoad` 都生成一个新的幂等键（那是对的 ——
       同一屏内连点两次要撞上同一个键），可【退回上一页再进来】就是
       一个新键、一张新单。库里因此攒着「同一个用户、同一个 sku、
       四笔未付、合计 796 元」这样的记录（2026-09-01 五路评审 · 工程审计）。
       钱没多扣 —— 未付单不是扣款 —— 但买家在「我买过的」里看见四条
       一模一样的待付，第一反应是自己被重复下单了。

       判据是【行完全一样】:同样的 sku、同样的数量、同样多的行。
       真想买两份的人改数量，不是下两张一模一样的单。
       只认 unpaid —— 已付、已取消、已过期的都不算。 */
    /* 【带券就不复用】（2026-09-03）。
       复用的前提是「这一单跟上一单一模一样」，而券会改金额 —— 不一样了。
       上一版的判据只看 sku 与数量：
         不带券下单 → ¥199 未付 → 退回去、输了券码再下单
         → 复用命中，还给他那张 ¥199 的单，券没用上，也不报错。
       反过来换一张券也一样：拿到的还是上一张券的折扣。

       这是同一个坑的第三次 —— 收货地址那次（上面那段注释）和联系人那次
       都是「复用分支在事务之前 return，而这一次填的东西写在事务里」。
       券码没法像地址那样「补写进去」:券要在事务里锁，锁完金额就变了，
       那已经是另一张单。所以带券的时候直接不走复用。 */
    if req.lines.len() == 1 && req.coupon_codes.is_empty() {
        let l = &req.lines[0];
        let 已有: Option<String> = sqlx::query_scalar(
            r#"SELECT o.id FROM order_record o
                 JOIN order_line ol ON ol.order_id = o.id
                WHERE o.user_id = $1 AND o.status = 'unpaid'
                  AND ol.sku_id = $2 AND ol.qty = $3
                  AND (SELECT count(*) FROM order_line x WHERE x.order_id = o.id) = 1
                ORDER BY o.created_at DESC LIMIT 1"#,
        ).bind(&req.user_id).bind(&l.sku_id).bind(l.qty)
         .fetch_optional(pool).await.db()?;
        if let Some(id) = 已有 {
            /* 【这一次填的地址要写进去】。
               复用分支在事务【之前】return，而 `shipping_address` / `contact`
               / `note` 是在事务里写 order_meta 的 —— 不补这一步，
               这一次填的东西一个字都不落库，而且不报错：
                 选地址 A 下单 → 退回去 → 选地址 B 再下单 → 复用命中第一张 →
                 屏上显示 B，运单收件人快照读 order_meta 拿到 A，包裹寄到 A。
               运单那一头还套着 `COALESCE(…, '{}')`，连空都不会报。
               2026-09-01 五路评审 · 工程审计当场抓到 —— 这是我为了消掉
               「四笔一样的未付单」而引入的。
               最新填的那个才是他要的，所以覆盖；这一次没填就不动旧的。 */
            if req.shipping_address.is_some() || req.contact.is_some() {
                sqlx::query(
                    r#"INSERT INTO order_meta(order_id, shipping_address_json, contact_json, extra_json)
                       VALUES ($1, $2, $3, '{}'::jsonb)
                       ON CONFLICT (order_id) DO UPDATE SET
                         shipping_address_json = COALESCE(EXCLUDED.shipping_address_json,
                                                          order_meta.shipping_address_json),
                         contact_json          = COALESCE(EXCLUDED.contact_json,
                                                          order_meta.contact_json)"#,
                ).bind(&id).bind(&req.shipping_address).bind(&req.contact)
                 .execute(pool).await.db()?;
            }
            /* note 落在 `audit_note` 上 —— 建单那条路（本文件下面那条 INSERT）
               就是这么写的，复用这一支不该另找一个地方。
               上一版这里写的是 `SET note = $2`，而 order_record 【没有】note 这一列：
               它编译得过（本仓禁用 query! 宏，SQL 是运行期才解析的），
               一跑就是 500。`check-sql · 每条 SQL 过一遍 Postgres` 抓到的
               （2026-09-01）—— 这正是那一支存在的理由。
               覆盖改成追加：第一次下单写的那句是审计串的一部分，不该被后来的抹掉。 */
            if let Some(n) = req.note.as_ref().filter(|n| !n.trim().is_empty()) {
                sqlx::query(
                    "UPDATE order_record SET audit_note = COALESCE(audit_note, '') || E'\\n' || $2
                      WHERE id = $1",
                ).bind(&id).bind(n).execute(pool).await.db()?;
            }
            let r = sqlx::query(
                "SELECT amount_total_minor, currency FROM order_record WHERE id=$1",
            ).bind(&id).fetch_one(pool).await.db()?;
            tracing::info!(order_id = %id, "同一件东西已经有一笔没付的，把那一笔还回去（地址按这一次的更新）");
            return Ok(CreatedOrder {
                order_id: id,
                amount_total_minor: r.get("amount_total_minor"),
                currency: r.get("currency"),
                status: "unpaid".into(),
            });
        }
    }

    let mut tx = pool.begin().await.db()?;
    let order_id = new_id("ord");
    let now = Utc::now();

    let mut subtotal: i64 = 0;
    let mut currency: Option<String> = None;
    // (line_id, sku_id, unit_price, qty, line_subtotal, snapshot)
    let mut lines: Vec<(String, String, i64, i32, i64, Value)> = Vec::with_capacity(req.lines.len());

    for l in &req.lines {
        let row = sqlx::query(
            r#"SELECT s.id, s.code, s.name, s.spec_json, s.weight_g, s.stock_kind,
                      pb.price_minor, pb.currency
               FROM sku s
               LEFT JOIN LATERAL (
                 SELECT price_minor, currency FROM price_book
                 WHERE sku_id = s.id AND status='active'
                   AND region IN ($2, 'global')
                   AND platform IN ($3, 'all')
                   AND effective_from <= NOW()
                   AND (effective_to IS NULL OR effective_to > NOW())
                 ORDER BY effective_from DESC LIMIT 1
               ) pb ON TRUE
               WHERE s.id=$1 AND s.status='active'"#,
        )
        .bind(&l.sku_id)
        .bind(&req.region)
        .bind(&req.channel_origin)
        .fetch_optional(&mut *tx)
        .await.db()?
        .ok_or_else(|| DomainError::NotFound(format!("sku {}", l.sku_id)))?;

        /* 【限量的东西要真的限量】（2026-09-03 第四轮评审 · 工程审计）。
           `stock_count` 与 `per_user_cap` 这两列在整个 unmei-app 里
           **零处引用** —— 玉坠写着 50 件，实测能下一万单。
           一件卖光了还在收钱的商品，比不上架更糟。

           扣减写成一句带条件的 UPDATE:`stock_count >= $2` 让「查」和「扣」
           在同一个语句、同一个隐式事务里完成 —— 先查再扣的话，
           两个人同时下最后一件都能查到「还有 1」。
           影响行数为 0 就是不够了，如实说还剩多少。
           `unlimited` 那一档不碰。 */
        let 限量: bool = row.try_get::<String, _>("stock_kind")
            .map(|k| k == "limited").unwrap_or(false);
        if 限量 {
            let n = sqlx::query(
                "UPDATE sku SET stock_count = stock_count - $2 \
                 WHERE id = $1 AND stock_count IS NOT NULL AND stock_count >= $2",
            )
            .bind(&l.sku_id)
            .bind(l.qty)
            .execute(&mut *tx)
            .await.db()?
            .rows_affected();
            if n == 0 {
                let 剩: Option<i32> = sqlx::query_scalar(
                    "SELECT stock_count FROM sku WHERE id=$1",
                ).bind(&l.sku_id).fetch_optional(&mut *tx).await.db()?.flatten();
                return Err(DomainError::Conflict(format!(
                    "sku {} 不够了 —— 要 {}，还剩 {}",
                    l.sku_id, l.qty, 剩.unwrap_or(0)
                )));
            }
        }

        let unit: i64 = row
            .try_get("price_minor")
            .map_err(|_| DomainError::Validation(format!("sku {} 无激活价", l.sku_id)))?;
        let cur: String = row
            .try_get("currency")
            .map_err(|_| DomainError::Validation(format!("sku {} 价格无币种", l.sku_id)))?;

        // 旧的两份都是「后一行覆盖前一行」,混币种下单会算出一笔币种错误的总额。
        // 一笔订单只能有一个币种，不一致就拒绝。
        match &currency {
            None => currency = Some(cur),
            Some(existing) if *existing != cur => {
                return Err(DomainError::Validation(format!(
                    "订单内币种不一致：{existing} vs {cur}"
                )));
            }
            Some(_) => {}
        }

        /* 算钱用 checked。Rust 在 release 下整数溢出是【静默回绕】——
           一笔总额绕成负数的订单，后面每一步都会当成真数字往下算。
           2026-08-18 量过：qty 上界只有库里的 `CHECK (qty > 0)`，没有上限；
           一次请求收得下 4 万行（1.4 MB，请求体上限约 2 MB）。
           按当前最高单价 49800，溢出需要约 8.7 万行 —— 今天够不着，
           但那是「单价 × 请求体上限」凑出来的巧合，不是设计：
           单价再高一倍就进得来。这里不猜上限该是多少（那是产品决定），
           只保证**算不出来就报错，不给一个错的数**。 */
        let line_sub = unit
            .checked_mul(l.qty as i64)
            .ok_or_else(|| DomainError::Validation(format!(
                "行金额溢出：单价 {unit} × 数量 {}", l.qty
            )))?;
        subtotal = subtotal
            .checked_add(line_sub)
            .ok_or_else(|| DomainError::Validation("订单总额溢出".into()))?;
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

    /* 【券在这里真的减钱】。在它之前这一段是 `let total = subtotal;`，
       而带来的券码只在下面被 warn 一句「折扣引擎尚未接通」——
       用户以为用了券，扣的是原价，没有任何一处会说出这件事。

       锁券跑在同一个事务里：券锁上了、订单也落库了，要么都成要么都不成。
       券不合用就整单拒绝（`lock_for_order` 里逐条抛），
       不悄悄跳过 —— 跳过在用户那边看到的就是「按原价扣款」。 */
    let (券们, discount) = crate::coupon::lock_for_order(
        &mut tx, &order_id, &req.user_id, &req.region, subtotal, &req.coupon_codes,
    ).await?;
    let total = subtotal
        .checked_sub(discount)
        .filter(|t| *t >= 0)
        .ok_or_else(|| DomainError::Internal(format!(
            "折扣 {discount} 超过了订单金额 {subtotal}"
        )))?;

    sqlx::query(
        r#"INSERT INTO order_record(
             id, user_id, channel_origin, currency,
             amount_subtotal_minor, amount_discount_minor, amount_total_minor,
             status, source_kind, region, ip, ua, expires_at, audit_note
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid', 'one_shot', $8, $9, $10,
                     NOW() + INTERVAL '30 minutes', $11)"#,
    )
    .bind(&order_id)
    .bind(&req.user_id)
    .bind(&req.channel_origin)
    .bind(&currency)
    .bind(subtotal)
    .bind(discount)
    .bind(total)
    .bind(&req.region)
    .bind(&req.ip)
    .bind(&req.ua)
    .bind(req.note.clone().unwrap_or_default())
    .execute(&mut *tx)
    .await.db()?;

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
        .await.db()?;
    }

    sqlx::query(
        r#"INSERT INTO order_meta(order_id, shipping_address_json, contact_json, extra_json)
           VALUES ($1, $2, $3, '{}'::jsonb)"#,
    )
    .bind(&order_id)
    .bind(&req.shipping_address)
    .bind(&req.contact)
    .execute(&mut *tx)
    .await.db()?;

    sqlx::query(
        r#"INSERT INTO order_event(id, order_id, kind, actor_kind, actor_id,
                                   before_status, after_status, meta_json)
           VALUES ($1, $2, 'OrderCreated', 'user', $3, NULL, 'unpaid', '{}'::jsonb)"#,
    )
    .bind(new_id("oe"))
    .bind(&order_id)
    .bind(&req.user_id)
    .execute(&mut *tx)
    .await.db()?;

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

    if !券们.is_empty() {
        tracing::info!(
            order_id = %order_id,
            discount_minor = discount,
            n = 券们.len(),
            "本单锁了优惠券，付款成功时核销"
        );
    }

    tx.commit().await.db()?;

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
/// `owner` 传 `Some(user_id)` 时同时做归属校验 —— 客户端路径必须传，
/// 后台路径传 `None`。这一条是旧路由对而旧 service 漏掉的。
pub async fn cancel(
    pool: &PgPool,
    order_id: &str,
    reason: &str,
    actor: &Actor,
    owner: Option<&str>,
) -> Result<(), DomainError> {
    let mut tx = pool.begin().await.db()?;

    let row = sqlx::query("SELECT status, user_id FROM order_record WHERE id=$1 FOR UPDATE")
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await.db()?
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
    // 状态机是唯一判据。旧路由那句硬编码的 ["draft","unpaid"] 和状态机等价，
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
    .await.db()?;

    // 【订单没成，券要还给人家】。走状态机里那条 Locked → Issued。
    // 不还的话，一次点错的下单就把用户的券吃掉了，而他既没花钱也没了券。
    crate::coupon::release_for_order(&mut tx, order_id).await?;

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
    .await.db()?;

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

    tx.commit().await.db()?;
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
    .await.db()?
    .rows_affected();

    // 旧的两份都不检查影响行数，批注一个不存在的订单会静默成功。
    if affected == 0 {
        return Err(DomainError::NotFound(format!("order {order_id}")));
    }
    Ok(())
}

// ═══════════════════════════ 过期未付 ═══════════════════════════

/// 把超时未支付的订单标记为取消。sweeper 调用。
pub async fn expire_unpaid(pool: &PgPool) -> Result<u64, DomainError> {
    /* 【过期也要还券】。跟手动取消同一个道理，只是这条路上没有人在场 ——
       所以更需要它自己做对：一张锁在过期订单上的券，
       不还就永远是 locked，用户再也用不了，也没有任何提示。

       两句写在一个事务里：订单标了取消、券也放回去，要么都成要么都不成。 */
    let mut tx = pool.begin().await.db()?;
    let 过期单: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM order_record
         WHERE status='unpaid' AND expires_at < NOW() FOR UPDATE",
    )
    .fetch_all(&mut *tx)
    .await.db()?;

    if 过期单.is_empty() {
        return Ok(0);
    }

    let res = sqlx::query(
        r#"UPDATE order_record SET status='cancelled', cancelled_at=NOW(),
             cancel_reason='expired', cancel_actor='system'
           WHERE id = ANY($1)"#,
    )
    .bind(&过期单)
    .execute(&mut *tx)
    .await.db()?;

    for id in &过期单 {
        crate::coupon::release_for_order(&mut tx, id).await?;
    }
    tx.commit().await.db()?;
    Ok(res.rows_affected())
}
