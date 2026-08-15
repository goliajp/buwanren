use axum::{routing::post, Router, Json, extract::State};
use serde::Deserialize;
use serde_json::json;
use unmei_domain::{AuthOut, UserPublic};
use uuid::Uuid;
use crate::state::AppState;
use crate::auth::{issue, ApiError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/auth/anonymous", post(anonymous))
        .route("/v1/auth/wechat", post(wechat_mock))
}

#[derive(Debug, Deserialize, Default)]
struct AnonymousReq {
    #[serde(default)] platform: Option<String>,
    #[serde(default)] region:   Option<String>,
    #[serde(default)] locale:   Option<String>,
}

async fn anonymous(
    State(st): State<AppState>,
    Json(req): Json<AnonymousReq>,
) -> Result<Json<AuthOut>, ApiError> {
    let id = format!("u_anon_{}", Uuid::new_v4().simple());
    let plat = req.platform.unwrap_or_else(|| "web".into());
    let region = req.region.unwrap_or_else(|| "cn".into());
    let locale = req.locale.unwrap_or_else(|| "zh-CN".into());
    sqlx::query!(
        r#"INSERT INTO user (id, platform, region, locale, is_anonymous) VALUES (?,?,?,?,1)"#,
        id, plat, region, locale,
    ).execute(&st.db).await?;
    let user = UserPublic {
        id: id.clone(),
        nickname: "过客".into(),
        avatar_url: None,
        platform: plat.clone(),
        region: region.clone(),
        locale,
        active_natal_id: None,
        is_anonymous: true,
    };
    let token = issue(&id, &plat, &region, &st.jwt_secret, 86400 * 30)
        .map_err(ApiError::from)?;
    Ok(Json(AuthOut { token, user, expires_in: 86400 * 30 }))
}

#[derive(Debug, Deserialize)]
struct WechatReq {
    /// 真实接入时此处校验微信 code → openid;mock 时直接给 openid
    code_or_openid: String,
    #[serde(default)] nickname: Option<String>,
    #[serde(default)] avatar_url: Option<String>,
}

async fn wechat_mock(
    State(st): State<AppState>,
    Json(req): Json<WechatReq>,
) -> Result<Json<AuthOut>, ApiError> {
    // upsert
    let existing = sqlx::query!(
        "SELECT id, nickname, avatar_url, platform, region, locale, active_natal_id, is_anonymous
         FROM user WHERE openid_wx = ?", req.code_or_openid
    ).fetch_optional(&st.db).await?;
    let user = if let Some(u) = existing {
        UserPublic {
            id: u.id, nickname: u.nickname, avatar_url: u.avatar_url,
            platform: u.platform, region: u.region, locale: u.locale,
            active_natal_id: u.active_natal_id, is_anonymous: u.is_anonymous != 0,
        }
    } else {
        let id = format!("u_wx_{}", Uuid::new_v4().simple());
        let nickname = req.nickname.unwrap_or_else(|| "微信用户".into());
        sqlx::query!(
            "INSERT INTO user (id, openid_wx, nickname, avatar_url, platform, region, is_anonymous)
             VALUES (?,?,?,?, 'mini', 'cn', 0)",
            id, req.code_or_openid, nickname, req.avatar_url,
        ).execute(&st.db).await?;
        UserPublic {
            id, nickname, avatar_url: req.avatar_url,
            platform: "mini".into(), region: "cn".into(), locale: "zh-CN".into(),
            active_natal_id: None, is_anonymous: false,
        }
    };
    let token = issue(&user.id, &user.platform, &user.region, &st.jwt_secret, 86400 * 30)
        .map_err(ApiError::from)?;
    Ok(Json(AuthOut { token, user, expires_in: 86400 * 30 }))
}
