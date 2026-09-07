use axum::{routing::{get, post}, Router, Json, extract::State};
use serde_json::{json, Value as J};
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
        /* 注销。**不挂 DELETE，挂 POST** —— 微信小程序的 `wx.request` 支持
           DELETE，但这一下在客户端要走一个二次确认的表单式流程，
           而这个仓里所有「按下去会发生一件不可逆的事」的动作都是 POST
           （取消订单、退款、退订）。同一类动作用同一种方法。 */
        .route("/v1/user/me/delete", post(delete_me))
        /* 【订阅消息的授权要记下来】（2026-09-07）。小程序的推送只有这一种，
           而它要用户**每一条都单独授权**，授权一次只发得出一条 ——
           所以「授权过几次、用掉几次」是要落库的事。
           真机上 `wx.requestSubscribeMessage` 弹出那一下之后调这里。 */
        .route("/v1/user/me/subscribe-grant", post(记下订阅授权))
}

fn 默认区() -> String { "cn".into() }

#[derive(serde::Deserialize)]
struct 授权体 {
    template_id: String,
    #[serde(default = "默认区")]
    region: String,
}

/// 用户点了「允许」。
///
/// 【模板号必须是我们认识的那几个】。客户端报什么就存什么的话，
/// 这张表会攒满一堆永远发不出去的授权（模板号错一个字微信就拒），
/// 而那种错在日志里长得跟「用户没订阅」一模一样。
async fn 记下订阅授权(
    State(st): State<AppState>, AuthedUser(c): AuthedUser, Json(b): Json<授权体>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let 认识的: Vec<String> = ["WX_TPL_SUB_BILL"]
        .iter()
        .filter_map(|k| std::env::var(k).ok())
        .filter(|v| !v.is_empty())
        .collect();
    if !认识的.contains(&b.template_id) {
        return Err(ApiError::bad("这不是我们在用的模板".to_string()));
    }
    unmei_app::notify::记下授权(&st.db, &c.sub, &b.template_id, &b.region).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
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


/// 注销账号。
///
/// 【隐私政策上写了两遍，而在这之前一处都做不到】——「设置」上那颗
/// 按钮是本机的 `logout()`，清掉这台手机上的 token，服务端一行不动。
/// 绑了微信的人下次登录回来东西全在；匿名的人只是再也够不着自己那个号。
///
/// 删什么、留什么，逐条对着政策那句话来，写在 `unmei_app::account`。
/// 这一层只负责：认得出是谁、把结果记一句日志。
///
/// 【幂等】：已经注销过的再调一次照旧 200 —— 手抖点两下不该报错，
/// 而报错会让人以为没注销成功。
async fn delete_me(
    State(st): State<AppState>,
    AuthedUser(claims): AuthedUser,
) -> Result<Json<J>, ApiError> {
    let 账 = unmei_app::account::delete(&st.db, &claims.sub).await?;
    /* 【留一句日志】。这是这个产品里唯一一个「用户自己把数据删掉」的动作,
       而它没有后台留痕表（`audit_log` 记的是管理员）。真出了事要查
       「这个人是什么时候自己走的、带走了什么」,只有这一行。 */
    tracing::info!(user = %claims.sub, ?账, "用户注销了账号");
    Ok(Json(json!({ "ok": true })))
}
