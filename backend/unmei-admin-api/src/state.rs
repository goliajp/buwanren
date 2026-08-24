use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub mingli_base: Arc<String>,
    pub http: reqwest::Client,
    pub jwt_secret: Arc<Vec<u8>>,
}

impl AppState {
    pub fn new(db: PgPool, mingli_base: String) -> Self {
        /* 没设环境变量就用内置默认 —— 而那个默认**写在仓库里**，
           谁都能拿它伪造 token（管理员的也一样）。保留兜底是为了本机开发，
           但必须让它**响**：启动时喊一声，照 `main.rs` 对微信未配置那条的做法。
           2026-08-18 查到时，代码、docker-compose、.env.example 三层都带着
           同一个开发密钥，忘了设的部署会**照常启动**，一点异常都看不出来。 */
        let jwt_from_env = std::env::var("UNMEI_ADMIN_JWT_SECRET").ok();
        let jwt_is_default = jwt_from_env.is_none();
        let jwt_secret = jwt_from_env
            .unwrap_or_else(|| "unmei-admin-dev-secret-CHANGE".to_string())
            .into_bytes();
        if jwt_is_default {
            tracing::warn!("⚠ UNMEI_ADMIN_JWT_SECRET 没设，用的是仓库里那个公开的开发密钥 —— 上线前必须换");
        }
        Self {
            db,
            mingli_base: Arc::new(mingli_base),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build().expect("http"),
            jwt_secret: Arc::new(jwt_secret),
        }
    }
}
