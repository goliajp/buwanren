//! 鉴权路由
//! · POST /v1/auth/anonymous          — 匿名 token
//! · POST /v1/auth/wx/miniprogram     — 微信小程序 wx.login → code → token
//! · POST /v1/auth/wx/h5/callback     — H5 / 公众号 OAuth 回调
//! · GET  /v1/auth/wx/h5/url          — 生成微信授权跳转 URL

use axum::{routing::{post, get}, Router, Json, extract::{State, Query}};
use serde::Deserialize;
use sqlx::Row;
use unmei_domain::{AuthOut, UserPublic};
use uuid::Uuid;
use crate::state::AppState;
use crate::auth::{issue, ApiError};
use crate::routes::user_public_from_row;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/auth/anonymous",        post(anonymous))
        .route("/v1/auth/wx/miniprogram",   post(wx_miniprogram))
        .route("/v1/auth/wx/h5/url",        get(wx_h5_url))
        .route("/v1/auth/wx/h5/callback",   post(wx_h5_callback))
}

// ─── 匿名 ──────────────────────────────────────────────────
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
    sqlx::query(
        r#"INSERT INTO app_user (id, platform, region, locale, is_anonymous)
           VALUES ($1,$2,$3,$4,TRUE)"#,
    ).bind(&id).bind(&plat).bind(&region).bind(&locale)
     .execute(&st.db).await?;
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

// ─── 微信小程序 ───────────────────────────────────────────
#[derive(Debug, Deserialize)]
struct WxMiniprogramReq {
    /// wx.login() 拿到的 code
    code: String,
    #[serde(default)] nickname: Option<String>,
    #[serde(default)] avatar_url: Option<String>,
    #[serde(default)] region: Option<String>,
}

async fn wx_miniprogram(
    State(st): State<AppState>,
    Json(req): Json<WxMiniprogramReq>,
) -> Result<Json<AuthOut>, ApiError> {
    let sess = st.wx.mp_jscode2session(&req.code).await
        .map_err(|e| ApiError::bad(format!("wx login: {e}")))?;

    // upsert · 优先按 unionid 找(多端打通);否则按 mp openid
    let openid = sess.openid;
    let unionid = sess.unionid;
    let existing = sqlx::query(
        r#"SELECT id, nickname, avatar_url, platform, region, locale, active_natal_id, is_anonymous
           FROM app_user
           WHERE wx_mp_openid = $1 OR (wx_unionid IS NOT NULL AND wx_unionid = $2)
           LIMIT 1"#,
    ).bind(&openid).bind(&unionid).fetch_optional(&st.db).await?;

    let user = if let Some(u) = existing {
        // 顺便回填可能缺的字段
        let uid: String = u.get("id");
        sqlx::query(
            r#"UPDATE app_user
               SET wx_mp_openid = COALESCE(wx_mp_openid, $1),
                   wx_unionid   = COALESCE(wx_unionid,   $2),
                   last_active_at = NOW()
               WHERE id = $3"#,
        ).bind(&openid).bind(&unionid).bind(&uid).execute(&st.db).await?;
        user_public_from_row(&u)
    } else {
        let id = format!("u_wxmp_{}", Uuid::new_v4().simple());
        let nickname = req.nickname.unwrap_or_else(|| "微信用户".into());
        let region = req.region.unwrap_or_else(|| "cn".into());
        sqlx::query(
            r#"INSERT INTO app_user
               (id, wx_mp_openid, wx_unionid, nickname, avatar_url, platform, region, is_anonymous)
               VALUES ($1,$2,$3,$4,$5,'mini',$6,FALSE)"#,
        ).bind(&id).bind(&openid).bind(&unionid).bind(&nickname)
         .bind(&req.avatar_url).bind(&region)
         .execute(&st.db).await?;
        UserPublic {
            id,
            nickname,
            avatar_url: req.avatar_url,
            platform: "mini".into(),
            region,
            locale: "zh-CN".into(),
            active_natal_id: None,
            is_anonymous: false,
        }
    };
    let token = issue(&user.id, &user.platform, &user.region, &st.jwt_secret, 86400 * 30)
        .map_err(ApiError::from)?;
    Ok(Json(AuthOut { token, user, expires_in: 86400 * 30 }))
}

// ─── 公众号 / H5 OAuth · 生成跳转 URL ─────────────────────
#[derive(Debug, Deserialize)]
struct H5UrlReq {
    redirect_uri: String,
    #[serde(default)] state: Option<String>,
    #[serde(default)] userinfo: Option<bool>,
}

async fn wx_h5_url(
    State(st): State<AppState>,
    Query(req): Query<H5UrlReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let state = req.state.unwrap_or_else(|| Uuid::new_v4().simple().to_string());
    let url = st.wx.h5_authorize_url(&req.redirect_uri, &state, req.userinfo.unwrap_or(false))
        .map_err(|e| ApiError::bad(format!("wx h5 url: {e}")))?;
    Ok(Json(serde_json::json!({ "url": url, "state": state })))
}

// ─── 公众号 / H5 OAuth 回调 ──────────────────────────────
#[derive(Debug, Deserialize)]
struct H5CallbackReq {
    code: String,
    #[serde(default)] region: Option<String>,
}

async fn wx_h5_callback(
    State(st): State<AppState>,
    Json(req): Json<H5CallbackReq>,
) -> Result<Json<AuthOut>, ApiError> {
    let r = st.wx.h5_code_to_access(&req.code).await
        .map_err(|e| ApiError::bad(format!("wx h5 cb: {e}")))?;

    // upsert · h5_openid 或 unionid
    let existing = sqlx::query(
        r#"SELECT id, nickname, avatar_url, platform, region, locale, active_natal_id, is_anonymous
           FROM app_user
           WHERE wx_h5_openid = $1 OR (wx_unionid IS NOT NULL AND wx_unionid = $2)
           LIMIT 1"#,
    ).bind(&r.openid).bind(&r.unionid).fetch_optional(&st.db).await?;

    let user = if let Some(u) = existing {
        let uid: String = u.get("id");
        sqlx::query(
            r#"UPDATE app_user
               SET wx_h5_openid = COALESCE(wx_h5_openid, $1),
                   wx_unionid   = COALESCE(wx_unionid,   $2),
                   last_active_at = NOW()
               WHERE id = $3"#,
        ).bind(&r.openid).bind(&r.unionid).bind(&uid).execute(&st.db).await?;
        user_public_from_row(&u)
    } else {
        let id = format!("u_wxh5_{}", Uuid::new_v4().simple());
        let region = req.region.unwrap_or_else(|| "cn".into());
        sqlx::query(
            r#"INSERT INTO app_user
               (id, wx_h5_openid, wx_unionid, nickname, platform, region, is_anonymous)
               VALUES ($1,$2,$3,'微信用户','web',$4,FALSE)"#,
        ).bind(&id).bind(&r.openid).bind(&r.unionid).bind(&region)
         .execute(&st.db).await?;
        UserPublic {
            id, nickname: "微信用户".into(), avatar_url: None,
            platform: "web".into(), region, locale: "zh-CN".into(),
            active_natal_id: None, is_anonymous: false,
        }
    };
    let token = issue(&user.id, &user.platform, &user.region, &st.jwt_secret, 86400 * 30)
        .map_err(ApiError::from)?;
    Ok(Json(AuthOut { token, user, expires_in: 86400 * 30 }))
}
