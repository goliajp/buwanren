//! 风控规则引擎 + 规则管理用例。
//!
//! DSL parser / evaluator 整段搬自 `unmei-domain/commerce/services_impl/risk.rs`。
//! 那个文件里其余部分是从未被调用过的 sqlx 落地,但**这段解析器是真的、有测试的**,
//! 所以单独救出来。三个单测原样带过来。
//!
//! DSL 语法(MVP):
//!
//! ```text
//! expression := condition (AND|OR condition)*
//! condition  := field op value
//! field      := <ident>(\.<ident>)*    // amount / user.age_days / count_in_window(payment,user_id,1h)
//! op         := > < >= <= == !=
//! value      := number | 'string' | true | false
//! ```
//!
//! 求值时由 ctx 提供 field → value 映射;`count_in_window(...)` 这类
//! 需要查库的字段由调用方预先算好塞进 `extras`,解析器只当它是个 ident。

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as J};
use sqlx::{PgPool, Row};
use unmei_domain::commerce::enums::{RiskCaseState, RiskRuleStatus};
use unmei_domain::DomainError;

use crate::{Actor, DbResultExt};
use crate::new_id;

// ═══════════════════════════ 规则管理 ═══════════════════════════

/// 改规则状态。合法取值由 [`RiskRuleStatus`] 判定。
pub async fn set_rule_status(
    pool: &PgPool,
    rule_id: &str,
    status: &str,
) -> Result<RiskRuleStatus, DomainError> {
    let status = RiskRuleStatus::from_str_lax(status)
        .ok_or_else(|| DomainError::Validation(format!("unknown risk rule status {status}")))?;

    let affected = sqlx::query("UPDATE risk_rule SET status=$1 WHERE id=$2")
        .bind(status.as_str())
        .bind(rule_id)
        .execute(pool)
        .await.db()?
        .rows_affected();

    if affected == 0 {
        return Err(DomainError::NotFound(format!("risk_rule {rule_id}")));
    }
    Ok(status)
}

// ═══════════════════════════ 求值 ═══════════════════════════

#[derive(Debug, Clone, Default, Deserialize)]
pub struct RiskEvalContext {
    pub kind: String,
    pub user_id: Option<String>,
    pub order_id: Option<String>,
    pub payment_id: Option<String>,
    pub amount_minor: Option<i64>,
    pub user_age_days: Option<i32>,
    pub extras: J,
}

#[derive(Debug, Clone, Serialize)]
pub struct RiskDecision {
    pub action: String,
    pub matched_rule_ids: Vec<String>,
    pub details: J,
}

/// 按 kind 取激活规则,priority 倒序遍历,首条命中且 action ≠ `log_only` 即定案。
/// 有命中就落一条 `risk_event`。
pub async fn evaluate(pool: &PgPool, ctx: &RiskEvalContext) -> Result<RiskDecision, DomainError> {
    let rules = sqlx::query(
        r#"SELECT id, expression, action FROM risk_rule
           WHERE kind=$1 AND status='active'
             AND effective_from <= NOW()
             AND (effective_to IS NULL OR effective_to > NOW())
           ORDER BY priority DESC"#,
    )
    .bind(&ctx.kind)
    .fetch_all(pool)
    .await.db()?;

    let env = build_env(ctx);
    let mut matched: Vec<String> = Vec::new();
    let mut decided = "allow".to_string();

    for r in &rules {
        let expression: String = r.get("expression");
        let expr = match compile_expression(&expression) {
            Ok(e) => e,
            Err(e) => {
                // 规则表达式写错不该让整条支付链路挂掉,但也不能悄悄跳过。
                let id: String = r.get("id");
                tracing::warn!(rule_id = %id, error = %e, "risk rule 表达式无法解析，已跳过");
                continue;
            }
        };
        if expr.eval(&env) {
            matched.push(r.get("id"));
            decided = r.get("action");
            if decided != "log_only" {
                break;
            }
        }
    }

    if !matched.is_empty() {
        sqlx::query(
            // region 从订单取（没有订单的风控事件退回 cn）—— 见 payment.rs 那段注释
            r#"INSERT INTO risk_event(id, kind, user_id, order_id, payment_id,
                 matched_rule_ids, decided_action, details_json, decided_at, region)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(),
                       COALESCE((SELECT region FROM order_record WHERE id=$4), 'cn'))"#,
        )
        .bind(new_id("re"))
        .bind(&ctx.kind)
        .bind(&ctx.user_id)
        .bind(&ctx.order_id)
        .bind(&ctx.payment_id)
        .bind(&matched)
        .bind(&decided)
        .bind(&ctx.extras)
        .execute(pool)
        .await.db()?;
    }

    Ok(RiskDecision {
        action: decided,
        matched_rule_ids: matched,
        details: json!({}),
    })
}

fn build_env(ctx: &RiskEvalContext) -> HashMap<String, Value> {
    let mut env = HashMap::<String, Value>::new();
    if let Some(amt) = ctx.amount_minor {
        env.insert("amount".into(), Value::Int(amt));
    }
    if let Some(age) = ctx.user_age_days {
        env.insert("user.age_days".into(), Value::Int(age as i64));
    }
    if let J::Object(m) = &ctx.extras {
        for (k, v) in m {
            match v {
                J::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        env.insert(k.clone(), Value::Int(i));
                    } else if let Some(f) = n.as_f64() {
                        env.insert(k.clone(), Value::Int(f as i64));
                    }
                }
                J::String(s) => {
                    env.insert(k.clone(), Value::Str(s.clone()));
                }
                J::Bool(b) => {
                    env.insert(k.clone(), Value::Bool(*b));
                }
                _ => {}
            }
        }
    }
    env
}

// ═══════════════════════════ DSL ═══════════════════════════

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Int(i64),
    Str(String),
    Bool(bool),
}

impl Value {
    fn cmp_op(&self, op: &str, other: &Value) -> bool {
        use Value::*;
        match (self, other) {
            (Int(a), Int(b)) => match op {
                ">" => a > b,
                "<" => a < b,
                ">=" => a >= b,
                "<=" => a <= b,
                "==" => a == b,
                "!=" => a != b,
                _ => false,
            },
            (Str(a), Str(b)) => match op {
                "==" => a == b,
                "!=" => a != b,
                _ => false,
            },
            (Bool(a), Bool(b)) => match op {
                "==" => a == b,
                "!=" => a != b,
                _ => false,
            },
            _ => false,
        }
    }
}

#[derive(Debug, Clone)]
enum Connector {
    And,
    Or,
}

#[derive(Debug, Clone)]
struct Condition {
    field: String,
    op: String,
    value: Value,
}

#[derive(Debug, Clone)]
pub struct Expression {
    head: Condition,
    tail: Vec<(Connector, Condition)>,
}

impl Expression {
    pub fn eval(&self, env: &HashMap<String, Value>) -> bool {
        let mut cur = eval_one(&self.head, env);
        for (conn, c) in &self.tail {
            let next = eval_one(c, env);
            cur = match conn {
                Connector::And => cur && next,
                Connector::Or => cur || next,
            };
        }
        cur
    }
}

fn eval_one(c: &Condition, env: &HashMap<String, Value>) -> bool {
    match env.get(&c.field) {
        Some(v) => v.cmp_op(&c.op, &c.value),
        None => false,
    }
}

/// 编译一条规则表达式。规则上架时静态校验用。
pub fn compile_expression(s: &str) -> Result<Expression, String> {
    let tokens = tokenize(s)?;
    parse(&tokens)
}

#[derive(Debug, Clone)]
enum Token {
    Ident(String),
    Op(String),
    Num(i64),
    Str(String),
    Bool(bool),
    And,
    Or,
    LParen,
    RParen,
}

fn tokenize(s: &str) -> Result<Vec<Token>, String> {
    let mut out: Vec<Token> = Vec::new();
    let mut chars = s.chars().peekable();
    while let Some(&ch) = chars.peek() {
        if ch.is_whitespace() {
            chars.next();
            continue;
        }
        if ch == '\'' || ch == '"' {
            let quote = ch;
            chars.next();
            let mut buf = String::new();
            let mut closed = false;
            for c2 in chars.by_ref() {
                if c2 == quote {
                    closed = true;
                    break;
                }
                buf.push(c2);
            }
            if !closed {
                return Err(format!("unterminated string starting with {quote}"));
            }
            out.push(Token::Str(buf));
            continue;
        }
        if ch == '(' {
            chars.next();
            out.push(Token::LParen);
            continue;
        }
        if ch == ')' {
            chars.next();
            out.push(Token::RParen);
            continue;
        }
        if "><=!".contains(ch) {
            let mut op = String::new();
            op.push(ch);
            chars.next();
            if let Some(&c2) = chars.peek() {
                if c2 == '=' {
                    op.push(c2);
                    chars.next();
                }
            }
            out.push(Token::Op(op));
            continue;
        }
        if ch.is_ascii_digit()
            || (ch == '-' && out.last().map(|t| matches!(t, Token::Op(_))).unwrap_or(true))
        {
            let mut num = String::new();
            num.push(ch);
            chars.next();
            while let Some(&c2) = chars.peek() {
                if c2.is_ascii_digit() {
                    num.push(c2);
                    chars.next();
                } else {
                    break;
                }
            }
            out.push(Token::Num(num.parse::<i64>().map_err(|e| e.to_string())?));
            continue;
        }
        if ch.is_alphabetic() || ch == '_' {
            let mut id = String::new();
            while let Some(&c2) = chars.peek() {
                if c2.is_alphanumeric() || c2 == '_' || c2 == '.' || c2 == '(' || c2 == ')' || c2 == ','
                {
                    if c2 == '(' {
                        // 函数调用整体(含参数)当成一个 ident,由调用方预先求值填进 env
                        id.push(c2);
                        chars.next();
                        let mut depth = 1;
                        for c3 in chars.by_ref() {
                            id.push(c3);
                            if c3 == '(' {
                                depth += 1;
                            }
                            if c3 == ')' {
                                depth -= 1;
                                if depth == 0 {
                                    break;
                                }
                            }
                        }
                        break;
                    }
                    id.push(c2);
                    chars.next();
                } else {
                    break;
                }
            }
            match id.to_lowercase().as_str() {
                "and" => out.push(Token::And),
                "or" => out.push(Token::Or),
                "true" => out.push(Token::Bool(true)),
                "false" => out.push(Token::Bool(false)),
                _ => out.push(Token::Ident(id)),
            }
            continue;
        }
        return Err(format!("unexpected char {ch:?}"));
    }
    Ok(out)
}

fn parse(tokens: &[Token]) -> Result<Expression, String> {
    if tokens.is_empty() {
        return Err("empty expression".into());
    }
    let mut i = 0;
    let head = parse_condition(tokens, &mut i)?;
    let mut tail: Vec<(Connector, Condition)> = Vec::new();
    while i < tokens.len() {
        let conn = match &tokens[i] {
            Token::And => Connector::And,
            Token::Or => Connector::Or,
            _ => return Err(format!("expected AND/OR at token {i}")),
        };
        i += 1;
        let c = parse_condition(tokens, &mut i)?;
        tail.push((conn, c));
    }
    Ok(Expression { head, tail })
}

fn parse_condition(tokens: &[Token], i: &mut usize) -> Result<Condition, String> {
    let field = match tokens.get(*i) {
        Some(Token::Ident(s)) => s.clone(),
        _ => return Err(format!("expected ident at token {i}")),
    };
    *i += 1;
    let op = match tokens.get(*i) {
        Some(Token::Op(s)) => s.clone(),
        _ => return Err(format!("expected op at token {i}")),
    };
    *i += 1;
    let value = match tokens.get(*i) {
        Some(Token::Num(n)) => Value::Int(*n),
        Some(Token::Str(s)) => Value::Str(s.clone()),
        Some(Token::Bool(b)) => Value::Bool(*b),
        _ => return Err(format!("expected value at token {i}")),
    };
    *i += 1;
    Ok(Condition { field, op, value })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_simple_gt() {
        let e = compile_expression("amount > 100000").unwrap();
        let mut env = HashMap::new();
        env.insert("amount".into(), Value::Int(150_000));
        assert!(e.eval(&env));
        env.insert("amount".into(), Value::Int(50_000));
        assert!(!e.eval(&env));
    }

    #[test]
    fn parse_and_chain() {
        let e = compile_expression("amount > 100000 AND user.age_days < 7").unwrap();
        let mut env = HashMap::new();
        env.insert("amount".into(), Value::Int(150_000));
        env.insert("user.age_days".into(), Value::Int(3));
        assert!(e.eval(&env));
        env.insert("user.age_days".into(), Value::Int(30));
        assert!(!e.eval(&env));
    }

    #[test]
    fn parse_count_in_window_treated_as_ident() {
        let e = compile_expression("count_in_window(payment,user_id,1h) > 5").unwrap();
        let mut env = HashMap::new();
        env.insert("count_in_window(payment,user_id,1h)".into(), Value::Int(6));
        assert!(e.eval(&env));
    }

    // ─── 下面几条是搬过来时补的。旧实现只测了 happy path,
    //     而 evaluate() 会拿用户在后台随手写的表达式来编译。

    #[test]
    fn empty_expression_is_an_error_not_a_panic() {
        assert!(compile_expression("").is_err());
        assert!(compile_expression("   ").is_err());
    }

    #[test]
    fn unterminated_string_is_an_error() {
        // 旧 tokenizer 遇到没闭合的引号会把剩下的全吞掉当字符串,静默通过
        assert!(compile_expression("channel == 'wechat").is_err());
    }

    #[test]
    fn missing_value_is_an_error() {
        assert!(compile_expression("amount >").is_err());
        assert!(compile_expression("amount").is_err());
    }

    #[test]
    fn unknown_field_evaluates_false_rather_than_matching() {
        // env 里没有的字段一律不命中 —— 规则宁可漏也不能误杀
        let e = compile_expression("nonexistent_field > 1").unwrap();
        assert!(!e.eval(&HashMap::new()));
    }

    #[test]
    fn type_mismatch_does_not_match() {
        let e = compile_expression("amount > 100").unwrap();
        let mut env = HashMap::new();
        env.insert("amount".into(), Value::Str("lots".into()));
        assert!(!e.eval(&env));
    }

    #[test]
    fn or_chain() {
        let e = compile_expression("amount > 100000 OR user.age_days < 1").unwrap();
        let mut env = HashMap::new();
        env.insert("amount".into(), Value::Int(1));
        env.insert("user.age_days".into(), Value::Int(0));
        assert!(e.eval(&env));
    }
}

// ═══════════════════════ 接线开关(台账 D7)═══════════════════════

/// 风控现在拦不拦单。
///
/// 默认 **false** —— 规则照跑、事件照落、**一单不拦**。这是上线策略的一部分,
/// 不是「以后再说」:后台风控台先看到真实命中率,运营再逐条把规则改成拦截判定,
/// 那时把 `UNMEI_RISK_ENFORCE=1` 打开。
///
/// 为什么要这个开关,而不是直接接上就完事:今天库里 4 条激活规则的判定是
/// `review` / `challenge`,**没有一条是 log_only**。照原样接线,上线当天就开始
/// 拦真单 —— 而规则从来没在真流量上跑过,没人知道它们的命中率是 0.1% 还是 30%。
///
/// 也不能为了「先不拦」就干脆不调 `evaluate` —— 那样规则永远等不到数据,
/// 风控台永远是空的,这条路会一直停在「实现完整、零调用方」。
pub fn enforcing() -> bool {
    matches!(std::env::var("UNMEI_RISK_ENFORCE").as_deref(), Ok("1") | Ok("true"))
}

/// 这些判定意味着「这一单别往下走了」。`review` / `challenge` 要人介入,
/// 所以也算拦 —— 拦下来交给人,不是放过去。
const BLOCKING: &[&str] = &["block", "reject", "review", "challenge"];

/// 跑一遍风控并按开关决定拦不拦。命中一律落 `risk_event`(在 `evaluate` 里),
/// 观察模式下额外打一行日志,写明「如果开了会怎样」。
pub async fn gate(pool: &PgPool, ctx: &RiskEvalContext) -> Result<(), DomainError> {
    let d = evaluate(pool, ctx).await?;
    if d.matched_rule_ids.is_empty() {
        return Ok(());
    }
    let blocking = BLOCKING.contains(&d.action.as_str());

    /* 【命中了要开个案子，不然没有人接】（2026-09-04）。
       `risk_case` 有表、有四个状态、后台有「结案」路由（那一条这一轮
       刚接上状态机），而**全仓没有一处建案子**，库里零行。
       同一个形状这一轮遇到第八次:建好了，两头没接上。

       命中而不开案子的后果很具体:`risk_event` 是一条流水，
       没有状态、没有负责人、没有「处理完了没有」。运营那一屏
       「风控案子」永远是空的，而看板上「没结的案子」这个 KPI 恒为 0 ——
       它读起来像「风控没事」，而实际是「风控的事没人接」。

       只给【拦截类】动作开案子:`log_only` / `allow` 那些是留痕，
       不需要人做什么。观察模式下照开 —— 那些正是「本可拦下」的单，
       开关翻开前要看的就是它们。 */
    if blocking {
        if let Err(e) = 开个案子(pool, ctx, &d).await {
            // 案子开不出来不该把这一单带走 —— 它是旁证，不是主路径。
            // 但要 error 一行:一张悄悄不生长的案子表比没有更糟。
            tracing::error!(kind = %ctx.kind, %e, "风控命中了，案子没开出来");
        }
    }

    if blocking && enforcing() {
        return Err(DomainError::RiskBlocked {
            rule_id: d.matched_rule_ids.join(","),
            action: d.action,
        });
    }
    tracing::info!(
        kind = %ctx.kind, action = %d.action, rules = ?d.matched_rule_ids,
        enforcing = enforcing(),
        "风控命中{}", if blocking { "（观察模式，本可拦下）" } else { "" }
    );
    Ok(())
}

/// 给一次拦截类命中开一个案子。
///
/// **同一个对象只开一个**:一单从下单到支付会过两道闸，
/// 两次都命中就是两条 `risk_event`（那是流水，本来就该有两条），
/// 而案子是「这件事要不要人管」—— 一件事一个案子。
/// 判据是「这一单/这个人上还有没有没结的案子」。
///
/// 严重度按动作定:`block` / `reject` 是真要拦的，记 high；
/// `review` / `challenge` 是要人看一眼的，记 med。
/// 不编一个「critical」——那一档留给人工升级，机器判不出来。
async fn 开个案子(
    pool: &PgPool,
    ctx: &RiskEvalContext,
    d: &RiskDecision,
) -> Result<(), DomainError> {
    let 严重 = match d.action.as_str() {
        "block" | "reject" => "high",
        _ => "med",
    };
    let 用户们: Vec<String> = ctx.user_id.iter().cloned().collect();
    let 订单们: Vec<String> = ctx.order_id.iter().cloned().collect();

    /* 一条 INSERT ... SELECT，把「还没有没结的案子」写进同一句话里 ——
       先查再插的话，两道闸几乎同时命中会各插一条。
       `WHERE NOT EXISTS` 里比的是 involved_*，那是这张表描述「关于谁/关于哪一单」
       的地方。 */
    let n = sqlx::query(
        "INSERT INTO risk_case(id, kind, severity, involved_user_ids, involved_order_ids,
                               state, opened_at, audit_note, region)
         SELECT $1, $2, $3, $4, $5, 'open', NOW(), $6, $7
          WHERE NOT EXISTS (
                SELECT 1 FROM risk_case c
                 WHERE c.state IN ('open','investigating')
                   AND ( ($5::text[] <> '{}' AND c.involved_order_ids && $5::text[])
                      OR ($5::text[]  = '{}' AND c.involved_user_ids  && $4::text[]) )
          )",
    )
    .bind(new_id("rc"))
    .bind(&ctx.kind)
    .bind(严重)
    .bind(&用户们)
    .bind(&订单们)
    .bind(format!("规则 {} 判 {}", d.matched_rule_ids.join("、"), d.action))
    .bind(区(ctx))
    .execute(pool)
    .await.db()?
    .rows_affected();
    if n > 0 {
        tracing::info!(kind = %ctx.kind, action = %d.action, 严重,
            "风控开了一个案子 —— 等人来看");
    }
    Ok(())
}

/// 这次风控发生在哪个区。`extras` 里带了就用，没带按 `cn`
/// （跟别处同一个默认，见 `payment.rs` 那段 region 注释）。
fn 区(ctx: &RiskEvalContext) -> String {
    ctx.extras
        .get("region")
        .and_then(|v| v.as_str())
        .unwrap_or("cn")
        .to_string()
}

/// 结掉一个风控案子。
///
/// 【`RiskCaseState` 四个状态定义了，没有一条路走到终态】——
/// 跟会计期间、跟对账差异是同一种缺口:表建好了、状态列好了，
/// 而人要做的那个动作没有人写。风控页因此只能看，看完什么也做不了。
///
/// `resolved` 与 `false_positive` 分开，不是两个同义词:
/// 前者是「这确实有问题，已处理」，后者是「规则报错了」。
/// 混成一个的话，规则调不调、调哪一条，就再也无从判断。
pub async fn close_case(
    pool: &PgPool,
    case_id: &str,
    to_state: &str,
    note: &str,
    actor: &Actor,
) -> Result<RiskCaseState, DomainError> {
    use unmei_domain::commerce::state_machine::StateTransition;

    let 目标 = RiskCaseState::from_str_lax(to_state).ok_or_else(|| {
        DomainError::Validation(format!("案子状态 {to_state} 不认识"))
    })?;
    if note.trim().is_empty() {
        return Err(DomainError::Validation("说一句是怎么判的 —— 空的结论等于没结".into()));
    }

    let mut tx = pool.begin().await.db()?;
    let 现状: String = sqlx::query_scalar("SELECT state FROM risk_case WHERE id=$1 FOR UPDATE")
        .bind(case_id)
        .fetch_optional(&mut *tx)
        .await.db()?
        .ok_or_else(|| DomainError::NotFound(format!("风控案子 {case_id}")))?;
    let 现 = RiskCaseState::from_str_lax(&现状)
        .ok_or_else(|| DomainError::Internal(format!("案子状态 {现状} 不认识")))?;
    // 结了的案子不回头 —— 判错了要重开是【新】的一件事，
    // 抹掉旧结论之后没人看得出它曾经被结过
    现.assert_transition(目标)?;

    let 收尾 = matches!(目标, RiskCaseState::Resolved | RiskCaseState::FalsePositive);
    sqlx::query(
        "UPDATE risk_case SET state=$1,
                closed_at = CASE WHEN $2 THEN NOW() ELSE closed_at END,
                assigned_admin_id = COALESCE(assigned_admin_id, $3),
                audit_note = COALESCE(audit_note,'') || E'\n' || $4
           WHERE id=$5",
    )
    .bind(目标.as_str())
    .bind(收尾)
    .bind(actor.id.as_deref())
    .bind(format!("{} → {}：{}", actor.label(), 目标.as_str(), note.trim()))
    .bind(case_id)
    .execute(&mut *tx)
    .await.db()?;

    tx.commit().await.db()?;
    Ok(目标)
}
