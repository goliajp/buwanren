//! mingli-api :6027 调用客户端

use serde::Deserialize;
use crate::state::AppState;
use crate::auth::ApiError;
use unmei_domain::AppError;

pub struct MingliClient<'a> {
    state: &'a AppState,
}

impl<'a> MingliClient<'a> {
    pub fn new(state: &'a AppState) -> Self { Self { state } }

    pub fn base(&self) -> &str { &self.state.mingli_base }

    /// 调 /api/cast 取 qimen+bazi 全 21 叶(用于 naji.spin)
    pub async fn cast(&self, body: &serde_json::Value) -> Result<serde_json::Value, ApiError> {
        let url = format!("{}/api/cast", self.base());
        let r = self.state.http.post(&url).json(body).send().await?;
        if !r.status().is_success() {
            return Err(ApiError(AppError::Upstream(format!("mingli /api/cast HTTP {}", r.status()))));
        }
        Ok(r.json::<serde_json::Value>().await?)
    }

    /// 调 /api/bazi 精盘(用于 natal_summary 预算)
    pub async fn bazi(&self, body: &serde_json::Value) -> Result<serde_json::Value, ApiError> {
        let url = format!("{}/api/bazi", self.base());
        let r = self.state.http.post(&url).json(body).send().await?;
        if !r.status().is_success() {
            return Err(ApiError(AppError::Upstream(format!("mingli /api/bazi HTTP {}", r.status()))));
        }
        Ok(r.json::<serde_json::Value>().await?)
    }
}

// ─── 取 cast 结果里 qimen 叶 + bazi 叶 ───────────────────────────
pub fn leaf<'a>(cast: &'a serde_json::Value, id: &str) -> Option<&'a serde_json::Value> {
    cast.get("leaves")?
        .as_array()?
        .iter()
        .find(|l| l.get("id").and_then(|v| v.as_str()) == Some(id))?
        .get("chart")
}

// ─── Bazi chart 关键字段(只取我们要的)──────────────────────────
#[derive(Debug, Deserialize)]
pub struct BaziLite {
    pub day_master: String,
    pub day_master_wuxing: String,
    pub strength: BaziStrength,
    pub pattern: BaziPattern,
    pub yongshen: BaziYongshen,
}
#[derive(Debug, Deserialize)]
pub struct BaziStrength {
    pub score: u32,
    pub level: String,
}
#[derive(Debug, Deserialize)]
pub struct BaziPattern { pub name: String }
#[derive(Debug, Deserialize)]
pub struct BaziYongshen {
    pub primary_wuxing: String,
    pub primary_role: String,
    pub secondary_wuxing: Option<String>,
    pub avoid_wuxing: Vec<String>,
}

// Qimen 时盘目前只以原始 JSON 落进 `naji_record.t_chart` 留档,没有解析成结构体。
// 这里原有一对 `QimenLite` / `QimenXun` 反序列化目标,从未被构造过 ——
// 真要用时照 mingli 当时的响应重新定义,比留着一份可能已经对不上的旧形状安全。
