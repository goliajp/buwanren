//! 「算力隐式」桥层 — 按 natal_summary + qimen 时盘 + 时辰,
//! 从 quote / gate_word / yiji_word 池中**精准匹配**抽取(非随机)。
//!
//! 商品推荐部分由 commerce v2 CatalogService 接管,本文件只保留内容池抽取。

use rand::{Rng, SeedableRng, rngs::StdRng};
use sqlx::{PgPool, Row};
use unmei_domain::{AppError, QuoteOut, RecommendOut};
use crate::auth::ApiError;

/// 三个内容池缺内容时说同一句话。
///
/// 原先三处各行其是:签词 500 `no published quote`、门解**静静兜成「宜静」**、
/// 宜忌静静返回空。第二种最糟 —— 它把「这个语言没有内容」变成一句像模像样、
/// 却没有任何依据的判词。三者的分歧本身就是 bug,与「未知语言该怎么办」
/// 那条待拍板的政策无关。
///
/// 消息里带上 locale:缺内容这件事我们完全知道原因,而 locale 是唯一有用的
/// 那个值,原先的 `no published quote` 一个字都没提。
///
/// **状态码仍是 500**,不是 404 也不是 422 —— 请求本身没毛病,是这边没有内容
/// 可给,500 说的正是这个。换成 404 / 422 等于替产品选了「回退 zh-CN /
/// 登录时拒掉 / 返回空态」三条路之一,那件事还等着拍板(docs/OPEN.md 第 10 条)。
fn no_content(table: &str, locale: &str) -> ApiError {
    ApiError(AppError::Internal(format!("no published {table} for locale {locale:?}")))
}

pub struct ChosenQuote { pub id: String, pub out: QuoteOut }
// gate 本身调用方已经有了(是它传进来的),这里只回传解释与方位
pub struct ChosenGate { pub direction: String, pub explain: String }

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
        return Err(no_content("quote", locale));
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
    // 没有这一门的词条,就说没有 —— 不要编一句「宜静」出来。
    // 那句兜底会在「有 quote、没有 gate_word」的语言上原样发给用户,
    // 而它读起来跟真的门解一模一样。
    let Some(rr) = r else { return Err(no_content("gate_word", locale)) };
    Ok(ChosenGate { direction: rr.get("direction"), explain: rr.get("benefit_text") })
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

    // 空着不报,出来的卦就是「没有宜、没有忌」—— 看着像今天恰好无可宜忌,
    // 实际是这个语言一条词都没有。两种一模一样,而含义相反。
    if yi_rows.is_empty() { return Err(no_content("yiji_word(type=yi)", locale)); }
    if ji_rows.is_empty() { return Err(no_content("yiji_word(type=ji)", locale)); }

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
/// 起完一卦，接下来能做的一件事。
///
/// 这里原先收 5 个参数、一个都不用、直接 `Ok(None)` —— 文件头写着「商品推荐
/// 由 commerce v2 CatalogService 接管」，而那一步没做，于是每一卦的
/// `recommend` 都是 null。占卜这一半与商品那一半本该在这儿相接（docs/FLOW.md B1）。
///
/// **不按用神选**：商品上根本没有五行字段（`tags` 是 八字 / 本命 / 问事 /
/// 实物 / 配饰 …，`category` 是 report / omamori / service / charm），
/// 硬凑一个五行对应出来是假的。按**这个人走到哪儿了**选：
///
/// 1. 还没有本命 → 本命那一类报告（下一步本来就是建本命）
/// 2. 有本命、村里一个人都没有 → 一枚御守（买了才有人入住）
/// 3. 其余 → 问事那一类报告
///
/// 三条都受 `available_regions` / `available_platforms` 约束，价格取
/// `price_book` 里 active 的那条。**一条都选不出来就回 None** —— 宁可这一卦
/// 没有下一步，也不硬塞一件买不到的东西。
///
/// 规则是实现方定的，换掉下面那个 match 即可。
pub async fn pick_recommend(
    pool: &PgPool,
    user_id: &str,
    region: &str,
    platform: &str,
    seed: u64,
) -> Result<Option<RecommendOut>, ApiError> {
    let has_natal: bool = sqlx::query_scalar(
        "SELECT active_natal_id IS NOT NULL FROM app_user WHERE id=$1",
    ).bind(user_id).fetch_optional(pool).await?.unwrap_or(false);

    let village_empty: bool = if has_natal {
        let n: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM villager_residency WHERE user_id=$1",
        ).bind(user_id).fetch_one(pool).await?;
        n == 0
    } else {
        false
    };

    // (category, 必须带的 tag)
    let (category, tag): (&str, Option<&str>) = match (has_natal, village_empty) {
        (false, _) => ("report", Some("本命")),
        (true, true) => ("omamori", None),
        (true, false) => ("report", Some("问事")),
    };

    let rows = sqlx::query(
        r#"SELECT p.id, p.name, p.sub_title, p.hero_image_url,
                  px.price_minor, px.currency
           FROM product p
           JOIN sku s ON s.product_id = p.id AND s.status = 'active'
           JOIN LATERAL (
             SELECT price_minor, currency FROM price_book
             WHERE sku_id = s.id AND status = 'active'
               AND region IN ($3, 'global')
               AND platform IN ($4, 'all')
               AND effective_from <= NOW()
               AND (effective_to IS NULL OR effective_to > NOW())
             ORDER BY effective_from DESC LIMIT 1
           ) px ON TRUE
           WHERE p.status = 'listed'
             AND p.category = $1
             AND ($2::text IS NULL OR $2 = ANY(p.tags))
             AND $3 = ANY(p.available_regions)
             AND $4 = ANY(p.available_platforms)
           ORDER BY p.sort_weight DESC, p.id
           LIMIT 50"#,
    )
    .bind(category)
    .bind(tag)
    .bind(region)
    .bind(platform)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(None);
    }
    // 同一个人同一天落到同一件上 —— 跟签词、门那边用的是同一个 seed。
    let idx = (seed % rows.len() as u64) as usize;
    let r = &rows[idx];
    let minor: i64 = r.get("price_minor");
    let currency: String = r.get("currency");
    Ok(Some(RecommendOut {
        kind: "product".into(),
        id: r.get("id"),
        name: r.get("name"),
        sub_title: r.get("sub_title"),
        price_display: money_display(minor, &currency),
        image_url: r.get("hero_image_url"),
    }))
}

/// 分转成一句能直接显示的价格。小数位问 `Currency` 要 —— 它是穷尽的，
/// 加一个币种会在三处编译不过（那是 2026-08-18 特意改成这样的）。
fn money_display(minor: i64, currency: &str) -> String {
    use unmei_domain::commerce::money::Currency;
    let Some(c) = Currency::from_str_lax(currency) else {
        // 认不出的币种不猜小数位 —— 原样把分和代码写出来，看得出是哪里不对。
        return format!("{minor} {currency}");
    };
    let d = c.decimals() as u32;
    let sym = match c {
        Currency::Cny => "¥",
        Currency::Jpy => "¥",
        Currency::Usd => "$",
        Currency::Eur => "€",
        Currency::Twd => "NT$",
        Currency::Hkd => "HK$",
        Currency::Gbp => "£",
        Currency::Sgd => "S$",
    };
    if d == 0 {
        return format!("{sym}{minor}");
    }
    let unit = 10_i64.pow(d);
    format!("{sym}{}.{:0width$}", minor / unit, (minor % unit).abs(), width = d as usize)
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
