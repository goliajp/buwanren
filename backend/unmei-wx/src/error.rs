use thiserror::Error;

pub type Result<T> = std::result::Result<T, WxError>;

#[derive(Debug, Error)]
pub enum WxError {
    #[error("wx api error · errcode={errcode}, errmsg={errmsg}")]
    Api { errcode: i32, errmsg: String },

    #[error("network · {0}")]
    Network(#[from] reqwest::Error),

    #[error("cache · {0}")]
    Cache(#[from] std::io::Error),

    #[error("crypto · {0}")]
    Crypto(String),

    #[error("config missing · {0}")]
    Config(&'static str),

    #[error("decode · {0}")]
    Decode(String),

    #[error("internal · {0}")]
    Internal(String),
}
