//! /v1/reports · 那一册（设计册 M2「八字深度报告 ¥199 · 看 ›」）
//!
//! ## 一个字都不编
//!
//! 这一册的每一项都来自 mingli 排的盘：格局带着出处（「月令本气透干 月柱」）、
//! 用神带着 method 与 reasoning 原文、强弱带着五行分数。设计册 10.8 说的
//! 「不下没有来源的断言」在这儿不是克制，是**不需要** —— 排盘算得出来的东西
//! 已经够写满一册，编出来的话反而是把有出处的换成没出处的。
//!
//! 所以这里没有一处 LLM，也没有一句「你的命格主……」式的话术。
//!
//! ## 页在后端排
//!
//! 返回的是排好的 `pages`：页序、标题、每页的出处都是**产品文案**，
//! 改一句不该让人重新发一版小程序。客户端拿到的是能直接画的行。
//!
//! 客户端只有两个模板：四柱那页（这册的门面，专门画）和其余页
//! （`rows` + 可选 `bars` + 可选 `quote`）。加一页、改页序都不动客户端。

use axum::{extract::{Path, State}, routing::get, Json, Router};
use serde_json::{json, Value as J};
use sqlx::Row;

use unmei_domain::AppError;

use crate::auth::{ApiError, AuthedUser};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // 只有这一条。「我买过的」已经是册子的入口 —— 从那一单点进来，
        // 不另开一条列表路。没人调的接口是死代码，而死代码会被当成还活着
        .route("/v1/reports/:id", get(one))
}

async fn one(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(id): Path<String>,
) -> Result<Json<J>, ApiError> {
    let r = sqlx::query(
        r#"SELECT id, user_id, kind, status, natal_snapshot_json, chart_json,
                  mingli_version, created_at, ready_at
           FROM report WHERE id=$1"#,
    )
    .bind(&id)
    .fetch_optional(&st.db)
    .await?
    .ok_or_else(|| ApiError(AppError::NotFound("report".into())))?;

    // 别人的册子不给看。不存在和不是你的都回 404 —— 403 会告诉猜 id 的人
    // 「这一册确实存在」
    if r.get::<String, _>("user_id") != c.sub {
        return Err(ApiError(AppError::NotFound("report".into())));
    }

    let status: String = r.get("status");
    let natal: Option<J> = r.get("natal_snapshot_json");
    let chart: Option<J> = r.get("chart_json");
    let version: Option<String> = r.get("mingli_version");

    // 还没出的册子照样回 200 —— 它是这一单真实的状态，不是错误。
    // 客户端据此说「还差你的生辰」并给一条去填的路（设计册 10.7）。
    let pages = match (&status[..], chart.as_ref()) {
        // 「今天」从这里传进去,不在 `排页` 里读时钟。读时钟的函数没法钉住行为 ——
        // 大运标哪一格是随日子走的,而一个自己去问「现在几点」的函数,
        // 测试只能在它算出来的那一天成立
        ("ready", Some(chart)) => 排页(chart, version.as_deref(), 今天()),
        _ => vec![],
    };

    Ok(Json(json!({
        "id": r.get::<String, _>("id"),
        "kind": r.get::<String, _>("kind"),
        "status": status,
        "whose": natal.as_ref().and_then(|n| n.get("label").cloned()).unwrap_or(J::Null),
        "birth_line": natal.as_ref().map(生辰一行).unwrap_or(J::Null),
        "mingli_version": version,
        "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        "pages": pages,
    })))
}

/// 「1998年3月5日 14:30 · 成都」—— 这一册算的是谁
fn 生辰一行(n: &J) -> J {
    let g = |k: &str| n.get(k).and_then(|v| v.as_i64()).unwrap_or(0);
    let city = n.get("birth_city").and_then(|v| v.as_str()).unwrap_or("");
    let 时刻 = format!("{}年{}月{}日 {:02}:{:02}", g("year"), g("month"), g("day"), g("hour"), g("minute"));
    J::String(if city.is_empty() { 时刻 } else { format!("{时刻} · {city}") })
}

fn 串(v: Option<&J>) -> String {
    v.and_then(|x| x.as_str()).unwrap_or("").to_string()
}

/// 盘 → 一册的六页。
///
/// 每页都写出处：读的人要能追到这一句是从哪儿算出来的。
/// 一页取不到数据就**不出这一页** —— 摆一页空的比少一页糟。
/// 上海的今天。生辰、大运都按用户所在的日子算 —— 差八小时的话，
/// 晚上八点之后就换一天，而大运换格那天会提前一天翻。
fn 今天() -> chrono::NaiveDate {
    (chrono::Utc::now() + chrono::Duration::hours(8)).date_naive()
}

/// 生日到今天的**实龄**。
///
/// 原先这里是「今年 − 生年」，那不是实龄：生日在年内较晚的人会多算一岁，
/// 而多算的那一岁**正好落在换格那一年** —— 整年标错一格。
/// 本机那份样本是三月生的，两种算法同值，所以测不出来。
fn 实龄(生: (i64, i64, i64), 今: chrono::NaiveDate) -> i64 {
    use chrono::Datelike;
    let (y, m, d) = 生;
    今.year() as i64 - y - if ((今.month() as i64), (今.day() as i64)) < (m, d) { 1 } else { 0 }
}

fn 排页(c: &J, version: Option<&str>, 今: chrono::NaiveDate) -> Vec<J> {
    /* 「mingli-v0.1 排盘」—— 前半截是仓库名加版本号,那是写给我看的,
       而这一册是买家花钱读的东西。留住溯源(每一句都能追到怎么算出来的)是对的,
       但要说成人话:先说它是什么,再把型号缀在后面,像仪器落款。 */
    let 出处 = format!("排盘引擎 · {}", version.unwrap_or("mingli"));
    let mut pages = vec![];

    // 一 · 四柱。这册的门面，客户端专门画
    let 柱 = ["year", "month", "day", "hour"];
    let 位 = ["年", "月", "日", "时"];
    let pillars: Vec<J> = 柱.iter().zip(位).filter_map(|(k, p)| {
        let x = c.get(k)?;
        /* 天干那一行的拼音 —— 客户端拿它给这一柱的牌顶配色。
           不给汉字让客户端自己映射:那等于在页面里抄一份五行表,
           抄的那天是对的，改的那天就不是了。 */
        let 拼 = match 串(x.get("stem_wuxing")).as_str() {
            "木" => "mu", "火" => "huo", "土" => "tu", "金" => "jin", "水" => "shui",
            _ => "",
        };
        Some(json!({
            "pos": p,
            "ganzhi": 串(x.get("ganzhi")),
            "ten_god": 串(x.get("ten_god")),
            "pinyin": 拼,
            "wuxing": format!("{}{}", 串(x.get("stem_wuxing")), 串(x.get("branch_wuxing"))),
            "nayin": 串(x.get("nayin")),
            "twelve": 串(x.get("day_twelve")),
            "hidden": x.get("hidden").and_then(|h| h.as_array()).map(|a| a.iter().map(|g|
                format!("{}{}", 串(g.get("stem")), 串(g.get("ten_god")))
            ).collect::<Vec<_>>()).unwrap_or_default(),
        }))
    }).collect();
    if !pillars.is_empty() {
        pages.push(json!({
            "key": "pillars", "title": "四柱",
            "note": "藏干写在每柱下面 —— 后面几页说的每一句都从这四根柱子来",
            "pillars": pillars, "source": 出处,
        }));
    }

    // 二 · 日主与强弱。五行分布是这一页的主角
    if let Some(s) = c.get("strength") {
        let w = s.get("wuxing");
        // 第三项是客户端的 class 后缀 —— 页面里不再按汉字猜五行
        let 名 = [("wood", "木", "mu"), ("fire", "火", "huo"), ("earth", "土", "tu"),
                  ("metal", "金", "jin"), ("water", "水", "shui")];
        /* 带上拼音 —— 客户端拿它给每根条上色。跟四柱那处同一个道理:
           在页面里按汉字映射等于抄第二份五行表。 */
        let bars: Vec<J> = 名.iter().filter_map(|(k, cn, py)| {
            let v = w?.get(k)?.as_i64()?;
            Some(json!({ "k": cn, "v": v, "pinyin": py }))
        }).collect();
        pages.push(json!({
            "key": "strength",
            "title": format!("日主 {}", 串(c.get("day_master"))),
            "lead": format!("{} · 综合 {}", 串(s.get("level")), s.get("score").and_then(|v| v.as_i64()).unwrap_or(0)),
            "note": "分数是五行力量的加权和，不是打分 —— 高不等于好",
            "bars": bars,
            "rows": vec![
                json!({"k": "得令", "v": s.get("got_ling").cloned().unwrap_or(J::Null)}),
                json!({"k": "得地", "v": s.get("got_di").cloned().unwrap_or(J::Null)}),
                json!({"k": "得势", "v": s.get("got_shi").cloned().unwrap_or(J::Null)}),
            ],
            "source": 出处,
        }));
    }

    // 三 · 用神。reasoning 是排盘自己写的推理，原样给出 —— 不改写、不润色
    if let Some(y) = c.get("yongshen") {
        let avoid = y.get("avoid_wuxing").and_then(|a| a.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join("、"))
            .unwrap_or_default();
        pages.push(json!({
            "key": "yongshen", "title": "用神",
            "lead": 串(y.get("method")),
            "rows": vec![
                json!({"k": "主用", "v": format!("{} · {}", 串(y.get("primary_wuxing")), 串(y.get("primary_role")))}),
                json!({"k": "次用", "v": format!("{} · {}", 串(y.get("secondary_wuxing")), 串(y.get("secondary_role")))}),
                json!({"k": "所忌", "v": avoid}),
            ],
            "quote": 串(y.get("reasoning")),
            "source": 出处,
        }));
    }

    // 四 · 格局。带 source —— 「凭什么是这个格」比「是什么格」重要
    if let Some(p) = c.get("pattern") {
        let mut rows = vec![
            json!({"k": "取自", "v": 串(p.get("source"))}),
            json!({"k": "月令", "v": format!("{}（{}）", 串(p.get("qi_stem")), 串(p.get("qi_kind")))}),
        ];
        if p.get("revealed").and_then(|v| v.as_bool()).unwrap_or(false) {
            rows.push(json!({"k": "透干", "v": 串(p.get("revealed_in"))}));
        }
        pages.push(json!({
            "key": "pattern", "title": 串(p.get("name")),
            "lead": "格局", "rows": rows, "source": 出处,
        }));
    }

    // 五 · 大运。**标出现在走到哪一格** —— 十格干支谁都排得出来，
    // 「你在第三格，还有四年换」才是读的人真正要的那一句。
    if let Some(d) = c.get("dayun").and_then(|d| d.get("pillars")).and_then(|p| p.as_array()) {
        /* 岁数按【实龄】算。排盘给的 `start_age_years` 就是实龄（实测 9.74），
           `pillars[].start_age` 是它取整后的步长，所以两边口径要对上。 */
        let 取 = |k: &str| c.get("input").and_then(|i| i.get(k)).and_then(|v| v.as_i64());
        let 今岁 = match (取("year"), 取("month"), 取("day")) {
            (Some(y), Some(m), Some(d)) => Some(实龄((y, m, d), 今)),
            // 生日不全就不标 —— 标错一格比不标糟：读的人会照着它算还有几年换运
            _ => None,
        };
        // 现在这一格 = start_age 不超过今岁的最后一格
        let 现格 = 今岁.and_then(|age| d.iter().rposition(|p|
            p.get("start_age").and_then(|v| v.as_i64()).map(|a| a <= age).unwrap_or(false)));
        let rows: Vec<J> = d.iter().take(8).enumerate().map(|(i, p)| json!({
            "k": format!("{} 岁", p.get("start_age").and_then(|v| v.as_i64()).unwrap_or(0)),
            "v": 串(p.get("ganzhi")),
            "now": Some(i) == 现格,
        })).collect();
        if !rows.is_empty() {
            pages.push(json!({
                "key": "dayun", "title": "大运",
                "lead": if c.get("dayun").and_then(|d| d.get("forward")).and_then(|v| v.as_bool()).unwrap_or(true) { "顺行" } else { "逆行" },
                "note": "每一步走十年，从起运那年算起 · 标着的那格是现在",
                "rows": rows, "source": 出处,
            }));
        }
    }

    // 六 · 三宫与旬空
    if let Some(h) = c.get("three_houses") {
        let 空 = c.get("xunkong").and_then(|a| a.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join("、"))
            .unwrap_or_default();
        let mut rows = vec![
            json!({"k": "胎元", "v": 串(h.get("tai_yuan"))}),
            json!({"k": "命宫", "v": 串(h.get("ming_gong"))}),
            json!({"k": "身宫", "v": 串(h.get("shen_gong"))}),
        ];
        rows.retain(|r| r.get("v").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false));
        if !空.is_empty() {
            rows.push(json!({"k": "旬空", "v": 空}));
        }
        if !rows.is_empty() {
            pages.push(json!({"key": "houses", "title": "三宫", "rows": rows, "source": 出处}));
        }
    }

    pages
}


#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn 日(y: i32, m: u32, d: u32) -> NaiveDate { NaiveDate::from_ymd_opt(y, m, d).unwrap() }

    #[test]
    fn 实龄按生日算而不是按年份差() {
        // 生日还没到:今年减生年会多算一岁
        assert_eq!(实龄((1998, 12, 5), 日(2026, 8, 29)), 27);
        // 生日当天就算过了
        assert_eq!(实龄((1998, 12, 5), 日(2026, 12, 5)), 28);
        assert_eq!(实龄((1998, 12, 5), 日(2026, 12, 4)), 27);
        // 生日在年初的:两种算法同值 —— 本机那份样本正是这一种,所以它测不出问题
        assert_eq!(实龄((1998, 3, 5), 日(2026, 8, 29)), 28);
    }

    fn 盘(生月日: (i64, i64)) -> J {
        json!({
            "input": { "year": 1998, "month": 生月日.0, "day": 生月日.1 },
            "dayun": { "forward": false, "pillars": [
                { "ganzhi": "癸丑", "start_age": 10 },
                { "ganzhi": "壬子", "start_age": 20 },
                { "ganzhi": "辛亥", "start_age": 30 },
            ]},
        })
    }

    fn 标着现在的那格(pages: &[J]) -> Option<String> {
        let p = pages.iter().find(|p| p["key"] == "dayun")?;
        p["rows"].as_array()?.iter()
            .find(|r| r["now"] == json!(true))
            .map(|r| r["v"].as_str().unwrap_or("").to_string())
    }

    #[test]
    fn 大运标的是现在走着的那一格() {
        // 三月生,2026-08 实龄 28 → 二十岁那格
        let p = 排页(&盘((3, 5)), None, 日(2026, 8, 29));
        assert_eq!(标着现在的那格(&p).as_deref(), Some("壬子"));
    }

    #[test]
    fn 换格那一年不许提前翻() {
        /* ★ 这一条是这次修的东西。十二月生的人在 2026-08-29 实龄 27，
           还在二十岁那格；按「今年减生年」算成 28，看着仍是二十岁那格 ——
           所以要挑一个真会翻的日子：实龄 29 vs 30。 */
        let 十二月生 = 盘((12, 5));
        // 2027-08-29:实龄 28,仍在二十岁那格
        assert_eq!(标着现在的那格(&排页(&十二月生, None, 日(2027, 8, 29))).as_deref(), Some("壬子"));
        // 2028-08-29:实龄 29,还是二十岁那格 —— 而「今年减生年」会算成 30，提前翻到三十岁那格
        assert_eq!(标着现在的那格(&排页(&十二月生, None, 日(2028, 8, 29))).as_deref(), Some("壬子"),
                   "生日还没到就翻格了 —— 岁数算成了年份差");
        // 2028-12-05 生日当天:实龄 30,这才翻
        assert_eq!(标着现在的那格(&排页(&十二月生, None, 日(2028, 12, 5))).as_deref(), Some("辛亥"));
    }

    #[test]
    fn 生日不全就不标哪一格() {
        let 缺日 = json!({
            "input": { "year": 1998, "month": 12 },
            "dayun": { "pillars": [{ "ganzhi": "癸丑", "start_age": 10 }] },
        });
        // 标错一格比不标糟:读的人会照着它算还有几年换运
        assert_eq!(标着现在的那格(&排页(&缺日, None, 日(2026, 8, 29))), None);
    }
}
