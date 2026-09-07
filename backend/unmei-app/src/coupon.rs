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
use unmei_domain::commerce::money::{Currency, Money};
use unmei_domain::commerce::region::Region;
use std::str::FromStr;
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

/// 一张券此刻过不去的那一关。
///
/// 【三处必须问同一遍】——下单锁券（[`lock_for_order`]）、试算（[`preview`]）、
/// 以及「我手里这张还能不能用」（[`mine`]）。分三份抄的话，屏上写着「能用」
/// 而下单被拒（或者反过来），**而用户是在看到「能用」之后才按的付款**。
/// 这个模块开头那段话说的就是这件事，只是先前只覆盖了前两处，
/// 而那两处的说法已经漂了一点（同一个状态，一处说「现在是「redeemed」」，
/// 另一处说「用过了」）。
///
/// 【只做「减多少」之前的那些关】。预算兜不兜得住这一张，要等算完 `off`
/// 才知道，那一关留在调用方；这里把 `budget - used` 交出去。
fn 过不去的关(
    row: &sqlx::postgres::PgRow,
    user_id: &str,
    region: &str,
    now: chrono::DateTime<Utc>,
) -> Result<Option<i64>, 挡下> {
    let state_s: String = row.get("state");
    let state = CouponState::from_str_lax(&state_s)
        .ok_or_else(|| 挡下::说明白(format!("的状态 {state_s} 不认识")))?;
    /* 【能不能锁由状态机说，怎么说由这儿说】。
       这两句先前是反过来的:`assert_transition` 在前，于是它那句
       `illegal state transition: redeemed → locked` 抢先返回，
       而下面这段人话【一行都执行不到】—— 用过的券在结账屏上
       报的就是那句英文（确认页照原文显示后端这几句，见 `照原文`）。
       抓到它的是「手里的券」那一屏:同一段判断换个地方读，
       屏上直接摆出一个 `redeemed`。 */
    if state.assert_transition(CouponState::Locked).is_err() || state != CouponState::Issued {
        return Err(挡下::说明白(
            match state_s.as_str() {
                "locked" => "已经挂在另一张单上",
                "redeemed" => "用过了",
                "expired" => "过期了",
                "revoked" => "被收回了",
                其他 => 其他,
            }
            .to_string(),
        ));
    }

    let owner: Option<String> = row.get("owner_user_id");
    if let Some(o) = &owner {
        if o != user_id {
            return Err(挡下::装作不存在);
        }
    }

    let 券区: String = row.get("region");
    if 券区 != region {
        return Err(挡下::说明白(format!("不能在 {region} 用")));
    }

    let expires: chrono::DateTime<Utc> = row.get("expires_at");
    if expires <= now {
        return Err(挡下::说明白("已经过期".into()));
    }

    // 挂着活动的券，活动本身也要在有效期内、且没停
    let Some(st): Option<String> = row.get("promo_status") else {
        return Ok(None);
    };
    if st != "active" {
        return Err(挡下::说明白(format!("挂的活动现在是「{st}」，用不了")));
    }
    let from: chrono::DateTime<Utc> = row.get("effective_from");
    let to: Option<chrono::DateTime<Utc>> = row.get("effective_to");
    if now < from || to.is_some_and(|t| now > t) {
        return Err(挡下::说明白("挂的活动不在有效期内".into()));
    }
    /* 【预算要在减之前问「兜得住吗」】（2026-09-03 五路评审 · 资金审计）。
       `used >= budget` 只拦「已经花超了」，拦不住「这一张就会花超」——
       预算 1000 已用 999 时，一张减 500 的券照样能用，
       活动实际支出 1499，超预算 49.9%。预算越紧，超得越狠:
       只剩 1 分钱额度的活动能被一张大额券撑破。

       所以把判断挪到算完 `off` 之后 —— 那时才知道这一张要减多少。 */
    let budget: Option<i64> = row.get("budget_minor");
    let used: i64 = row.get("used_minor");
    match budget {
        Some(b) if used >= b => Err(挡下::说明白("挂的活动预算用完了".into())),
        Some(b) => Ok(Some(b - used)),
        None => Ok(None),
    }
}

/// 【这一单本身过不过得了这张券的门槛】。
///
/// 【上面那一关问的是「这张券本身还能不能用」，这一关问的是
/// 「用在这一单上行不行」】—— 两件事，判据来源也不同:
/// 前者全在 coupon / promotion 那两行上，后者要知道这一单多少钱、
/// 这个人是不是新客、这一单上还有没有别的券。
///
/// 【为什么这一关此前整个不存在】（2026-09-07）。`promotion` 上
/// `rule_json` / `match_json` / `stackable` / `per_user_cap` 这几列
/// 从建库起就在，后台详情页也把它们摆出来给人看 —— 而
/// `unmei-app` 与 `unmei-api` 里 grep 它们是**零命中**。
/// 种子里唯一一个真活动 `NEWUSER20`（新人首单立减 20%）写着
/// 「满 ¥49」「仅新客」「不可叠加」，三条一条都不生效:
/// 一个老客拿它减 ¥29 的东西，照样减得下来。
///
/// 【只认代码真做得到的那几个键】。没实现的键不假装实现，
/// 也不允许悄悄躺着 —— `scripts/check-promo-rules.py` 盯着这件事:
/// 活动里出现一个这里不认识的键就红。凭空给一个没人用的键发明语义,
/// 跟它不生效一样糟，只是错得更晚。
async fn 这一单过得了这张券吗(
    db: impl sqlx::PgExecutor<'_>,
    row: &sqlx::postgres::PgRow,
    user_id: &str,
    region: &str,
    这一单小计: i64,
    这一单几张券: usize,
) -> Result<(), 挡下> {
    let rule: Option<serde_json::Value> = row.try_get("promo_rule_json").ok().flatten();
    let matc: Option<serde_json::Value> = row.try_get("promo_match_json").ok().flatten();
    let stackable: Option<bool> = row.try_get("promo_stackable").ok().flatten();

    // 【不可叠加】。判据是「这一单上不止一张券」——
    // 一张不可叠加的券自己一个人用是可以的，跟别的凑在一起才不行。
    if stackable == Some(false) && 这一单几张券 > 1 {
        return Err(挡下::说明白("不能跟别的券一起用".into()));
    }

    if let Some(min) = rule.as_ref().and_then(|r| r.get("min_amount")).and_then(|v| v.as_i64()) {
        if 这一单小计 < min {
            // 差多少也说出来 —— 「满 ¥49 可用」比「不满足条件」有用得多
            /* 【符号与小数位由区定，不写死 ¥】。这一句原先自己拼了一份
               `format!("¥{}.{:02}")` —— 在繁中那一格上，它把 NT$ 说成 ¥、
               还给零位小数的币种硬加两位。金额格式全仓只许有一支
               （`check-money-fmt` 盯着这件事，2026-09-07 当场抓住）。 */
            let 币 = Region::from_str(region)
                .map(|r| r.meta().primary_currency.to_string())
                .unwrap_or_else(|_| "CNY".into());
            let 说 = |分: i64| Currency::from_str_lax(&币)
                .map(|c| Money::new(分, c).display_human())
                .unwrap_or_else(|| format!("{分} {币}"));
            return Err(挡下::说明白(format!(
                "要满 {} 才能用，这一单是 {}",
                说(min),
                说(这一单小计)
            )));
        }
    }

    /* 【新客怎么算】。判据是「他还没有一单付过钱的」——
       活动名字就叫「新人首单」，那才是它要给的人。
       不按注册时间算:注册了三个月没买过东西的人，他的首单仍然是首单，
       而按天数算会把他挡在外面，也会放进一个注册当天买了三次的人。 */
    let 只给新客 = matc
        .as_ref()
        .and_then(|m| m.get("new_user_only"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if 只给新客 {
        let 买过: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM order_record
              WHERE user_id = $1 AND status IN ('paid','fulfilling','done',
                                                'refund_partial','refunded')",
        )
        .bind(user_id)
        .fetch_one(db)
        .await
        .map_err(|e| 挡下::说明白(format!("查不到你买过什么（{e}）")))?;
        if 买过 > 0 {
            return Err(挡下::说明白("只给还没买过东西的人".into()));
        }
    }
    Ok(())
}

/// 被 [`过不去的关`] 挡下时，该怎么说。
enum 挡下 {
    /// 【当成不存在】。「这张券不是你的」等于确认这个码真实存在 ——
    /// 对外要跟「没有这张券」是同一句话。
    装作不存在,
    /// 照实说。**这句话里不带券码** —— 下单与试算把它拼成
    /// 「券 XXX 已经过期」，而券卡上码就在旁边，再念一遍是废话。
    说明白(String),
}

/// 把 [`挡下`] 拼成下单 / 试算那两处要的那一句。
fn 那一句(挡: 挡下, code: &str) -> DomainError {
    DomainError::Validation(match 挡 {
        挡下::装作不存在 => format!("没有这张券：{code}"),
        挡下::说明白(话) => format!("券 {code} {话}"),
    })
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
                      p.budget_minor, p.used_minor,
                      p.rule_json AS promo_rule_json, p.match_json AS promo_match_json,
                      p.stackable AS promo_stackable
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
        // 门禁只有一处 —— 见 `过不去的关`
        let 预算还剩 = 过不去的关(&row, user_id, region, Utc::now())
            .map_err(|挡| 那一句(挡, code))?;
        // 这一单本身过不过得了它的门槛（满多少 / 只给新客 / 能不能叠加）
        这一单过得了这张券吗(&mut **tx, &row, user_id, region, subtotal_minor, codes.len())
            .await
            .map_err(|挡| 那一句(挡, code))?;

        let benefit_json: serde_json::Value = row.get("benefit_json");
        let benefit = Benefit::parse(&benefit_json, code)?;
        // 【按已减之后的余额算】——多张券叠加时，第二张按剩下的钱打折，
        // 不是各自按原价算完再相加（那样两张五折能把订单减成负数）。
        let 余 = subtotal_minor - 已减;
        let off = benefit.off(余, code)?;
        if let Some(剩) = 预算还剩 {
            if off > 剩 {
                return Err(DomainError::Validation(format!(
                    "券 {code} 挂的活动预算兜不住这一张：还剩 {剩} 分，它要减 {off} 分"
                )));
            }
        }

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

/// 这张券用在这个金额上能减多少 —— 不动库，不锁券。
///
/// 【必须跟下单那一步用同一段算法】。分两份实现的话，
/// 试算说「减 40」、下单扣 50，而用户是在看到 40 之后才按的付款 ——
/// 那是比不显示折扣更糟的事。
///
/// 所以这里复用 `Benefit::parse` 与 `off`，只是把
/// `lock_for_order` 里那些【会改库】的步骤去掉:不 FOR UPDATE、不 UPDATE。
/// 校验一条不少 —— 试算说得通、下单却被拒，同样是欺骗。
pub async fn preview(
    pool: &PgPool,
    user_id: &str,
    region: &str,
    subtotal_minor: i64,
    codes: &[String],
) -> Result<(Vec<AppliedCoupon>, i64), DomainError> {
    if codes.is_empty() {
        return Ok((Vec::new(), 0));
    }
    let mut seen = std::collections::HashSet::new();
    for c in codes {
        if !seen.insert(c.as_str()) {
            return Err(DomainError::Validation(format!("券码 {c} 报了不止一次")));
        }
    }

    let mut applied = Vec::new();
    let mut 已减 = 0i64;
    for code in codes {
        let row = sqlx::query(
            r#"SELECT c.id, c.state, c.owner_user_id, c.expires_at, c.benefit_json,
                      c.region, c.promotion_id,
                      p.status AS promo_status, p.effective_from, p.effective_to,
                      p.budget_minor, p.used_minor,
                      p.rule_json AS promo_rule_json, p.match_json AS promo_match_json,
                      p.stackable AS promo_stackable
               FROM coupon c
               LEFT JOIN promotion p ON p.id = c.promotion_id
               WHERE c.code = $1"#,
        )
        .bind(code)
        .fetch_optional(pool)
        .await.db()?
        .ok_or_else(|| DomainError::Validation(format!("没有这张券：{code}")))?;

        let coupon_id: String = row.get("id");
        // 【跟下单同一段门禁】——试算说得通、下单却被拒，同样是欺骗
        let 预算还剩 = 过不去的关(&row, user_id, region, Utc::now())
            .map_err(|挡| 那一句(挡, code))?;
        这一单过得了这张券吗(pool, &row, user_id, region, subtotal_minor, codes.len())
            .await
            .map_err(|挡| 那一句(挡, code))?;

        let benefit_json: serde_json::Value = row.get("benefit_json");
        let benefit = Benefit::parse(&benefit_json, code)?;
        let off = benefit.off(subtotal_minor - 已减, code)?;
        if let Some(剩) = 预算还剩 {
            if off > 剩 {
                return Err(DomainError::Validation(format!(
                    "券 {code} 挂的活动预算兜不住这一张：还剩 {剩} 分，它要减 {off} 分"
                )));
            }
        }
        已减 += off;
        applied.push(AppliedCoupon {
            coupon_id,
            code: code.clone(),
            applied_amount_minor: off,
        });
    }
    Ok((applied, 已减))
}

/// 「我手里这张券」—— 券面、还能不能用、用不了的话为什么。
///
/// 【这一列本来就在库里，只是没人发出来】。`coupon.owner_user_id`
/// 从建库起就是为「这一张是谁的」留的，后台也一直发得出绑人的券 ——
/// 而用户那一侧没有一个「我的券」。运营给一位用户补一张，
/// 用户打开只有确认页上那个「有券码就填这儿」的格子，也就是
/// **他得先知道那串码**：券要另外找一条路送到他眼前（短信 / 客服 /
/// 二维码），那条路一断，这张券就等于没发。
#[derive(Debug, Clone, Serialize)]
pub struct MyCoupon {
    pub id: String,
    /// 券码。系统派发的券可以没有码（`coupon.code` 可空）——
    /// 那种券现在没有下单入口，卡片会说清，不编一个码出来
    pub code: Option<String>,
    /// 挂的活动叫什么。没挂活动就没有名字，那时卡片自己说「减多少」
    pub title: Option<String>,
    pub state: String,
    pub region: String,
    /// 由 region 定（`Region::meta().primary_currency`），不在页面里写死
    pub currency: String,
    pub pct_off_bps: i64,
    pub amount_off_minor: Option<i64>,
    pub max_off_minor: Option<i64>,
    pub expires_at: chrono::DateTime<Utc>,
    /// 现在拿去下单能用
    pub usable: bool,
    /// 用不了的话，为什么。能用时是空串
    pub why: String,
    /// 用掉了的话，用在哪张单上 —— 台账要能顺着点回去
    pub used_on_order_id: Option<String>,
}

/// 他名下的券，能用的排前面。
///
/// 【只取这一格的】。别的区发的券在这一格里点不动，摆出来只是一行
/// 「不能在 cn 用」；那是发券那一侧的错，不该由用户在这一屏承担。
pub async fn mine(
    pool: &PgPool,
    user_id: &str,
    region: &str,
) -> Result<Vec<MyCoupon>, DomainError> {
    let currency = Region::from_str(region)
        .map_err(|_| DomainError::Validation(format!("没有 {region} 这一格")))?
        .meta()
        .primary_currency
        .to_string();

    let rows = sqlx::query(
        r#"SELECT c.id, c.code, c.state, c.owner_user_id, c.expires_at, c.benefit_json,
                  c.region, c.promotion_id,
                  p.name AS promo_name,
                  p.status AS promo_status, p.effective_from, p.effective_to,
                  p.budget_minor, p.used_minor,
                  r.order_id AS used_on_order_id
           FROM coupon c
                LEFT JOIN promotion p ON p.id = c.promotion_id
                LEFT JOIN coupon_redemption r ON r.coupon_id = c.id
           WHERE c.owner_user_id = $1 AND c.region = $2"#,
    )
    .bind(user_id)
    .bind(region)
    .fetch_all(pool)
    .await
    .db()?;

    let now = Utc::now();
    let mut out: Vec<MyCoupon> = Vec::with_capacity(rows.len());
    for row in &rows {
        let id: String = row.get("id");
        let code: Option<String> = row.get("code");
        let benefit_json: serde_json::Value = row.get("benefit_json");

        /* 【能不能用，问的是下单那一段判断】—— 见 `过不去的关`。
           在这儿另抄一份的话，这一屏写着「能用」而下单被拒。 */
        let mut why = match 过不去的关(row, user_id, region, now) {
            Ok(_) => String::new(),
            /* SQL 就是按 owner 取的，正常撞不上这一支；真撞上说明这一行
               的 owner 刚被改过，照实说，不当成能用 */
            Err(挡下::装作不存在) => "这张券已经不在你名下".to_string(),
            Err(挡下::说明白(话)) => 话,
        };

        /* 券面读不懂的券也要摆出来。藏起来的话，运营说「给你发了」而
           用户屏上什么都没有 —— 那正是这个接口要修的那件事 */
        let benefit = Benefit::parse(&benefit_json, code.as_deref().unwrap_or(&id));
        if why.is_empty() && benefit.is_err() {
            why = "这张券的内容有问题 —— 找客服换一张".to_string();
        }
        /* 没有码的券现在【没有下单入口】：确认页收的是券码。
           说它「能用」而他找不到地方用，是这一屏最不该犯的错 */
        if why.is_empty() && code.is_none() {
            why = "这张券还没有码 —— 找客服".to_string();
        }

        out.push(MyCoupon {
            id,
            code,
            title: row.get("promo_name"),
            state: row.get("state"),
            region: row.get("region"),
            currency: currency.clone(),
            pct_off_bps: benefit.as_ref().map(|b| b.pct_off_bps).unwrap_or(0),
            amount_off_minor: benefit.as_ref().ok().and_then(|b| b.amount_off_minor),
            max_off_minor: benefit.as_ref().ok().and_then(|b| b.max_off_minor),
            expires_at: row.get("expires_at"),
            usable: why.is_empty(),
            why,
            used_on_order_id: row.get("used_on_order_id"),
        });
    }

    /* 能用的排前面，同样能用的先过期的在前 —— 这一屏人点进来是找
       「我现在有什么能用」，不是翻台账。用掉的、过期的仍然列着（那是他的
       台账），只是排在后面。排序放在这儿不放 SQL：「能不能用」要问活动
       的状态与预算，那不是一句 ORDER BY 说得清的。 */
    out.sort_by(|a, b| {
        b.usable
            .cmp(&a.usable)
            .then(a.expires_at.cmp(&b.expires_at))
    });
    Ok(out)
}

/// 一次发一批。
///
/// 【`coupon.batch_id` 是又一列「读得到、没人写」】——列表接口查它、
/// 前端显示它，而没有任何地方往里写。真实的发券是成批的
/// （一次一千张码往外投），一张张点不可行 —— 于是这一列
/// 从建库起就是空的，而「批」这个概念在系统里等于不存在。
///
/// **码由这里生成，不由调用方给**。让调用方传一千个码的话，
/// 重码、弱码（连号、可猜）都成了它的责任，而那件事只该做对一次。
///
/// 整批一个事务:发了一半的批次比没发更难处理 ——
/// 后台看到一个数目对不上的批次，而它并不是真的对不上。
pub async fn issue_batch(
    pool: &PgPool,
    req: IssueBatch<'_>,
    actor: &Actor,
) -> Result<(String, Vec<String>), DomainError> {
    let IssueBatch { 张数, 前缀, promotion_id, benefit_json, expires_at, region } = req;

    if !(1..=5000).contains(&张数) {
        return Err(DomainError::Validation(format!(
            "一批发 {张数} 张 —— 只收 1 到 5000。要更多就分几批，一次几万张的话，出错时也是几万张要收回"
        )));
    }
    // 券面读不懂的不许进库 —— 跟单张那一条同一个道理，
    // 只是这里错一次是一千张
    Benefit::parse(&benefit_json, "（这一批）")?;
    if expires_at <= Utc::now() {
        return Err(DomainError::Validation("发一批已经过期的券没有意义".into()));
    }
    let 前缀 = 前缀.trim().to_uppercase();
    if 前缀.is_empty() || 前缀.len() > 12 || !前缀.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(DomainError::Validation(
            "前缀要 1 到 12 位字母数字 —— 它是人念得出来的那一半".into()));
    }

    let batch_id = new_id("cb");
    let mut tx = pool.begin().await.db()?;
    let mut 码们 = Vec::with_capacity(张数 as usize);

    for _ in 0..张数 {
        /* 【码要猜不出来】。连号（`SALE001`…`SALE999`）等于把整批
           送给第一个想到试一下的人。用 uuid 的十六进制取 10 位 ——
           2^40 的空间，配上库里 `UNIQUE (code)`，撞了就整批回滚重来。 */
        let 码 = format!("{}{}", 前缀,
            uuid::Uuid::new_v4().simple().to_string()[..10].to_uppercase());
        sqlx::query(
            r#"INSERT INTO coupon(id, code, batch_id, promotion_id, benefit_json,
                                  state, issued_at, expires_at, audit_note, region)
               VALUES ($1, $2, $3, $4, $5, 'issued', NOW(), $6, $7, $8)"#,
        )
        .bind(new_id("cpn"))
        .bind(&码)
        .bind(&batch_id)
        .bind(promotion_id)
        .bind(&benefit_json)
        .bind(expires_at)
        .bind(format!("{} 发的第 {batch_id} 批", actor.label()))
        .bind(region)
        .execute(&mut *tx)
        .await.db()?;
        码们.push(码);
    }

    tx.commit().await.db()?;
    tracing::info!(batch_id, 张数, "发了一批券");
    Ok((batch_id, 码们))
}

pub struct IssueBatch<'a> {
    pub 张数: i32,
    /// 码的前半截，人念得出来的那一段（`SPRING` → `SPRING3F9A2C1B04`）
    pub 前缀: &'a str,
    pub promotion_id: Option<&'a str>,
    pub benefit_json: serde_json::Value,
    pub expires_at: chrono::DateTime<Utc>,
    pub region: &'a str,
}
