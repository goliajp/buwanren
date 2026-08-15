//! PgRiskService · `RiskService` trait 的 sqlx 落地 + 简易 DSL 规则引擎。
//!
//! DSL 语法(MVP):
//! ```text
//! expression := condition (AND|OR condition)*
//! condition  := field op value
//! field      := <ident>(\.<ident>)*  // 如 amount / user.age_days / count_in_window(payment,user_id,1h)
//! op         := > < >= <= == !=
//! value      := number | 'string' | true | false
//! ```
//!
//! 求值时 ctx 提供已计算好的 field → value 映射;count_in_window 由 service 预填入 ctx.
//! 解析失败 → DomainError::Validation(规则上架时静态校验)。

use async_trait::async_trait;
use chrono::Utc;
use serde_json::{json, Value as J};
use sqlx::PgPool;
use uuid::Uuid;

use crate::commerce::events::DomainEvent;
use crate::commerce::outbox;
use crate::commerce::risk::{RiskCase, RiskEvent, RiskRule};
use crate::commerce::services::{
    ListParams, Page, RiskDecision, RiskEvalContext, RiskService,
};
use crate::DomainError;

#[derive(Clone)]
pub struct PgRiskService {
    pub pool: PgPool,
}

impl PgRiskService {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

#[async_trait]
impl RiskService for PgRiskService {
    async fn list_rules(&self, kind: Option<&str>) -> Result<Vec<RiskRule>, DomainError> {
        let rules: Vec<RiskRule> = sqlx::query_as(
            r#"SELECT * FROM risk_rule
               WHERE ($1::text IS NULL OR kind=$1)
               ORDER BY status='active' DESC, priority DESC, name"#,
        ).bind(kind).fetch_all(&self.pool).await?;
        Ok(rules)
    }

    async fn upsert_rule(&self, rule: RiskRule, _admin_id: &str) -> Result<RiskRule, DomainError> {
        // 静态校验 expression
        let _ = compile_expression(&rule.expression)
            .map_err(|e| DomainError::Validation(format!("expression: {e}")))?;
        let id = if rule.id.is_empty() { format!("rr-{}", Uuid::new_v4()) } else { rule.id.clone() };
        sqlx::query(
            r#"INSERT INTO risk_rule(id, name, kind, expression, action, priority, status,
                 effective_from, effective_to, audit_note)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO UPDATE SET
                 name=EXCLUDED.name, kind=EXCLUDED.kind, expression=EXCLUDED.expression,
                 action=EXCLUDED.action, priority=EXCLUDED.priority, status=EXCLUDED.status,
                 effective_to=EXCLUDED.effective_to, audit_note=EXCLUDED.audit_note"#,
        ).bind(&id).bind(&rule.name).bind(rule.kind).bind(&rule.expression)
         .bind(rule.action).bind(rule.priority).bind(rule.status)
         .bind(rule.effective_from).bind(rule.effective_to).bind(&rule.audit_note)
         .execute(&self.pool).await?;
        let out: RiskRule = sqlx::query_as("SELECT * FROM risk_rule WHERE id=$1")
            .bind(&id).fetch_one(&self.pool).await?;
        Ok(out)
    }

    async fn list_events(&self, p: &ListParams) -> Result<Page<RiskEvent>, DomainError> {
        let off = p.page as i64 * p.page_size as i64;
        let lim = p.page_size.clamp(1, 200) as i64;
        let items: Vec<RiskEvent> = sqlx::query_as(
            r#"SELECT * FROM risk_event
               WHERE ($1::text IS NULL OR decided_action=$1)
               ORDER BY decided_at DESC OFFSET $2 LIMIT $3"#,
        ).bind(&p.status).bind(off).bind(lim)
         .fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM risk_event WHERE ($1::text IS NULL OR decided_action=$1)",
        ).bind(&p.status).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: p.page, page_size: p.page_size })
    }

    async fn list_cases(&self, p: &ListParams) -> Result<Page<RiskCase>, DomainError> {
        let off = p.page as i64 * p.page_size as i64;
        let lim = p.page_size.clamp(1, 200) as i64;
        let items: Vec<RiskCase> = sqlx::query_as(
            r#"SELECT * FROM risk_case
               WHERE ($1::text IS NULL OR state=$1)
               ORDER BY opened_at DESC OFFSET $2 LIMIT $3"#,
        ).bind(&p.status).bind(off).bind(lim)
         .fetch_all(&self.pool).await?;
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM risk_case WHERE ($1::text IS NULL OR state=$1)",
        ).bind(&p.status).fetch_one(&self.pool).await?;
        Ok(Page { items, total, page: p.page, page_size: p.page_size })
    }

    async fn open_case(&self, case: RiskCase, _admin_id: &str) -> Result<RiskCase, DomainError> {
        let id = if case.id.is_empty() { format!("rc-{}", Uuid::new_v4()) } else { case.id.clone() };
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            r#"INSERT INTO risk_case(id, kind, severity, involved_user_ids, involved_order_ids,
                 state, assigned_admin_id, audit_note)
               VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)"#,
        ).bind(&id).bind(&case.kind).bind(case.severity)
         .bind(&case.involved_user_ids).bind(&case.involved_order_ids)
         .bind(&case.assigned_admin_id).bind(&case.audit_note)
         .execute(&mut *tx).await?;
        outbox::write(&mut *tx, &DomainEvent::RiskCaseOpened {
            case_id: id.clone(), severity: case.severity.to_string(),
            occurred_at: Utc::now(),
        }).await?;
        tx.commit().await?;
        let out: RiskCase = sqlx::query_as("SELECT * FROM risk_case WHERE id=$1")
            .bind(&id).fetch_one(&self.pool).await?;
        Ok(out)
    }

    async fn close_case(&self, id: &str, resolution: &str, admin_id: &str) -> Result<(), DomainError> {
        sqlx::query(
            r#"UPDATE risk_case SET state=$1, closed_at=NOW(),
                 audit_note = audit_note || E'\\n' || $2
               WHERE id=$3 AND state IN ('open','investigating')"#,
        ).bind(resolution).bind(format!("admin {admin_id} close: {resolution}"))
         .bind(id).execute(&self.pool).await?;
        Ok(())
    }

    /// 规则引擎 · 按 kind 选规则、按 priority 倒序遍历、首条命中 action ≠ allow 即返回。
    async fn evaluate(&self, ctx: RiskEvalContext) -> Result<RiskDecision, DomainError> {
        let rules: Vec<RiskRule> = sqlx::query_as(
            r#"SELECT * FROM risk_rule
               WHERE kind=$1 AND status='active'
                 AND effective_from <= NOW()
                 AND (effective_to IS NULL OR effective_to > NOW())
               ORDER BY priority DESC"#,
        ).bind(&ctx.kind).fetch_all(&self.pool).await?;

        let env = build_env(&ctx);
        let mut matched: Vec<String> = Vec::new();
        let mut decided = "allow".to_string();
        for r in &rules {
            let expr = match compile_expression(&r.expression) {
                Ok(e) => e,
                Err(_) => continue,
            };
            if expr.eval(&env) {
                matched.push(r.id.clone());
                decided = r.action.to_string();
                if decided != "log_only" { break; }
            }
        }

        // 写 risk_event(若有 match)
        if !matched.is_empty() {
            let ev_id = format!("re-{}", Uuid::new_v4());
            sqlx::query(
                r#"INSERT INTO risk_event(id, kind, user_id, order_id, payment_id,
                     matched_rule_ids, decided_action, details_json, decided_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())"#,
            ).bind(&ev_id).bind(&ctx.kind).bind(&ctx.user_id)
             .bind(&ctx.order_id).bind(&ctx.payment_id)
             .bind(&matched).bind(&decided).bind(&ctx.extras)
             .execute(&self.pool).await?;
        }

        Ok(RiskDecision {
            action: decided,
            matched_rule_ids: matched,
            details: json!({}),
        })
    }
}

// ═══════════════════════════ 简易 DSL parser + evaluator ═══════════════════════════

#[derive(Debug, Clone)]
enum Value { Int(i64), Str(String), Bool(bool) }
impl Value {
    fn cmp(&self, op: &str, other: &Value) -> bool {
        use Value::*;
        match (self, other) {
            (Int(a), Int(b)) => match op {
                ">" => a > b, "<" => a < b, ">=" => a >= b, "<=" => a <= b,
                "==" => a == b, "!=" => a != b, _ => false,
            },
            (Str(a), Str(b)) => match op {
                "==" => a == b, "!=" => a != b, _ => false,
            },
            (Bool(a), Bool(b)) => match op {
                "==" => a == b, "!=" => a != b, _ => false,
            },
            _ => false,
        }
    }
}

#[derive(Debug, Clone)]
enum Connector { And, Or }

#[derive(Debug, Clone)]
struct Condition { field: String, op: String, value: Value }

#[derive(Debug, Clone)]
struct Expression {
    head: Condition,
    tail: Vec<(Connector, Condition)>,
}

impl Expression {
    fn eval(&self, env: &std::collections::HashMap<String, Value>) -> bool {
        let mut cur = eval_one(&self.head, env);
        for (conn, c) in &self.tail {
            let next = eval_one(c, env);
            cur = match conn { Connector::And => cur && next, Connector::Or => cur || next };
        }
        cur
    }
}

fn eval_one(c: &Condition, env: &std::collections::HashMap<String, Value>) -> bool {
    match env.get(&c.field) {
        Some(v) => v.cmp(&c.op, &c.value),
        None => false,
    }
}

fn compile_expression(s: &str) -> Result<Expression, String> {
    let tokens = tokenize(s)?;
    parse(&tokens)
}

#[derive(Debug, Clone)]
enum Token { Ident(String), Op(String), Num(i64), Str(String), Bool(bool), And, Or, LParen, RParen }

fn tokenize(s: &str) -> Result<Vec<Token>, String> {
    let mut out: Vec<Token> = Vec::new();
    let mut chars = s.chars().peekable();
    while let Some(&ch) = chars.peek() {
        if ch.is_whitespace() { chars.next(); continue; }
        if ch == '\'' || ch == '"' {
            let quote = ch; chars.next();
            let mut acc = String::new();
            while let Some(c) = chars.next() {
                if c == quote { break; }
                acc.push(c);
            }
            out.push(Token::Str(acc));
            continue;
        }
        if ch == '(' { chars.next(); out.push(Token::LParen); continue; }
        if ch == ')' { chars.next(); out.push(Token::RParen); continue; }
        if "><=!".contains(ch) {
            let mut op = String::new(); op.push(ch); chars.next();
            if let Some(&c2) = chars.peek() {
                if c2 == '=' { op.push(c2); chars.next(); }
            }
            out.push(Token::Op(op));
            continue;
        }
        if ch.is_ascii_digit() || (ch == '-' && out.last().map(|t| matches!(t, Token::Op(_))).unwrap_or(true)) {
            let mut num = String::new(); num.push(ch); chars.next();
            while let Some(&c2) = chars.peek() {
                if c2.is_ascii_digit() { num.push(c2); chars.next(); } else { break; }
            }
            out.push(Token::Num(num.parse::<i64>().map_err(|e| e.to_string())?));
            continue;
        }
        if ch.is_alphabetic() || ch == '_' {
            let mut id = String::new();
            while let Some(&c2) = chars.peek() {
                if c2.is_alphanumeric() || c2 == '_' || c2 == '.' || c2 == '(' || c2 == ')' || c2 == ',' {
                    if c2 == '(' {
                        // 把整个 func 名称 + 参数收下作 ident
                        id.push(c2); chars.next();
                        let mut depth = 1;
                        for c3 in chars.by_ref() {
                            id.push(c3);
                            if c3 == '(' { depth += 1; }
                            if c3 == ')' { depth -= 1; if depth == 0 { break; } }
                        }
                        break;
                    }
                    id.push(c2); chars.next();
                } else { break; }
            }
            match id.to_lowercase().as_str() {
                "and" => out.push(Token::And),
                "or"  => out.push(Token::Or),
                "true"  => out.push(Token::Bool(true)),
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
    let mut i = 0;
    let head = parse_condition(tokens, &mut i)?;
    let mut tail: Vec<(Connector, Condition)> = Vec::new();
    while i < tokens.len() {
        let conn = match &tokens[i] {
            Token::And => Connector::And,
            Token::Or  => Connector::Or,
            _ => return Err(format!("expected AND/OR at {i}")),
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
        _ => return Err(format!("expected ident at {i}")),
    };
    *i += 1;
    let op = match tokens.get(*i) {
        Some(Token::Op(s)) => s.clone(),
        _ => return Err(format!("expected op at {i}")),
    };
    *i += 1;
    let value = match tokens.get(*i) {
        Some(Token::Num(n)) => Value::Int(*n),
        Some(Token::Str(s)) => Value::Str(s.clone()),
        Some(Token::Bool(b)) => Value::Bool(*b),
        _ => return Err(format!("expected value at {i}")),
    };
    *i += 1;
    Ok(Condition { field, op, value })
}

fn build_env(ctx: &RiskEvalContext) -> std::collections::HashMap<String, Value> {
    let mut env = std::collections::HashMap::<String, Value>::new();
    if let Some(amt) = ctx.amount_minor { env.insert("amount".into(), Value::Int(amt)); }
    if let Some(ag) = ctx.user_age_days { env.insert("user.age_days".into(), Value::Int(ag as i64)); }
    // 扁平化 extras
    if let J::Object(m) = &ctx.extras {
        for (k, v) in m {
            match v {
                J::Number(n) => {
                    if let Some(i) = n.as_i64() { env.insert(k.clone(), Value::Int(i)); }
                    else if let Some(f) = n.as_f64() { env.insert(k.clone(), Value::Int(f as i64)); }
                }
                J::String(s) => { env.insert(k.clone(), Value::Str(s.clone())); }
                J::Bool(b) => { env.insert(k.clone(), Value::Bool(*b)); }
                _ => {}
            }
        }
    }
    env
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

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
}
