//! 集成测试底座 —— 对着真 Postgres 跑。
//!
//! 为什么要真库:用例层的价值几乎全在 SQL 与事务边界上 ——
//! 状态机拦没拦住、outbox 有没有跟业务写入同批提交、影响行数为 0 时报不报 404。
//! 这些用 mock 测等于测 mock。
//!
//! ## 跑法
//!
//! ```bash
//! bash scripts/setup-dev.sh
//! cd backend
//! TEST_DATABASE_URL=postgres://unmei:unmei_dev_pwd@localhost:6032/unmei \
//!   cargo test -p unmei-app --test '*'
//! ```
//!
//! 没设 `TEST_DATABASE_URL` 时测试**跳过并打印一行**,不会假装通过。
//! CI 里这个变量必然有值,且会断言测试数 > 0(见 backend.yml)。
//!
//! ## 隔离
//!
//! 不清库、不加锁。每个测试用 [`uniq`] 生成自己的 ID,断言只针对自己造的数据,
//! 所以能并行跑,也能对着有 seed 数据的开发库跑。
//!
//! 唯一的例外是全局扫表的用例(如 `order::expire_unpaid`),那种断言「某条特定
//! 订单变成什么样」,不断言总数。

#![allow(dead_code)] // 每个测试二进制只用到其中一部分

use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tokio::sync::OnceCell;

static MIGRATED: OnceCell<()> = OnceCell::const_new();
static COUNTER: AtomicU64 = AtomicU64::new(0);

/// 进程内唯一后缀。并行测试之间不会撞 ID。
pub fn uniq(prefix: &str) -> String {
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let pid = std::process::id();
    format!("{prefix}-t{pid}-{n}")
}

/// 拿连接池;没配 `TEST_DATABASE_URL` 返回 `None`。
///
/// **每个测试自己建池,不共享。**`#[tokio::test]` 给每个测试起一个独立 runtime,
/// 而 sqlx 的池绑在建它的那个 runtime 上 —— 把池放进全局 `OnceCell` 复用,
/// 第一个测试跑完 runtime 一关,后面的测试就会拿到
/// 「A Tokio 1.x context was found, but it is being shutdown」。
/// 这个坑第一次跑就踩到了,别再改回共享。
///
/// migrations 用 `OnceCell` 保证每个测试二进制只跑一次(跑在它自己的池上,
/// 不跨 runtime 传递任何东西)。sqlx 的 migrator 本身还有 advisory lock,
/// 多个测试二进制并行也安全。
pub async fn pool() -> Option<PgPool> {
    let url = std::env::var("TEST_DATABASE_URL").ok()?;
    let pool = PgPoolOptions::new()
        // 每测试 2 条足够;并行度 × 2 要留在 postgres 的 max_connections 之内
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(20))
        .connect(&url)
        .await
        .unwrap_or_else(|e| panic!("TEST_DATABASE_URL 设了但连不上: {e}"));

    MIGRATED
        .get_or_init(|| async {
            sqlx::migrate!("../migrations").run(&pool).await.expect("migrations");
        })
        .await;

    Some(pool)
}

/// 取池,取不到就**让测试炸掉**并说清怎么办。
///
/// 一开始这里写的是「静默 return 跳过」,结果 `cargo test` 报 15 passed
/// 而一个都没跑 —— 测试框架把 skip 的输出吞了,看上去全绿。
/// 这种假绿比没有测试更糟,所以改成硬失败:
///
/// - 设了 `TEST_DATABASE_URL` → 跑
/// - 没设、但显式设了 `UNMEI_SKIP_DB_TESTS=1` → 跳过(你自己声明的,不会误会)
/// - 都没设 → panic,并告诉你两条路各怎么走
#[macro_export]
macro_rules! db_or_skip {
    () => {
        match $crate::common::pool().await {
            Some(p) => p,
            None => {
                if std::env::var("UNMEI_SKIP_DB_TESTS").as_deref() == Ok("1") {
                    return;
                }
                panic!(
                    "\n{} 需要数据库,但没有配。二选一:\n\
                     \x20 跑起来:  bash scripts/setup-dev.sh && \\\n\
                     \x20           TEST_DATABASE_URL=postgres://unmei:unmei_dev_pwd@localhost:6032/unmei cargo test\n\
                     \x20 跳过它:  UNMEI_SKIP_DB_TESTS=1 cargo test\n\
                     （不提供静默跳过 —— 那会让 cargo test 报一片绿而其实什么都没跑）\n",
                    module_path!()
                );
            }
        }
    };
}

// ═══════════════════════════ fixture ═══════════════════════════
//
// 一律自建,不依赖 seed。seed 会变、会被别的测试改,拿它当前提迟早出玄学失败。

/// 建一个用户,返回 user_id。
pub async fn user(pool: &PgPool) -> String {
    let id = uniq("u");
    sqlx::query("INSERT INTO app_user(id, nickname, platform, region) VALUES ($1,'测试','web','cn')")
        .bind(&id)
        .execute(pool)
        .await
        .expect("insert app_user");
    id
}

/// 建一个「商品 + SKU + 一条激活价」,返回 sku_id。
///
/// 建单用例只认 SKU 与 price_book,所以 product 只是为了满足外键。
pub async fn sku_with_price(pool: &PgPool, currency: &str, price_minor: i64) -> String {
    let product_id = uniq("prd");
    let sku_id = uniq("sku");
    let price_id = uniq("pb");

    sqlx::query(
        "INSERT INTO product(id, code, name, category, kind, status)
         VALUES ($1, $1, '测试商品', 'report', 'one_shot', 'listed')",
    )
    .bind(&product_id)
    .execute(pool)
    .await
    .expect("insert product");

    sqlx::query(
        "INSERT INTO sku(id, product_id, code, name, spec_json, default_currency, status)
         VALUES ($1, $2, $1, '测试 SKU', $3, $4, 'active')",
    )
    .bind(&sku_id)
    .bind(&product_id)
    .bind(json!({"note": "fixture"}))
    .bind(currency)
    .execute(pool)
    .await
    .expect("insert sku");

    sqlx::query(
        "INSERT INTO price_book(id, sku_id, currency, price_minor, region, platform, status)
         VALUES ($1, $2, $3, $4, 'cn', 'all', 'active')",
    )
    .bind(&price_id)
    .bind(&sku_id)
    .bind(currency)
    .bind(price_minor)
    .execute(pool)
    .await
    .expect("insert price_book");

    sku_id
}

/// 建一个 SKU 但**不给价** —— 用来测「无激活价」分支。
pub async fn sku_without_price(pool: &PgPool) -> String {
    let product_id = uniq("prd");
    let sku_id = uniq("sku");
    sqlx::query(
        "INSERT INTO product(id, code, name, category, kind, status)
         VALUES ($1, $1, '无价商品', 'report', 'one_shot', 'listed')",
    )
    .bind(&product_id)
    .execute(pool)
    .await
    .expect("insert product");
    sqlx::query(
        "INSERT INTO sku(id, product_id, code, name, status)
         VALUES ($1, $2, $1, '无价 SKU', 'active')",
    )
    .bind(&sku_id)
    .bind(&product_id)
    .execute(pool)
    .await
    .expect("insert sku");
    sku_id
}

// ═══════════════════════════ 断言辅助 ═══════════════════════════

pub async fn scalar_string(pool: &PgPool, sql: &str, bind: &str) -> Option<String> {
    sqlx::query_scalar(sql)
        .bind(bind)
        .fetch_optional(pool)
        .await
        .expect("query")
}

pub async fn scalar_i64(pool: &PgPool, sql: &str, bind: &str) -> i64 {
    sqlx::query_scalar(sql)
        .bind(bind)
        .fetch_one(pool)
        .await
        .expect("query")
}

/// 某聚合上某类领域事件的条数。用来验 outbox 有没有跟业务写入同批落地。
pub async fn outbox_count(pool: &PgPool, kind: &str, aggregate_id: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM outbox_event WHERE kind=$1 AND aggregate_id=$2")
        .bind(kind)
        .bind(aggregate_id)
        .fetch_one(pool)
        .await
        .expect("count outbox")
}

pub async fn order_status(pool: &PgPool, order_id: &str) -> Option<String> {
    scalar_string(pool, "SELECT status FROM order_record WHERE id=$1", order_id).await
}
