use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode, header::AUTHORIZATION},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use unmei_domain::{AppError, ApiErrorBody, DomainError};
use sqlx::Row;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminClaims {
    pub sub: String,        // admin_id
    pub exp: i64,
    pub roles: Vec<String>,
    pub name: String,
    /// P1 6-cell:本 admin 可访问的 region 集合(super=全开;区域 admin=单个)
    /// 含 `"global"` 表示可访问集团聚合视图
    #[serde(default)]
    pub region_scope: Vec<String>,
}

pub fn issue(id: &str, name: &str, roles: &[String], region_scope: &[String], secret: &[u8], ttl_sec: i64) -> anyhow::Result<String> {
    let now = chrono::Utc::now().timestamp();
    let claims = AdminClaims {
        sub: id.to_string(), name: name.to_string(),
        roles: roles.to_vec(),
        region_scope: region_scope.to_vec(),
        exp: now + ttl_sec,
    };
    Ok(encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret))?)
}

pub fn decode_token(tok: &str, secret: &[u8]) -> Result<AdminClaims, AppError> {
    decode::<AdminClaims>(tok, &DecodingKey::from_secret(secret), &Validation::new(Algorithm::HS256))
        .map(|d| d.claims)
        .map_err(|_| AppError::Unauthorized)
}

pub struct Admin(pub AdminClaims);
#[axum::async_trait]
impl FromRequestParts<AppState> for Admin {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        let v = parts.headers.get(AUTHORIZATION).ok_or(ApiError(AppError::Unauthorized))?;
        let v = v.to_str().map_err(|_| ApiError(AppError::Unauthorized))?;
        let tok = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer "))
            .ok_or(ApiError(AppError::Unauthorized))?;
        let mut claims = decode_token(tok, &state.jwt_secret).map_err(ApiError)?;

        /* 【停用一个管理员要当场生效】（2026-09-03 五路评审 · 越权审计）。

           上一版验完签名就放行 —— 这个提取器【一次都没查过库】。
           于是把一个管理员 `is_active=false`、甚至把整行删掉，
           他手里那张 token 仍然能用满八小时，写操作照做。
           而用户那一侧每个请求都查 `is_banned`（见 unmei-api/src/auth.rs）——
           同一个仓里两套标准，松的那一套管的偏偏是权限更大的人。

           角色与分区也从库里现取，不认 token 里那两份:
           收回一个人的 `finance` 角色、把他的区从 cn 改成 hk，
           都不该等到他重新登录才算数。token 里那两份只是签发时的快照，
           而权限的真相在库里。

           代价是每个请求多一次主键查询 —— 跟用户那一侧同一笔账。 */
        let row = sqlx::query(
            "SELECT is_active, roles, region_scope FROM admin_user WHERE id=$1",
        )
        .bind(&claims.sub)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError(AppError::Infra(format!("db: {e}"))))?;

        // 人没了 = token 作废。这里给 401 不给 403 ——
        // 「你这张票不算数了」，不是「你的票有效但不让你进」
        let row = row.ok_or(ApiError(AppError::Unauthorized))?;
        if !row.get::<bool, _>("is_active") {
            return Err(ApiError(AppError::Unauthorized));
        }
        claims.roles = row
            .get::<serde_json::Value, _>("roles")
            .as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        claims.region_scope = row.get::<Vec<String>, _>("region_scope");

        Ok(Admin(claims))
    }
}

impl Admin {
    pub fn requires_role(&self, role: &str) -> Result<(), ApiError> {
        if self.0.roles.iter().any(|r| r == role || r == "super") { Ok(()) }
        else { Err(ApiError(AppError::Forbidden)) }
    }

    /// 几个角色里有一个就行。`super` 永远通过。
    ///
    /// 分工表里不少条是「客服或运营都做得了」（填运单号、标物流异常），
    /// 硬塞进单角色要么得给客服多发一个运营角色（那等于没分），
    /// 要么把同一件事拆成两条路由（那是为了迁就写法改产品）。
    pub fn requires_any_role(&self, roles: &[&str]) -> Result<(), ApiError> {
        if self.0.roles.iter().any(|r| r == "super" || roles.contains(&r.as_str())) { Ok(()) }
        else { Err(ApiError(AppError::Forbidden)) }
    }
}

// ─── Error wrapper ────────────────────────────────────────────
pub struct ApiError(pub AppError);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.0.status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        // 原文只进日志。不写这一句的话，把它从响应体里拿掉等于把它丢了 ——
        // 排查的人拿不到表名约束名，比现在还糟。
        if let Some(detail) = self.0.detail() {
            tracing::error!(status = status.as_u16(), detail, "infra failure");
        }
        /* 【后台也不许把库的原文发出去】（2026-09-03 五路评审 · 越权审计）。
           用户侧早改成 `出面()` 了，这一边一直是 `to_string()` ——
           于是 `db: error returned from database: duplicate key value
           violates unique constraint "…"` 连表名带约束名一起进响应体。
           后台不是内网:它就是一个挂在公网上的登录页，
           一个撞库成功的人由此拿到整张表结构。

           原文照旧进日志（上面那一句），排查的人一点没少拿。 */
        let body = ApiErrorBody { error: self.0.出面(), code: self.0.code().to_string() };
        (status, Json(body)).into_response()
    }
}
impl From<AppError> for ApiError { fn from(e: AppError) -> Self { Self(e) } }
/// 用例层(`unmei-app`)的错误。状态码由 `DomainError::http_status()` 决定,
/// 路由不再手工判断该返回什么。
impl From<DomainError> for ApiError {
    fn from(e: DomainError) -> Self { Self(AppError::Domain(e)) }
}
impl ApiError {
    pub fn not_found(msg: impl Into<String>) -> Self { Self(AppError::NotFound(msg.into())) }
}
impl From<sqlx::Error> for ApiError { fn from(e: sqlx::Error) -> Self { Self(AppError::Infra(format!("db: {e}"))) } }
impl From<reqwest::Error> for ApiError { fn from(e: reqwest::Error) -> Self { Self(AppError::Infra(format!("http: {e}"))) } }
impl From<serde_json::Error> for ApiError { fn from(e: serde_json::Error) -> Self { Self(AppError::Infra(format!("json: {e}"))) } }
impl From<anyhow::Error> for ApiError { fn from(e: anyhow::Error) -> Self { Self(AppError::Internal(e.to_string())) } }
