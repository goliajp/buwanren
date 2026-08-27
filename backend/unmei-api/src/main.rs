//! unmei-api · 业务 BFF · :6028
//! · auth / user / natal / naji / product / activity / badge / config / pay

mod state;
mod auth;
mod idem;
mod mingli;
mod routes;
mod ai_compose;
mod workers;

use axum::Router;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use unmei_wx::{WxConfig, WxSdk};

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter(
        tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "unmei_api=debug,unmei_wx=debug,tower_http=info,sqlx=warn".into()),
    ).init();

    // ─── PostgreSQL pool ───────────────────────────────────────
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://unmei:unmei_dev_pwd@localhost:6032/unmei".to_string());
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(8))
        .connect(&db_url)
        .await?;

    // sqlx 自动跑 migrations/
    sqlx::migrate!("../migrations").run(&pool).await?;

    // 首次跑 seed(幂等 ON CONFLICT DO NOTHING)— 用 simple_query 协议跑多语句
    let mut conn = pool.acquire().await?;
    for (what, sql) in [
        ("seed.sql", include_str!("../../seed/seed.sql")),
        // 40 位不完人与 35 门术数。由 scripts/export-cast.py 从 rooms/design.html 导出,
        // 单一来源仍是设计册 —— 别在库里手改,下次导出会盖掉。
        ("villagers.sql", include_str!("../../seed/villagers.sql")),
        ("lack_bias.sql", include_str!("../../seed/lack_bias.sql")),
        ("villager_voice.sql", include_str!("../../seed/villager_voice.sql")),
        // 术数 → mingli 叶。叶名要跟 mingli-registry 对得上,
        // 校验:python3 scripts/check-art-leaf.py
        ("art_leaf.sql", include_str!("../../seed/art_leaf.sql")),
    ] {
        sqlx::raw_sql(sql).execute(&mut *conn).await
            .map_err(|e| anyhow::anyhow!("seed {what}: {e}"))?;
    }
    drop(conn);
    tracing::info!("✓ pg ready · migrations + seed");

    // ─── kevy-embedded(in-process Redis 协议兼容 KV)──────
    // 单 Store 共享给 WxSdk + AppState · clone 浅拷贝
    let cache_dir = std::env::var("UNMEI_CACHE_DIR")
        .unwrap_or_else(|_| "./data/cache".to_string());
    std::fs::create_dir_all(&cache_dir).ok();
    let cfg = kevy_embedded::Config::default().with_persist(&cache_dir);
    let cache = kevy_embedded::Store::open(cfg)
        .map_err(|e| anyhow::anyhow!("kevy-embedded open: {e}"))?;
    tracing::info!("✓ kevy-embedded ready · persist={cache_dir}");

    // ─── 微信 SDK ──────────────────────────────────────────
    let wx_cfg = WxConfig::from_env();
    let wx = WxSdk::new(wx_cfg, cache.clone());
    if wx.is_mock() {
        tracing::warn!("⚠ wx mp未配置，运行在 MOCK 模式");
    } else {
        tracing::info!("✓ wx mp configured");
    }

    // ─── 算力源 ────────────────────────────────────────────
    let mingli_base = std::env::var("MINGLI_API_BASE")
        .unwrap_or_else(|_| "http://localhost:6027".to_string());

    let state = AppState::new(pool, cache, mingli_base, wx);

    // ─── 后台 worker(常驻 unmei-api 进程)─────────────────
    workers::spawn_all(state.clone());

    let app = Router::new()
        .merge(routes::auth::router())
        .merge(routes::user::router())
        .merge(routes::natal::router())
        .merge(routes::naji::router())
        .merge(routes::activity::router())
        .merge(routes::badge::router())
        .merge(routes::config::router())
        .merge(routes::commerce::router())
        .merge(routes::village::router())
        .merge(routes::incense::router())
        .merge(routes::health::router())
        .layer(CorsLayer::very_permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let bind = std::env::var("UNMEI_API_BIND")
        .unwrap_or_else(|_| "0.0.0.0:6028".to_string());
    let addr: SocketAddr = bind.parse()?;
    tracing::info!("unmei-api listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
