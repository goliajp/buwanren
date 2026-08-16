//! unmei 共享领域类型 — 客户端 DTO / 商业子系统域模型 / Error。

#![allow(clippy::module_name_repetitions)]

use serde::{Deserialize, Serialize};

pub mod error;
pub use error::*;

pub mod commerce;

// 区域模型见 [`commerce::Region`] —— 6 个 cell(cn / jp / kr / sea / na / zh_hant)
// 外加一个只用于 admin scope 的虚拟 global。
//
// 这里原本还有一对 v0.1 留下的 `Platform` / `Region`,零引用,而且它那套
// region 取值(Cn/Hk/Tw/Jp/Us/Eu/Other)与 6-cell 模型互相矛盾 ——
// domain 里摆两个打架的 Region,比摆一个死类型更危险:总有人会 import 错那个。

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

// ─── 活动 / 徽章 公开侧 ────────────────────────────────────────
//
// 这里原本还有一个 `ProductPublic`(id/name/sub_title/category/price_display/
// image_url/stock_status)—— v0.1 `/v1/product` 的响应形状。commerce v2 把
// 端点换成了 `/v1/products`,返回的是 product 行本身(价格在 SKU 的 price_book 上,
// 不在 product 上),这个 DTO 就没人用了。
//
// ⚠ `proto/src/pages/Product.tsx` 至今仍照着这个旧形状写,且请求的是已经不存在的
// `/v1/product`。详见 README「已知欠账」。

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
// (曾有一个 `AuthHeaderHint`,零引用 —— 平台 / 区域 / 语言实际是在
//  `routes/config.rs` 里直接读 X-Platform / X-Region / X-Locale 头拿的)

#[derive(Debug, Clone, Serialize)]
pub struct AuthOut {
    pub token: String,
    pub user: UserPublic,
    pub expires_in: i64,
}
