//! /v1/village/* · 村子与不完人
//!
//! 第 10 步「四条动线」里后端要出的三条:
//!   - `GET  /v1/village`                    我的村子:住着谁、n/40、空屋
//!   - `POST /v1/villagers/:id/reading`      问签(三层)
//!   - `POST /v1/omamori/scan`               扫御守入住
//!
//! ## 算力层在这一层取,不在用例层取
//!
//! `unmei_app::villager::reading` 不认识 HTTP,也不该认识 —— 同 `payment::start`
//! 的分工。所以「他这门术数对应 mingli 的哪片叶、去要一盘」发生在这里,
//! 取到的盘原样传进用例层落档。
//!
//! 取不到盘就传 `None`,用例层如实落一个空盘。**不伪造成算过的样子** ——
//! 事后翻档案的人要能一眼看出这一签背后有没有真盘。

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration as ChronoDuration, Utc};
use serde::Deserialize;
use serde_json::{json, Value as J};
use sqlx::Row;
use unmei_app::{residency, villager};

use crate::auth::{ApiError, AuthedUser};
use crate::mingli::MingliClient;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/v1/village", get(my_village))
        .route("/v1/villagers", get(all_villagers))
        .route("/v1/villagers/:id/reading", post(ask_reading))
        .route("/v1/omamori/scan", post(scan))
}

/// 按 Asia/Shanghai 切日。问签一天一签,那个「一天」得跟用户看到的日历一致。
/// 「今天」——**写死东八区**。
///
/// 中国无夏令时，所以对 `cn` 恒成立。但这个产品是六 cell 的
/// （`cn / jp / kr / sea / na / zh_hant`），而 `RegionMeta` 里
/// **每个 cell 的 `tz` 都写着**（`Asia/Shanghai` / `Asia/Tokyo` / …）
/// —— **没有任何一处读它**（2026-08-18 查过）。
///
/// 后果是具体的：`jp` / `kr` 差 1 小时，`na` 差 13–16 小时 ——
/// 美洲用户的「今天」会在他【上午】翻页，于是「同一天问同一位、逐字相同」
/// 那条设定在他那里每天早上断一次。
///
/// 今天够不着：内容只有 `zh-CN`，小程序只发 `region=cn`。
/// 真开第二个 cell 时，这里要改成按用户 region 取 `meta().tz` 算本地日期
/// （后端还没有时区库，chrono-tz 之类要一起加）。
/// `workers/recon.rs` 里有同样一行 `+8`，改的时候两处一起。
fn today_shanghai() -> chrono::NaiveDate {
    (Utc::now() + ChronoDuration::hours(8)).date_naive()
}

// ─── 我的村子 ────────────────────────────────────────────────────

async fn my_village(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
) -> Result<Json<J>, ApiError> {
    let home = residency::village_of(&st.db, &c.sub).await?;

    // 连没找回的一起返回。**空屋不消失是世界观,不是待办** ——
    // 前端要能把空屋画出来、点得到、让它说「这间空着,等人」。
    let rows = sqlx::query(
        "SELECT v.id, v.name, v.title, v.art_key, a.name AS art_name, v.lack, v.rarity, \
                b.direction \
         FROM villager v \
         LEFT JOIN art a ON a.key = v.art_key \
         LEFT JOIN lack_bias b ON b.lack = v.lack \
         ORDER BY v.id",
    )
    .fetch_all(&st.db)
    .await?;

    /* 谁卖着东西（设计册 10.8：东西长在卖它的人身上）。
       **不在页面写死名单** —— 写死的话，第二个卖东西的人来了没人记得改那一处。
       排除御守：那不是「他卖的」，是「里面封着他」，而且它有自己的入口（扫开）。 */
    /* 一位村民卖着好几件时挑哪一件要【说得准】。DISTINCT 不定序，
       挑中哪一件全看行序 —— 那种不确定会在数据一变的时候悄悄换掉入口。
       按 sort_weight 高的先，同权重按 id，两条都定死。 */
    let sells_rows = sqlx::query(
        "SELECT DISTINCT ON (k.villager_id) k.villager_id, p.id AS product_id, p.name
           FROM sku k JOIN product p ON p.id = k.product_id
          WHERE k.villager_id IS NOT NULL AND k.status='active'
            AND p.status='listed' AND p.category <> 'omamori'
          ORDER BY k.villager_id, p.sort_weight DESC, p.id",
    )
    .fetch_all(&st.db)
    .await?;
    let sells: std::collections::HashMap<String, (String, String)> = sells_rows
        .iter()
        .map(|r| (r.get::<String, _>("villager_id"),
                  (r.get::<String, _>("product_id"), r.get::<String, _>("name"))))
        .collect();

    let all: Vec<J> = rows
        .iter()
        .map(|r| {
            let id: String = r.get("id");
            let at_home = home.iter().any(|h| *h == id);
            json!({
                "id": id,
                "name": r.get::<String, _>("name"),
                "title": r.get::<Option<String>, _>("title"),
                "art": r.get::<Option<String>, _>("art_name"),
                "lack": r.get::<String, _>("lack"),
                // 头像配色用它 —— 见名册那一处的说明
                "direction": r.get::<Option<String>, _>("direction"),
                "rarity": r.get::<Option<String>, _>("rarity"),
                "at_home": at_home,
                "sells": sells.get(&id).map(|(pid, name)| json!({
                    "product_id": pid, "name": name,
                })),
            })
        })
        .collect();

    /* 「该扫了」（设计册 E2）。手上有一枚已签收还没扫开的御守时，
       村子主屏上多一条 —— 只在该出现时出现，常驻的提示会被无视。
       不说是谁：还没请回来的人，名字都不该知道。 */
    let to_scan = residency::delivered_but_unscanned(&st.db, &c.sub).await?;

    /* 某位今天说的一句（设计册 V1）。主屏第一眼该是【有人在跟你打招呼】，
       不是一张地图加两个数。

       只从【住着的人】里选 —— 还没请回来的人连名字都不该知道
       （空屋那一屏照的也是这一条）。所以空村时它是 null，
       客户端据此不摆这一块:村里没人，谁都没法说话。

       「今天」是真的按天定：同一个人同一天进来看到的是同一句，
       换一天换一句。随机选的话刷新一次换一句，那就不是「今天说的」，
       是一台老虎机。 */
    // 「今天」从这里传进去,不在 `today_says` 里读时钟:读时钟的函数
    // 没法钉住「同一天同一句、换一天换一句」——测试只能在它算出来的那天成立。
    // 日期按上海时区 ——「今天」是用户的今天,差八小时的话晚上八点就换一句
    let day = (chrono::Utc::now() + chrono::Duration::hours(8))
        .format("%Y-%m-%d").to_string();
    let says = today_says(&st.db, &c.sub, &home, &day).await?;

    Ok(Json(json!({
        "found": home.len(),
        "total": all.len(),
        "villagers": all,
        "today_says": says,
        "to_scan": to_scan.map(|(order_id, delivered_at)| json!({
            "order_id": order_id,
            "delivered_at": delivered_at,
        })),
    })))
}

/// 图鉴:不带住没住,给未登录的人看。
/// 按天定的选择种子。**不用标准库的 Hasher** —— `DefaultHasher` 的算法
/// 不保证跨版本稳定，那意味着升一次工具链，所有人「今天说的话」会集体换一句。
/// FNV-1a 写死在这儿，行为跟编译器无关。
fn 日种(user_id: &str, day: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in user_id.bytes().chain(b"@".iter().copied()).chain(day.bytes()) {
        h ^= b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    h
}

/// 今天由谁说、说他的第几句 —— 返回 `候选` 里的下标。
///
/// `候选` 是 (谁, 行下标)，按 (谁, 第几句) 排好序。
///
/// **先定人再定句**：同一天里又请回来一位，别人正说着的那句不该跟着变。
/// 挑句子用的种子是【那个人】而不是用户 —— 否则同一天里换个人住进来，
/// 原来那位说的话也会跟着换。
fn 挑一句(候选: &[(&str, usize)], user_id: &str, day: &str) -> usize {
    let mut 谁们: Vec<&str> = 候选.iter().map(|(w, _)| *w).collect();
    谁们.dedup();
    let 谁 = 谁们[(日种(user_id, day) % 谁们.len() as u64) as usize];
    let 他的: Vec<usize> = 候选.iter().filter(|(w, _)| *w == 谁).map(|(_, i)| *i).collect();
    他的[(日种(谁, day) % 他的.len() as u64) as usize]
}

/// 住着的人里，今天由谁说、说哪一句。
///
/// 村里没人、或住着的人都还没写话 → `None`，客户端不摆这一块。
/// **不拿没住进来的人顶上**：那等于提前告诉你还没请回来的是谁。
async fn today_says(
    db: &sqlx::PgPool,
    user_id: &str,
    home: &[String],
    day: &str,
) -> Result<J, ApiError> {
    if home.is_empty() {
        return Ok(J::Null);
    }

    let rows = sqlx::query(
        r#"SELECT l.villager_id, l.seq, l.text, v.name, v.title, a.name AS art_name,
                  b.direction
             FROM villager_line l
             JOIN villager v ON v.id = l.villager_id
             LEFT JOIN art a ON a.key = v.art_key
             LEFT JOIN lack_bias b ON b.lack = v.lack
            WHERE l.villager_id = ANY($1)
            ORDER BY l.villager_id, l.seq"#,
    )
    .bind(home)
    .fetch_all(db)
    .await?;
    if rows.is_empty() {
        return Ok(J::Null);
    }

    let 候选: Vec<(&str, usize)> = rows.iter().enumerate()
        .map(|(i, r)| (r.get::<&str, _>("villager_id"), i)).collect();
    let r = &rows[挑一句(&候选, user_id, &day)];

    Ok(json!({
        "villager_id": r.get::<String, _>("villager_id"),
        "direction": r.get::<Option<String>, _>("direction"),
        "name": r.get::<String, _>("name"),
        "title": r.get::<Option<String>, _>("title"),
        "art": r.get::<Option<String>, _>("art_name"),
        "text": r.get::<String, _>("text"),
    }))
}

#[derive(serde::Deserialize)]
struct 名册参数 {
    /// 按谁的用神排。传五行单字（木火土金水）；不传就按原来的规矩排
    #[serde(default)]
    r#for: Option<String>,
}

async fn all_villagers(
    State(st): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<名册参数>,
) -> Result<Json<J>, ApiError> {
    let rows = sqlx::query(
        "SELECT v.id, v.name, v.title, a.name AS art_name, v.rarity, v.lack, b.direction \
         FROM villager v \
         LEFT JOIN art a ON a.key = v.art_key \
         LEFT JOIN lack_bias b ON b.lack = v.lack \
         ORDER BY v.id",
    )
    .fetch_all(&st.db)
    .await?;

    /* 「你缺 X，下面这几位跟你补得上」—— 这句话得【真的】排过才说得出口。
       在这之前它是假的:那一页顶上写着它,而排序只按「在卖的排前面、
       然后按 id」,跟用神一点关系都没有（设计册 10.8:不下没有来源的断言）。

       两头本来就接得上:
         `lack_bias`      村民缺什么 → 他反过来劝你哪个方向
         `yongshen_bias`  你的用神   → 你需要哪个方向
       中间那张表 2026-08-30 才补上。 */
    let 想要的: std::collections::HashMap<String, (i16, String)> = match q.r#for.as_deref() {
        Some(w) if !w.is_empty() => sqlx::query(
            "SELECT direction, rank, note FROM yongshen_bias WHERE wuxing = $1",
        )
        .bind(w)
        .fetch_all(&st.db)
        .await?
        .iter()
        .map(|r| (r.get::<String, _>("direction"),
                  (r.get::<i16, _>("rank"), r.get::<String, _>("note"))))
        .collect(),
        _ => Default::default(),
    };

    /* 哪一位的御守【真的在卖】。设计册 10.8 那条：
       「没上架的也列出来，写『未上架』—— 四十位里只有四位在卖，
        照实说，不拿别人顶上」。
       只列在卖的那几位，读的人会以为世上只有那几位；那是拿别人顶上。

       跟「我的村子」那一条的分别在【作用域】：你村里没请回来的那一格
       不说是谁（空屋那一屏），因为那是你的村子；而这是目录，
       四十位是公开的事实（设计册 11：官网放四十位档案）。 */
    let 在卖: std::collections::HashMap<String, String> = sqlx::query(
        "SELECT DISTINCT ON (k.villager_id) k.villager_id, p.id AS product_id \
         FROM sku k JOIN product p ON p.id = k.product_id \
         WHERE k.villager_id IS NOT NULL AND k.status='active' \
           AND p.status='listed' AND p.category = 'omamori' \
         ORDER BY k.villager_id, p.sort_weight DESC, p.id",
    )
    .fetch_all(&st.db)
    .await?
    .iter()
    .map(|r| (r.get::<String, _>("villager_id"), r.get::<String, _>("product_id")))
    .collect();

    let mut out: Vec<(i16, u8, String, J)> = rows
        .iter()
        .map(|r| {
            let id: String = r.get("id");
            let pid = 在卖.get(&id).cloned();
            let dir: Option<String> = r.get("direction");
            // 主(1) 次(2) 其余(9)。没传用神时全是 9，排序就退回原来的规矩
            let (名次, 为什么) = dir
                .as_ref()
                .and_then(|d| 想要的.get(d))
                .map(|(n, note)| (*n, Some(note.clone())))
                .unwrap_or((9, None));
            (名次,
             if pid.is_some() { 0 } else { 1 },   // 在卖的排前面（原来的规矩）
             id.clone(),
             json!({
                "id": id,
                "name": r.get::<String, _>("name"),
                "title": r.get::<Option<String>, _>("title"),
                "art": r.get::<Option<String>, _>("art_name"),
                "rarity": r.get::<Option<String>, _>("rarity"),
                // 有就是那件商品的 id；没有就是 null —— 客户端据此写「未上架」
                "omamori_product_id": pid,
                "lack": r.get::<String, _>("lack"),
                /* 他往哪个方向劝你（`lack_bias`）。客户端拿它给头像配色 ——
                   四十位共用一个琥珀圆牌时，一眼分不出谁是谁，
                   而这个字段本来就带着语义:同一路人是同一个色。 */
                "direction": dir,
                /* 为什么这一位排在前面。**没排过就是 null** ——
                   客户端据此决定说不说那句「跟你补得上」，
                   而不是不管三七二十一都说一遍。 */
                "why": 为什么,
             }))
        })
        .collect();
    // 主 → 次 → 在卖 → id。每一层都定死,不留「看行序」的余地
    out.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)).then(a.2.cmp(&b.2)));

    Ok(Json(json!(out.into_iter().map(|(_, _, _, v)| v).collect::<Vec<_>>())))
}

// ─── 问签 ────────────────────────────────────────────────────────

async fn ask_reading(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Path(villager_id): Path<String>,
) -> Result<Json<J>, ApiError> {
    // 没请回家的不完人不给你看命。这不是权限检查,是设定:
    // 御守是入住凭证,他得先住进你的村子。
    if !residency::is_home(&st.db, &c.sub, &villager_id).await? {
        return Err(ApiError::not_found(format!(
            "{villager_id} 还没住进你的村子"
        )));
    }

    let chart = fetch_chart(&st, &c.sub, &villager_id).await;
    let r = villager::reading(&st.db, &c.sub, &villager_id, today_shanghai(), chart).await?;

    Ok(Json(json!({
        "villager_id": r.villager_id,
        "villager_name": r.villager_name,
        "art": r.art_key,
        "lack": r.lack,
        "verdict": r.verdict,
        "suit": r.suit,
        "avoid": r.avoid,
        "say": r.say,
    })))
}

/// 算力层:他这门术数有对应的 mingli 叶就去要一盘。
///
/// 拿不到就返回 `None` —— 上游挂了不该让问签整条挂掉(他还是会说话,
/// 只是这一签背后没有真盘),但也**不能假装算过**:落档时空盘就是空盘。
async fn fetch_chart(st: &AppState, user_id: &str, villager_id: &str) -> Option<J> {
    let leaf: Option<String> = sqlx::query_scalar(
        "SELECT a.mingli_leaf FROM villager v JOIN art a ON a.key = v.art_key WHERE v.id = $1",
    )
    .bind(villager_id)
    .fetch_optional(&st.db)
    .await
    .ok()
    .flatten()?;
    // 这一列可空。没配叶就没得算 —— 旧代码把 None 直接序列化成 null 发上去了
    let leaf = leaf?;

    /* 用户的本命盘参数。没建过本命就没得算 —— 同样如实返回 None。

       取的是【生辰本身】,不是 natal_id:mingli 的 /api/cast 要 year/month/day/
       hour/minute/tz(+gender),不认 natal_id。以前发的是 natal_id,
       于是它每次都 422,而这边把 422 当成「上游不可用」记一行 warn 就过去了 ——
       日志写着「取不到盘」,读起来像是运维问题,所以这条一直没人查。
       实际后果是【每一签都是空盘】,而那是产品的核心那一件事。 */
    let row: Option<(i32, i32, i32, i32, i32, f64, Option<String>)> = sqlx::query_as(
        r#"SELECT n.year, n.month, n.day, n.hour, n.minute, n.tz, n.gender
             FROM app_user u JOIN natal n ON n.id = u.active_natal_id
            WHERE u.id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(&st.db)
    .await
    .ok()
    .flatten();
    let (y, mo, d, h, mi, tz, gender) = row?;

    match MingliClient::new(st)
        .cast(&crate::mingli::cast_body(&leaf, y, mo, d, h, mi, tz, gender.as_deref()))
        .await
    {
        Ok(v) => Some(v),
        Err(e) => {
            // 上游不可用是运维问题,不该表现成「这位不完人今天不说话」。
            // 记一行,继续出签,档案里那一栏是空的 —— 一眼看得出。
            tracing::warn!(villager_id, leaf, "取不到盘，这一签落空盘：{}", e.0);
            None
        }
    }
}

// ─── 扫御守 ──────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ScanBody {
    /// nfc / qr / chain / manual
    carrier: String,
    /// NFC UID、QR 序列号……载体不同,这里的东西不同,身份记录是同一条
    credential: String,
}

async fn scan(
    State(st): State<AppState>,
    AuthedUser(c): AuthedUser,
    Json(b): Json<ScanBody>,
) -> Result<Json<J>, ApiError> {
    let out = residency::move_in_from_credential(&st.db, &c.sub, &b.carrier, &b.credential).await?;
    let vid = out.villager_id().to_string();

    /* 方向也一起给 —— 「他住进来了」那一屏要用它上色。
       让那一屏自己再去要一次的话,脸会先按默认的琥珀渲出来、
       两百毫秒后才换成他自己的颜色,而那一下正落在光晕炸开的当口。
       一个人的颜色在四处要一样(名册 / 村子 / 他的主页 / 搬进来那一刻),
       不然颜色就不是在指人,只是在装饰。 */
    let r = sqlx::query(
        "SELECT v.name, b.direction FROM villager v \
           LEFT JOIN lack_bias b ON b.lack = v.lack \
          WHERE v.id = $1",
    )
    .bind(&vid)
    .fetch_optional(&st.db)
    .await?;
    let name: Option<String> = r.as_ref().map(|x| x.get("name"));
    let direction: Option<String> = r.as_ref().and_then(|x| x.get("direction"));

    Ok(Json(json!({
        "villager_id": vid,
        "villager_name": name,
        "direction": direction,
        // 重复扫不是错误,但界面要说得不一样:
        // 第一次是「他住进来了」,第二次是「他早就在了」
        "moved_in": out.is_new(),
    })))
}


#[cfg(test)]
mod tests {
    use super::*;

    /// 四个人各三句，跟真数据一个形状
    fn 候选() -> Vec<(&'static str, usize)> {
        let mut v = vec![];
        for (n, who) in ["ayun", "popo", "shenyan", "tenz"].iter().enumerate() {
            for j in 0..3 {
                v.push((*who, n * 3 + j));
            }
        }
        v
    }

    #[test]
    fn 同一天同一个人说的是同一句() {
        let c = 候选();
        let a = 挑一句(&c, "u_1", "2026-08-29");
        for _ in 0..20 {
            assert_eq!(挑一句(&c, "u_1", "2026-08-29"), a,
                       "同一天同一个人应当每次都拿到同一句 —— 否则刷新一下就换一句，那是老虎机");
        }
    }

    #[test]
    fn 换一天会换() {
        let c = 候选();
        let 一个月: std::collections::HashSet<usize> = (1..=30)
            .map(|d| 挑一句(&c, "u_1", &format!("2026-09-{d:02}")))
            .collect();
        // 十二句里一个月至少该听到几句不同的。全都一样 = 日期没参与
        assert!(一个月.len() >= 4, "一个月只听到 {} 句 —— 日期没起作用？", 一个月.len());
    }

    #[test]
    fn 不同的人听到的不都一样() {
        let c = 候选();
        let 一天: std::collections::HashSet<usize> = (0..40)
            .map(|i| 挑一句(&c, &format!("u_{i}"), "2026-08-29"))
            .collect();
        assert!(一天.len() >= 4, "四十个人只分出 {} 种 —— 用户没参与？", 一天.len());
    }

    #[test]
    fn 只有一个人住着时也说得出话() {
        let 一个人: Vec<(&str, usize)> = vec![("popo", 0), ("popo", 1)];
        let i = 挑一句(&一个人, "u_1", "2026-08-29");
        assert!(i < 2);
    }
}
