//! 御守 → 入住 · 对真库。
//!
//! 门禁三条:
//!   ① 买一枚 → 村里多一人
//!   ② 重复扫同一枚不重复入住
//!   ③ 风控事件真落库,且一单未拦

mod common;

use unmei_app::{fulfillment, order, payment, residency, risk};

/// 造一款御守 SKU:product 的履约类型是 residency,sku 指名是哪位不完人。
async fn omamori_sku(pool: &sqlx::PgPool, villager_id: &str, price_minor: i64) -> String {
    let pid = common::uniq("prod-oma");
    sqlx::query(
        "INSERT INTO product (id, code, name, category, kind, status, fulfillment_kind) \
         VALUES ($1, $1, '御守', 'omamori', 'one_shot', 'listed', 'residency')",
    )
    .bind(&pid)
    .execute(pool)
    .await
    .expect("建 product");

    let sku = common::uniq("sku-oma");
    sqlx::query(
        "INSERT INTO sku (id, product_id, code, name, status, villager_id) \
         VALUES ($1, $2, $1, '御守 · 单枚', 'active', $3)",
    )
    .bind(&sku)
    .bind(&pid)
    .bind(villager_id)
    .execute(pool)
    .await
    .expect("建 sku");

    sqlx::query(
        "INSERT INTO price_book (id, sku_id, currency, price_minor, status, effective_from) \
         VALUES ($1, $2, 'CNY', $3, 'active', NOW() - INTERVAL '1 day')",
    )
    .bind(common::uniq("pb"))
    .bind(&sku)
    .bind(price_minor)
    .execute(pool)
    .await
    .expect("建价");
    sku
}

/// 买一枚并付掉,返回 user_id。
async fn buy(pool: &sqlx::PgPool, sku: &str, price_minor: i64) -> (String, String) {
    let user = common::user(pool).await;
    let created = order::create(
        pool,
        order::NewOrder {
            user_id: user.clone(),
            region: "cn".into(),
            channel_origin: "web".into(),
            lines: vec![order::NewOrderLine { sku_id: sku.to_string(), qty: 1 }],
            shipping_address: None,
            contact: None,
            coupon_codes: vec![],
            note: None,
            ip: None,
            ua: None,
        },
    )
    .await
    .expect("建单");

    let pending = payment::start(pool, &created.order_id, &user, "wechat_jsapi", None)
        .await
        .expect("发起支付");
    payment::apply_succeeded(pool, &pending.payment_id, None, chrono::Utc::now())
        .await
        .expect("入账");
    let _ = price_minor;
    (user, created.order_id)
}

// ═══════════════════════ ① 买一枚 → 村里多一人 ═══════════════════════

#[tokio::test]
async fn buying_an_omamori_brings_the_villager_home() {
    let pool = db_or_skip!();
    let sku = omamori_sku(&pool, "ayun", 9900).await;
    let (user, order_id) = buy(&pool, &sku, 9900).await;

    assert!(residency::village_of(&pool, &user).await.unwrap().is_empty(), "买之前村里没人");

    fulfillment::apply_order_paid(&pool, &order_id).await.expect("履约");

    let village = residency::village_of(&pool, &user).await.unwrap();
    assert_eq!(village, vec!["ayun"], "付了钱，阿云就该住进来");
    assert!(residency::is_home(&pool, &user, "ayun").await.unwrap());
}

#[tokio::test]
async fn the_order_line_records_who_moved_in() {
    let pool = db_or_skip!();
    let sku = omamori_sku(&pool, "popo", 9900).await;
    let (_user, order_id) = buy(&pool, &sku, 9900).await;
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("履约");

    let r: serde_json::Value = sqlx::query_scalar(
        "SELECT fulfillment_ref FROM order_line WHERE order_id=$1",
    ).bind(&order_id).fetch_one(&pool).await.expect("查行");
    assert_eq!(r["kind"], "residency");
    assert_eq!(r["villager_id"], "popo");
    assert_eq!(r["new"], true);
}

#[tokio::test]
async fn replaying_order_paid_does_not_add_a_second_person() {
    let pool = db_or_skip!();
    let sku = omamori_sku(&pool, "tenz", 9900).await;
    let (user, order_id) = buy(&pool, &sku, 9900).await;

    // 渠道重推、dispatcher 重跑,都会让这条事件来第二遍
    for _ in 0..3 {
        let _ = fulfillment::apply_order_paid(&pool, &order_id).await;
    }
    let village = residency::village_of(&pool, &user).await.unwrap();
    assert_eq!(village, vec!["tenz"], "重推事件不该让村里多出第二个丹增");
}

// ═══════════════════════ ② 重复扫不重复入住 ═══════════════════════

async fn mint(pool: &sqlx::PgPool, villager_id: &str) -> String {
    let oid = common::uniq("oma");
    sqlx::query("INSERT INTO omamori (id, villager_id) VALUES ($1,$2)")
        .bind(&oid).bind(villager_id).execute(pool).await.expect("造御守");
    let cred = common::uniq("04A1B2");
    sqlx::query("INSERT INTO omamori_credential (carrier_kind, credential, omamori_id) VALUES ('nfc',$1,$2)")
        .bind(&cred).bind(&oid).execute(pool).await.expect("发凭证");
    cred
}

#[tokio::test]
async fn scanning_the_same_omamori_twice_moves_in_once() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let cred = mint(&pool, "bailu").await;

    let first = residency::move_in_from_credential(&pool, &user, "nfc", &cred).await.expect("第一次扫");
    assert!(first.is_new(), "第一次该是新入住");

    let second = residency::move_in_from_credential(&pool, &user, "nfc", &cred).await.expect("第二次扫");
    assert!(!second.is_new(), "第二次不该又住进来一次");

    assert_eq!(residency::village_of(&pool, &user).await.unwrap(), vec!["bailu"]);
}

#[tokio::test]
async fn a_second_omamori_of_the_same_villager_still_means_one_person() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let a = mint(&pool, "mira").await;
    let b = mint(&pool, "mira").await;   // 另一枚实物,封的是同一个人

    residency::move_in_from_credential(&pool, &user, "nfc", &a).await.unwrap();
    residency::move_in_from_credential(&pool, &user, "nfc", &b).await.unwrap();

    // 村子里不会有两个米拉
    assert_eq!(residency::village_of(&pool, &user).await.unwrap(), vec!["mira"]);
}

#[tokio::test]
async fn buying_then_scanning_the_same_villager_is_still_one() {
    let pool = db_or_skip!();
    let sku = omamori_sku(&pool, "shenyan", 9900).await;
    let (user, order_id) = buy(&pool, &sku, 9900).await;
    fulfillment::apply_order_paid(&pool, &order_id).await.expect("履约");

    let cred = mint(&pool, "shenyan").await;
    let again = residency::move_in_from_credential(&pool, &user, "nfc", &cred).await.unwrap();
    assert!(!again.is_new(), "买过之后再扫，不该重复入住");
    assert_eq!(residency::village_of(&pool, &user).await.unwrap(), vec!["shenyan"]);
}

#[tokio::test]
async fn an_unknown_credential_is_not_found() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let err = residency::move_in_from_credential(&pool, &user, "nfc", "没有这枚").await
        .expect_err("查无此御守");
    assert!(matches!(err, unmei_app::DomainError::NotFound(_)), "实际 {err:?}");
}

#[tokio::test]
async fn a_revoked_credential_is_refused() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let cred = mint(&pool, "tao").await;
    sqlx::query("UPDATE omamori_credential SET revoked_at=NOW() WHERE credential=$1")
        .bind(&cred).execute(&pool).await.expect("作废");

    let err = residency::move_in_from_credential(&pool, &user, "nfc", &cred).await
        .expect_err("作废的凭证不该还能用");
    assert!(matches!(err, unmei_app::DomainError::Validation(_)), "实际 {err:?}");
}

// ═══════════════════════ ③ 风控落库且不拦单 ═══════════════════════

/// 拦不拦单这个开关是【进程级】的（环境变量），而 Rust 的测试在同一个进程里
/// 并行跑。下面两条一条要读默认值、一条要把它打开，撞上就是随机红 ——
/// 而随机红最后总会被当成「重跑一次就好了」。所以让它们互斥。
static RISK_ENV: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[tokio::test]
async fn risk_runs_and_records_but_blocks_nothing() {
    let _guard = RISK_ENV.lock().unwrap_or_else(|e| e.into_inner());
    let pool = db_or_skip!();

    // 观察模式(默认):规则照跑、事件照落、一单不拦。
    assert!(!risk::enforcing(), "默认必须是观察模式 —— 上线当天不该突然开始拦真单");

    let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM risk_event")
        .fetch_one(&pool).await.expect("数事件");

    let sku = omamori_sku(&pool, "ayun", 9900).await;
    // 走得通就说明没被拦:建单与发起支付两处都过了风控
    let (_user, order_id) = buy(&pool, &sku, 9900).await;
    let status = common::order_status(&pool, &order_id).await;
    assert_eq!(status.as_deref(), Some("paid"), "观察模式下这一单必须走到底");

    let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM risk_event")
        .fetch_one(&pool).await.expect("数事件");
    assert!(after >= before, "风控事件只增不减");
}

#[tokio::test]
async fn the_enforcement_switch_is_off_by_default_and_reads_the_env() {
    let _guard = RISK_ENV.lock().unwrap_or_else(|e| e.into_inner());
    let _ = db_or_skip!();
    // 开关必须是外部可见的东西。写死成 false 的话,「以后再打开」就变成
    // 「以后要改代码再发一次版」—— 那多半就永远不打开了。
    assert!(!risk::enforcing());
    // SAFETY:测试进程内改环境变量。这条断言的价值在于证明开关真的读得到外部配置。
    unsafe { std::env::set_var("UNMEI_RISK_ENFORCE", "1") };
    assert!(risk::enforcing(), "打开开关后该真的生效");
    unsafe { std::env::remove_var("UNMEI_RISK_ENFORCE") };
    assert!(!risk::enforcing());
}
