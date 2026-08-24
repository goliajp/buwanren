//! 幂等键 · 对真库。
//!
//! 这一层的价值全在并发与重放上,所以断言写在这两件事上,不在函数签名上。
//! 特别是「两个并发请求带同一个键」那条:先 SELECT 再 INSERT 的实现在单线程
//! 测试里看起来完全正常,只有真的并发才露馅。

mod common;

use serde_json::json;
use unmei_app::idempotency::{self, Claim};

fn key() -> String {
    common::uniq("idem")
}

// ═══════════════════════ 基本三态 ═══════════════════════

#[tokio::test]
async fn first_claim_is_fresh() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"sku": "a", "qty": 1}));

    let c = idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp).await.expect("claim");
    assert_eq!(c, Claim::Fresh);
}

#[tokio::test]
async fn same_key_same_params_replays_the_first_response() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"sku": "a", "qty": 1}));
    let body = json!({"order_id": "ord-123"});

    assert_eq!(idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp).await.unwrap(), Claim::Fresh);
    idempotency::complete(&pool, &k, Some("u1"), 201, &body).await.expect("complete");

    let again = idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp).await.unwrap();
    assert_eq!(again, Claim::Replay { status: 201, body });
}

#[tokio::test]
async fn claim_while_the_first_is_still_running_is_in_flight() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"a": 1}));

    // 占住但不 complete —— 模拟第一个请求还在执行
    assert_eq!(idempotency::claim(&pool, &k, None, "POST", "/v1/orders", &fp).await.unwrap(), Claim::Fresh);

    let second = idempotency::claim(&pool, &k, None, "POST", "/v1/orders", &fp).await.unwrap();
    assert_eq!(second, Claim::InFlight, "第二个请求不该也拿到 Fresh");
}

/// 同一个键、同样的请求体，但是【两个不同的用户】—— 各走各的。
///
/// 这是 2026-08-23 补的。在此之前主键只有 `key`，占键、查重、回写、放开
/// 全都不看 `user_id`（表里有那一列，没人用它过滤）。实测后果：
/// 乙拿到甲那一单的 `order_id` 与金额，而乙自己那一单根本没建 ——
/// 既是跨用户外泄，也是一次静默的没执行。
/// 键是客户端给的头，所以「撞上的概率」不由我们说了算。
#[tokio::test]
async fn same_key_two_users_do_not_collide() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"a": 1}));

    assert_eq!(
        idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp).await.unwrap(),
        Claim::Fresh,
    );
    idempotency::complete(&pool, &k, Some("u1"), 201, &json!({"order_id": "ord-甲"})).await.unwrap();

    // 乙拿同一个键、同样的体过来：这是【乙的第一次】，必须放行去真的执行
    assert_eq!(
        idempotency::claim(&pool, &k, Some("u2"), "POST", "/v1/orders", &fp).await.unwrap(),
        Claim::Fresh,
        "乙的第一次被当成了甲的重放 —— 乙那一单不会被执行，而乙以为成功了",
    );
    idempotency::complete(&pool, &k, Some("u2"), 201, &json!({"order_id": "ord-乙"})).await.unwrap();

    // 各自重放，各拿各的
    match idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp).await.unwrap() {
        Claim::Replay { body, .. } => assert_eq!(body["order_id"], "ord-甲"),
        other => panic!("甲的重放拿到了 {other:?}"),
    }
    match idempotency::claim(&pool, &k, Some("u2"), "POST", "/v1/orders", &fp).await.unwrap() {
        Claim::Replay { body, .. } => assert_eq!(body["order_id"], "ord-乙", "乙拿到了甲的响应体"),
        other => panic!("乙的重放拿到了 {other:?}"),
    }

    // 乙把自己的键放开，不该动到甲那一行
    idempotency::release(&pool, &k, Some("u2")).await.unwrap();
    match idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp).await.unwrap() {
        Claim::Replay { body, .. } => assert_eq!(body["order_id"], "ord-甲", "甲那一行被乙的 release 动了"),
        other => panic!("甲那一行没了：{other:?}"),
    }
}

#[tokio::test]
async fn same_key_different_params_is_refused_not_replayed() {
    let pool = db_or_skip!();
    let k = key();
    let fp1 = idempotency::fingerprint(&json!({"sku": "a", "qty": 1}));
    let fp2 = idempotency::fingerprint(&json!({"sku": "b", "qty": 9}));

    idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp1).await.unwrap();
    idempotency::complete(&pool, &k, Some("u1"), 201, &json!({"order_id": "ord-1"})).await.unwrap();

    // 把上一次的响应还给它比报错更糟 —— 它会以为自己这次新请求成功了
    let c = idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp2).await.unwrap();
    assert_eq!(c, Claim::Fingerprint);
}

#[tokio::test]
async fn same_key_on_a_different_endpoint_is_refused() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"a": 1}));

    idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders", &fp).await.unwrap();
    idempotency::complete(&pool, &k, Some("u1"), 201, &json!({})).await.unwrap();

    let c = idempotency::claim(&pool, &k, Some("u1"), "POST", "/v1/orders/x/pay", &fp).await.unwrap();
    assert_eq!(c, Claim::Fingerprint, "同一个键用在两个端点上，「同参」没有意义");
}

// ═══════════════════════ 并发 · 本组的核心 ═══════════════════════

#[tokio::test]
async fn only_one_of_many_concurrent_claims_wins() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"sku": "a"}));

    // 先 SELECT 再 INSERT 的实现在这里会让多个请求同时拿到 Fresh，
    // 于是同一张订单被下两遍 —— 那正是 D6 要堵的那个洞。
    let mut set = tokio::task::JoinSet::new();
    for _ in 0..8 {
        let (p, k, fp) = (pool.clone(), k.clone(), fp.clone());
        set.spawn(async move { idempotency::claim(&p, &k, Some("u1"), "POST", "/v1/orders", &fp).await });
    }
    let mut fresh = 0;
    let mut in_flight = 0;
    while let Some(r) = set.join_next().await {
        match r.expect("join").expect("claim") {
            Claim::Fresh => fresh += 1,
            Claim::InFlight => in_flight += 1,
            other => panic!("并发下不该出现 {other:?}"),
        }
    }
    assert_eq!(fresh, 1, "只能有一个请求拿到执行权");
    assert_eq!(in_flight, 7);
}

// ═══════════════════════ 失败要放开键 ═══════════════════════

#[tokio::test]
async fn release_lets_the_client_retry() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"a": 1}));

    idempotency::claim(&pool, &k, None, "POST", "/v1/orders", &fp).await.unwrap();
    // 处理失败了。不放开的话这个键要卡满 24 小时,而客户端并不知道要换一个
    idempotency::release(&pool, &k, None).await.expect("release");

    let retry = idempotency::claim(&pool, &k, None, "POST", "/v1/orders", &fp).await.unwrap();
    assert_eq!(retry, Claim::Fresh);
}

#[tokio::test]
async fn release_does_not_touch_a_finished_key() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"a": 1}));
    let body = json!({"order_id": "ord-keep"});

    idempotency::claim(&pool, &k, None, "POST", "/v1/orders", &fp).await.unwrap();
    idempotency::complete(&pool, &k, None, 201, &body).await.unwrap();
    idempotency::release(&pool, &k, None).await.expect("release");

    // 已经落了响应的键不归 release 管 —— 那是别人的成功结果
    let c = idempotency::claim(&pool, &k, None, "POST", "/v1/orders", &fp).await.unwrap();
    assert_eq!(c, Claim::Replay { status: 201, body });
}

// ═══════════════════════ 指纹 ═══════════════════════

#[tokio::test]
async fn field_order_does_not_change_the_fingerprint() {
    let _ = db_or_skip!();
    let a = idempotency::fingerprint(&json!({"sku": "x", "qty": 2}));
    let b = idempotency::fingerprint(&json!({"qty": 2, "sku": "x"}));
    assert_eq!(a, b, "字段顺序不同的同一个请求应当算同参");
}

#[tokio::test]
async fn a_changed_value_changes_the_fingerprint() {
    let _ = db_or_skip!();
    let a = idempotency::fingerprint(&json!({"sku": "x", "qty": 2}));
    let b = idempotency::fingerprint(&json!({"sku": "x", "qty": 3}));
    assert_ne!(a, b);
}

#[tokio::test]
async fn nested_field_order_also_does_not_matter() {
    let _ = db_or_skip!();
    let a = idempotency::fingerprint(&json!({"o": {"p": 1, "q": [1, {"r": 2, "s": 3}]}}));
    let b = idempotency::fingerprint(&json!({"o": {"q": [1, {"s": 3, "r": 2}], "p": 1}}));
    assert_eq!(a, b);
}

// ═══════════════════════ 过期 ═══════════════════════

#[tokio::test]
async fn an_expired_key_can_be_claimed_again() {
    let pool = db_or_skip!();
    let k = key();
    let fp = idempotency::fingerprint(&json!({"a": 1}));

    idempotency::claim(&pool, &k, None, "POST", "/v1/orders", &fp).await.unwrap();
    idempotency::complete(&pool, &k, None, 201, &json!({"x": 1})).await.unwrap();
    sqlx::query("UPDATE idempotency_log SET expires_at = NOW() - INTERVAL '1 second' WHERE key = $1")
        .bind(&k).execute(&pool).await.expect("催熟");

    let c = idempotency::claim(&pool, &k, None, "POST", "/v1/orders", &fp).await.unwrap();
    assert_eq!(c, Claim::Fresh, "过期的键该能重新占用，否则键空间只进不出");
}

#[tokio::test]
async fn purge_removes_only_expired_rows() {
    let pool = db_or_skip!();
    let live = key();
    let dead = key();
    let fp = idempotency::fingerprint(&json!({"a": 1}));

    idempotency::claim(&pool, &live, None, "POST", "/v1/orders", &fp).await.unwrap();
    idempotency::claim(&pool, &dead, None, "POST", "/v1/orders", &fp).await.unwrap();
    sqlx::query("UPDATE idempotency_log SET expires_at = NOW() - INTERVAL '1 hour' WHERE key = $1")
        .bind(&dead).execute(&pool).await.expect("催熟");

    idempotency::purge_expired(&pool).await.expect("purge");

    let still: Option<String> = sqlx::query_scalar("SELECT key FROM idempotency_log WHERE key=$1")
        .bind(&live).fetch_optional(&pool).await.unwrap();
    assert!(still.is_some(), "没过期的不该被清掉");
    let gone: Option<String> = sqlx::query_scalar("SELECT key FROM idempotency_log WHERE key=$1")
        .bind(&dead).fetch_optional(&pool).await.unwrap();
    assert!(gone.is_none());
}
