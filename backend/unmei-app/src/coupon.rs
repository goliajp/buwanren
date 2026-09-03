//! 优惠券用例 · 锁定 → 核销 → 释放。
//!
//! 【为什么这个模块是新写的】——在它之前，下单时带的券码只被
//! `tracing::warn!` 记一句「折扣引擎尚未接通，本单未核销」，然后**按全价收钱**。
//! 用户以为用了券，付的是原价，而系统里没有任何一处会说出这件事。
//! 静默兜底本来就不该有，发生在收钱这一侧尤其不行。
//!
//! 券走两阶段，跟表结构一致（`locked_for_order_id` / `state` / `redeemed_at`
//! 这几列本来就是为它留的）:
//!
//! ```text
//!   issued ──下单─→ locked ──付款成功─→ redeemed
//!              ↑        │
//!              └─订单取消/过期─┘
//! ```
//!
//! **下单时不核销**。核销要等钱真的到账 —— 不然一笔取消的订单会把券吃掉，
//! 而用户既没花钱也没了券。释放走的是状态机里那条 `Locked → Issued`。

use chrono::Utc;
use serde::Serialize;
use sqlx::{PgPool, Postgres, Row, Transaction};
use unmei_domain::commerce::enums::CouponState;
use unmei_domain::commerce::state_machine::StateTransition;
use unmei_domain::DomainError;

use crate::{new_id, Actor, DbResultExt};

/// 一张券在本单上抵了多少钱。
#[derive(Debug, Clone, Serialize)]
pub struct AppliedCoupon {
    pub coupon_id: String,
    pub code: String,
    /// 这张券在本单上实际抵掉的金额（分）。封顶与余额都算过了
    pub applied_amount_minor: i64,
}

/// 券面写的优惠。目前只有「按比例减 + 封顶」一种 ——
/// 库里 `benefit_json` 现役形状就是 `{"pct_off_bps": 2000, "max_off_minor": 10000}`。
///
/// 【读不懂的券面一律拒绝，不当成「没有优惠」】。当成 0 折扣的话，
/// 用户会按原价被扣款，而屏幕上他刚刚输过一个券码。
struct Benefit {
    pct_off_bps: i64,
    max_off_minor: Option<i64>,
    amount_off_minor: Option<i64>,
}

impl Benefit {
    fn parse(v: &serde_json::Value, code: &str) -> Result<Self, DomainError> {
        let pct = v.get("pct_off_bps").and_then(|x| x.as_i64());
        let amt = v.get("amount_off_minor").and_then(|x| x.as_i64());
        if pct.is_none() && amt.is_none() {
            return Err(DomainError::Validation(format!(
                "券 {code} 的优惠内容读不懂（既没有 pct_off_bps 也没有 amount_off_minor）"
            )));
        }
        if let Some(p) = pct {
            if !(0..=10_000).contains(&p) {
                return Err(DomainError::Validation(format!(
                    "券 {code} 的折扣比例 {p} 不在 0–10000 万分比之内"
                )));
            }
        }
        if let Some(a) = amt {
            if a < 0 {
                return Err(DomainError::Validation(format!("券 {code} 的减免金额是负数")));
            }
        }
        Ok(Self {
            pct_off_bps: pct.unwrap_or(0),
            max_off_minor: v.get("max_off_minor").and_then(|x| x.as_i64()),
            amount_off_minor: amt,
        })
    }

    /// 这张券对 `base` 分能减多少。
    ///
    /// 算钱用 checked —— release 下整数溢出是静默回绕，一笔绕成负数的折扣
    /// 会让订单总额变大，而后面每一步都会当成真数字往下算。
    fn off(&self, base: i64, code: &str) -> Result<i64, DomainError> {
        let mut off = base
            .checked_mul(self.pct_off_bps)
            .map(|x| x / 10_000)
            .ok_or_else(|| DomainError::Validation(format!("券 {code} 折扣计算溢出")))?;
        if let Some(a) = self.amount_off_minor {
            off = off
                .checked_add(a)
                .ok_or_else(|| DomainError::Validation(format!("券 {code} 折扣计算溢出")))?;
        }
        if let Some(cap) = self.max_off_minor {
            off = off.min(cap);
        }
        // 减免不能超过本单金额 —— 超了就是找零，而这不是一张现金券
        Ok(off.clamp(0, base))
    }
}

/// 下单时锁定这些券，返回每张抵了多少。
///
/// 跑在**下单那个事务里**（所以收的是 `&mut Transaction`）——
/// 券锁定与订单落库要么一起成，要么一起不成：
/// 分开做的话，订单写失败会留下一张永远锁着的券。
///
/// 一张券不合用就整单拒绝，不悄悄跳过。**「跳过一张券」在用户那边看到的是
/// 「按原价扣款」，而他刚刚输过券码** —— 那正是这个模块存在的理由。
pub async fn lock_for_order(
    tx: &mut Transaction<'_, Postgres>,
    order_id: &str,
    user_id: &str,
    region: &str,
    subtotal_minor: i64,
    codes: &[String],
) -> Result<(Vec<AppliedCoupon>, i64), DomainError> {
    if codes.is_empty() {
        return Ok((Vec::new(), 0));
    }

    // 同一个码报两次不算两张券 —— 拒绝，而不是去重后当没事发生
    let mut seen = std::collections::HashSet::new();
    for c in codes {
        if !seen.insert(c.as_str()) {
            return Err(DomainError::Validation(format!("券码 {c} 报了不止一次")));
        }
    }

    let mut applied = Vec::new();
    let mut 已减 = 0i64;

    for code in codes {
        // FOR UPDATE:两笔订单同时用同一张券时，后来的那笔要等前一笔落定，
        // 看到的才是 locked。少了它，两笔都能读到 issued，券被用两次。
        let row = sqlx::query(
            r#"SELECT c.id, c.state, c.owner_user_id, c.expires_at, c.benefit_json,
                      c.region, c.promotion_id,
                      p.status AS promo_status, p.effective_from, p.effective_to,
                      p.budget_minor, p.used_minor
               FROM coupon c
               LEFT JOIN promotion p ON p.id = c.promotion_id
               WHERE c.code = $1
               FOR UPDATE OF c"#,
        )
        .bind(code)
        .fetch_optional(&mut **tx)
        .await.db()?
        .ok_or_else(|| DomainError::Validation(format!("没有这张券：{code}")))?;

        let coupon_id: String = row.get("id");
        let state_s: String = row.get("state");
        let state = CouponState::from_str_lax(&state_s).ok_or_else(|| {
            DomainError::Validation(format!("券 {code} 的状态 {state_s} 不认识"))
        })?;
        // 状态机说了算，不在这儿手抄一份白名单
        state.assert_transition(CouponState::Locked)?;
        if state != CouponState::Issued {
            return Err(DomainError::Validation(format!(
                "券 {code} 现在是「{state_s}」，用不了"
            )));
        }

        let owner: Option<String> = row.get("owner_user_id");
        if let Some(o) = &owner {
            if o != user_id {
                // 【不说「这张券不是你的」】——那等于告诉人家这个码真实存在。
                // 对外一律「没有这张券」，跟不存在同一句话。
                return Err(DomainError::Validation(format!("没有这张券：{code}")));
            }
        }

        let 券区: String = row.get("region");
        if 券区 != region {
            return Err(DomainError::Validation(format!("券 {code} 不能在 {region} 用")));
        }

        let now = Utc::now();
        let expires: chrono::DateTime<Utc> = row.get("expires_at");
        if expires <= now {
            return Err(DomainError::Validation(format!("券 {code} 已经过期")));
        }

        // 挂着活动的券，活动本身也要在有效期内、且没停
        let promo_status: Option<String> = row.get("promo_status");
        if let Some(st) = promo_status {
            if st != "active" {
                return Err(DomainError::Validation(format!(
                    "券 {code} 挂的活动现在是「{st}」，用不了"
                )));
            }
            let from: chrono::DateTime<Utc> = row.get("effective_from");
            let to: Option<chrono::DateTime<Utc>> = row.get("effective_to");
            if now < from || to.is_some_and(|t| now > t) {
                return Err(DomainError::Validation(format!("券 {code} 挂的活动不在有效期内")));
            }
            let budget: Option<i64> = row.get("budget_minor");
            let used: i64 = row.get("used_minor");
            if budget.is_some_and(|b| used >= b) {
                return Err(DomainError::Validation(format!("券 {code} 挂的活动预算用完了")));
            }
        }

        let benefit_json: serde_json::Value = row.get("benefit_json");
        let benefit = Benefit::parse(&benefit_json, code)?;
        // 【按已减之后的余额算】——多张券叠加时，第二张按剩下的钱打折，
        // 不是各自按原价算完再相加（那样两张五折能把订单减成负数）。
        let 余 = subtotal_minor - 已减;
        let off = benefit.off(余, code)?;

        sqlx::query(
            "UPDATE coupon SET state='locked', locked_for_order_id=$1 WHERE id=$2",
        )
        .bind(order_id)
        .bind(&coupon_id)
        .execute(&mut **tx)
        .await.db()?;

        已减 += off;
        applied.push(AppliedCoupon {
            coupon_id,
            code: code.clone(),
            applied_amount_minor: off,
        });
    }

    Ok((applied, 已减))
}

/// 付款成功时核销这一单锁着的券。
///
/// 跑在收款那个事务里 —— 钱记上了、券才算用掉，两件事一起成或一起不成。
pub async fn redeem_for_order(
    tx: &mut Transaction<'_, Postgres>,
    order_id: &str,
    discount_minor: i64,
) -> Result<usize, DomainError> {
    let rows = sqlx::query(
        "SELECT id, promotion_id FROM coupon
         WHERE locked_for_order_id=$1 AND state='locked' FOR UPDATE",
    )
    .bind(order_id)
    .fetch_all(&mut **tx)
    .await.db()?;

    if rows.is_empty() {
        return Ok(0);
    }

    // 【把折扣按券摊回去】。`coupon_redemption.applied_amount_minor` 是
    // 「这张券抵了多少」，而订单上只存了合计。一张券的常情下两者相等；
    // 多张时按张数均摊，最后一张吃掉余数 —— 摊完的和必须等于合计，
    // 不然对账时这两个数会差几分钱，而那种差最难查。
    let n = rows.len() as i64;
    let 每张 = discount_minor / n;
    let 余数 = discount_minor - 每张 * n;

    for (i, r) in rows.iter().enumerate() {
        let coupon_id: String = r.get("id");
        let promotion_id: Option<String> = r.get("promotion_id");
        let 本张 = 每张 + if i as i64 == n - 1 { 余数 } else { 0 };

        sqlx::query(
            "UPDATE coupon SET state='redeemed', redeemed_at=NOW() WHERE id=$1",
        )
        .bind(&coupon_id)
        .execute(&mut **tx)
        .await.db()?;

        sqlx::query(
            "INSERT INTO coupon_redemption(id, coupon_id, order_id, applied_amount_minor, applied_at)
             VALUES ($1, $2, $3, $4, NOW())",
        )
        .bind(new_id("crd"))
        .bind(&coupon_id)
        .bind(order_id)
        .bind(本张)
        .execute(&mut **tx)
        .await.db()?;

        if let Some(pid) = promotion_id {
            sqlx::query("UPDATE promotion SET used_minor = used_minor + $1 WHERE id=$2")
                .bind(本张)
                .bind(&pid)
                .execute(&mut **tx)
                .await.db()?;
        }
    }

    Ok(rows.len())
}

/// 订单取消 / 过期时把券放回去。
///
/// 走的是状态机里那条 `Locked → Issued` —— 券是用户的东西，
/// 订单没成不该把它吃掉。
pub async fn release_for_order(
    tx: &mut Transaction<'_, Postgres>,
    order_id: &str,
) -> Result<u64, DomainError> {
    let n = sqlx::query(
        "UPDATE coupon SET state='issued', locked_for_order_id=NULL
         WHERE locked_for_order_id=$1 AND state='locked'",
    )
    .bind(order_id)
    .execute(&mut **tx)
    .await.db()?
    .rows_affected();
    Ok(n)
}

/// 后台发券。
///
/// `code` 由调用方给（批量发时通常是生成好的），重复的码直接失败 ——
/// 库里那条唯一索引说了算，不在这里先查一遍再插（那中间有竞态）。
pub struct IssueCoupon<'a> {
    pub code: &'a str,
    pub promotion_id: Option<&'a str>,
    pub owner_user_id: Option<&'a str>,
    pub benefit_json: serde_json::Value,
    pub expires_at: chrono::DateTime<Utc>,
    pub region: &'a str,
}

pub async fn issue(
    pool: &PgPool,
    req: IssueCoupon<'_>,
    actor: &Actor,
) -> Result<String, DomainError> {
    let IssueCoupon { code, promotion_id, owner_user_id, benefit_json, expires_at, region } = req;
    // 发之前先把券面读一遍 —— 读不懂的券面不许进库。
    // 进了库的坏券要等到有人拿它下单才炸，而那时炸在用户脸上。
    Benefit::parse(&benefit_json, code)?;
    if expires_at <= Utc::now() {
        return Err(DomainError::Validation("发一张已经过期的券没有意义".into()));
    }

    let id = new_id("cpn");
    sqlx::query(
        r#"INSERT INTO coupon(id, code, promotion_id, owner_user_id, benefit_json,
                              state, issued_at, expires_at, audit_note, region)
           VALUES ($1, $2, $3, $4, $5, 'issued', NOW(), $6, $7, $8)"#,
    )
    .bind(&id)
    .bind(code)
    .bind(promotion_id)
    .bind(owner_user_id)
    .bind(&benefit_json)
    .bind(expires_at)
    .bind(format!("{} 发出", actor.label()))
    .bind(region)
    .execute(pool)
    .await.db()?;

    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn 按比例减并封顶() {
        let b = Benefit::parse(&json!({"pct_off_bps": 2000, "max_off_minor": 10000}), "X").unwrap();
        assert_eq!(b.off(19900, "X").unwrap(), 3980);      // 两成
        assert_eq!(b.off(199000, "X").unwrap(), 10000);    // 封顶
    }

    #[test]
    fn 减免不许超过本单金额() {
        let b = Benefit::parse(&json!({"amount_off_minor": 50000}), "X").unwrap();
        // 这不是现金券，减不出找零
        assert_eq!(b.off(19900, "X").unwrap(), 19900);
    }

    #[test]
    fn 读不懂的券面要拒绝而不是当成零折扣() {
        // 【当成 0 折扣 = 用户按原价被扣款，而他刚输过券码】
        assert!(Benefit::parse(&json!({}), "X").is_err());
        assert!(Benefit::parse(&json!({"pct_off_bps": 20000}), "X").is_err());
        assert!(Benefit::parse(&json!({"amount_off_minor": -1}), "X").is_err());
    }

    #[test]
    fn 摊回去的和必须等于合计() {
        // redeem_for_order 里的摊法：每张取整，最后一张吃余数
        for (总, 张) in [(3980i64, 3i64), (1i64, 2), (0, 1), (99999, 7)] {
            let 每张 = 总 / 张;
            let 余数 = 总 - 每张 * 张;
            let 和: i64 = (0..张).map(|i| 每张 + if i == 张 - 1 { 余数 } else { 0 }).sum();
            assert_eq!(和, 总, "{总} 分摊给 {张} 张，摊完的和对不上");
        }
    }
}
