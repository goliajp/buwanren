//! 对账用例 · 对真库。
//!
//! 对账的意义是抓金额差异。从前它只按 `channel_txn_id` 匹配,匹配上就标
//! `matched` —— 于是「渠道说收了 39800、我们记的是 19900」这种最该被抓的情况,
//! 对账报的是全绿。这组测试就是钉住这一条:**差一分也要报**。

mod common;

use chrono::NaiveDate;
use unmei_app::recon::{self, SettlementRow};

/// 造一笔已入账、且带【渠道自己的流水号】的支付,返回 (payment_id, channel_txn_id)。
///
/// 渠道流水号现在走正路:`apply_succeeded(pool, 我方单号, Some(渠道流水号), ...)`。
/// 这个 fixture 从前得用一条裸 UPDATE 把它塞进去 —— 因为那时 `apply_succeeded`
/// 只有一个标识,渠道流水号根本没地方进来(见 2026-08-17 的回调匹配键修复)。
async fn paid(pool: &sqlx::PgPool, amount_minor: i64) -> (String, String) {
    use unmei_app::order::{NewOrder, NewOrderLine};
    let user = common::user(pool).await;
    let sku = common::sku_with_price(pool, "CNY", amount_minor).await;
    let created = unmei_app::order::create(
        pool,
        NewOrder {
            user_id: user.clone(),
            region: "cn".into(),
            channel_origin: "web".into(),
            lines: vec![NewOrderLine { sku_id: sku, qty: 1 }],
            shipping_address: None,
            contact: None,
            coupon_codes: vec![],
            note: None,
            ip: None,
            ua: None,
        },
    ).await.expect("建单");

    let pending = unmei_app::payment::start(pool, &created.order_id, &user, "wechat_jsapi", None)
        .await
        .expect("发起支付");
    let txn = common::uniq("4200001234");   // 渠道流水号的形状,与 payment id 明显不同
    unmei_app::payment::apply_succeeded(pool, &pending.payment_id, Some(&txn), chrono::Utc::now())
        .await
        .expect("入账");
    (pending.payment_id, txn)
}

async fn record_state(pool: &sqlx::PgPool, batch_id: &str, txn: &str) -> Option<String> {
    sqlx::query_scalar("SELECT match_state FROM recon_record WHERE batch_id=$1 AND channel_txn_id=$2")
        .bind(batch_id)
        .bind(txn)
        .fetch_optional(pool)
        .await
        .expect("查 recon_record")
}

fn day(n: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 8, n).expect("date")
}

// ═══════════════════════ 金额相符 ═══════════════════════

#[tokio::test]
async fn amount_equal_is_matched() {
    let pool = db_or_skip!();
    let (_pid, txn) = paid(&pool, 19900).await;
    let channel = common::uniq("ch");

    let out = recon::ingest_settlement(
        &pool, &channel, day(1), "CNY",
        &[SettlementRow { channel_txn_id: txn.clone(), amount_minor: 19900, status: "SUCCESS".into() }],
    ).await.expect("对账");

    assert_eq!(out.matched, 1);
    assert_eq!(out.amount_mismatch, 0);
    assert_eq!(out.status, "matched");
    assert_eq!(record_state(&pool, &out.batch_id, &txn).await.as_deref(), Some("matched"));
}

// ═══════════════════════ 金额不符 · 本条是 D9 的核心 ═══════════════════════

#[tokio::test]
async fn one_cent_more_is_a_mismatch_not_a_match() {
    let pool = db_or_skip!();
    let (_pid, txn) = paid(&pool, 19900).await;
    let channel = common::uniq("ch");

    // 差一分。不做自动容差 —— 钱的事不许模糊。
    let out = recon::ingest_settlement(
        &pool, &channel, day(2), "CNY",
        &[SettlementRow { channel_txn_id: txn.clone(), amount_minor: 19901, status: "SUCCESS".into() }],
    ).await.expect("对账");

    assert_eq!(out.matched, 0, "金额不同不该算对上");
    assert_eq!(out.amount_mismatch, 1);
    assert_eq!(out.status, "has_discrepancy");
    assert_eq!(record_state(&pool, &out.batch_id, &txn).await.as_deref(), Some("amount_mismatch"));
}

#[tokio::test]
async fn double_charge_shows_up_as_a_mismatch() {
    let pool = db_or_skip!();
    let (_pid, txn) = paid(&pool, 19900).await;
    let channel = common::uniq("ch");

    // 台账 D6 那个实测场景:应付 19900,渠道那边收了 39800。
    // 从前这一笔在对账里是绿的 —— 流水号对得上就算 matched。
    let out = recon::ingest_settlement(
        &pool, &channel, day(3), "CNY",
        &[SettlementRow { channel_txn_id: txn.clone(), amount_minor: 39800, status: "SUCCESS".into() }],
    ).await.expect("对账");

    assert_eq!(out.amount_mismatch, 1);
    assert_eq!(record_state(&pool, &out.batch_id, &txn).await.as_deref(), Some("amount_mismatch"));
}

#[tokio::test]
async fn mismatch_still_records_which_payment_it_was() {
    let pool = db_or_skip!();
    let (pid, txn) = paid(&pool, 19900).await;
    let channel = common::uniq("ch");

    let out = recon::ingest_settlement(
        &pool, &channel, day(4), "CNY",
        &[SettlementRow { channel_txn_id: txn.clone(), amount_minor: 100, status: "SUCCESS".into() }],
    ).await.expect("对账");

    // 人工处理差异时第一件事是打开那笔支付,别让他再查一次流水号
    let got: Option<String> = sqlx::query_scalar(
        "SELECT matched_payment_id FROM recon_record WHERE batch_id=$1 AND channel_txn_id=$2",
    ).bind(&out.batch_id).bind(&txn).fetch_one(&pool).await.expect("查");
    assert_eq!(got.as_deref(), Some(pid.as_str()));
}

// ═══════════════════════ 内部缺单 ═══════════════════════

#[tokio::test]
async fn unknown_txn_is_missing_in_internal() {
    let pool = db_or_skip!();
    let channel = common::uniq("ch");
    let txn = common::uniq("ghost");

    let out = recon::ingest_settlement(
        &pool, &channel, day(5), "CNY",
        &[SettlementRow { channel_txn_id: txn.clone(), amount_minor: 500, status: "SUCCESS".into() }],
    ).await.expect("对账");

    assert_eq!(out.missing_in_internal, 1);
    assert_eq!(out.status, "has_discrepancy");
    assert_eq!(record_state(&pool, &out.batch_id, &txn).await.as_deref(), Some("missing_in_internal"));
}

// ═══════════════════════ 批次层面 ═══════════════════════

#[tokio::test]
async fn counts_are_reported_apart_not_lumped_into_one_number() {
    let pool = db_or_skip!();
    let (_p1, ok_txn) = paid(&pool, 1000).await;
    let (_p2, bad_txn) = paid(&pool, 2000).await;
    let ghost = common::uniq("ghost");
    let channel = common::uniq("ch");

    let out = recon::ingest_settlement(
        &pool, &channel, day(6), "CNY",
        &[
            SettlementRow { channel_txn_id: ok_txn,  amount_minor: 1000, status: "SUCCESS".into() },
            SettlementRow { channel_txn_id: bad_txn, amount_minor: 2500, status: "SUCCESS".into() },
            SettlementRow { channel_txn_id: ghost,   amount_minor: 300,  status: "SUCCESS".into() },
        ],
    ).await.expect("对账");

    // 只报一个「有差异」说不出是缺了单还是金额不符,两种要走的处理完全不同
    assert_eq!((out.matched, out.amount_mismatch, out.missing_in_internal), (1, 1, 1));
    assert_eq!(out.total_count, 3);
    assert_eq!(out.status, "has_discrepancy");
}

#[tokio::test]
async fn second_pull_for_the_same_day_does_nothing() {
    let pool = db_or_skip!();
    let (_pid, txn) = paid(&pool, 700).await;
    let channel = common::uniq("ch");
    let rows = [SettlementRow { channel_txn_id: txn, amount_minor: 700, status: "SUCCESS".into() }];

    let first = recon::ingest_settlement(&pool, &channel, day(7), "CNY", &rows).await.expect("第一次");
    assert!(!first.skipped);

    let second = recon::ingest_settlement(&pool, &channel, day(7), "CNY", &rows).await.expect("第二次");
    assert!(second.skipped, "同一天同一渠道不该对两遍");

    let batches: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM recon_batch WHERE channel=$1 AND batch_date=$2",
    ).bind(&channel).bind(day(7)).fetch_one(&pool).await.expect("数批次");
    assert_eq!(batches, 1);
}

#[tokio::test]
async fn batch_total_is_the_channel_side_sum() {
    let pool = db_or_skip!();
    let channel = common::uniq("ch");
    let out = recon::ingest_settlement(
        &pool, &channel, day(8), "CNY",
        &[
            SettlementRow { channel_txn_id: common::uniq("g"), amount_minor: 100, status: "SUCCESS".into() },
            SettlementRow { channel_txn_id: common::uniq("g"), amount_minor: 250, status: "SUCCESS".into() },
        ],
    ).await.expect("对账");

    // 合计取渠道侧的数 —— 对账是拿渠道的账来核我们的账,不是反过来
    let total = common::scalar_i64(&pool, "SELECT total_amount_minor FROM recon_batch WHERE id=$1", &out.batch_id).await;
    assert_eq!(total, 350);
}
