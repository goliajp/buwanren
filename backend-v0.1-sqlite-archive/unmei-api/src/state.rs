use sqlx::SqlitePool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub mingli_base: Arc<String>,
    pub http: reqwest::Client,
    pub jwt_secret: Arc<Vec<u8>>,
}

impl AppState {
    pub fn new(db: SqlitePool, mingli_base: String) -> Self {
        let jwt_secret = std::env::var("UNMEI_JWT_SECRET")
            .unwrap_or_else(|_| "unmei-dev-secret-CHANGE-IN-PROD".to_string())
            .into_bytes();
        Self {
            db,
            mingli_base: Arc::new(mingli_base),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("reqwest client"),
            jwt_secret: Arc::new(jwt_secret),
        }
    }
}
