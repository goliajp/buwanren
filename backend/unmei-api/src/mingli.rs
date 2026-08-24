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

/// 性别取值:我们内部用 `M` / `F`(表单与库里都是),而 mingli 只认
/// `male` / `female` / `男` / `女` —— 直接透传会被它 422 挡回来。
///
/// 这个错以前是【看不见】的:`compute_summary_now(...).await.ok()` 把它吞了,
/// 于是建本命照样返回 200、记录照样落库,只有下一步取 summary 时 404,
/// 前端显示「生成失败」。谁也想不到根因在一个字母上。
/// 【不猜】。以前这里是 `_ => "male"`：一个不认识的写法会被静默算成男，
/// 而性别决定用神 —— 盘会算错，然后自信地显示出来，没有一处会红。
/// `natal.gender` 在库里是无约束的 `TEXT`，建本命那条路也不校验，
/// 所以「不认识的写法」不是假设。
pub fn gender_for_mingli(g: &str) -> Option<&'static str> {
    match g {
        "M" | "m" | "male" | "男" => Some("male"),
        "F" | "f" | "female" | "女" => Some("female"),
        _ => None,
    }
}

/// `/api/cast` 的请求体。**它要的是生辰本身,不是 natal_id** ——
/// natal_id 是我们这边的概念,mingli 不知道有这回事,发过去它 422。
///
/// 这条契约以前写在调用点上,而调用点发的是 `{leaf, natal_id}`,
/// 于是每一签都被挡回来、落成空盘(库里 84 条问签,80 条的盘是空的)。
/// 契约放到客户端旁边,连同下面那几条测试一起,免得下次再各写各的。
pub fn cast_body(
    leaf: &str,
    y: i32, mo: i32, d: i32, h: i32, mi: i32, tz: f64,
    gender: Option<&str>,
) -> serde_json::Value {
    serde_json::json!({
        "leaf": leaf,
        "year": y, "month": mo, "day": d, "hour": h, "minute": mi, "tz": tz,
        /* 认得的写法照映射发过去；【认不得的原样发】—— 上游会 422 挡回来，
           那是响的失败。以前这里把它变成 male，是不响的错误：
           盘按男的算完照样返回，谁也不会去查。
           （`gender` 缺失时仍然当 M，那是另一个问题：产品要不要允许
             没有性别的本命，记在报告里等拍板，不在这一条里顺手改。） */
        "gender": gender.map(|g| gender_for_mingli(g).unwrap_or(g)).unwrap_or("male"),
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 性别照上游认的写法发过去() {
        // 上游只认这四种写法,我们内部用的是 M / F
        assert_eq!(gender_for_mingli("M"), Some("male"));
        assert_eq!(gender_for_mingli("F"), Some("female"));
        assert_eq!(gender_for_mingli("男"), Some("male"));
        assert_eq!(gender_for_mingli("女"), Some("female"));
        // 认不得的不猜。以前这里会答 male —— 那是一张算错却看不出错的盘
        assert_eq!(gender_for_mingli("其他"), None);
        assert_eq!(gender_for_mingli(""), None);
    }

    #[test]
    fn 请求体带生辰而不是我们这边的编号() {
        let b = cast_body("liuren", 1995, 6, 15, 14, 30, 8.0, Some("F"));
        assert_eq!(b["gender"], "female");

        // 认不得的写法【原样发出去】，让上游 422 —— 不在这里变成 male
        let odd = cast_body("liuren", 1995, 6, 15, 14, 30, 8.0, Some("双性"));
        assert_eq!(odd["gender"], "双性", "不认识就别替它决定");
        for k in ["leaf", "year", "month", "day", "hour", "minute", "tz", "gender"] {
            assert!(b.get(k).is_some(), "少了 {k} —— 上游会 422");
        }
        assert!(b.get("natal_id").is_none(), "natal_id 是我们这边的概念，上游不认");
        assert_eq!(b["gender"], "female");
    }
}
