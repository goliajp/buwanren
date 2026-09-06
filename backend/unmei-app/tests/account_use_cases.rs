//! 注销账号 · 对真库。
//!
//! 这一支钉住的是**隐私政策上写着的那句话**：
//!
//! > 你退出并删除账号，出生时间与盘会一起删掉；
//! > 订单与支付记录按法律要求保留，那部分只留金额与时间。
//!
//! 每条测试对着这句话的一小段。改坏任何一段，这里都要红 ——
//! 因为屏上那句话是对着人许下的，而库里做不做得到没有第二个地方看得出来。

mod common;

use serde_json::json;
use unmei_app::{account, order};

/// 建一个人，给他一份盘、一张带地址的单。
async fn 一个有东西的人(pool: &sqlx::PgPool) -> (String, String, String) {
    let user = common::user(pool).await;
    let sku = common::sku_with_price(pool, "CNY", 19900).await;

    let natal = common::uniq("natal");
    sqlx::query(
        "INSERT INTO natal(id, user_id, label, year, month, day, hour, minute,
                           birth_city, gender)
         VALUES ($1,$2,'我',1998,3,5,14,30,'成都','male')",
    )
    .bind(&natal)
    .bind(&user)
    .execute(pool)
    .await
    .expect("插一份盘");
    sqlx::query("UPDATE app_user SET active_natal_id=$1 WHERE id=$2")
        .bind(&natal)
        .bind(&user)
        .execute(pool)
        .await
        .expect("挂上这份盘");

    let 单 = order::create(
        pool,
        order::NewOrder {
            user_id: user.clone(),
            region: "cn".into(),
            channel_origin: "web".into(),
            lines: vec![order::NewOrderLine { sku_id: sku, qty: 1 }],
            shipping_address: Some(json!({
                "province": "四川", "city": "成都", "district": "武侯",
                "detail": "某某路 3 号", "name": "张三", "phone": "13800000000"
            })),
            contact: Some(json!({ "name": "张三", "phone": "13800000000" })),
            coupon_codes: vec![],
            note: Some("生日礼物，帮我包一下".into()),
            ip: None,
            ua: None,
        },
    )
    .await
    .expect("下一单");

    (user, natal, 单.order_id)
}

/// 【出生时间与盘会一起删掉】—— 政策那句话的前半句。
#[tokio::test]
async fn 注销之后盘就没了() {
    let pool = db_or_skip!();
    let (user, natal, _) = 一个有东西的人(&pool).await;

    assert_eq!(
        common::scalar_i64(&pool, "SELECT count(*) FROM natal WHERE id=$1", &natal).await,
        1,
        "前提：注销之前这份盘在"
    );

    account::delete(&pool, &user).await.expect("注销");

    assert_eq!(
        common::scalar_i64(&pool, "SELECT count(*) FROM natal WHERE user_id=$1", &user).await,
        0,
        "盘没删掉 —— 政策上写着「出生时间与盘会一起删掉」"
    );
    /* `natal_summary` 靠外键 CASCADE 跟着走。这一条不是多余的:
       哪天有人把那条外键改成 SET NULL，盘的排盘结果会留在库里，
       而上面那条断言照旧绿 —— 它只看 `natal`。 */
    assert_eq!(
        common::scalar_i64(
            &pool,
            "SELECT count(*) FROM natal_summary WHERE natal_id=$1",
            &natal
        )
        .await,
        0,
        "盘删了而排出来的结果还留着"
    );
}

/// 【订单与支付记录按法律要求保留】—— 政策那句话的后半句，前半段。
#[tokio::test]
async fn 注销之后订单还在() {
    let pool = db_or_skip!();
    let (user, _, 单) = 一个有东西的人(&pool).await;

    account::delete(&pool, &user).await.expect("注销");

    assert_eq!(
        common::scalar_i64(&pool, "SELECT count(*) FROM order_record WHERE id=$1", &单).await,
        1,
        "订单被删了 —— 政策上写着它「按法律要求保留」"
    );
    assert_eq!(
        common::scalar_i64(&pool, "SELECT count(*) FROM order_line WHERE order_id=$1", &单).await,
        1,
        "订单行被删了"
    );
}

/// 【那部分只留金额与时间】—— 政策那句话的后半句，后半段。
///
/// 「只留金额与时间」这句话是有牙的：收货地址、联系人、留言都是姓名电话住址，
/// 留着就不叫「只留金额与时间」。
#[tokio::test]
async fn 注销之后订单上不再有姓名地址() {
    let pool = db_or_skip!();
    let (user, _, 单) = 一个有东西的人(&pool).await;

    let 有联系人 = common::scalar_i64(
        &pool,
        "SELECT count(*) FROM order_meta WHERE order_id=$1 AND contact_json IS NOT NULL",
        &单,
    )
    .await;
    assert_eq!(有联系人, 1, "前提：注销之前这一单上有联系人");

    account::delete(&pool, &user).await.expect("注销");

    let 还留着 = common::scalar_i64(
        &pool,
        "SELECT count(*) FROM order_meta
          WHERE order_id=$1 AND (contact_json IS NOT NULL
                             OR shipping_address_json IS NOT NULL
                             OR gift_note IS NOT NULL)",
        &单,
    )
    .await;
    assert_eq!(还留着, 0, "订单上还留着姓名 / 地址 / 留言 —— 那不叫「只留金额与时间」");
    // 而金额确实还在 —— 这一条防的是「一刀切把 order_meta 整行删了」
    assert_eq!(
        common::scalar_i64(
            &pool,
            "SELECT count(*) FROM order_record WHERE id=$1 AND amount_total_minor > 0",
            &单
        )
        .await,
        1,
        "金额也没了 —— 留的那一半得真留下"
    );
}

/// 【这个号再也进不来】。微信 openid 是它唯一能被认回来的东西。
#[tokio::test]
async fn 注销之后认不回这个号() {
    let pool = db_or_skip!();
    let (user, _, _) = 一个有东西的人(&pool).await;
    sqlx::query("UPDATE app_user SET wx_mp_openid=$1, phone='13800000000' WHERE id=$2")
        .bind(common::uniq("openid"))
        .bind(&user)
        .execute(&pool)
        .await
        .expect("绑一个微信");

    account::delete(&pool, &user).await.expect("注销");

    assert_eq!(
        common::scalar_i64(
            &pool,
            "SELECT count(*) FROM app_user
              WHERE id=$1 AND wx_mp_openid IS NULL AND phone IS NULL
                AND deleted_at IS NOT NULL AND nickname='已注销'",
            &user
        )
        .await,
        1,
        "openid / 手机号没清干净，或者没落注销时间 —— 这个号还认得回来"
    );
}

/// 【点两下不该报错】。注销是个不可逆的动作，人多半会犹豫一下再按；
/// 网络慢的时候他会再按一次，而报错会让他以为第一次没成。
#[tokio::test]
async fn 注销两次不报错() {
    let pool = db_or_skip!();
    let (user, _, _) = 一个有东西的人(&pool).await;

    account::delete(&pool, &user).await.expect("头一次");
    let 第二次 = account::delete(&pool, &user).await.expect("第二次也该成");
    assert_eq!(第二次.natal, 0, "第二次不该再报「删了一份盘」");
}

/// 【注销之后不该继续扣钱】（2026-09-06 三路验证 · 准备花钱的那一路）。
///
/// 设置那一屏明写着「这个号再也进不来」。而注销此前**一个字都不碰
/// `subscription`**，续费 worker 只看 `next_billing_attempt_at` ——
/// 订了「一味香 · 按月送」再注销的人，每月照样被扣，
/// 东西寄给一个已经抹掉的地址，而他没有任何办法来管这件事。
#[tokio::test]
async fn 注销会把还活着的订阅停掉() {
    let pool = db_or_skip!();
    let (user, _, _) = 一个有东西的人(&pool).await;
    let 套餐 = common::scalar_string(&pool, "SELECT id FROM plan WHERE status='active' LIMIT 1", "")
        .await
        .expect("库里得有一个在架套餐");
    let 订 = common::uniq("sub");
    sqlx::query(
        "INSERT INTO subscription(id, user_id, plan_id, status, source_channel,
                                  current_period_start, current_period_end,
                                  next_billing_attempt_at)
         VALUES ($1,$2,$3,'active','wechat', NOW(), NOW() + INTERVAL '30 days',
                 NOW() + INTERVAL '30 days')",
    )
    .bind(&订)
    .bind(&user)
    .bind(&套餐)
    .execute(&pool)
    .await
    .expect("插一条订阅");

    let 账 = account::delete(&pool, &user).await.expect("注销");
    assert_eq!(账.停掉的订阅, 1, "注销了，而订阅还活着 —— 下个月还会扣钱");
    assert_eq!(
        common::scalar_string(&pool, "SELECT status FROM subscription WHERE id=$1", &订).await.as_deref(),
        Some("cancelled"),
        "订阅没被停掉",
    );
}

/// 【还没发货的那一单，地址得留着】（2026-09-06 三路验证）。
///
/// 「只留金额与时间」说的是留档，不是把还没办完的事办不成。
/// 上一版抹的是这个人**所有**的单 —— 刚买完 ¥398 玉坠、还没发货就注销的人，
/// 地址被抹掉，包裹永远寄不出，而钱留在账上。
#[tokio::test]
async fn 还在办的那一单地址不抹() {
    let pool = db_or_skip!();
    let (user, _, 单) = 一个有东西的人(&pool).await;
    // 履约中：钱收了、东西还没寄
    sqlx::query("UPDATE order_record SET status='fulfilling', amount_paid_minor=19900 WHERE id=$1")
        .bind(&单)
        .execute(&pool)
        .await
        .expect("推到履约中");

    account::delete(&pool, &user).await.expect("注销");

    assert_eq!(
        common::scalar_i64(
            &pool,
            "SELECT count(*) FROM order_meta
              WHERE order_id=$1 AND shipping_address_json IS NOT NULL",
            &单,
        )
        .await,
        1,
        "这一单还在办，地址却被抹了 —— 那个包裹从此寄不出去",
    );
}
