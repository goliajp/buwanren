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

/// 结论那一页上的那句话。跟填完出生时间那一屏用同一套说法
/// （`natal::build_friendly_hint`）—— 两处说同一件事却用两种措辞，
/// 读的人会以为是两回事。这里按五行直接给，不绕排盘那一层。
fn 人话(缺: &str, 够多: &str) -> String {
    let 使劲 = match 缺 {
        "木" => "多往外走走，把想做的事真的动起来",
        "火" => "多往热闹的地方去，跟人待在一起",
        "土" => "把手上的事一件件做扎实，别贪多",
        "金" => "该收的收、该断的断，别拖着",
        "水" => "给自己留出安静的时间，想清楚再动",
        _ => "顺着自己的节奏来",
    };
    let 头一个 = 够多.chars().next().map(|c| c.to_string()).unwrap_or_default();
    let 够了 = match 头一个.as_str() {
        "木" => "新的计划已经够多了，先把旧的收个尾",
        "火" => "热闹和人情已经够多了，不必再往里添",
        "土" => "稳的东西已经够多了，别再往下压",
        "金" => "已经够克制了，不用再逼自己一把",
        "水" => "想得已经够多了，剩下的交给做",
        _ => "",
    };
    if 够了.is_empty() { format!("{使劲}。") } else { format!("{使劲}。{够了}。") }
}

fn 排页(c: &J, version: Option<&str>, 今: chrono::NaiveDate) -> Vec<J> {
    /* 「mingli-v0.1 排盘」—— 前半截是仓库名加版本号，那是写给我看的，
       而这一册是买家花钱读的东西。留住溯源（每一句都能追到怎么算出来的）
       是对的，但落款上不该有内部代号:「mingli-v0.1」对读的人没有意义，
       它只说明「这里有个我们内部的东西」。
       改说这一页的数是【算出来的不是编的】—— 那才是溯源要传达的事。
       真正的版本号仍然留在响应里（`engine_version` 字段），
       出问题时查得到，只是不摆在买家眼前。 */
    let 出处 = "按你的出生时间排出来的，不是套模板".to_string();
    let _ = version;
    let mut pages = vec![];

    /* 零 · 结论。**这一页排在最前，而且它是唯一一页不用懂术数也读得完的**。
       原先六页是「四柱 → 日主 → 用神 → 格局 → 大运 → 三宫」——
       从最技术的开头，到最技术的结尾，中间没有一页说结论。
       花钱买下它的人翻开第一眼是一张排盘表，读完六页带走的是「我看了一堆表」。

       0830 标尺定的是【先给结论，再给术语】。所以这一页只说三件事：
       你缺什么 · 该往哪儿使劲 · 现在走到哪一步;
       后面五页原样保留，它们是这三句话的依据。
       数据全部来自已有的盘，一个新字段都不造。 */
    if let Some(y) = c.get("yongshen") {
        let 缺 = 串(y.get("primary_wuxing"));
        let 够多 = y.get("avoid_wuxing").and_then(|a| a.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join("、"))
            .unwrap_or_default();
        // 现在走到第几步 —— 跟大运那一页用同一套实龄口径，两页说的得是同一件事
        let 取 = |k: &str| c.get("input").and_then(|i| i.get(k)).and_then(|v| v.as_i64());
        let 这一步 = c.get("dayun").and_then(|d| d.get("pillars")).and_then(|p| p.as_array())
            .and_then(|d| {
                let age = match (取("year"), 取("month"), 取("day")) {
                    (Some(y), Some(m), Some(dd)) => 实龄((y, m, dd), 今),
                    _ => return None,
                };
                let i = d.iter().rposition(|p|
                    p.get("start_age").and_then(|v| v.as_i64()).map(|a| a <= age).unwrap_or(false))?;
                let 起 = d[i].get("start_age").and_then(|v| v.as_i64())?;
                /* 【不带干支】。这一页自己写着「不用懂术数也读得完」，
                   而括号里那两个字（壬子）正是术数 —— 一页里最后一个术语，
                   偏偏落在承诺没有术语的那一页上。
                   干支在大运那一页有，那里才是它的地方。 */
                Some(format!("{} 岁起这十年", 起))
            });

        let mut rows = vec![json!({"k": "你缺的", "v": 缺})];
        if !够多.is_empty() {
            rows.push(json!({"k": "已经够多的", "v": 够多}));
        }
        if let Some(步) = 这一步 {
            rows.push(json!({"k": "现在走到", "v": 步}));
        }
        pages.push(json!({
            "key": "lead", "title": "说在前面",
            // 页数在最后回填 —— 后面有几页由数据说了算（缺格局就少一页），
            // 写死「五页」在实际有六页的盘上就是一句错话，而它印在承诺
            // 「不用懂术数也读得完」的那一页上，正是最不该出错的位置。
            "note": "",
            "rows": rows,
            "quote": 人话(&缺, &够多),
            "source": 出处,
        }));
    }

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
            "pillars": pillars,
            "body": "把出生的年、月、日、时各换成一组干支，一共八个字 —— 「八字」就是这么来的。日柱的天干叫日主，代表你自己；后面所有的强弱、喜忌，都是拿另外七个字跟它比出来的。每张卡下面那几行是藏干：地支里还藏着天干，藏着的那些同样算力量。",
            "source": 出处,
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

    /* 四 · 格局。带出处 —— 「凭什么是这个格」比「是什么格」重要。
       但那句出处（「月令本气透干 月柱」）正是下面两行拼起来的:
       「月令 甲（本气）」+「透干 月柱」。三行摆在一起，同一件事说了两遍，
       而且拼起来那句是机器串，读的人得先把它拆开才看得懂。
       所以【拆得开就只给拆开的】，拆不开（没有月令、或没透干）才留原句。 */
    if let Some(p) = c.get("pattern") {
        let 透了 = p.get("revealed").and_then(|v| v.as_bool()).unwrap_or(false);
        let 月令 = 串(p.get("qi_stem"));
        let mut rows = vec![];
        if 月令.is_empty() || !透了 {
            rows.push(json!({"k": "取自", "v": 串(p.get("source"))}));
        }
        if !月令.is_empty() {
            rows.push(json!({"k": "月令", "v": format!("{}（{}）", 月令, 串(p.get("qi_kind")))}));
        }
        if 透了 {
            rows.push(json!({"k": "透干", "v": 串(p.get("revealed_in"))}));
        }
        pages.push(json!({
            "key": "pattern", "title": 串(p.get("name")),
            "lead": "格局",
            "note": "先认出月令里最有力的那个字，再看它有没有在天干上露头 —— 露了头，这张盘就有了主线",
            "rows": rows,
            "body": 格局怎么读(&串(p.get("name"))),
            "source": 出处,
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
        /* 【这一步怎么读】。这一页原先只有一排干支加五百像素空白 ——
           八个字谁都排得出来，「你现在这一步是帮你还是拦你」才是要问的。
           喜忌从用神那一节取，取不到就只留通则那一段，不编。

           算在 `json!` 【外面】:那个宏解析不了带泛型的块表达式
           （`Vec<String>` 的尖括号会被当成比较运算符），
           报出来是「comparison operators cannot be chained」，
           跟这段逻辑本身没关系。 */
        let 通则 = "换运不是换命，换的是舞台：同一张盘在不同的十年里，\
得力的地方和费劲的地方会挪位置。顺行逆行只是干支往哪个方向数，\
由性别和年柱的阴阳定，跟好坏无关。";
        let 喜 = c.get("yongshen").map(|y| 串(y.get("primary_wuxing"))).unwrap_or_default();
        let 不喜: Vec<String> = c.get("yongshen")
            .and_then(|y| y.get("avoid_wuxing")).and_then(|a| a.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let 大运正文 = match (现格, 喜.is_empty()) {
            (Some(i), false) => format!("{}\n\n{}", 通则, 这一步怎么读(&d[i], d.get(i + 1), &喜, &不喜)),
            _ => 通则.to_string(),
        };

        if !rows.is_empty() {
            pages.push(json!({
                "key": "dayun", "title": "大运",
                "lead": if c.get("dayun").and_then(|d| d.get("forward")).and_then(|v| v.as_bool()).unwrap_or(true) { "顺行" } else { "逆行" },
                "note": "每一步走十年，从起运那年算起 · 标着的那格是现在",
                "rows": rows,
                "body": 大运正文,
                "source": 出处,
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
            pages.push(json!({
                "key": "houses", "title": "三宫",
                "rows": rows,
                "body": "胎元是受孕那个月的干支，看的是你出生前那段时间的底子。命宫由出生的月份和时辰折算出来，传统上用它看一个人的大方向；身宫跟命宫配着看，偏向后天怎么走。旬空是这一旬里空掉的两个地支 —— 事情落在这两个字上，力量要打个折。",
                "source": 出处,
            }));
        }
    }

    /* 结论页的那句「后面还有几页」得等所有页都排完才数得出来。
       它排在最前，却只有到这里才知道自己前面立的 flag 是几。 */
    let 后面 = pages.len().saturating_sub(1);
    if let Some(第一页) = pages.first_mut() {
        if 第一页.get("key").and_then(|v| v.as_str()) == Some("lead") {
            第一页["note"] = json!(format!(
                "这一页不用懂术数也读得完 —— 后面{}页是它怎么算出来的", 汉数(后面)));
        }
    }

    pages
}

/* 这一页原先整页只有两行:「月令 甲（本气）」「透干 月柱」，
   下面五百多像素全空。买下这一册的人翻到格局那一页，看到两行字就翻过去了 ——
   而格局恰恰是整张盘的入手方式，后面说的强弱喜忌都顺着它走。

   十段各写一次「主线是什么、顺的时候什么样、费劲的时候什么样」。
   术语留着（这是专业页），但句子按现代汉语写，不用文言。 */
/* 干支带的是哪一行。天干十个、地支十二个，各有定数 ——
   这是对照表，不是判断。 */
fn 五行(干支: &str) -> Option<&'static str> {
    let 首 = 干支.chars().next()?;
    Some(match 首 {
        '甲' | '乙' => "木",
        '丙' | '丁' => "火",
        '戊' | '己' => "土",
        '庚' | '辛' => "金",
        '壬' | '癸' => "水",
        _ => return None,
    })
}

/* 【这一步怎么读】。大运那一页原先只有一排干支加五百像素空白 ——
   八个字谁都排得出来，「你现在这一步是帮你还是拦你」才是要问的。

   只做一层:这一步带的那一行，在不在你的喜忌里。
   真要细断还得看它跟盘里其它字的会合刑冲，那一层这份说明书不做，
   而且**说清楚不做** —— 含糊地暗示自己算得更深，比少说一层糟。

   八格逐个写会把那一页挤满，人真正想知道的是「我现在在哪儿、
   接下来会怎样」，所以只说当前这一步和下一步。 */
fn 这一步怎么读(这格: &J, 下格: Option<&J>, 喜: &str, 不喜: &[String]) -> String {
    let 干支 = 串(这格.get("ganzhi"));
    let 行 = match 五行(&干支) { Some(x) => x, None => return String::new() };
    let 起 = 这格.get("start_age").and_then(|v| v.as_i64()).unwrap_or(0);

    let 味 = if 行 == 喜 {
        format!("带的是{}，正是你缺的那一样 —— 这十年顺手一些", 行)
    } else if 不喜.iter().any(|x| x == 行) {
        format!("带的是{}，是你已经够多的那一样 —— 这十年得多费些劲", 行)
    } else {
        format!("带的是{}，跟你的喜忌都不搭边 —— 不特别帮你，也不特别拦你", 行)
    };

    let mut 话 = format!("{} 岁起这一步 {}，{}。", 起, 干支, 味);
    if let Some(下) = 下格 {
        let 下支 = 串(下.get("ganzhi"));
        let 下起 = 下.get("start_age").and_then(|v| v.as_i64()).unwrap_or(0);
        if let Some(下行) = 五行(&下支) {
            let 下味 = if 下行 == 喜 { "会松一些" }
                       else if 不喜.iter().any(|x| x == 下行) { "会紧一些" }
                       else { "跟这一步差不多" };
            话.push_str(&format!("{} 岁换到 {}，带{}，{}。", 下起, 下支, 下行, 下味));
        }
    }
    话.push_str("这里只看这一步带哪一行 —— 它跟盘里其它字怎么牵扯，这一册不做那一层。");
    话
}

fn 格局怎么读(名: &str) -> String {
    let 正文 = match 名.trim_end_matches('格') {
        "正财" => "主线是「守」。财在盘里指你要经手、要守住的那部分：钱、事、答应下来的责任。正财来路清楚、进得稳，所以这类盘讲究撑不撑得住 —— 身强是持家有方，身弱容易被事情推着走。",
        "偏财" => "主线还是财，但偏财来得散、去得也快。这类盘对机会敏感，路子活。同样看身强身弱：撑得住是能张罗，撑不住是摊子铺太大。",
        "正官" => "主线是「规矩」。官指约束你的那部分：职位、制度、别人对你的期待。正官是讲道理的那种约束，所以这类盘多半守本分、按流程走。身强担得起，身弱会被管得喘不过气。",
        "七杀" | "偏官" => "七杀也是官，但不讲道理 —— 它指压力、竞争、突然压到头上的事。这类盘抗压，遇强则强，也容易把自己绷得太紧。关键看有没有东西替你挡一挡：印来化，或者食伤来制。",
        "正印" => "主线是「养」。印指生你、护你的那部分：长辈、学问、退路。这类盘学得进东西，心里有底；但印太厚会拖 —— 什么都想先弄明白再动，机会就过去了。",
        "偏印" | "枭神" => "也是印，但偏。这类盘想法多、路子偏，学的东西不太主流。好处是别人想不到的地方它想得到，麻烦是容易钻牛角尖，或者把简单事做复杂。",
        "食神" => "主线是「出」。食神指你往外拿出来的东西：表达、手艺、做成的成果。这类盘性子松弛，能把想法变成看得见的东西。最忌被印压住 —— 那样话到嘴边又咽回去。",
        "伤官" => "也是往外拿，但比食神冲。这类盘有才、藏不住，看不惯的直接说。锋利既是本事也是麻烦：顺的时候别人服你，不顺的时候得罪人还不自知。",
        "建禄" | "禄" => "月令正好是日主自己这一行。这类盘底子厚、自立，不太靠人；反过来说也少了个现成的靠山，什么都得自己张罗，早年通常费力些。",
        "羊刃" | "月刃" => "月令是日主的刃，力量比建禄还猛一档，冲劲足、说干就干。用得好是能扛大事的人，用不好是刹不住车 —— 这类盘最需要一个能约束它的东西。",
        // 认不出来的格不硬编一段。宁可空着，也不给一段跟这张盘无关的话。
        _ => "",
    };
    正文.to_string()
}

/// 一到十的汉字。文案里「后面6页」读着像报表，「后面六页」才像人写的。
fn 汉数(n: usize) -> String {
    const 字: [&str; 11] = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    if n <= 10 { 字[n].to_string() } else { n.to_string() }
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

    /// 结论排在最前，而且它一个术语都不带。
    ///
    /// 原先六页从「四柱」开头 —— 花钱买下的人翻开第一眼是一张排盘表。
    /// 0830 标尺定的是先给结论再给术语，所以第一页只说
    /// 「你缺什么 / 已经够多的 / 现在走到哪一步」加一句人话。
    /* 「后面几页」这句话原先写死成「五页」，而实际排出来是六页 ——
       它偏偏印在承诺「不用懂术数也读得完」的那一页上。
       页数由数据定（缺格局就少一页），所以这里拿两种盘各数一次。 */
    /* 大运那一页要说清「这一步是帮你还是拦你」。判据只有一层:
       这一步带的那一行在不在喜忌里 —— 而这一层必须【说清楚只有一层】，
       含糊地暗示算得更深比少说一层糟。 */
    #[test]
    fn 大运那一页说得出这一步是帮你还是拦你() {
        /* 1998 年生的人在 2026 年是 28 岁 —— 「现在这一步」是 20 岁那格，
           不是第一格。头一版把两格写成 10 / 20，断言就落在了下一格上。 */
        let 盘 = |步: &str, 下: &str| json!({
            "input": { "year": 1998, "month": 3, "day": 5 },
            "yongshen": { "primary_wuxing": "土", "avoid_wuxing": ["火", "木"] },
            "dayun": { "forward": false, "pillars": [
                { "ganzhi": "癸丑", "start_age": 10 },
                { "ganzhi": 步, "start_age": 20 },
                { "ganzhi": 下, "start_age": 30 }] },
        });
        // 戊 = 土 = 喜 → 顺手;丙 = 火 = 忌 → 费劲
        let 顺 = 排页(&盘("戊子", "丙午"), None, 日(2026, 8, 31));
        let 文 = 顺.iter().find(|x| x["key"] == "dayun").unwrap()["body"].as_str().unwrap();
        assert!(文.contains("正是你缺的那一样"), "带喜的那一步该说顺手：{文}");
        assert!(文.contains("会紧一些"), "下一步带忌，该预告紧一些：{文}");
        assert!(文.contains("这一册不做那一层"), "只做一层就要说清只做一层：{文}");

        let 逆 = 排页(&盘("丙午", "戊子"), None, 日(2026, 8, 31));
        let 文2 = 逆.iter().find(|x| x["key"] == "dayun").unwrap()["body"].as_str().unwrap();
        assert!(文2.contains("已经够多的那一样"), "带忌的那一步该说费劲：{文2}");

        // 【取不到用神就不编】—— 只留通则，不硬说这一步是好是坏
        let 无 = 排页(&json!({
            "input": { "year": 1998, "month": 3, "day": 5 },
            "dayun": { "forward": false, "pillars": [
                { "ganzhi": "癸丑", "start_age": 10 }, { "ganzhi": "戊子", "start_age": 20 }] },
        }), None, 日(2026, 8, 31));
        let 文3 = 无.iter().find(|x| x["key"] == "dayun").unwrap()["body"].as_str().unwrap();
        assert!(!文3.contains("只看这一步"),
                "没有用神就不该断这一步是帮你还是拦你：{文3}");
    }

    #[test]
    fn 说在前面报的页数就是实际页数() {
        let 全 = json!({
            "input": { "year": 1998, "month": 3, "day": 5 },
            "yongshen": { "primary_wuxing": "土", "avoid_wuxing": ["火"] },
            "pillars": [{"pillar": "年", "ganzhi": "戊寅"}],
            "day_master": { "stem": "辛" },
            "pattern": { "name": "正财格", "qi_stem": "甲", "qi_kind": "本气",
                         "revealed": true, "revealed_in": "月柱" },
            "dayun": { "forward": false, "pillars": [{"ganzhi": "癸丑", "start_age": 10}] },
            "three_houses": { "tai_yuan": "乙巳" },
        });
        for 盘 in [全.clone(), {
            // 同一张盘去掉格局 —— 页数少一，那句话得跟着少一
            let mut x = 全.clone();
            x.as_object_mut().unwrap().remove("pattern");
            x
        }] {
            let pages = 排页(&盘, None, 日(2026, 8, 31));
            let note = pages[0]["note"].as_str().unwrap().to_string();
            let 实际 = pages.len() - 1;
            let 汉 = 汉数(实际);
            assert!(note.contains(&format!("后面{}页", 汉)),
                "共 {} 页（正文 {} 页），第一页却说「{}」", pages.len(), 实际, note);
        }
    }

    #[test]
    fn 结论排在最前且不带术语() {
        let c = json!({
            "input": { "year": 1998, "month": 3, "day": 5 },
            "yongshen": { "primary_wuxing": "土", "primary_role": "印星",
                          "secondary_wuxing": "金", "secondary_role": "比劫",
                          "avoid_wuxing": ["火", "木"], "method": "扶抑",
                          "reasoning": "日主辛偏弱" },
            "dayun": { "forward": false, "pillars": [
                { "ganzhi": "癸丑", "start_age": 10 },
                { "ganzhi": "壬子", "start_age": 20 },
            ]},
        });
        let pages = 排页(&c, None, 日(2026, 8, 30));
        assert_eq!(pages[0]["key"], "lead", "结论不在第一页 = 买家翻开第一眼还是排盘表");

        let 页文 = pages[0].to_string();
        for 术语 in ["日主", "用神", "格局", "藏干", "纳音", "印星", "比劫"] {
            assert!(!页文.contains(术语),
                    "结论页上出现了术语「{术语}」—— 这一页要不用懂术数也读得完");
        }
        /* 干支也是术语。这条原先漏了它，于是「现在走到 20 岁起这十年（壬子）」
           一路过关 —— 一页里最后一个术语，偏偏落在承诺没有术语的那一页上。
           干支在大运那一页有，那里才是它的地方。 */
        for 干支 in ["癸丑", "壬子"] {
            assert!(!页文.contains(干支),
                    "结论页上出现了干支「{干支}」—— 那是大运那一页的东西");
        }
        /* 落款上不许有内部代号。「mingli-v0.1」对读的人没有意义，
           它只说明「这里有个我们内部的东西」。 */
        assert!(!页文.contains("mingli") && !页文.to_lowercase().contains("v0."),
                "结论页的落款露出了内部代号：{页文}");
        // 三件事都得说到：缺什么、够多的、走到哪一步
        assert!(页文.contains("你缺的") && 页文.contains("已经够多的")
                && 页文.contains("现在走到"), "结论页少了三件事之一：{页文}");
        // 而且要有那句人话 —— 只给三个字的结论等于还是没说人话
        assert!(页文.contains("把手上的事一件件做扎实"), "结论页没有那句人话：{页文}");
    }

    /// 格局那一页:那句出处正是下面两行拼起来的,拆得开就不摆原句。
    #[test]
    fn 格局拆得开就不摆那句原话() {
        let 拆 = |p: J| -> Vec<String> {
            let c = json!({ "input": { "year": 1998, "month": 3, "day": 5 }, "pattern": p });
            排页(&c, None, 日(2026, 8, 30))
                .into_iter()
                .find(|x| x["key"] == "pattern")
                .map(|x| x["rows"].as_array().unwrap().iter()
                        .map(|r| 串(r.get("k"))).collect())
                .unwrap_or_default()
        };

        // 月令有、也透干了 —— 两行说得清，原句就不再摆一遍
        assert_eq!(
            拆(json!({"name": "正财格", "source": "月令本气透干 月柱",
                      "qi_stem": "甲", "qi_kind": "本气",
                      "revealed": true, "revealed_in": "月柱"})),
            vec!["月令", "透干"],
            "拆得开的时候还摆着「取自」= 同一件事说了两遍",
        );

        // 没透干 —— 只剩一行，拆不全，那就留原句
        assert!(
            拆(json!({"name": "偏印格", "source": "月令藏干取用",
                      "qi_stem": "甲", "qi_kind": "本气", "revealed": false}))
                .contains(&"取自".to_string()),
            "拆不全的时候把出处也丢了 = 读的人不知道凭什么是这个格",
        );

        // 连月令都没有 —— 只有原句可给
        assert_eq!(
            拆(json!({"name": "从财格", "source": "全局从财", "revealed": false})),
            vec!["取自"],
        );
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
