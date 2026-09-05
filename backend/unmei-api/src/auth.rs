//! JWT 鉴权 — 极简,headers 取 token,middleware 注入 user_id

use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode, header::AUTHORIZATION},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use unmei_domain::{AppError, ApiErrorBody, DomainError};

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,       // user_id
    pub exp: i64,
    pub plat: String,
    pub region: String,
}

pub fn issue(user_id: &str, plat: &str, region: &str, secret: &[u8], ttl_sec: i64) -> anyhow::Result<String> {
    let now = chrono::Utc::now().timestamp();
    let claims = Claims {
        sub: user_id.to_string(),
        exp: now + ttl_sec,
        plat: plat.to_string(),
        region: region.to_string(),
    };
    let tok = encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret))?;
    Ok(tok)
}

pub fn decode_token(tok: &str, secret: &[u8]) -> Result<Claims, AppError> {
    decode::<Claims>(
        tok,
        &DecodingKey::from_secret(secret),
        &Validation::new(Algorithm::HS256),
    )
    .map(|d| d.claims)
    .map_err(|_| AppError::Unauthorized)
}

/// 从 Authorization: Bearer ... 取 claims;无 token 时返回 None(用于半公开接口)
pub fn try_claims(parts: &Parts, secret: &[u8]) -> Option<Claims> {
    let v = parts.headers.get(AUTHORIZATION)?.to_str().ok()?;
    let tok = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer "))?;
    decode_token(tok, secret).ok()
}

/// Required-auth extractor
pub struct AuthedUser(pub Claims);

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthedUser {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        let v = parts.headers.get(AUTHORIZATION).ok_or(ApiError(AppError::Unauthorized))?;
        let v = v.to_str().map_err(|_| ApiError(AppError::Unauthorized))?;
        let tok = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer "))
            .ok_or(ApiError(AppError::Unauthorized))?;
        let claims = decode_token(tok, &state.jwt_secret).map_err(ApiError)?;

        /* 【封了要真的进不来】（2026-09-03）。`app_user.is_banned` 这一列
           从建库起就在，而**没有任何地方写它，也没有任何地方读它**。
           一个建好了却不生效的开关比没有更糟:后台看着能封，
           封完那个人照常下单。

           查在这里而不是逐条路由 —— 三十多个要登录的接口手抄必漏，
           而漏掉的那一条正是他会去用的那条。
           代价是每个请求多一次主键查询。

           token 里不带这个标志，因为 token 签发之后不会更新 ——
           封一个人不该等到他的 token 过期（八小时）才生效。 */
        /* 【注销过的也在这一句里挡】（2026-09-05）。挡在这里而不是逐条路由,
           理由跟上面那条一样:三十多个要登录的接口手抄必漏。

           回的是 **401 不是 403**。403 是「你不能做这件事」，
           而注销之后这个账号已经不存在 —— 401 才是实情;
           而且客户端对 401 的处置是清掉 token 重新匿名登录
           （`services/api.ts`），那正是一个刚注销完的人该落到的地方:
           一个干净的新身份。403 会让他卡在一屏「没有权限」上。 */
        let 那个人: Option<(bool, Option<chrono::DateTime<chrono::Utc>>)> =
            sqlx::query_as("SELECT is_banned, deleted_at FROM app_user WHERE id=$1")
                .bind(&claims.sub)
                .fetch_optional(&state.db)
                .await
                .map_err(|e| ApiError(AppError::Infra(format!("db: {e}"))))?;
        if let Some((封了, 注销了)) = 那个人 {
            /* 【注销那一条自己放行】。它在应用层是幂等的（再调一次返回
               各项都是 0），而这道守卫会抢在它前面把第二次打成 401 ——
               于是那份幂等【在 HTTP 上一次都到不了】。

               这不是给注销开后门:一个已经注销的号再注销一次是空操作，
               放行不多给它任何东西。而挡住的代价是真的:网络超时之后
               人再点一次，那一下其实已经成了，屏上却报「没登录」——
               他会以为自己的数据还在，而且再也找不到那个号去注销一次。 */
            let 是注销那一条 = parts.uri.path() == "/v1/user/me/delete";
            if 注销了.is_some() && !是注销那一条 {
                return Err(ApiError(AppError::Unauthorized));
            }
            if 封了 {
                return Err(ApiError(AppError::Forbidden));
            }
        }

        Ok(AuthedUser(claims))
    }
}

// ─── Error wrapper for axum response ───────────────────────────
pub struct ApiError(pub AppError);

impl ApiError {
    pub fn bad(msg: impl Into<String>) -> Self { Self(AppError::BadRequest(msg.into())) }
    pub fn not_found(msg: impl Into<String>) -> Self { Self(AppError::NotFound(msg.into())) }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.0.status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        // 原文只进日志。不写这一句的话，把它从响应体里拿掉等于把它丢了 ——
        // 排查的人拿不到表名约束名，比现在还糟。
        if let Some(detail) = self.0.detail() {
            tracing::error!(status = status.as_u16(), detail, "infra failure");
        }
        // 用 `出面()` 而不是 `to_string()` —— 库的原文不上屏，见 AppError::出面
        let body = ApiErrorBody { error: self.0.出面(), code: self.0.code().to_string() };
        (status, Json(body)).into_response()
    }
}
impl From<AppError> for ApiError { fn from(e: AppError) -> Self { Self(e) } }
/// 用例层(`unmei-app`)的错误。状态码由 `DomainError::http_status()` 决定 ——
/// NotFound→404 / Conflict→409 / Validation→422 / IllegalStateTransition→409,
/// 路由不再手工判断该返回什么。
impl From<DomainError> for ApiError {
    fn from(e: DomainError) -> Self { Self(AppError::Domain(e)) }
}
impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self { Self(AppError::Infra(format!("db: {e}"))) }
}
impl From<reqwest::Error> for ApiError {
    fn from(e: reqwest::Error) -> Self { Self(AppError::Infra(format!("http: {e}"))) }
}
impl From<serde_json::Error> for ApiError {
    fn from(e: serde_json::Error) -> Self { Self(AppError::Infra(format!("json: {e}"))) }
}
impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self { Self(AppError::Internal(e.to_string())) }
}
