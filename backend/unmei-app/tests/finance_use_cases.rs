//! 关账用例 · 对真库。
//!
//! 【这是财务这一块第一批测试里最要紧的一条】。`accounting_period.state`
//! 从建库到现在全是 `open` —— 状态机定义了 open / closing / closed，
//! 没有一条路走到后两个，而记账那一侧一直防着「关了的期间」。
//!
//! 关账保护的是「这本账不会再变」这句话。所以这里钉的每一条，
//! 都是「不这么做的话，关上的账仍然会变」。

mod common;

use unmei_app::{finance, Actor, DomainError};

/// 建一个空的 open 期间，返回它的 id。
async fn 建一期(pool: &sqlx::PgPool) -> String {
    let id = format!("period-t{}", uuid::Uuid::new_v4().simple());
    /* year/sub 要唯一（uq_accounting_period），而这些测试是并行跑的。
       从 uuid 派生，不引 rand ——`unmei-app` 本来没有这个依赖，
       为一行测试代码加一个 crate 不划算。
       年份取 1000-1899：真数据在 2026 上下，撞不着。 */
    let 种: u128 = uuid::Uuid::new_v4().as_u128();
    let 年: i32 = 1000 + (种 % 900) as i32;
    let 月: i32 = 1 + ((种 >> 32) % 12) as i32;
    sqlx::query(
        "INSERT INTO accounting_period(id, kind, year, sub, state, region)
         VALUES ($1, 'month', $2, $3, 'open', 'cn')",
    )
    .bind(&id).bind(年).bind(月)
    .execute(pool).await.expect("建会计期");
    id
}

/// 往这一期记一条分录，借 `debit` 贷 `credit`（不平就传不等的数）。
async fn 记一笔(pool: &sqlx::PgPool, period: &str, debit: i64, credit: i64, status: &str) -> String {
    let je = format!("je-t{}", uuid::Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO journal_entry(id, period_id, description, posted_at, posted_by_kind,
                                   business_kind, business_ref_id, status, region)
         VALUES ($1, $2, '测试', NOW(), 'system', 'test', $1, $3, 'cn')",
    ).bind(&je).bind(period).bind(status).execute(pool).await.expect("插分录头");
    sqlx::query(
        "INSERT INTO journal_line(id, entry_id, line_no, account_code, debit_minor, credit_minor, currency)
         VALUES ($1, $2, 1, (SELECT code FROM account_chart LIMIT 1), $3, $4, 'CNY')",
    ).bind(format!("jl-t{}", uuid::Uuid::new_v4().simple()))
     .bind(&je).bind(debit).bind(credit)
     .execute(pool).await.expect("插分录行");
    je
}

#[tokio::test]
async fn 平的账关得上() {
    let pool = db_or_skip!();
    let p = 建一期(&pool).await;
    记一笔(&pool, &p, 19900, 19900, "posted").await;

    let (借, 贷) = finance::close_period(&pool, &p, &Actor::system()).await.expect("关账");
    assert_eq!((借, 贷), (19900, 19900));

    let st = common::scalar_string(&pool, "SELECT state FROM accounting_period WHERE id=$1", &p).await;
    assert_eq!(st.as_deref(), Some("closed"));
}

#[tokio::test]
async fn 不平的账不许关而且要说出差多少() {
    let pool = db_or_skip!();
    let p = 建一期(&pool).await;
    记一笔(&pool, &p, 19900, 10000, "posted").await;

    /* 【不平就是有账没落地】。这时候封期只会把问题冻在里面 ——
       冻住之后再改要走冲销，而现在还能直接补。 */
    let e = finance::close_period(&pool, &p, &Actor::system()).await.unwrap_err();
    match e {
        DomainError::Conflict(m) => {
            assert!(m.contains("差 9900"), "得说出差多少，拿到的是：{m}");
        }
        其他 => panic!("拿到的是 {其他:?}"),
    }
    let st = common::scalar_string(&pool, "SELECT state FROM accounting_period WHERE id=$1", &p).await;
    assert_eq!(st.as_deref(), Some("open"), "拒绝之后期间不能被改动");
}

#[tokio::test]
async fn 有草稿分录就不许关() {
    let pool = db_or_skip!();
    let p = 建一期(&pool).await;
    记一笔(&pool, &p, 100, 100, "draft").await;

    /* 一条 draft 挂在关了的账期上，之后既不能过账（期关了）
       也没人会去看它 —— 它会一直在那儿，而且看起来像笔账。 */
    let e = finance::close_period(&pool, &p, &Actor::system()).await.unwrap_err();
    assert!(matches!(e, DomainError::Conflict(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 关过的不能再关() {
    let pool = db_or_skip!();
    let p = 建一期(&pool).await;
    finance::close_period(&pool, &p, &Actor::system()).await.expect("第一次");

    // 【第二次要报冲突，不能默默说成功】——「关账成功」这句话
    // 对财务是有分量的，说了就得是真发生过一次封期
    let e = finance::close_period(&pool, &p, &Actor::system()).await.unwrap_err();
    assert!(matches!(e, DomainError::Conflict(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 不存在的期间报找不到() {
    let pool = db_or_skip!();
    let e = finance::close_period(&pool, "period-没有这个", &Actor::system()).await.unwrap_err();
    assert!(matches!(e, DomainError::NotFound(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 关了之后退款账就落不进去了() {
    let pool = db_or_skip!();
    /* 【这一条钉的是关账到底管不管用】。
       前面几条只验了状态改没改 —— 而关账真正的意思是
       「这一期不能再记账」。`post_refund_journal` 里写着
       「不把账偷偷记进一个关了的期间」，这里让它真的撞上一次。

       记账那一侧按【当前月】取期间，所以要关的正是当前这个月。
       这一条会把本机当月的账期关掉 —— 那正是它要验的事，
       测试库（unmei_test）跟跑着的 API 不共用，见 .claude/CLAUDE.md。 */
    use chrono::Datelike;
    let 现在 = chrono::Utc::now();
    let period_id = format!("period-{}-{:02}", 现在.year(), 现在.month());
    sqlx::query(
        "INSERT INTO accounting_period(id, kind, year, sub, state, region)
         VALUES ($1, 'month', $2, $3, 'open', 'cn') ON CONFLICT DO NOTHING",
    )
    .bind(&period_id).bind(现在.year()).bind(现在.month() as i32)
    .execute(&pool).await.expect("建当月");
    // 先把这一期清空，不然别的测试留下的分录会让它不平
    sqlx::query("DELETE FROM journal_line WHERE entry_id IN (SELECT id FROM journal_entry WHERE period_id=$1)")
        .bind(&period_id).execute(&pool).await.expect("清行");
    sqlx::query("DELETE FROM journal_entry WHERE period_id=$1")
        .bind(&period_id).execute(&pool).await.expect("清头");
    sqlx::query("UPDATE accounting_period SET state='open' WHERE id=$1")
        .bind(&period_id).execute(&pool).await.expect("重开");

    finance::close_period(&pool, &period_id, &Actor::system()).await.expect("关当月");

    // 造一笔要记账的退款
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let o = unmei_app::order::create(&pool, unmei_app::order::NewOrder {
        user_id: user.clone(), region: "cn".into(), channel_origin: "web".into(),
        lines: vec![unmei_app::order::NewOrderLine { sku_id: sku, qty: 1 }],
        shipping_address: None, contact: None, coupon_codes: vec![], note: None,
        ip: None, ua: None,
    }).await.expect("下单");
    // refund.payment_id 有外键 —— 造一笔真的支付行，不拿一个假 id 顶
    let pay = format!("pay-t{}", uuid::Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO payment(id, order_id, user_id, channel, amount_minor, currency,
                             status, paid_at, region)
         VALUES ($1, $2, $3, 'wechat_h5', 19900, 'CNY', 'success', NOW(), 'cn')",
    ).bind(&pay).bind(&o.order_id).bind(&user).execute(&pool).await.expect("插支付");

    let rfd = format!("rfd-t{}", uuid::Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO refund(id, order_id, payment_id, amount_minor, currency,
                            reason_code, actor_kind, status, region)
         VALUES ($1, $2, $3, 19900, 'CNY', 'test', 'system', 'success', 'cn')",
    ).bind(&rfd).bind(&o.order_id).bind(&pay).execute(&pool).await.expect("插退款");

    let e = finance::post_refund_journal(&pool, &rfd).await.unwrap_err();
    match e {
        DomainError::Conflict(m) => assert!(
            m.contains("没有地方落"), "该说清楚账落不下去，拿到的是：{m}"),
        其他 => panic!("关了账还能记进去 —— 那关账就是个摆设。拿到的是 {其他:?}"),
    }
}
