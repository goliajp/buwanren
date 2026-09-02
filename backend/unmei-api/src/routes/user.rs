use axum::{routing::get, Router, Json, extract::State};
use serde::Deserialize;
use unmei_domain::UserPublic;
use crate::state::AppState;
use crate::auth::{AuthedUser, ApiError};
use crate::routes::user_public_from_row;

pub fn router() -> Router<AppState> {
    Router::new()
        // POST 与 PATCH 同义:微信小程序的 wx.request 不支持 PATCH
        // (平台硬限制,method 只有 GET/POST/PUT/DELETE/OPTIONS/HEAD/TRACE/CONNECT),
        // 只挂 PATCH 的话 mini 端永远改不了昵称头像。
        .route("/v1/user/me", get(me).patch(patch_me).post(patch_me))
}

async fn me(
    State(st): State<AppState>,
    AuthedUser(claims): AuthedUser,
) -> Result<Json<UserPublic>, ApiError> {
    let u = sqlx::query(
        "SELECT id, nickname, avatar_url, platform, region, locale, active_natal_id, is_anonymous
         FROM app_user WHERE id = $1",
    ).bind(&claims.sub).fetch_one(&st.db).await?;
    Ok(Json(user_public_from_row(&u)))
}

#[derive(Debug, Deserialize)]
struct PatchReq {
    nickname: Option<String>,
    avatar_url: Option<String>,
    locale: Option<String>,
}

async fn patch_me(
    State(st): State<AppState>,
    AuthedUser(claims): AuthedUser,
    Json(req): Json<PatchReq>,
) -> Result<Json<UserPublic>, ApiError> {
    /* 【语言得是【真有词表】的那几种】（2026-09-03 第四轮评审 · 工程审计）。
       上一版任意串直接落库，而 `gate_word` / `quote` / `yiji` 三张词表
       全库只有 `zh-CN` —— 写一个 `en-US` 进去，`naji/spin` 从此永久 500，
       用户把自己的核心功能打死了，而且没有任何一屏能改回来。
       判据从【库里】取，不写死一张表:哪天真上了第二种语言，
       它自己就跟着放行。 */
    if let Some(l) = req.locale.as_deref() {
        let 有词表: Option<String> = sqlx::query_scalar(
            "SELECT locale FROM gate_word WHERE locale=$1 AND status='published' LIMIT 1",
        ).bind(l).fetch_optional(&st.db).await?;
        if 有词表.is_none() {
            return Err(ApiError::from(unmei_domain::DomainError::Validation(
                format!("locale {l} 还没有词表 —— 换成一个有的"))));
        }
    }
    /* 【三条写在一句里】。原先是三条各自独立的 UPDATE ——
       第二条失败就是「昵称改了、头像没改」，然后回一个 5xx，
       用户看到的是失败而库里改了一半。
       `COALESCE(NULLIF($n,''), 列)` 让没传的字段原样不动。 */
    sqlx::query(
        "UPDATE app_user SET \
           nickname   = COALESCE($1, nickname), \
           avatar_url = COALESCE($2, avatar_url), \
           locale     = COALESCE($3, locale) \
         WHERE id=$4",
    )
    .bind(req.nickname.as_deref())
    .bind(req.avatar_url.as_deref())
    .bind(req.locale.as_deref())
    .bind(&claims.sub)
    .execute(&st.db)
    .await?;
    me(State(st), AuthedUser(claims)).await
}
