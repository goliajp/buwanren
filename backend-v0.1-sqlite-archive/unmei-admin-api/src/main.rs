//! unmei-admin-api · 运营后台 · :6029

mod state;
mod auth;
mod routes;

use axum::Router;
use sqlx::sqlite::SqlitePoolOptions;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter(
        tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "unmei_admin_api=debug,tower_http=info".into()),
    ).init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../unmei-api/unmei.db?mode=rwc".to_string());
    let pool = SqlitePoolOptions::new().max_connections(10).connect(&db_url).await?;
    sqlx::migrate!("../migrations").run(&pool).await?;

    let mingli_base = std::env::var("MINGLI_API_BASE")
        .unwrap_or_else(|_| "http://localhost:6027".to_string());

    let state = AppState::new(pool, mingli_base);

    let app = Router::new()
        .merge(routes::auth::router())
        .merge(routes::dashboard::router())
        .merge(routes::users::router())
        .merge(routes::quotes::router())
        .merge(routes::products::router())
        .merge(routes::activities::router())
        .merge(routes::feature_flags::router())
        .merge(routes::stats::router())
        .merge(routes::mingli::router())
        .merge(routes::health::router())
        .layer(CorsLayer::very_permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let bind = std::env::var("UNMEI_ADMIN_API_BIND")
        .unwrap_or_else(|_| "127.0.0.1:6029".to_string());
    let addr: SocketAddr = bind.parse()?;
    tracing::info!("unmei-admin-api listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
