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

    // kevy-embedded · in-process KV(admin 进程独立一份,不跨进程共享)
    let cache_dir = std::env::var("UNMEI_ADMIN_CACHE_DIR")
        .unwrap_or_else(|_| "./data/admin-cache".to_string());
    std::fs::create_dir_all(&cache_dir).ok();
    let cfg = kevy_embedded::Config::default().with_persist(&cache_dir);
    let cache = kevy_embedded::Store::open(cfg)
        .map_err(|e| anyhow::anyhow!("kevy-embedded open: {e}"))?;

    let mingli_base = std::env::var("MINGLI_API_BASE")
        .unwrap_or_else(|_| "http://localhost:6027".to_string());

    let state = AppState::new(pool, cache, mingli_base);

    let app = Router::new()
        .merge(routes::auth::router())
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
