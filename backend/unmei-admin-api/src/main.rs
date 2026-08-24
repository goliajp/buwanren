//! unmei-admin-api · 运营后台 · :6029

mod state;
mod auth;
mod routes;

use axum::Router;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter(
        tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "unmei_admin_api=debug,tower_http=info,sqlx=warn".into()),
    ).init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://unmei:unmei_dev_pwd@localhost:6032/unmei".to_string());
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(8))
        .connect(&db_url).await?;
    sqlx::migrate!("../migrations").run(&pool).await?;

    /* 种子无条件建了一个超级管理员：`admin@unmei.local` / `admin123`，
       口令哈希**写在仓库的 seed.sql 里**（`backend/seed/seed.sql`，角色含 super）。
       也就是任何一次部署都自带一个公开可登录的超管账号。
       这里在启动时查一眼那个哈希还在不在 —— 改过口令就不喊。
       「要不要在生产种这个账号、怎么引导首登改密」是产品/安全决定，
       记在 docs/OPEN.md；这一步只保证它**不是静悄悄的**。 */
    let default_admin: Option<String> = sqlx::query_scalar(
        "SELECT email FROM admin_user
         WHERE email='admin@unmei.local'
           AND password_hash LIKE '$argon2id$v=19$m=19456,t=2,p=1$dW5tZWlfYWRtaW5fc2FsdA%'",
    )
    .fetch_optional(&pool)
    .await
    .unwrap_or(None);
    if let Some(email) = default_admin {
        tracing::warn!("⚠ 默认管理员 {email} 还用着仓库里那个口令（admin123）—— 上线前必须改");
    }

    let mingli_base = std::env::var("MINGLI_API_BASE")
        .unwrap_or_else(|_| "http://localhost:6027".to_string());

    let state = AppState::new(pool, mingli_base);

    let app = Router::new()
        .merge(routes::auth::router())
        .merge(routes::users::router())
        .merge(routes::quotes::router())
        .merge(routes::activities::router())
        .merge(routes::feature_flags::router())
        .merge(routes::mingli::router())
        .merge(routes::naji::router())
        .merge(routes::commerce::router())
        .merge(routes::commerce::master_router())
        .merge(routes::health::router())
        .layer(CorsLayer::very_permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let bind = std::env::var("UNMEI_ADMIN_API_BIND")
        .unwrap_or_else(|_| "0.0.0.0:6029".to_string());
    let addr: SocketAddr = bind.parse()?;
    tracing::info!("unmei-admin-api listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
