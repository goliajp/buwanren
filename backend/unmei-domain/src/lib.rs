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
impl NatalInput {
    /// 挡掉【不可能成立】的生辰。
    ///
    /// 这一条在信任边界上，不是防御性校验：`/v1/user/natals` 收的是客户端
    /// 直接给的数，而 2026-08-18 实测 `month: 99`、`tz: 1e308` 都会 **200**
    /// 建成一条本命 —— 排盘随后算不出来，于是库里多一条**永远不会工作**的记录
    /// （那正是「113 份本命 7 份没有盘」的来源之一）。
    ///
    /// 只挡不可能的：真日历日（连 2 月 30 号一起挡）、时分范围、时区范围。
    /// **年份不设上下界** —— 那是判断题，留给「排盘算不出来时怎么办」那条决定。
    pub fn validate(&self) -> Result<(), String> {
        if chrono::NaiveDate::from_ymd_opt(self.year, self.month, self.day).is_none() {
            return Err(format!("不是一个真实存在的日子：{}-{}-{}", self.year, self.month, self.day));
        }
        if self.hour > 23 {
            return Err(format!("时 {} 不在 0–23", self.hour));
        }
        if self.minute > 59 {
            return Err(format!("分 {} 不在 0–59", self.minute));
        }
        if !self.tz.is_finite() || self.tz < -12.0 || self.tz > 14.0 {
            return Err(format!("时区 {} 不在 -12–+14", self.tz));
        }
        Ok(())
    }
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
// 最后一个消费方是 `proto/` 那个 React 原型,它 2026-08-17 已删(台账 D10):
// 真客户端是小程序,原型与它职能重叠且自 commerce v2 起就在拿 404。

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

#[cfg(test)]
mod natal_input_tests {
    use super::*;

    fn base() -> NatalInput {
        NatalInput {
            label: None, year: 1990, month: 3, day: 4, hour: 5, minute: 6, tz: 8.0,
            gender: Some("M".into()), birth_lat: None, birth_lon: None, birth_city: None,
            true_solar_time: false, subject_type: "person".into(),
        }
    }

    #[test]
    fn 真实存在的生辰放行() {
        assert!(base().validate().is_ok());
    }

    /// 这三种 2026-08-18 之前都会 **200** 建成一条本命，然后永远算不出盘。
    #[test]
    fn 不可能成立的生辰当场挡住() {
        let mut a = base(); a.month = 99;
        assert!(a.validate().is_err(), "99 月");
        let mut b = base(); b.month = 2; b.day = 30;
        assert!(b.validate().is_err(), "2 月 30 号");
        let mut c = base(); c.tz = 1e308;
        assert!(c.validate().is_err(), "时区 1e308");
        let mut d = base(); d.hour = 24;
        assert!(d.validate().is_err(), "24 时");
        let mut e = base(); e.minute = 60;
        assert!(e.validate().is_err(), "60 分");
    }

    /// 年份【不】设上下界：那是判断题，留给「排盘算不出来时怎么办」那条决定。
    #[test]
    fn 年份不由这里判断() {
        let mut a = base(); a.year = -9999;
        assert!(a.validate().is_ok(), "-9999 是个真实存在的日子，挡不挡是另一件事");
    }
}
