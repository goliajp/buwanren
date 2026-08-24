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
//!
//! ## 别断言全表扫描的影响行数
//!
//! `expire_unpaid` / `expire_overdue` 这类用例扫的是整张表,而**后端的 sweeper
//! 也在扫同一张表**(每 30 秒一跳;2026-08-19 起每一跳都扫,此前只在有待查支付时
//! 才顺带跑一次)。它抢先一步的话,用例这次调用就是 0 行 —— 2026-08-19 一次完整
//! workspace 跑里真红过一次。两条用例已改成只断结果:那条该变的变了、不该动的
//! 没动。
//!
//! 断结果这一侧**没有被削弱**:把 `expire_unpaid` 的条件打瘸,后端在跑时连测
//! 四次全红,后端停掉也红。sweeper 30 秒一跳,而用例从建单到调用只有几毫秒,
//! 落进那个窗口的概率极低 —— 「行数」会被抢走,「结果」几乎不会。

#![allow(dead_code)] // 每个测试二进制只用到其中一部分

use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tokio::sync::OnceCell;

static MIGRATED: OnceCell<()> = OnceCell::const_new();
static COUNTER: AtomicU64 = AtomicU64::new(0);

/// 唯一后缀。并行测试之间不会撞 ID，**跨多次运行也不会**。
///
/// 原来只有 `pid + 计数`。pid 会被系统复用，而计数每个进程都从 0 开始 ——
/// 于是「上一次跑用过同一个 pid」时，第一个 `u-t{pid}-0` 直接撞主键。
/// 库里跑的轮次越多，撞的概率越大：2026-08-18 连着两次全量测试都栽在这上面
/// （`duplicate key ... u-t25055-0 already exists`），而它看起来像别的毛病。
///
/// 所以再掺一个【进程启动时刻的纳秒】：同一 pid 隔一次运行也不会重合。
static NONCE: std::sync::OnceLock<u64> = std::sync::OnceLock::new();

pub fn uniq(prefix: &str) -> String {
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let pid = std::process::id();
    let nonce = *NONCE.get_or_init(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos() as u64 ^ (d.as_secs() & 0xffff))
            .unwrap_or(0)
    });
    format!("{prefix}-t{pid}x{nonce}-{n}")
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
        .unwrap_or_else(|e| panic!("TEST_DATABASE_URL 设了但连不上：{e}"));

    MIGRATED
        .get_or_init(|| async {
            sqlx::migrate!("../migrations").run(&pool).await.expect("migrations");
            seed_reference_data(&pool).await;
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

/// 灌**参照数据**:40 位不完人、35 门术数、缺的偏向、说话模板。
///
/// 下面那条「一律自建,不依赖 seed」说的是**会变的演示数据**(商品、订单、优惠券)——
/// 拿它们当前提确实会出玄学失败。参照数据是另一回事:它由
/// `scripts/export-cast.py` 从设计册生成,测试只读不改,而且
/// `villager_reading_use_cases` 断言的正是「设计册 → seed → 行为」这条管线
/// (阿云缺勤所以偏向动、婆婆与米拉同修塔罗却说不同的话)——没有它,
/// 那些断言就没有主语。
///
/// 应用启动时灌的是同一批文件(见 `unmei-api/src/main.rs`),这里只是跟上。
///
/// ★ 这一步曾经缺席,后果是 CI 上 8 条测试撞外键报错,而本机全绿 ——
///   因为本机的库早被我手工灌过。典型的「在我机器上是好的」。
async fn seed_reference_data(pool: &PgPool) {
    for (what, sql) in [
        // 主 seed 在前:宜忌词池、卦辞、徽章、feature_flag 都在它里面。
        // `villager::reading` 从 `yiji_word` 取宜忌 —— 没有它,问签用例
        // 会报「yiji_word 里没有 yi 词」。CI 上就是这么红的第二次。
        ("seed", include_str!("../../../seed/seed.sql")),
        ("villagers", include_str!("../../../seed/villagers.sql")),
        ("art_leaf", include_str!("../../../seed/art_leaf.sql")),
        ("lack_bias", include_str!("../../../seed/lack_bias.sql")),
        ("villager_voice", include_str!("../../../seed/villager_voice.sql")),
    ] {
        sqlx::raw_sql(sql)
            .execute(pool)
            .await
            .unwrap_or_else(|e| panic!("灌参照数据 {what} 失败：{e}"));
    }
    // 灌完就断言它在。外键报错读起来像「测试写错了」,
    // 而真正的问题是「参照数据没进来」—— 那两件事该长得不一样。
    // 逐项断言,而不是只数一张表 —— 第一次修这个 bug 时我只断言了村民数,
    // 于是 CI 顺利越过外键那一关,又在下一张表上红了一次。
    // 参照数据是一整套,要么都在,要么就该在这里说清楚缺的是哪一样。
    for (table, want, why) in [
        ("villager", 40, "40 位不完人，由 scripts/export-cast.py 从设计册导出"),
        ("art", 35, "35 门术数，同上"),
        ("lack_bias", 41, "每个「缺」偏向哪个方向"),
        ("villager_voice", 7, "说话模板（只给已开房的写，不批量凑）"),
    ] {
        let n: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(pool)
            .await
            .unwrap_or_else(|e| panic!("数 {table} 失败：{e}"));
        assert_eq!(n, want, "参照数据 {table} 没灌全：应有 {want} 行，实际 {n} —— {why}");
    }

    /* 数量对不等于接得上。四个数全对，而某位村民的「缺」没有对应偏向，
       三层里的偏向层对他就不成立 —— 他的签会退回通用口气。
       阶段 C 要往里加 34 间房的数据，这种错最容易在那时候发生。

       **只查这一条**：`art_key` 与 `villager_voice.villager_id` 都已经有外键守着
       （`villager_art_key_fkey` / `villager_voice_villager_id_fkey`），
       schema 保证过的事不在这里重复防一遍。`lack` 没有外键，只有 NOT NULL。 */
    let 断链: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM villager v \
         WHERE NOT EXISTS (SELECT 1 FROM lack_bias b WHERE b.lack = v.lack)",
    )
    .fetch_one(pool)
    .await
    .expect("查缺与偏向的对应");
    assert_eq!(断链, 0, "有 {断链} 位村民的「缺」没有对应的偏向 —— 三层里的偏向层对他不成立");
    // 内容池:问签要从这里取宜忌。空池的报错是「yiji_word 里没有 yi 词」,
    // 读起来像用例写错了,其实是 seed 没进来。
    for kind in ["yi", "ji"] {
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM yiji_word WHERE type = $1")
            .bind(kind)
            .fetch_one(pool)
            .await
            .expect("数宜忌词");
        assert!(n > 0, "yiji_word 的 {kind} 词池是空的 —— seed/seed.sql 没灌进来");
    }
}

// ═══════════════════════════ fixture ═══════════════════════════
//
// 一律自建,不依赖 seed。seed 会变、会被别的测试改,拿它当前提迟早出玄学失败。
// (参照数据除外,见上面 `seed_reference_data` 的说明。)

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
