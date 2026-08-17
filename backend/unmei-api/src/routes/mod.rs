use sqlx::{postgres::PgRow, Row};
use unmei_domain::UserPublic;

/// `app_user` 行 → 客户端公开视图。auth 的三处 upsert 分支与 `/v1/user/me` 共用。
pub(crate) fn user_public_from_row(r: &PgRow) -> UserPublic {
    UserPublic {
        id: r.get("id"),
        nickname: r.get("nickname"),
        avatar_url: r.get("avatar_url"),
        platform: r.get("platform"),
        region: r.get("region"),
        locale: r.get("locale"),
        active_natal_id: r.get("active_natal_id"),
        is_anonymous: r.get("is_anonymous"),
    }
}

pub mod auth;
pub mod user;
pub mod natal;
pub mod naji;
pub mod activity;
pub mod badge;
pub mod config;
pub mod health;
pub mod commerce;
pub mod village;
