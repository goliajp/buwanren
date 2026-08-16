//! unmei 共享领域类型 — 客户端 DTO / 商业子系统域模型 / Error。

#![allow(clippy::module_name_repetitions)]

use serde::{Deserialize, Serialize};

pub mod error;
pub use error::*;

pub mod commerce;

// ─── 平台 / 区域 ────────────────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Mini,
    Ios,
    Android,
    Web,
}
impl Default for Platform { fn default() -> Self { Self::Web } }
impl Platform {
    pub fn as_str(&self) -> &'static str {
        match self { Self::Mini=>"mini", Self::Ios=>"ios", Self::Android=>"android", Self::Web=>"web" }
    }
    pub fn from_str_lax(s: &str) -> Self {
        match s { "mini"=>Self::Mini, "ios"=>Self::Ios, "android"=>Self::Android, _=>Self::Web }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Region { Cn, Hk, Tw, Jp, Us, Eu, Other }
impl Default for Region { fn default() -> Self { Self::Cn } }
impl Region {
    pub fn as_str(&self) -> &'static str {
        match self { Self::Cn=>"cn", Self::Hk=>"hk", Self::Tw=>"tw", Self::Jp=>"jp", Self::Us=>"us", Self::Eu=>"eu", Self::Other=>"other" }
    }
}

// ─── 用户公开侧 ────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPublic {
    pub id: String,
    pub nickname: String,
    pub avatar_url: Option<String>,
    pub platform: String,
    pub region: String,
    pub locale: String,
    pub active_natal_id: Option<String>,
    pub is_anonymous: bool,
}

// ─── Natal ────────────────────────────────────────────────────
#[derive(Debug, Clone, Deserialize)]
pub struct NatalInput {
    pub label: Option<String>,
    pub year: i32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    #[serde(default)]
    pub minute: u32,
    #[serde(default = "default_tz")]
    pub tz: f64,
    pub gender: Option<String>,
    pub birth_lat: Option<f64>,
    pub birth_lon: Option<f64>,
    pub birth_city: Option<String>,
    #[serde(default)]
    pub true_solar_time: bool,
    #[serde(default = "default_subject")]
    pub subject_type: String,
}
fn default_tz() -> f64 { 8.0 }
fn default_subject() -> String { "person".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Natal {
    pub id: String,
    pub user_id: String,
    pub label: String,
    pub year: i32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    pub tz: f64,
    pub gender: Option<String>,
    pub birth_lat: Option<f64>,
    pub birth_lon: Option<f64>,
    pub birth_city: Option<String>,
    pub true_solar_time: bool,
    pub subject_type: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NatalSummary {
    /// 公开:展示给客户端「本命简介卡」一行
    pub day_master: String,        // 「己土」
    pub strength_level: String,    // 「偏强」
    pub primary_yongshen: String,  // 「木」
    pub primary_role: String,      // 「官杀」
    pub secondary_yongshen: Option<String>,
    pub avoid_wuxing: Vec<String>, // ["火","土"]
    pub friendly_hint: String,
    /// 内部隐藏字段(只给 admin 看):
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strength_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern_name: Option<String>,
}

// ─── 纳吉结果(客户端 design.html v0.3 形态)──────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NajiResult {
    pub id: String,
    pub asked_at: String,
    pub time_label: String,         // 「申时 · 15:24」
    pub quote: QuoteOut,
    pub gate: String,               // 「休门」
    pub direction: String,          // 「东方」
    pub gate_explain: String,
    pub suit: Vec<String>,
    pub avoid: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub question: Option<String>,   // 用户问事内容 · 回显给客户端
    pub recommend: Option<RecommendOut>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteOut {
    pub text: String,
    pub source: String,             // 「庄子 · 列御寇」
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendOut {
    pub kind: String,               // "product"
    pub id: String,
    pub name: String,
    pub sub_title: Option<String>,
    pub price_display: String,
    pub image_url: Option<String>,
}

// ─── 纳吉请求 ────────────────────────────────────────────────
#[derive(Debug, Clone, Deserialize, Default)]
pub struct NajiSpinReq {
    /// 缺省 = 服务端用当前时刻
    pub time_now: Option<String>,   // ISO 8601
    pub location_lat: Option<f64>,
    pub location_lon: Option<f64>,
    /// 用户写下的问事内容 · 只留档,不参与算力
    #[serde(default)]
    pub question: Option<String>,
}

// ─── 商品 / 活动 / 徽章 公开侧 ──────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductPublic {
    pub id: String,
    pub name: String,
    pub sub_title: Option<String>,
    pub category: String,
    pub price_display: String,
    pub image_url: Option<String>,
    pub stock_status: String,      // 「现货」/「缺货」/「售罄」
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityPublic {
    pub id: String,
    pub title: String,
    pub sub_title: Option<String>,
    pub category: String,
    pub banner_url: Option<String>,
    pub city: Option<String>,
    pub start_at: String,
    pub max_participants: i32,
    pub current_count: i32,
    pub price_display: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BadgePublic {
    pub id: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub points: i32,
    pub earned: bool,
    pub earned_at: Option<String>,
}

// ─── 客户端配置(/v1/config 启动拉)──────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    pub platform: String,
    pub region: String,
    pub flags: serde_json::Value,
    pub locale: String,
}

// ─── auth ────────────────────────────────────────────────────
#[derive(Debug, Clone, Deserialize)]
pub struct AuthHeaderHint {
    pub platform: Option<String>,
    pub region: Option<String>,
    pub locale: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthOut {
    pub token: String,
    pub user: UserPublic,
    pub expires_in: i64,
}
