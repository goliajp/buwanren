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
use unmei_domain::commerce::enums::RiskRuleStatus;
use unmei_domain::DomainError;

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
        .await?
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
    .await?;

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
                tracing::warn!(rule_id = %id, error = %e, "risk rule 表达式无法解析,已跳过");
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
            r#"INSERT INTO risk_event(id, kind, user_id, order_id, payment_id,
                 matched_rule_ids, decided_action, details_json, decided_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())"#,
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
        .await?;
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
