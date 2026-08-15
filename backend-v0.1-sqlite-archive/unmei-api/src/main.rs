//! unmei-api · 业务 BFF · :6028
//! · auth / user / natal / naji / product / activity / badge / config

mod state;
mod auth;
mod mingli;
mod routes;
mod ai_compose;

use axum::Router;
use sqlx::sqlite::SqlitePoolOptions;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter(
        tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "unmei_api=debug,tower_http=info".into()),
    ).init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./unmei.db?mode=rwc".to_string());
    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await?;

    // 自动跑迁移(从 migrations/ 目录)
    sqlx::migrate!("../migrations").run(&pool).await?;

    let mingli_base = std::env::var("MINGLI_API_BASE")
        .unwrap_or_else(|_| "http://localhost:6027".to_string());

    let state = AppState::new(pool, mingli_base);

    let app = Router::new()
        .merge(routes::auth::router())
        .merge(routes::user::router())
        .merge(routes::natal::router())
        .merge(routes::naji::router())
        .merge(routes::product::router())
        .merge(routes::activity::router())
        .merge(routes::badge::router())
        .merge(routes::config::router())
        .merge(routes::health::router())
        .layer(CorsLayer::very_permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let bind = std::env::var("UNMEI_API_BIND")
        .unwrap_or_else(|_| "127.0.0.1:6028".to_string());
    let addr: SocketAddr = bind.parse()?;
    tracing::info!("unmei-api listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
