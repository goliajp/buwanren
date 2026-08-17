//! 幂等键(台账 D6)。
//!
//! 起因是一个实测复现的资金漏洞:同一张订单连按两次「支付」,产生两笔各自成功的
//! 支付,应付 19900、实付 39800。
//!
//! 拒绝并发支付、或者顶掉旧的那一笔,两条都只是把问题挪个地方 —— 前者让用户
//! 放弃付款后干等 30 分钟才能重试,后者可能关掉用户正在付的那一笔。
//! 真正的答案在客户端那一侧:请求带一个幂等键,**同键同参返回首次结果**。
//! 这样重复下单与重复支付是同一件事,一处解决。
//!
//! ## 三种结果
//!
//! - [`Claim::Fresh`] —— 键是新的,已经占住,去执行;完了调 [`complete`] 或 [`release`]
//! - [`Claim::Replay`] —— 这个键上次已经跑完了,把首次的响应原样还回去
//! - [`Claim::InFlight`] —— 另一个请求正拿着这个键在跑。返回 409 让客户端稍后重试,
//!   **不要等** —— 等就把连接数押在对方的执行时间上
//! - [`Claim::Fingerprint`] —— 同一个键配了不同的参数。这是客户端 bug,
//!   这时候把上一次的响应还给它比报错更糟:它会以为自己这次新请求成功了
//!
//! ## 只记成功
//!
//! 4xx / 5xx 不落库,调用方走 [`release`] 把键放开。把失败也缓存起来的话,
//! 一次网络抖动会让这个键在 24 小时里永远返回那个错误 —— 客户端换个键才能下单,
//! 而它并不知道要换。

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use unmei_domain::DomainError;

use crate::DbResultExt;

/// 占键的结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Claim {
    Fresh,
    Replay { status: i32, body: Value },
    InFlight,
    Fingerprint,
}

/// 请求参数的指纹。同键同参才返回首次结果,所以要有个东西代表「同参」。
pub fn fingerprint(body: &Value) -> String {
    // serde_json 的 Map 默认按插入顺序,同样的语义可能序列化出不同字节。
    // 这里按键名排序后再哈希,让「字段顺序不同的同一个请求」算同一个。
    fn canon(v: &Value) -> String {
        match v {
            Value::Object(m) => {
                let mut ks: Vec<_> = m.keys().collect();
                ks.sort();
                let inner: Vec<String> = ks.iter().map(|k| format!("{k}:{}", canon(&m[*k]))).collect();
                format!("{{{}}}", inner.join(","))
            }
            Value::Array(a) => format!("[{}]", a.iter().map(canon).collect::<Vec<_>>().join(",")),
            other => other.to_string(),
        }
    }
    let mut h = Sha256::new();
    h.update(canon(body).as_bytes());
    format!("{:x}", h.finalize())
}

/// 占住这个键。返回 [`Claim::Fresh`] 才可以往下执行。
pub async fn claim(
    pool: &PgPool,
    key: &str,
    user_id: Option<&str>,
    method: &str,
    path: &str,
    fp: &str,
) -> Result<Claim, DomainError> {
    // 占键与判重必须是同一条语句 —— 先 SELECT 再 INSERT 的话,两个并发请求
    // 会双双看到「没有」,然后双双执行。ON CONFLICT 把这一步压进一次原子写。
    //
    // DO UPDATE 上挂 `WHERE expires_at < NOW()`:过期的键可以被重新占用,
    // 没过期的则冲突不返回行,交给下面的 SELECT 去分辨是重放还是正在处理。
    let claimed = sqlx::query(
        "INSERT INTO idempotency_log \
           (key, user_id, method, path, request_fingerprint, response_status, response_body, created_at, expires_at) \
         VALUES ($1, $2, $3, $4, $5, 0, '{}'::jsonb, NOW(), NOW() + INTERVAL '24 hours') \
         ON CONFLICT (key) DO UPDATE SET \
           user_id = EXCLUDED.user_id, method = EXCLUDED.method, path = EXCLUDED.path, \
           request_fingerprint = EXCLUDED.request_fingerprint, \
           response_status = 0, response_body = '{}'::jsonb, \
           created_at = NOW(), expires_at = NOW() + INTERVAL '24 hours' \
         WHERE idempotency_log.expires_at < NOW() \
         RETURNING key",
    )
    .bind(key)
    .bind(user_id)
    .bind(method)
    .bind(path)
    .bind(fp)
    .fetch_optional(pool)
    .await
    .db()?;

    if claimed.is_some() {
        return Ok(Claim::Fresh);
    }

    let row = sqlx::query(
        "SELECT response_status, response_body, request_fingerprint, method, path \
         FROM idempotency_log WHERE key = $1",
    )
    .bind(key)
    .fetch_optional(pool)
    .await
    .db()?;

    let Some(row) = row else {
        // 键在这两条语句之间被清掉了(过期清理正好撞上)。当新的处理。
        return Ok(Claim::Fresh);
    };

    let stored_fp: Option<String> = row.get("request_fingerprint");
    let stored_method: String = row.get("method");
    let stored_path: String = row.get("path");
    // 路径也算参数的一部分:同一个键用在下单和支付上,那两次的「同参」毫无意义
    if stored_fp.as_deref() != Some(fp) || stored_method != method || stored_path != path {
        return Ok(Claim::Fingerprint);
    }

    let status: i32 = row.get("response_status");
    if status == 0 {
        return Ok(Claim::InFlight);
    }
    Ok(Claim::Replay { status, body: row.get("response_body") })
}

/// 执行成功,把首次响应记下来。之后同键同参都拿它。
pub async fn complete(pool: &PgPool, key: &str, status: i32, body: &Value) -> Result<(), DomainError> {
    if status == 0 {
        return Err(DomainError::Validation("响应状态码不能是 0(那是「处理中」的占位)".into()));
    }
    sqlx::query("UPDATE idempotency_log SET response_status = $2, response_body = $3 WHERE key = $1")
        .bind(key)
        .bind(status)
        .bind(body)
        .execute(pool)
        .await
        .db()?;
    Ok(())
}

/// 执行失败,把键放开让客户端能重试。只放开还占着的那种,
/// 不碰已经落了响应的 —— 那是别人的成功结果。
pub async fn release(pool: &PgPool, key: &str) -> Result<(), DomainError> {
    sqlx::query("DELETE FROM idempotency_log WHERE key = $1 AND response_status = 0")
        .bind(key)
        .execute(pool)
        .await
        .db()?;
    Ok(())
}

/// 清过期键。24 小时窗口过后这些行没有意义,留着只会让表一直长。
pub async fn purge_expired(pool: &PgPool) -> Result<u64, DomainError> {
    let r = sqlx::query("DELETE FROM idempotency_log WHERE expires_at < NOW()")
        .execute(pool)
        .await
        .db()?;
    Ok(r.rows_affected())
}

/// 给调用方拼「正在处理中」的响应体,免得每个路由各写一份措辞。
pub fn in_flight_body() -> Value {
    json!({ "error": "request_in_flight", "message": "同一个幂等键的上一个请求还在处理,请稍后重试" })
}
