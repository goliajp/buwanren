//! 「算力隐式」桥层 — 按 natal_summary + qimen 时盘 + 时辰,
//! 从 quote / gate_word / yiji_word 池中**精准匹配**抽取(非随机)。

use rand::{Rng, SeedableRng, rngs::StdRng};
use sqlx::SqlitePool;
use unmei_domain::{AppError, QuoteOut, RecommendOut};
use crate::auth::ApiError;

pub struct ChosenQuote { pub id: String, pub out: QuoteOut }
pub struct ChosenGate { pub gate: String, pub direction: String, pub explain: String }

/// 从 quote 池按主用神 / 八门偏好打分,top-K 中按 seed 取一(隐式个性化)
pub async fn pick_quote(
    pool: &SqlitePool,
    primary_yongshen: Option<&str>,
    gate: Option<&str>,
    locale: &str,
    seed: u64,
) -> Result<ChosenQuote, ApiError> {
    let rows = sqlx::query!(
        r#"SELECT id, book, chapter, text, wuxing_affinity, gate_affinity
           FROM quote
           WHERE status='published' AND locale=?1"#,
        locale,
    )
    .fetch_all(pool).await?;
    if rows.is_empty() {
        return Err(ApiError(AppError::Internal("no published quote".into())));
    }
    // 打分
    let mut scored: Vec<(f64, &str, &str, Option<&str>, &str)> = rows.iter().map(|r| {
        let aff_w: Vec<String> = serde_json::from_str(&r.wuxing_affinity).unwrap_or_default();
        let aff_g: Vec<String> = serde_json::from_str(&r.gate_affinity).unwrap_or_default();
        let mut score = 1.0;
        if let Some(yw) = primary_yongshen { if aff_w.iter().any(|w| w == yw) { score += 3.0; } }
        if let Some(g)  = gate              { if aff_g.iter().any(|x| x == g) { score += 2.0; } }
        (score, r.id.as_str(), r.book.as_str(), r.chapter.as_deref(), r.text.as_str())
    }).collect();
    scored.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap());

    // 取 top 5 中按 seed 取一
    let top = scored.into_iter().take(5).collect::<Vec<_>>();
    let mut rng = StdRng::seed_from_u64(seed);
    let idx = rng.gen_range(0..top.len());
    let (_, id, book, chapter, text) = &top[idx];
    let source = match chapter {
        Some(c) if !c.is_empty() => format!("{book} · {c}"),
        _ => (*book).to_string(),
    };
    Ok(ChosenQuote {
        id: (*id).to_string(),
        out: QuoteOut { text: (*text).to_string(), source },
    })
}

/// 按命盘的主用神反算「适合的吉门」— 简化映射(QM2 八门未落地前的桥)
pub fn pick_gate_by_yongshen(primary_yongshen: Option<&str>, time_branch: u8, seed: u64) -> &'static str {
    // 主用神 → 偏好门(简化优先级)
    let prefs: &[&str] = match primary_yongshen {
        Some("木") => &["休门","开门","生门"],
        Some("火") => &["景门","开门"],
        Some("土") => &["生门","死门"],
        Some("金") => &["惊门","开门","景门"],
        Some("水") => &["休门","杜门"],
        _          => &["休门","开门","生门","景门"],
    };
    // 时辰偏移(伪奇门:夜偏休/杜,昼偏景/开)
    let day = matches!(time_branch, 3..=8); // 卯..申(白天)
    let pool: Vec<&str> = if day {
        prefs.iter().chain(["景门","开门","生门"].iter()).cloned().collect()
    } else {
        prefs.iter().chain(["休门","杜门","死门"].iter()).cloned().collect()
    };
    let mut rng = StdRng::seed_from_u64(seed);
    pool[rng.gen_range(0..pool.len())]
}

pub async fn pick_gate_explain(pool: &SqlitePool, gate: &str, locale: &str) -> Result<ChosenGate, ApiError> {
    let r = sqlx::query!(
        r#"SELECT direction, benefit_text FROM gate_word
           WHERE gate=?1 AND locale=?2 AND status='published'
           ORDER BY version DESC LIMIT 1"#,
        gate, locale,
    ).fetch_optional(pool).await?;
    let (dir, txt) = match r {
        Some(rr) => (rr.direction, rr.benefit_text),
        None => ("—".to_string(), "宜静.".to_string()),
    };
    Ok(ChosenGate { gate: gate.to_string(), direction: dir, explain: txt })
}

pub async fn pick_yiji(
    pool: &SqlitePool,
    primary_yongshen: Option<&str>,
    avoid_wuxing: &[String],
    locale: &str,
    seed: u64,
) -> Result<(Vec<String>, Vec<String>), ApiError> {
    let yi_rows = sqlx::query!(
        r#"SELECT word, favor_when_main_wuxing FROM yiji_word
           WHERE type='yi' AND status='published' AND locale=?1"#,
        locale,
    ).fetch_all(pool).await?;
    let ji_rows = sqlx::query!(
        r#"SELECT word, disfavor_when_avoid_wuxing FROM yiji_word
           WHERE type='ji' AND status='published' AND locale=?1"#,
        locale,
    ).fetch_all(pool).await?;

    // 宜:命中主用神的优先;否则次之
    let mut yi_scored: Vec<(f64, &str)> = yi_rows.iter().map(|r| {
        let aff: Vec<String> = serde_json::from_str(&r.favor_when_main_wuxing).unwrap_or_default();
        let mut s = 1.0;
        if let Some(yw) = primary_yongshen { if aff.iter().any(|w| w == yw) { s += 5.0; } }
        (s, r.word.as_str())
    }).collect();
    yi_scored.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap());

    // 忌:命中忌神的优先
    let mut ji_scored: Vec<(f64, &str)> = ji_rows.iter().map(|r| {
        let aff: Vec<String> = serde_json::from_str(&r.disfavor_when_avoid_wuxing).unwrap_or_default();
        let mut s = 1.0;
        if aff.iter().any(|w| avoid_wuxing.iter().any(|aw| aw == w)) { s += 5.0; }
        (s, r.word.as_str())
    }).collect();
    ji_scored.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap());

    // top 8 中按 seed 抽 5/3
    let mut rng = StdRng::seed_from_u64(seed.wrapping_add(91));
    let yi_top: Vec<&str> = yi_scored.iter().take(10).map(|(_,w)| *w).collect();
    let ji_top: Vec<&str> = ji_scored.iter().take(8).map(|(_,w)| *w).collect();
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

/// 按主用神匹配商品推荐(top 1)
pub async fn pick_recommend(
    pool: &SqlitePool,
    primary_yongshen: Option<&str>,
    region: &str,
    platform: &str,
    seed: u64,
) -> Result<Option<RecommendOut>, ApiError> {
    let rows = sqlx::query!(
        r#"SELECT id, name, sub_title, price_cn, image_urls, recommend_when_main_wuxing,
                  regions_avail, platforms_avail
           FROM product
           WHERE status='on_sale' AND stock > 0"#
    ).fetch_all(pool).await?;
    let mut scored: Vec<(f64, &str, &str, Option<&str>, i64, &str)> = rows.iter().filter_map(|r| {
        let regs: Vec<String> = serde_json::from_str(&r.regions_avail).ok()?;
        let plats: Vec<String> = serde_json::from_str(&r.platforms_avail).ok()?;
        if !regs.iter().any(|x| x==region) || !plats.iter().any(|x| x==platform) { return None; }
        let aff: Vec<String> = serde_json::from_str(&r.recommend_when_main_wuxing).unwrap_or_default();
        let mut s = 1.0;
        if let Some(yw) = primary_yongshen { if aff.iter().any(|w| w == yw) { s += 5.0; } }
        Some((s, r.id.as_str(), r.name.as_str(), r.sub_title.as_deref(), r.price_cn, r.image_urls.as_str()))
    }).collect();
    if scored.is_empty() { return Ok(None); }
    scored.sort_by(|a,b| b.0.partial_cmp(&a.0).unwrap());
    let top: Vec<_> = scored.into_iter().take(3).collect();
    let mut rng = StdRng::seed_from_u64(seed.wrapping_add(177));
    let (_, id, name, sub, price_cn, imgs) = &top[rng.gen_range(0..top.len())];
    let imgs_arr: Vec<String> = serde_json::from_str(imgs).unwrap_or_default();
    let price = format!("¥{}", *price_cn / 100);
    Ok(Some(RecommendOut {
        kind: "product".into(),
        id: (*id).into(),
        name: (*name).into(),
        sub_title: sub.map(String::from),
        price_display: price,
        image_url: imgs_arr.into_iter().next(),
    }))
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
