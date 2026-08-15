use kevy_embedded::Store;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cache: Store,
    pub mingli_base: Arc<String>,
    pub http: reqwest::Client,
    pub jwt_secret: Arc<Vec<u8>>,
}

impl AppState {
    pub fn new(db: PgPool, cache: Store, mingli_base: String) -> Self {
        let jwt_secret = std::env::var("UNMEI_ADMIN_JWT_SECRET")
            .unwrap_or_else(|_| "unmei-admin-dev-secret-CHANGE".to_string())
            .into_bytes();
        Self {
            db,
            cache,
            mingli_base: Arc::new(mingli_base),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build().expect("http"),
            jwt_secret: Arc::new(jwt_secret),
        }
    }
}
