//! 订单用例 · 对真库。
//!
//! 覆盖的是 P1 合并两份旧实现时**逐条定下来的语义**。每条测试的名字说的就是
//! 它钉住的那条决定;注释写清楚旧实现在这里错在哪,免得将来有人「顺手改回去」。

mod common;

use serde_json::json;
use unmei_app::{order, Actor, DomainError};

// ═══════════════════════════ 建单 ═══════════════════════════

#[tokio::test]
async fn create_persists_ip_and_ua() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;

    let created = order::create(
        &pool,
        order::NewOrder {
            user_id: user.clone(),
            region: "cn".into(),
            channel_origin: "web".into(),
            lines: vec![order::NewOrderLine { sku_id: sku, qty: 1 }],
            shipping_address: None,
            contact: None,
            coupon_codes: vec![],
            note: None,
            // 旧路由这两列一直写 NULL,风控拿不到来源地址
            ip: Some("203.0.113.42".into()),
            ua: Some("unmei-test/1.0".into()),
        },
    )
    .await
    .expect("create order");

    let ip = common::scalar_string(&pool, "SELECT ip FROM order_record WHERE id=$1", &created.order_id).await;
    let ua = common::scalar_string(&pool, "SELECT ua FROM order_record WHERE id=$1", &created.order_id).await;
    assert_eq!(ip.as_deref(), Some("203.0.113.42"));
    assert_eq!(ua.as_deref(), Some("unmei-test/1.0"));
}

#[tokio::test]
async fn create_prices_by_region_not_by_whichever_row_is_newest() {
    /* `price_book` 按区域分行：同一个 sku 在 cn 是 CNY 4900、在 jp 是 JPY 1200。
       建单原先只 `ORDER BY effective_from DESC LIMIT 1`，不看 region ——
       于是 region=cn 的用户下出一笔 JPY 1200，而商品页上写着 ¥49.00。
       用户看到的价和被记的账不是同一个，两边还都「成功」了（2026-08-19 实测）。 */
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 4900).await; // fixture 落的是 cn 价

    // 同一个 sku 再加一条【更新的】jp 价 —— 不看 region 的话会取到它
    sqlx::query(
        "INSERT INTO price_book(id, sku_id, currency, price_minor, region, platform, status) \
         VALUES ($1, $2, 'JPY', 1200, 'jp', 'all', 'active')",
    )
    .bind(common::uniq("pb-jp"))
    .bind(&sku)
    .execute(&pool)
    .await
    .expect("种一条更新的 jp 价");

    let created = order::create(&pool, new_order(&user, vec![(sku, 1)]))
        .await
        .expect("建单");

    assert_eq!(created.currency, "CNY", "cn 的用户要按 cn 的价记账，不是最新那一行");
    assert_eq!(created.amount_total_minor, 4900);
}

#[tokio::test]
async fn create_reads_currency_from_price_book_not_hardcoded_cny() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    // 旧路由硬编码 CNY,遇到非 CNY 直接报错 —— 这单在旧代码里根本下不了
    let sku = common::sku_with_price(&pool, "JPY", 1200).await;

    let created = order::create(&pool, new_order(&user, vec![(sku, 1)]))
        .await
        .expect("create JPY order");

    assert_eq!(created.currency, "JPY");
    assert_eq!(created.amount_total_minor, 1200);
}

#[tokio::test]
async fn create_rejects_mixed_currency_lines() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let cny = common::sku_with_price(&pool, "CNY", 19900).await;
    let jpy = common::sku_with_price(&pool, "JPY", 1200).await;

    // 两份旧实现都是「后一行覆盖前一行」,会算出一笔币种标错的总额
    let err = order::create(&pool, new_order(&user, vec![(cny, 1), (jpy, 1)]))
        .await
        .expect_err("混币种应被拒");

    match err {
        DomainError::Validation(msg) => {
            assert!(msg.contains("CNY") && msg.contains("JPY"), "错误信息该说清是哪两个币种：{msg}");
        }
        other => panic!("期望 Validation，实际 {other:?}"),
    }
}

#[tokio::test]
async fn create_puts_contact_in_contact_column() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 100).await;

    let mut req = new_order(&user, vec![(sku, 1)]);
    req.contact = Some(json!({"name": "收件人"}));

    let created = order::create(&pool, req).await.expect("create");

    // 旧 PgOrderService 把 `receipt` 塞进了 contact_json 这一列
    let name: Option<String> = sqlx::query_scalar(
        "SELECT contact_json->>'name' FROM order_meta WHERE order_id=$1",
    )
    .bind(&created.order_id)
    .fetch_one(&pool)
    .await
    .expect("query order_meta");
    assert_eq!(name.as_deref(), Some("收件人"));
}

#[tokio::test]
async fn create_emits_order_created_to_outbox() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 100).await;

    let created = order::create(&pool, new_order(&user, vec![(sku, 1)])).await.expect("create");

    // 真正在跑的那份旧路由根本不写这条事件,下游 dispatcher 看不见新订单
    assert_eq!(common::outbox_count(&pool, "OrderCreated", &created.order_id).await, 1);
}

#[tokio::test]
async fn create_rejects_empty_and_non_positive_lines() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 100).await;

    assert!(matches!(
        order::create(&pool, new_order(&user, vec![])).await,
        Err(DomainError::Validation(_))
    ));
    assert!(matches!(
        order::create(&pool, new_order(&user, vec![(sku, 0)])).await,
        Err(DomainError::Validation(_))
    ));
}

#[tokio::test]
async fn create_rejects_unknown_sku_without_writing_anything() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;

    let err = order::create(&pool, new_order(&user, vec![("sku-does-not-exist".into(), 1)]))
        .await
        .expect_err("未知 SKU 应 404");
    assert!(matches!(err, DomainError::NotFound(_)));

    // 整笔在一个事务里,失败必须什么都没留下
    let orders = common::scalar_i64(&pool, "SELECT COUNT(*) FROM order_record WHERE user_id=$1", &user).await;
    assert_eq!(orders, 0, "失败的建单不该留下订单行");
}

#[tokio::test]
async fn create_rejects_sku_without_active_price() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_without_price(&pool).await;

    let err = order::create(&pool, new_order(&user, vec![(sku, 1)]))
        .await
        .expect_err("无激活价应被拒");
    assert!(matches!(err, DomainError::Validation(_)), "实际 {err:?}");
}

// ═══════════════════════════ 取消 ═══════════════════════════

#[tokio::test]
async fn cancel_unpaid_order_succeeds_and_records_actor_kind() {
    let pool = db_or_skip!();
    let (user, order_id) = order_fixture(&pool).await;

    order::cancel(&pool, &order_id, "改主意了", &Actor::user(&user), Some(&user))
        .await
        .expect("cancel");

    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("cancelled"));
    // 旧路由这里写死字面量 'user',后台调用时就是错的
    let actor = common::scalar_string(&pool, "SELECT cancel_actor FROM order_record WHERE id=$1", &order_id).await;
    assert_eq!(actor.as_deref(), Some("user"));
    assert_eq!(common::outbox_count(&pool, "OrderCancelled", &order_id).await, 1);
}

#[tokio::test]
async fn cancel_by_admin_records_admin_actor() {
    let pool = db_or_skip!();
    let (_user, order_id) = order_fixture(&pool).await;

    // owner 传 None = 后台不受归属限制
    order::cancel(&pool, &order_id, "运营取消", &Actor::admin("admin_root"), None)
        .await
        .expect("admin cancel");

    let actor = common::scalar_string(&pool, "SELECT cancel_actor FROM order_record WHERE id=$1", &order_id).await;
    assert_eq!(actor.as_deref(), Some("admin"));
    let actor_id: Option<String> = sqlx::query_scalar(
        "SELECT actor_id FROM order_event WHERE order_id=$1 AND kind='OrderCancelled'",
    )
    .bind(&order_id)
    .fetch_one(&pool)
    .await
    .expect("query order_event");
    assert_eq!(actor_id.as_deref(), Some("admin_root"));
}

#[tokio::test]
async fn cancel_by_non_owner_is_not_found_and_leaves_order_alone() {
    let pool = db_or_skip!();
    let (_owner, order_id) = order_fixture(&pool).await;
    let intruder = common::user(&pool).await;

    // 旧 PgOrderService 完全没有归属校验
    let err = order::cancel(&pool, &order_id, "越权", &Actor::user(&intruder), Some(&intruder))
        .await
        .expect_err("非属主应被拒");
    // 刻意返回 NotFound 而不是 Forbidden:不向非属主泄露订单是否存在
    assert!(matches!(err, DomainError::NotFound(_)), "实际 {err:?}");
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("unpaid"));
}

#[tokio::test]
async fn cancel_paid_order_is_blocked_by_the_state_machine() {
    let pool = db_or_skip!();
    let (_user, order_id) = order_fixture(&pool).await;
    sqlx::query("UPDATE order_record SET status='paid', paid_at=NOW() WHERE id=$1")
        .bind(&order_id)
        .execute(&pool)
        .await
        .expect("set paid");

    // ★ P1 的行为变更。旧后台路由允许从 paid 取消,但状态机里
    //   Paid → [Fulfilling, Done, RefundPartial, Refunded, Disputed] 没有 Cancelled。
    //   放行会留下「用户付了钱、订单取消了、没有退款记录」的窟窿。
    let err = order::cancel(&pool, &order_id, "后台取消", &Actor::admin("admin_root"), None)
        .await
        .expect_err("已付订单不该能直接取消");

    match err {
        DomainError::IllegalStateTransition { from, to } => {
            assert_eq!(from, "paid");
            assert_eq!(to, "cancelled");
        }
        other => panic!("期望 IllegalStateTransition，实际 {other:?}"),
    }
    assert_eq!(common::order_status(&pool, &order_id).await.as_deref(), Some("paid"));
    // 被拦下的操作不该留下任何痕迹
    assert_eq!(common::outbox_count(&pool, "OrderCancelled", &order_id).await, 0);
}

#[tokio::test]
async fn cancel_unknown_order_is_not_found() {
    let pool = db_or_skip!();
    let err = order::cancel(&pool, "ord-nope", "x", &Actor::system(), None)
        .await
        .expect_err("不存在的订单");
    assert!(matches!(err, DomainError::NotFound(_)));
}

// ═══════════════════════════ 批注 ═══════════════════════════

#[tokio::test]
async fn annotate_appends_and_tags_the_actor() {
    let pool = db_or_skip!();
    let (_user, order_id) = order_fixture(&pool).await;

    order::annotate(&pool, &order_id, "客服跟进过", &Actor::admin("admin_kf")).await.expect("annotate");

    let note = common::scalar_string(&pool, "SELECT audit_note FROM order_record WHERE id=$1", &order_id)
        .await
        .unwrap_or_default();
    assert!(note.contains("admin_kf"), "备注该带上操作人：{note}");
    assert!(note.contains("客服跟进过"), "备注该带上正文：{note}");
}

#[tokio::test]
async fn annotate_unknown_order_is_not_found_rather_than_silent_success() {
    let pool = db_or_skip!();
    // 旧实现不看影响行数,批注一个不存在的订单返回 ok:true
    let err = order::annotate(&pool, "ord-nope", "x", &Actor::admin("a"))
        .await
        .expect_err("幽灵订单该 404");
    assert!(matches!(err, DomainError::NotFound(_)));
}

// ═══════════════════════════ 辅助 ═══════════════════════════

fn new_order(user_id: &str, lines: Vec<(String, i32)>) -> order::NewOrder {
    order::NewOrder {
        user_id: user_id.to_string(),
        region: "cn".into(),
        channel_origin: "web".into(),
        lines: lines
            .into_iter()
            .map(|(sku_id, qty)| order::NewOrderLine { sku_id, qty })
            .collect(),
        shipping_address: None,
        contact: None,
        coupon_codes: vec![],
        note: None,
        ip: None,
        ua: None,
    }
}

/// 一个用户 + 一笔 unpaid 订单。
/// 同一个人、同一件东西、已经有一笔没付的 —— 再下一次拿回的是那一笔。
///
/// 确认屏每次 `onLoad` 都生成一个新的幂等键（同一屏内连点两次要撞上
/// 同一个键，那是对的），可【退回上一页再进来】就是一个新键、一张新单。
/// 库里因此攒着「同一个用户、同一个 sku、四笔未付、合计 796 元」这样的
/// 记录（2026-09-01 五路评审 · 工程审计查出来的）。
/// 钱没多扣 —— 未付单不是扣款 —— 但买家在「我买过的」里看见四条一模一样的
/// 待付，第一反应是自己被重复下单了。
#[tokio::test]
async fn ordering_the_same_thing_twice_returns_the_unpaid_order_you_already_have() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 9900).await;

    let 头一次 = order::create(&pool, new_order(&user, vec![(sku.clone(), 1)]))
        .await.expect("第一张单");
    let 第二次 = order::create(&pool, new_order(&user, vec![(sku.clone(), 1)]))
        .await.expect("再下一次");

    assert_eq!(第二次.order_id, 头一次.order_id, "同一件东西不该建出第二张待付单");
    let 张数: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM order_record o JOIN order_line ol ON ol.order_id=o.id \
          WHERE o.user_id=$1 AND o.status='unpaid' AND ol.sku_id=$2",
    ).bind(&user).bind(&sku).fetch_one(&pool).await.expect("数一数");
    assert_eq!(张数, 1, "库里也只该有一张");

    /* 【数量不同就是另一件事】。真想买两份的人改数量 ——
       那时不能把他的两份悄悄换回一份。 */
    let 两份 = order::create(&pool, new_order(&user, vec![(sku.clone(), 2)]))
        .await.expect("买两份");
    assert_ne!(两份.order_id, 头一次.order_id, "数量不同，不该复用上一张");
}

/// 复用未付单时，**这一次填的地址要覆盖上一次的**。
///
/// 复用分支在事务之前 return，而地址是在事务里写 order_meta 的 ——
/// 不补这一步，第二次填的东西一个字都不落库，而且不报错:
/// 选地址 A 下单 → 退回去 → 选地址 B 再下单 → 复用命中第一张 →
/// 屏上显示 B，运单收件人快照读 order_meta 拿到 A，包裹寄到 A。
/// 运单那一头还套着 `COALESCE(…, '{}')`，连空都不会报。
/// （2026-09-01 五路评审 · 工程审计抓到 —— 这是为了消掉「四笔一样的
/// 未付单」引入的，一个修复自己带出来的洞。）
#[tokio::test]
async fn reusing_an_unpaid_order_takes_the_address_you_just_typed() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 9900).await;
    let 下单 = |地址: &'static str| order::NewOrder {
        user_id: user.clone(), region: "cn".into(), channel_origin: "web".into(),
        lines: vec![order::NewOrderLine { sku_id: sku.clone(), qty: 1 }],
        shipping_address: Some(serde_json::json!({ "address": 地址 })),
        contact: Some(serde_json::json!({ "name": "验", "address": 地址 })),
        coupon_codes: vec![], note: None, ip: None, ua: None,
    };

    let 头一次 = order::create(&pool, 下单("甲地")).await.expect("第一张");
    let 第二次 = order::create(&pool, 下单("乙地")).await.expect("再下一次");
    assert_eq!(第二次.order_id, 头一次.order_id, "同一件东西该复用那一张");

    let 存的: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT shipping_address_json FROM order_meta WHERE order_id=$1",
    ).bind(&头一次.order_id).fetch_one(&pool).await.expect("读 order_meta");
    assert_eq!(存的.as_ref().and_then(|v| v["address"].as_str()), Some("乙地"),
               "库里存的该是他【这一次】填的那个地址，不是上一次的");
}

/// 复用未付单时，这一次写的备注也要落库 —— 而且是**追加**不是覆盖。
///
/// 上一版这里写的是 `UPDATE order_record SET note = $2`，而 order_record
/// 没有 note 这一列:本仓禁用 `query!` 宏，SQL 是运行期才解析的，所以它
/// 编译得过，一跑就是 500。`check-sql` 抓到之后改成落 `audit_note` ——
/// 跟建单那条路同一个去处。这个测试钉住「落哪儿」和「追加不覆盖」两件事。
#[tokio::test]
async fn reusing_an_unpaid_order_keeps_both_notes() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 9900).await;
    let 下单 = |备注: &'static str| order::NewOrder {
        user_id: user.clone(), region: "cn".into(), channel_origin: "web".into(),
        lines: vec![order::NewOrderLine { sku_id: sku.clone(), qty: 1 }],
        shipping_address: None, contact: None,
        coupon_codes: vec![], note: Some(备注.into()), ip: None, ua: None,
    };

    let 头一次 = order::create(&pool, 下单("头一遍")).await.expect("第一张");
    let 第二次 = order::create(&pool, 下单("第二遍")).await.expect("再下一次");
    assert_eq!(第二次.order_id, 头一次.order_id, "同一件东西该复用那一张");

    let 串: String = sqlx::query_scalar("SELECT audit_note FROM order_record WHERE id=$1")
        .bind(&头一次.order_id).fetch_one(&pool).await.expect("读 audit_note");
    assert!(串.contains("第二遍"), "这一次写的备注得在里头，实际是：{串}");
    assert!(串.contains("头一遍"), "上一次那句不该被抹掉，实际是：{串}");
}

/// 【同一位不能请两回】。
///
/// `residency::move_in_from_line` 是 `ON CONFLICT DO NOTHING`，第二次回
/// `AlreadyHome`；而 `fulfillment.rs` 只把 `is_new()` 写进 `fulfillment_ref`，
/// 行照样标 `done` —— 也就是钱收了、什么都没发生，而订单屏还会写
/// 「他已经在村里那一格住下了 —— 这单到此为止」。
/// 拦在建单这一层：那时钱还没动。
/// （2026-09-02 第三轮评审 · 转化路实跑出来的。）
#[tokio::test]
async fn cannot_buy_a_villager_who_already_lives_with_you() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let (sku, villager) = common::residency_sku(&pool, "CNY", 9900).await;

    // 头一次:建得出来
    let 头 = order::create(&pool, new_order(&user, vec![(sku.clone(), 1)])).await;
    assert!(头.is_ok(), "第一次该建得出来，实际 {:?}", 头.err());

    // 他住进来了（履约那一步的效果，这里直接种，测的是建单这一层）
    sqlx::query(
        "INSERT INTO villager_residency(id,user_id,villager_id,source_kind) \
         VALUES ($1,$2,$3,'grant') ON CONFLICT DO NOTHING",
    ).bind(format!("res-t{}", &uuid::Uuid::new_v4().to_string()[..8]))
     .bind(&user).bind(&villager)
     .execute(&pool).await.expect("种入住");

    let 再来 = order::create(&pool, new_order(&user, vec![(sku, 1)])).await;
    match 再来 {
        Err(DomainError::Conflict(m)) => assert!(m.contains(&villager), "话要说清是谁：{m}"),
        other => panic!("已经住着的那位不该再卖一次，实际 {other:?}"),
    }
}

/// 【同一张单里同一位村民出现两次】（2026-09-02 第四轮评审 · 工程审计）。
///
/// 上面那道守卫是【逐行独立】判的:每一行各自查「这位是不是已经住着」。
/// 而一位村民名下在架的 SKU 有三百多件 —— 两个不同的 sku 都指着他，
/// 两行各自都合法，加起来收两份钱只搬进来一个人。
/// 审计实测两个 sku 一张单回 `amount_total_minor: 19800`。
#[tokio::test]
async fn cannot_put_the_same_villager_in_one_order_twice() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let (sku1, villager) = common::residency_sku(&pool, "CNY", 9900).await;
    // 第二个 sku 指着【同一位】村民 —— 这正是现实里的形状
    let (sku2, _) = common::residency_sku(&pool, "CNY", 9900).await;
    sqlx::query("UPDATE sku SET villager_id=$2 WHERE id=$1")
        .bind(&sku2).bind(&villager).execute(&pool).await.expect("两个 sku 指同一人");

    let 两行 = order::create(&pool, new_order(&user, vec![(sku1, 1), (sku2, 1)])).await;
    match 两行 {
        Err(DomainError::Validation(m)) => {
            assert!(m.contains(&villager), "话要说清是谁：{m}");
        }
        other => panic!("同一位村民在一张单里出现两次不该建得出来，实际 {other:?}"),
    }
}

/// 【一条行只出一册，所以说明书的数量只能是 1】。
///
/// `report::ensure_for_line` 从头到尾没读过 `qty`（grep 可验），
/// 而确认屏对非 residency 的商品照常摆数量 —— 买两份，按两份收钱，出一份。
#[tokio::test]
async fn a_report_line_cannot_be_bought_twice_in_one_line() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::report_sku(&pool, "CNY", 19900).await;

    assert!(order::create(&pool, new_order(&user, vec![(sku.clone(), 1)])).await.is_ok(),
            "一份该建得出来");
    match order::create(&pool, new_order(&user, vec![(sku, 2)])).await {
        Err(DomainError::Validation(m)) => assert!(m.contains("qty"), "话里要说是数量的事：{m}"),
        other => panic!("说明书买两份该被拒 —— 收两份钱只出一册，实际 {other:?}"),
    }
}

async fn order_fixture(pool: &sqlx::PgPool) -> (String, String) {
    let user = common::user(pool).await;
    let sku = common::sku_with_price(pool, "CNY", 19900).await;
    let created = order::create(pool, new_order(&user, vec![(sku, 1)])).await.expect("fixture order");
    (user, created.order_id)
}

/// 算不出来就报错，不给一个错的数。
///
/// `qty` 只有库里的 `CHECK (qty > 0)`，没有上限；一次请求收得下 4 万行。
/// Rust 在 release 下整数溢出是**静默回绕** —— 一笔总额绕成负数的订单，
/// 后面每一步都会把它当成真数字。按当前最高单价溢出需要约 8.7 万行，
/// 被请求体上限挡着，但那是巧合不是设计。
#[tokio::test]
async fn an_order_total_that_would_overflow_is_refused_not_wrapped() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    // 单价拉到接近 i64 上限的一半，两行就足以溢出
    let sku = common::sku_with_price(&pool, "CNY", i64::MAX / 3).await;
    let err = order::create(&pool, order::NewOrder {
        user_id: user.clone(),
        region: "cn".into(),
        channel_origin: "web".into(),
        lines: vec![
            order::NewOrderLine { sku_id: sku.clone(), qty: 2 },
            order::NewOrderLine { sku_id: sku, qty: 2 },
        ],
        shipping_address: None,
        contact: None,
        coupon_codes: vec![],
        note: None,
        ip: None,
        ua: None,
    })
    .await
    .expect_err("溢出该被拒，而不是绕成一个假数字");
    assert!(
        matches!(err, DomainError::Validation(_)),
        "该是 Validation，实际 {err:?}"
    );
}

/// 过期未付的单会被取消；没到期的、以及已经付掉的，都不该被带走。
///
/// `expire_unpaid` 的注释一直写着「sweeper 调用」，而 2026-08-18 之前
/// **没有任何人调它** —— 开发库里 1005 张未付订单有 1002 张早过了期还挂着。
#[tokio::test]
async fn expiring_unpaid_orders_leaves_the_others_alone() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 8800).await;
    let mk = |u: String, s: String| order::NewOrder {
        user_id: u, region: "cn".into(), channel_origin: "web".into(),
        lines: vec![order::NewOrderLine { sku_id: s, qty: 1 }],
        shipping_address: None, contact: None, coupon_codes: vec![], note: None,
        ip: None, ua: None,
    };
    /* 【两件不同的东西】。原先这里是同一个 sku 下两次 ——
       而 2026-09-01 起「同一个人、同一件东西、已经有一笔没付的」
       会把那一笔原样还回来（退回上一页再进来不该再建一张）。
       于是两个变量指向同一张单，过期与不过期设在同一行上，
       这条用例自己把自己抵消了。它要验的是「过期的取消、没到期的不动」，
       跟是不是同一件东西无关。 */
    let sku2 = common::sku_with_price(&pool, "CNY", 8800).await;
    let overdue = order::create(&pool, mk(user.clone(), sku.clone())).await.expect("单一");
    let fresh = order::create(&pool, mk(user.clone(), sku2)).await.expect("单二");
    assert_ne!(overdue.order_id, fresh.order_id, "夹具要的是两张单");
    sqlx::query("UPDATE order_record SET expires_at = NOW() - INTERVAL '1 hour' WHERE id=$1")
        .bind(&overdue.order_id).execute(&pool).await.expect("摆成已过期");
    sqlx::query("UPDATE order_record SET expires_at = NOW() + INTERVAL '1 hour' WHERE id=$1")
        .bind(&fresh.order_id).execute(&pool).await.expect("摆成没到期");

    /* 不断言影响行数 —— 同 `expiring_overdue_payments_leaves_paid_ones_alone`：
       `expire_unpaid` 扫的是全表，本机开着后端时它的 sweeper 每 30 秒也扫一遍
       （2026-08-19 起每一跳都扫）。抢在前面的话这里就是 0，而那不代表用例坏了。
       断言落在结果上：那张过期的取消了，没到期的没被带走。 */
    order::expire_unpaid(&pool).await.expect("expire_unpaid");

    let a = common::scalar_string(&pool, "SELECT status FROM order_record WHERE id=$1", &overdue.order_id).await;
    let b = common::scalar_string(&pool, "SELECT status FROM order_record WHERE id=$1", &fresh.order_id).await;
    assert_eq!(a.as_deref(), Some("cancelled"), "过期未付的该取消");
    assert_eq!(b.as_deref(), Some("unpaid"), "没到期的不该被带走");
}

/// 【限量的东西要真的限量】（2026-09-03 第四轮评审 · 工程审计）。
///
/// `stock_count` 与 `per_user_cap` 这两列在整个 unmei-app 里零处引用 ——
/// 审计实测:`sku-jade-pendant` 写着 50 件，能下一万单。
/// 一件卖光了还在收钱的商品，比不上架更糟。
#[tokio::test]
async fn a_limited_sku_stops_selling_when_it_runs_out() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 9900).await;
    sqlx::query("UPDATE sku SET stock_kind='limited', stock_count=2 WHERE id=$1")
        .bind(&sku).execute(&pool).await.expect("摆成只剩两件");

    // 两件买得到
    let 头 = order::create(&pool, new_order(&user, vec![(sku.clone(), 2)])).await;
    assert!(头.is_ok(), "还有两件时该买得到，实际 {:?}", 头.err());

    let 剩: Option<i32> = sqlx::query_scalar("SELECT stock_count FROM sku WHERE id=$1")
        .bind(&sku).fetch_one(&pool).await.expect("读库存");
    assert_eq!(剩, Some(0), "买走两件之后该是 0");

    // 第三件买不到 —— 而且话要说清还剩多少
    let 再来 = order::create(&pool, new_order(&user, vec![(sku.clone(), 1)])).await;
    match 再来 {
        Err(DomainError::Conflict(m)) => {
            assert!(m.contains("不够了"), "话要说清为什么：{m}");
        }
        other => panic!("卖光了不该再卖，实际 {other:?}"),
    }

    // 不限量的那一档不受影响
    let 不限 = common::sku_with_price(&pool, "CNY", 9900).await;
    let 随便买 = order::create(&pool, new_order(&user, vec![(不限, 99)])).await;
    assert!(随便买.is_ok(), "unlimited 那一档不该被拦，实际 {:?}", 随便买.err());
}
