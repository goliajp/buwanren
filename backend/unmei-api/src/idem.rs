//! `Idempotency-Key` 请求头的接线(台账 D6)。
//!
//! 判重与落库在 `unmei_app::idempotency`;这里只做 HTTP 侧的三件事:
//! 读请求头、把重放的结果原样还回去、执行完把响应记下来。
//!
//! **键是可选的**。没带键就照常执行 —— 老客户端不会因为后端上了这一层就崩。
//! 带了键才有防重的保护,所以小程序侧的下单与支付两处必须带。
//!
//! 用法固定成三步,别在路由里各写一份:
//!
//! ```ignore
//! let guard = match idem::begin(&st, &headers, Some(&user), "/v1/orders", &body_json).await? {
//!     idem::Begin::Replay(resp) => return Ok(resp),
//!     idem::Begin::Proceed(g) => g,
//! };
//! let out = do_the_work().await;
//! guard.settle(&st, &out).await;      // 成功记下来,失败放开键
//! out
//! ```

use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::Value;
use unmei_app::idempotency::{self, Claim};

use crate::auth::ApiError;
use crate::state::AppState;

pub const HEADER: &str = "idempotency-key";

/// 键的长度上限。够长到能放 UUID,又不至于让人拿它当存储用。
const MAX_KEY_LEN: usize = 128;

pub enum Begin {
    /// 可以往下执行。执行完必须调 [`Guard::settle`]。
    Proceed(Guard),
    /// 这次是重放,把首次的响应原样还回去。
    Replay(Response),
}

/// 拿在手里的键。`None` 表示这次请求没带键,`settle` 什么都不做。
/// 记着这一次占的键**和它属于谁** —— 回写与放开都必须带上用户,
/// 否则会落到同名键的别人那一行上（幂等键是客户端给的头,重名由调用方决定）。
pub struct Guard(Option<(String, Option<String>)>);

impl Guard {
    /// 成功就把响应记下来,失败就把键放开让客户端能重试。
    ///
    /// 只记 2xx:把失败也缓存起来的话,一次网络抖动会让这个键在 24 小时里
    /// 一直返回那个错误,而客户端并不知道要换一个键。
    pub async fn settle(self, st: &AppState, outcome: &Result<Json<Value>, ApiError>) {
        let Some((key, uid)) = self.0 else { return };
        let u = uid.as_deref();
        let r = match outcome {
            Ok(Json(body)) => idempotency::complete(&st.db, &key, u, 200, body).await,
            Err(_) => idempotency::release(&st.db, &key, u).await,
        };
        // 记账失败不该把已经成功的业务操作变成失败 —— 钱已经收了、单已经建了。
        // 代价是这个键之后会被当成新的,最坏情况是防重失效一次。留日志给人看。
        if let Err(e) = r {
            tracing::error!(key, "幂等键落库失败，这个键的防重保护这次失效：{e}");
        }
    }
}

/// 读 `Idempotency-Key` 并占键。
pub async fn begin(
    st: &AppState,
    headers: &HeaderMap,
    user_id: Option<&str>,
    path: &str,
    body: &Value,
) -> Result<Begin, ApiError> {
    begin_opt(st, headers, user_id, path, body, false).await
}

/// 跟 `begin` 一样，但【要求】必须带键。给钱的那两处用。
pub async fn begin_required(
    st: &AppState,
    headers: &HeaderMap,
    user_id: Option<&str>,
    path: &str,
    body: &Value,
) -> Result<Begin, ApiError> {
    begin_opt(st, headers, user_id, path, body, true).await
}

async fn begin_opt(
    st: &AppState,
    headers: &HeaderMap,
    user_id: Option<&str>,
    path: &str,
    body: &Value,
    required: bool,
) -> Result<Begin, ApiError> {
    let Some(key) = headers.get(HEADER).and_then(|v| v.to_str().ok()).map(str::trim) else {
        if required {
            /* 钱的两处必须带键。不带就放行的话，D6 拍下的这道保护
               对【真实调用方】等于不存在 —— 而这个仓库已经有过一次
               「引擎完整、九条测试绿、零调用方」（D7 注释里点名的风控）。
               今天没有任何客户端调这两条，所以现在收紧代价为零；
               等买御守那条流程写出来，忘了带键会当场 400，而不是悄悄多扣一次。 */
            return Err(ApiError::bad(format!(
                "这个接口要带 {HEADER}：同一次操作重发要能认出来。见工序单 D6"
            )));
        }
        return Ok(Begin::Proceed(Guard(None)));
    };
    if key.is_empty() || key.len() > MAX_KEY_LEN {
        return Err(ApiError::bad(format!(
            "Idempotency-Key 长度要在 1..={MAX_KEY_LEN} 之间"
        )));
    }

    let fp = idempotency::fingerprint(body);
    match idempotency::claim(&st.db, key, user_id, "POST", path, &fp).await? {
        Claim::Fresh => Ok(Begin::Proceed(Guard(Some((key.to_string(), user_id.map(str::to_string)))))),
        Claim::Replay { status, body } => {
            let code = StatusCode::from_u16(status as u16).unwrap_or(StatusCode::OK);
            Ok(Begin::Replay((code, Json(body)).into_response()))
        }
        // 409 而不是排队等:等就把连接数押在另一个请求的执行时间上,
        // 而客户端自己重试一次的代价小得多。
        Claim::InFlight => Ok(Begin::Replay(
            (StatusCode::CONFLICT, Json(idempotency::in_flight_body())).into_response(),
        )),
        Claim::Fingerprint => Err(ApiError::bad(
            "这个 Idempotency-Key 上次配的是另一组参数。换一个键，或者把参数改回去",
        )),
    }
}
