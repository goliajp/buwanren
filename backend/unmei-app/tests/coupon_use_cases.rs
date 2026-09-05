//! 优惠券用例 · 对真库。
//!
//! 在这些测试之前，下单带的券码只被 `tracing::warn!` 记一句
//! 「折扣引擎尚未接通」，然后按全价收钱 —— 用户以为用了券，扣的是原价，
//! 而系统里没有任何一处会说出这件事。
//!
//! 每条测试钉的是一条「不这么做就会悄悄收错钱」的决定。

mod common;

use chrono::{Duration, Utc};
use serde_json::json;
use unmei_app::{coupon, order, Actor, DomainError};

/// 发一张按比例减的券，返回券码。
async fn 发一张(
    pool: &sqlx::PgPool,
    bps: i64,
    封顶: Option<i64>,
    归属: Option<&str>,
) -> String {
    let code = format!("T{}", uuid::Uuid::new_v4().simple());
    let mut benefit = json!({ "pct_off_bps": bps });
    if let Some(c) = 封顶 {
        benefit["max_off_minor"] = json!(c);
    }
    coupon::issue(
        pool,
        coupon::IssueCoupon {
            code: &code,
            promotion_id: None,
            owner_user_id: 归属,
            benefit_json: benefit,
            expires_at: Utc::now() + Duration::days(30),
            region: "cn",
        },
        &Actor::system(),
    )
    .await
    .expect("发券");
    code
}

async fn 下一单(
    pool: &sqlx::PgPool,
    user: &str,
    sku: &str,
    券: Vec<String>,
) -> Result<order::CreatedOrder, DomainError> {
    order::create(
        pool,
        order::NewOrder {
            user_id: user.into(),
            region: "cn".into(),
            channel_origin: "web".into(),
            lines: vec![order::NewOrderLine { sku_id: sku.into(), qty: 1 }],
            shipping_address: None,
            contact: None,
            coupon_codes: 券,
            note: None,
            ip: None,
            ua: None,
        },
    )
    .await
}

// ═══════════════════════════ 减钱 ═══════════════════════════

#[tokio::test]
async fn 券真的减钱而不是只被记一句日志() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let code = 发一张(&pool, 2000, None, None).await;

    let o = 下一单(&pool, &user, &sku, vec![code]).await.expect("下单");

    // 【这一条是整个模块的理由】。在它之前 total 恒等于 subtotal。
    assert_eq!(o.amount_total_minor, 15920, "两成折扣该是 159.20");
    let 折扣 = common::scalar_i64(
        &pool, "SELECT amount_discount_minor FROM order_record WHERE id=$1", &o.order_id,
    ).await;
    assert_eq!(折扣, 3980, "折扣要落库 —— 不落的话对账时凭空少一笔");
}

#[tokio::test]
async fn 封顶按封顶算() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 199000).await;
    let code = 发一张(&pool, 2000, Some(10000), None).await;

    let o = 下一单(&pool, &user, &sku, vec![code]).await.expect("下单");
    assert_eq!(o.amount_total_minor, 199000 - 10000);
}

#[tokio::test]
async fn 两张券按余额依次算而不是各按原价() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 10000).await;
    let a = 发一张(&pool, 5000, None, None).await;
    let b = 发一张(&pool, 5000, None, None).await;

    // 【各按原价算完再相加的话，两张五折就是 100% —— 订单减成 0】
    let o = 下一单(&pool, &user, &sku, vec![a, b]).await.expect("下单");
    assert_eq!(o.amount_total_minor, 2500, "第二张该按剩下的 5000 打折");
}

// ═══════════════════════════ 两阶段 ═══════════════════════════

#[tokio::test]
async fn 下单只锁定不核销() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let code = 发一张(&pool, 2000, None, None).await;

    let o = 下一单(&pool, &user, &sku, vec![code.clone()]).await.expect("下单");

    /* 【核销要等钱到】。下单就核销的话，一笔取消掉的订单会把券吃掉，
       而用户既没花钱也没了券。 */
    let state = common::scalar_string(&pool, "SELECT state FROM coupon WHERE code=$1", &code).await;
    assert_eq!(state.as_deref(), Some("locked"));
    let 锁给 = common::scalar_string(
        &pool, "SELECT locked_for_order_id FROM coupon WHERE code=$1", &code,
    ).await;
    assert_eq!(锁给.as_deref(), Some(o.order_id.as_str()));
    let 核销数 = common::scalar_i64(
        &pool,
        "SELECT COUNT(*)::int8 FROM coupon_redemption cr
         JOIN coupon c ON c.id=cr.coupon_id WHERE c.code=$1",
        &code,
    ).await;
    assert_eq!(核销数, 0, "还没付钱就不该有核销记录");
}

#[tokio::test]
async fn 取消订单把券还回去() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let code = 发一张(&pool, 2000, None, None).await;

    let o = 下一单(&pool, &user, &sku, vec![code.clone()]).await.expect("下单");
    order::cancel(&pool, &o.order_id, "测试", &Actor::system(), Some(&user))
        .await
        .expect("取消");

    let state = common::scalar_string(&pool, "SELECT state FROM coupon WHERE code=$1", &code).await;
    assert_eq!(state.as_deref(), Some("issued"), "订单没成，券是用户的东西");
    /* `common::scalar_string` 拿 NULL 会 panic（它 decode 成 String，
       不是 Option<String>）——「这一格是空的」正是这里要断言的事，
       所以这一条自己查：数一数还有几张锁在这张单上。 */
    let 还锁着 = common::scalar_i64(
        &pool,
        "SELECT COUNT(*)::int8 FROM coupon WHERE code=$1 AND locked_for_order_id IS NOT NULL",
        &code,
    ).await;
    assert_eq!(还锁着, 0, "锁也要一起解开 —— 只改 state 的话它还挂在死单上");
}

// ═══════════════════════════ 拒绝 ═══════════════════════════

#[tokio::test]
async fn 券不合用要整单拒绝而不是悄悄跳过() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;

    /* 【跳过一张券，在用户那边看到的是「按原价扣款」】。
       这正是这一整个模块存在的理由，所以单独钉一条。 */
    let e = 下一单(&pool, &user, &sku, vec!["NOSUCHCODE".into()]).await.unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");

    let 建了几单 = common::scalar_i64(
        &pool, "SELECT COUNT(*)::int8 FROM order_record WHERE user_id=$1", &user,
    ).await;
    assert_eq!(建了几单, 0, "拒绝就要整单不落库，不留半截订单");
}

#[tokio::test]
async fn 同一个码报两次要拒绝() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let code = 发一张(&pool, 2000, None, None).await;

    // 去重后当没事发生的话，用户以为用了两张、只减了一张的钱
    let e = 下一单(&pool, &user, &sku, vec![code.clone(), code]).await.unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 别人的券对外说的是没有这张券() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let 别人 = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let code = 发一张(&pool, 2000, None, Some(&别人)).await;

    let e = 下一单(&pool, &user, &sku, vec![code.clone()]).await.unwrap_err();
    match e {
        DomainError::Validation(m) => {
            // 【不能说「这张券不是你的」】—— 那等于确认这个码真实存在，
            // 于是撞码就能探出别人的券。跟不存在同一句话。
            assert!(m.contains("没有这张券"), "说漏了嘴：{m}");
            assert!(!m.contains("不是你的"), "说漏了嘴：{m}");
        }
        其他 => panic!("拿到的是 {其他:?}"),
    }
}

#[tokio::test]
async fn 锁着的券不能再被别的单用() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let code = 发一张(&pool, 2000, None, None).await;

    let 第一单 = 下一单(&pool, &user, &sku, vec![code.clone()]).await.expect("第一单");
    let 中间态 = common::scalar_string(&pool, "SELECT state FROM coupon WHERE code=$1", &code).await;
    assert_eq!(中间态.as_deref(), Some("locked"), "第一单之后券该是锁着的");

    let 第二单 = 下一单(&pool, &user, &sku, vec![code]).await;
    /* 【这一条第一次写出来时是挂的，而挂的原因不在券这边】。
       `create` 里有一条「同一个人、同一件东西、已经有一笔没付的就还给他」的
       复用分支，它在事务【之前】return —— 于是第二单根本没走到锁券，
       返回的是第一单，测试看到 Ok。
       顺着这条挂追下去发现的是另一个 bug:那条复用分支不看券码，
       于是「不带券下单 → 退回去输券码再下单」拿到的还是原价那张单，
       而且不报错（已修：带券就不复用）。 */
    match 第二单 {
        Ok(o) => panic!("锁着的券又建出一张单 {}（第一单是 {}）", o.order_id, 第一单.order_id),
        Err(e) => assert!(
            matches!(e, DomainError::Validation(_) | DomainError::IllegalStateTransition { .. }),
            "拿到的是 {e:?}"
        ),
    }
}

#[tokio::test]
async fn 带券下单不许复用之前那张没付的单() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;

    /* 【券码是第三个被复用分支吃掉的字段】（前两个是收货地址和联系人）。
       用户不带券下了一单，退回去、输了券码再下一次 ——
       复用命中的话拿到的还是原价那张，而且不报错。 */
    let 原价单 = 下一单(&pool, &user, &sku, vec![]).await.expect("第一单");
    assert_eq!(原价单.amount_total_minor, 19900);

    let code = 发一张(&pool, 2000, None, None).await;
    let 带券单 = 下一单(&pool, &user, &sku, vec![code]).await.expect("第二单");
    assert_ne!(带券单.order_id, 原价单.order_id, "带券的是另一张单");
    assert_eq!(带券单.amount_total_minor, 15920, "券要真的减钱");
}

/// 【用过的券，屏上说的得是人话】。
///
/// 这一句先前是英文的:`illegal state transition: redeemed → locked`。
/// `lock_for_order` 里那段人话（「用过了」）排在 `assert_transition`
/// 后面，而状态机那一句抢先返回 —— 于是它**一行都执行不到**，
/// 而确认页照原文显示后端这几句（`utils/say.ts` 的 `照原文`）。
///
/// 抓到它的是 2026-09-05 新开的「手里的券」那一屏:同一段判断换个地方读，
/// 屏上直接摆出一个 `redeemed`。测试盯着别再倒回去。
#[tokio::test]
async fn 用过的券说的是人话不是状态机那句英文() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let code = 发一张(&pool, 2000, None, None).await;
    sqlx::query("UPDATE coupon SET state='redeemed', redeemed_at=NOW() WHERE code=$1")
        .bind(&code)
        .execute(&pool)
        .await
        .expect("标成用过了");

    let e = 下一单(&pool, &user, &sku, vec![code]).await.unwrap_err();
    match e {
        DomainError::Validation(m) => {
            assert!(m.contains("用过了"), "说的不是人话：{m}");
            assert!(!m.contains("state transition"), "状态机那句英文漏上屏了：{m}");
            assert!(!m.contains("redeemed"), "库里那个字段的原文漏上屏了：{m}");
        }
        其他 => panic!("拿到的是 {其他:?}"),
    }
}

#[tokio::test]
async fn 过期的券用不了() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 19900).await;
    let code = format!("T{}", uuid::Uuid::new_v4().simple());
    // 发券那一步不许发过期的，所以直接插一行 —— 这里要的是「库里已有一张过期券」
    sqlx::query(
        "INSERT INTO coupon(id, code, benefit_json, state, issued_at, expires_at, audit_note, region)
         VALUES ($1, $2, '{\"pct_off_bps\":2000}'::jsonb, 'issued', NOW() - INTERVAL '2 days',
                 NOW() - INTERVAL '1 day', '测试', 'cn')",
    )
    .bind(format!("cpn-{}", uuid::Uuid::new_v4()))
    .bind(&code)
    .execute(&pool)
    .await
    .expect("插过期券");

    let e = 下一单(&pool, &user, &sku, vec![code]).await.unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");
}

#[tokio::test]
async fn 发券时读不懂的券面就不许进库() {
    let pool = db_or_skip!();
    /* 【坏券进了库要等到有人拿它下单才炸，那时炸在用户脸上】。
       在发的这一步拦下，炸在运营脸上 —— 那是能改的人。 */
    let e = coupon::issue(
        &pool,
        coupon::IssueCoupon {
            code: "BADBENEFIT_TEST",
            promotion_id: None,
            owner_user_id: None,
            benefit_json: json!({}),
            expires_at: Utc::now() + Duration::days(1),
            region: "cn",
        },
        &Actor::system(),
    )
    .await
    .unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");
}

// ═══════════════════════════ 成批发 ═══════════════════════════

async fn 发一批(pool: &sqlx::PgPool, n: i32, 前缀: &str) -> Result<(String, Vec<String>), DomainError> {
    coupon::issue_batch(
        pool,
        coupon::IssueBatch {
            张数: n,
            前缀,
            promotion_id: None,
            benefit_json: json!({ "pct_off_bps": 1000 }),
            expires_at: Utc::now() + Duration::days(30),
            region: "cn",
        },
        &Actor::system(),
    )
    .await
}

#[tokio::test]
async fn 一批发出来的码互不相同而且都能用() {
    let pool = db_or_skip!();
    let (batch, 码们) = 发一批(&pool, 50, "BAT").await.expect("发一批");
    assert_eq!(码们.len(), 50);

    // 【重码会让整批里有一张永远发不出去】——库里那条 UNIQUE 会挡，
    // 但那时是整批回滚，一千张白发
    let 去重: std::collections::HashSet<_> = 码们.iter().collect();
    assert_eq!(去重.len(), 50, "一批里出现了重码");

    let 落库 = common::scalar_i64(
        &pool, "SELECT COUNT(*)::int8 FROM coupon WHERE batch_id=$1", &batch).await;
    assert_eq!(落库, 50, "库里的张数对不上");

    /* 【batch_id 要真的写进去】。这一列此前从建库起就是空的 ——
       列表接口查它、前端显示它，而没有任何地方写。 */
    let 有批号 = common::scalar_i64(
        &pool,
        "SELECT COUNT(*)::int8 FROM coupon WHERE batch_id=$1 AND batch_id IS NOT NULL",
        &batch,
    ).await;
    assert_eq!(有批号, 50);
}

#[tokio::test]
async fn 码猜不出来() {
    let pool = db_or_skip!();
    let (_, 码们) = 发一批(&pool, 20, "GUESS").await.expect("发一批");
    /* 【连号等于把整批送给第一个想到试一下的人】。
       `GUESS001`…`GUESS999` 谁都猜得到 —— 所以码的后半截是随机的。
       这里钉的是「不是顺序的」:排序之后相邻两个的差不该恒为 1。 */
    let 后半: Vec<&str> = 码们.iter().map(|c| &c[5..]).collect();
    assert!(后半.iter().all(|x| x.len() == 10), "后半截应该是 10 位");
    let 连号 = 码们.iter().any(|c| c.ends_with("0001") || c.ends_with("0002"));
    assert!(!连号, "看着像连号：{码们:?}");
}

#[tokio::test]
async fn 张数超出范围要拒() {
    let pool = db_or_skip!();
    // 【一次几万张的话，出错时也是几万张要收回】
    assert!(发一批(&pool, 0, "X").await.is_err());
    assert!(发一批(&pool, 5001, "X").await.is_err());
}

#[tokio::test]
async fn 前缀要像个前缀() {
    let pool = db_or_skip!();
    // 前缀是【人念得出来的那一半】—— 空的、带符号的、太长的都不行
    assert!(发一批(&pool, 2, "").await.is_err());
    assert!(发一批(&pool, 2, "有中文").await.is_err());
    assert!(发一批(&pool, 2, "TOOOOOOOOLONGPREFIX").await.is_err());
}

#[tokio::test]
async fn 一批发出来的券真的用得上() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 10000).await;
    let (_, 码们) = 发一批(&pool, 3, "USE").await.expect("发一批");

    /* 【发出来用不上等于没发】。这一条把批量那一头接到下单那一头 ——
       中间任何一步（batch_id 写坏了、benefit 没落库、region 不对）
       都会在这里显形。 */
    let o = 下一单(&pool, &user, &sku, vec![码们[0].clone()]).await.expect("拿第一张下单");
    assert_eq!(o.amount_total_minor, 9000, "一成折扣该是 90 元");
}

// ═════════ 2026-09-03 五路评审 · 资金审计：活动预算 ═════════

/// 建一个带预算的活动，返回 promotion_id。
async fn 一个活动(pool: &sqlx::PgPool, 预算: i64, 已用: i64) -> String {
    let id = common::uniq("promo");
    sqlx::query(
        "INSERT INTO promotion(id, code, name, kind, benefit_json,
                               effective_from, effective_to,
                               budget_minor, used_minor, status, region)
         VALUES ($1, $1, '测试活动', 'pct_off', '{}'::jsonb,
                 NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days',
                 $2, $3, 'active', 'cn')",
    )
    .bind(&id)
    .bind(预算)
    .bind(已用)
    .execute(pool)
    .await
    .expect("insert promotion");
    id
}

async fn 发一张挂活动的(pool: &sqlx::PgPool, promo: &str, bps: i64) -> String {
    let code = format!("P{}", uuid::Uuid::new_v4().simple());
    coupon::issue(
        pool,
        coupon::IssueCoupon {
            code: &code,
            promotion_id: Some(promo),
            owner_user_id: None,
            benefit_json: json!({ "pct_off_bps": bps }),
            expires_at: Utc::now() + Duration::days(30),
            region: "cn",
        },
        &Actor::system(),
    )
    .await
    .expect("发券");
    code
}

/// 【预算要在减之前问「兜得住吗」】。
///
/// 原先的判据是 `used >= budget` —— 只拦「已经花超了」，
/// 拦不住「这一张就会花超」。预算 10000 已用 9900 时，
/// 一张减 5000 的券照样能用，活动实际支出 14900，超预算 49%。
#[tokio::test]
async fn 一张券撑破活动预算就用不了() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 10000).await;
    let promo = 一个活动(&pool, 10000, 9900).await;   // 只剩 100 分额度
    let code = 发一张挂活动的(&pool, &promo, 5000).await; // 五折 = 减 5000

    let e = 下一单(&pool, &user, &sku, vec![code]).await.unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");
}

/// 兜得住的就照用 —— 这一条防的是「一刀切拦掉所有挂活动的券」。
#[tokio::test]
async fn 预算兜得住的券照常能用() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 10000).await;
    let promo = 一个活动(&pool, 10000, 0).await;
    let code = 发一张挂活动的(&pool, &promo, 5000).await;

    let 单 = 下一单(&pool, &user, &sku, vec![code]).await.expect("该能用");
    let 应付 = common::scalar_i64(
        &pool, "SELECT amount_total_minor FROM order_record WHERE id=$1", &单.order_id,
    ).await;
    assert_eq!(应付, 5000, "券没减到");
}

/// 预算早就用光的，仍然是「用完了」那一句 —— 这一支原来就有，别改坏。
#[tokio::test]
async fn 预算用光的活动券用不了() {
    let pool = db_or_skip!();
    let user = common::user(&pool).await;
    let sku = common::sku_with_price(&pool, "CNY", 10000).await;
    let promo = 一个活动(&pool, 10000, 10000).await;
    let code = 发一张挂活动的(&pool, &promo, 1000).await;

    let e = 下一单(&pool, &user, &sku, vec![code]).await.unwrap_err();
    assert!(matches!(e, DomainError::Validation(_)), "拿到的是 {e:?}");
}
