//! 「算力隐式」桥层 — 按 natal_summary + qimen 时盘 + 时辰,
//! 从 quote / gate_word / yiji_word 池中**精准匹配**抽取(非随机)。
//!
//! 商品推荐部分由 commerce v2 CatalogService 接管,本文件只保留内容池抽取。

use rand::{Rng, SeedableRng, rngs::StdRng};
use sqlx::{PgPool, Row};
use unmei_domain::{AppError, QuoteOut, RecommendOut};
use crate::auth::ApiError;

pub struct ChosenQuote { pub id: String, pub out: QuoteOut }
pub struct ChosenGate { pub gate: String, pub direction: String, pub explain: String }

/// 从 quote 池按主用神 / 八门偏好打分,top-K 中按 seed 取一(隐式个性化)
pub async fn pick_quote(
    pool: &PgPool,
    primary_yongshen: Option<&str>,
    gate: Option<&str>,
    locale: &str,
    seed: u64,
) -> Result<ChosenQuote, ApiError> {
    let rows = sqlx::query(
        r#"SELECT id, book, chapter, text, wuxing_affinity, gate_affinity
           FROM quote
           WHERE status='published' AND locale=$1"#,
    ).bind(locale)
     .fetch_all(pool).await?;
    if rows.is_empty() {
        return Err(ApiError(AppError::Internal("no published quote".into())));
    }
    let mut scored: Vec<(f64, String, String, Option<String>, String)> = rows.into_iter().map(|r| {
        let aff_w: Vec<String> = serde_json::from_value(r.get("wuxing_affinity")).unwrap_or_default();
        let aff_g: Vec<String> = serde_json::from_value(r.get("gate_affinity")).unwrap_or_default();
        let mut score = 1.0;
        if let Some(yw) = primary_yongshen { if aff_w.iter().any(|w| w == yw) { score += 3.0; } }
        if let Some(g)  = gate              { if aff_g.iter().any(|x| x == g) { score += 2.0; } }
        (score, r.get("id"), r.get("book"), r.get("chapter"), r.get("text"))
    }).collect();
    scored.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap());

    let mut top = scored.into_iter().take(5).collect::<Vec<_>>();
    let mut rng = StdRng::seed_from_u64(seed);
    let idx = rng.gen_range(0..top.len());
    let (_, id, book, chapter, text) = top.swap_remove(idx);
    let source = match chapter {
        Some(c) if !c.is_empty() => format!("{book} · {c}"),
        _ => book,
    };
    Ok(ChosenQuote {
        id,
        out: QuoteOut { text, source },
    })
}

pub fn pick_gate_by_yongshen(primary_yongshen: Option<&str>, time_branch: u8, seed: u64) -> &'static str {
    let prefs: &[&str] = match primary_yongshen {
        Some("木") => &["休门","开门","生门"],
        Some("火") => &["景门","开门"],
        Some("土") => &["生门","死门"],
        Some("金") => &["惊门","开门","景门"],
        Some("水") => &["休门","杜门"],
        _          => &["休门","开门","生门","景门"],
    };
    let day = matches!(time_branch, 3..=8);
    let pool: Vec<&str> = if day {
        prefs.iter().chain(["景门","开门","生门"].iter()).cloned().collect()
    } else {
        prefs.iter().chain(["休门","杜门","死门"].iter()).cloned().collect()
    };
    let mut rng = StdRng::seed_from_u64(seed);
    pool[rng.gen_range(0..pool.len())]
}

pub async fn pick_gate_explain(pool: &PgPool, gate: &str, locale: &str) -> Result<ChosenGate, ApiError> {
    let r = sqlx::query(
        r#"SELECT direction, benefit_text FROM gate_word
           WHERE gate=$1 AND locale=$2 AND status='published'
           ORDER BY version DESC LIMIT 1"#,
    ).bind(gate).bind(locale).fetch_optional(pool).await?;
    let (dir, txt) = match r {
        Some(rr) => (rr.get("direction"), rr.get("benefit_text")),
        None => ("—".to_string(), "宜静".to_string()),
    };
    Ok(ChosenGate { gate: gate.to_string(), direction: dir, explain: txt })
}

pub async fn pick_yiji(
    pool: &PgPool,
    primary_yongshen: Option<&str>,
    avoid_wuxing: &[String],
    locale: &str,
    seed: u64,
) -> Result<(Vec<String>, Vec<String>), ApiError> {
    let yi_rows = sqlx::query(
        r#"SELECT word, favor_when_main_wuxing FROM yiji_word
           WHERE type='yi' AND status='published' AND locale=$1"#,
    ).bind(locale).fetch_all(pool).await?;
    let ji_rows = sqlx::query(
        r#"SELECT word, disfavor_when_avoid_wuxing FROM yiji_word
           WHERE type='ji' AND status='published' AND locale=$1"#,
    ).bind(locale).fetch_all(pool).await?;

    let mut yi_scored: Vec<(f64, String)> = yi_rows.into_iter().map(|r| {
        let aff: Vec<String> = serde_json::from_value(r.get("favor_when_main_wuxing")).unwrap_or_default();
        let mut s = 1.0;
        if let Some(yw) = primary_yongshen { if aff.iter().any(|w| w == yw) { s += 5.0; } }
        (s, r.get("word"))
    }).collect();
    yi_scored.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap());

    let mut ji_scored: Vec<(f64, String)> = ji_rows.into_iter().map(|r| {
        let aff: Vec<String> = serde_json::from_value(r.get("disfavor_when_avoid_wuxing")).unwrap_or_default();
        let mut s = 1.0;
        if aff.iter().any(|w| avoid_wuxing.iter().any(|aw| aw == w)) { s += 5.0; }
        (s, r.get("word"))
    }).collect();
    ji_scored.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap());

    let mut rng = StdRng::seed_from_u64(seed.wrapping_add(91));
    let yi_top: Vec<&str> = yi_scored.iter().take(10).map(|(_,w)| w.as_str()).collect();
    let ji_top: Vec<&str> = ji_scored.iter().take(8).map(|(_,w)| w.as_str()).collect();
    let yi_chosen: Vec<String> = shuffle_take(&yi_top, 5, &mut rng).into_iter().map(String::from).collect();
    let ji_chosen: Vec<String> = shuffle_take(&ji_top, 3, &mut rng).into_iter().map(String::from).collect();
    Ok((yi_chosen, ji_chosen))
}

fn shuffle_take<'a>(v: &'a [&'a str], n: usize, rng: &mut StdRng) -> Vec<&'a str> {
    let mut idxs: Vec<usize> = (0..v.len()).collect();
    for i in (1..idxs.len()).rev() {
        let j = rng.gen_range(0..=i);
        idxs.swap(i, j);
    }
    idxs.into_iter().take(n.min(v.len())).map(|i| v[i]).collect()
}

/// 商品推荐 · commerce v2 切版后由 CatalogService 接管,本桥层暂返回 None。
/// 后续会改成调用 catalog_service.recommend_by_yongshen(...) 走新表。
pub async fn pick_recommend(
    _pool: &PgPool,
    _primary_yongshen: Option<&str>,
    _region: &str,
    _platform: &str,
    _seed: u64,
) -> Result<Option<RecommendOut>, ApiError> {
    Ok(None)
}

pub fn time_label(hour: u32) -> String {
    let period = match hour {
        23 | 0 => "子时",
        1 | 2 => "丑时",
        3 | 4 => "寅时",
        5 | 6 => "卯时",
        7 | 8 => "辰时",
        9 | 10 => "巳时",
        11 | 12 => "午时",
        13 | 14 => "未时",
        15 | 16 => "申时",
        17 | 18 => "酉时",
        19 | 20 => "戌时",
        _ => "亥时",
    };
    period.to_string()
}
