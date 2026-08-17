//! 不完人问签 —— 那吉逻辑的三层推广。
//!
//! 「一个不完人 = 一门术数 = 一种解读你的方式。术数会重叠：两个人可以同修一门，
//! 但缺的东西不同，说出来的话就不同。」这三层就是那句话的实现:
//!
//! 1. **算力层** — 他的术数 → mingli 的叶 → 真盘。盘由调用方取好传进来
//!    (本层不认 HTTP,同 `payment::start` 的分工),原样落档留审计。
//! 2. **偏向层** — 他的**缺** → 把中性结论按方向重排。缺勤的阿云偏「该动了」,
//!    缺静的丹增偏「该停了」。同一盘,不同的人看出不同的意思 —— 差别全在这一层。
//! 3. **声音层** — 他的说话风格 → 同一个结论,阿云慢半拍带「贫道」,白鹭三五个字说完。
//!
//! seed = hash(user_id, villager_id, 当天)。同一个人问同一位不完人,一天之内
//! 逐字相同;换个人问、或者换个不完人、或者到了第二天,就是另一签。
//!
//! ## 为什么不给没写模板的村民兜底
//!
//! 40 位里现在只有 7 位有说话模板。缺模板的直接报错,不拿别人的口气搪塞 ——
//! 说话方式是这个角色最要紧的部分,借一个来用等于把他演成别人。
//! 模板该跟他那间房一起做、一起验收。

use chrono::NaiveDate;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use unmei_domain::DomainError;

use crate::new_id;
use crate::DbResultExt;

/// 一签。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Reading {
    pub id: String,
    pub villager_id: String,
    pub villager_name: String,
    pub art_key: Option<String>,
    pub lack: String,
    /// 偏向层给出的结论(中性池里被这个「缺」顶上来的那条)
    pub verdict: String,
    pub suit: Vec<String>,
    pub avoid: Vec<String>,
    /// 声音层说出来的整句
    pub say: String,
    pub seed: i64,
}

/// 中性结论池。七个方向,每个方向几种说法 —— 只有一种说法的话,
/// 同方向的两位不完人会说得一模一样,而他们本该只是**倾向**相同。
const VERDICTS: &[(&str, &[&str])] = &[
    ("move",   &["该动了", "别再等了", "起身的时候到了"]),
    ("still",  &["该停了", "先歇一歇", "停下来才看得清"]),
    ("keep",   &["守住就好", "别松手", "原地站稳"]),
    ("let_go", &["该放下了", "松开手吧", "别攥着了"]),
    ("ask",    &["去问清楚", "把话摊开", "别自己猜"]),
    ("near",   &["去找个人说说", "别一个人待着", "往人多的地方去"]),
    ("wait",   &["再等等", "时候没到", "缓一缓"]),
];

/// seed = hash(user_id, villager_id, 当天)。
///
/// 取 sha256 前 8 字节。用加法或者字符串拼接哈希都会让「换个村民」只挪动
/// 几个 bit,相邻的 seed 从同一个池子里挑出来的往往是同一条 —— 那就没有
/// 「换个村民就换个答案」了。
pub fn seed_of(user_id: &str, villager_id: &str, on: NaiveDate) -> i64 {
    let mut h = Sha256::new();
    h.update(user_id.as_bytes());
    h.update(b"\x00");
    h.update(villager_id.as_bytes());
    h.update(b"\x00");
    h.update(on.to_string().as_bytes());
    let d = h.finalize();
    let mut b = [0u8; 8];
    b.copy_from_slice(&d[..8]);
    (u64::from_be_bytes(b) >> 1) as i64 // 右移一位,留在正数区
}

/// 从池里按 seed 精确取一个(不是随机 —— 同样的 seed 永远取到同一个)。
fn pick<'a, T>(pool: &'a [T], seed: i64, salt: u64) -> &'a T {
    let mut h = Sha256::new();
    h.update(seed.to_be_bytes());
    h.update(salt.to_be_bytes());
    let d = h.finalize();
    let n = u64::from_be_bytes(d[..8].try_into().expect("8 bytes"));
    &pool[(n % pool.len() as u64) as usize]
}

/// 给一位用户、一位不完人、一天,出一签。
///
/// `chart` 是算力层的产物,由调用方(路由)向 mingli 取好传进来。
/// 传 `None` 表示这门术数还没接上算力 —— 那就如实落一个空盘,
/// **不假装算过**:事后翻档案的人要能一眼看出这一签背后有没有真盘。
pub async fn reading(
    pool: &PgPool,
    user_id: &str,
    villager_id: &str,
    on: NaiveDate,
    chart: Option<Value>,
) -> Result<Reading, DomainError> {
    // 已经问过就原样还回去。同一天同一位不完人只有一签 —— 这不是缓存,
    // 是设定:今天他已经说过了。
    if let Some(existing) = fetch(pool, user_id, villager_id, on).await? {
        return Ok(existing);
    }

    let v = sqlx::query(
        "SELECT v.name, v.art_key, v.lack, b.direction, \
                vv.opener, vv.closer, vv.joiner \
         FROM villager v \
         LEFT JOIN lack_bias b ON b.lack = v.lack \
         LEFT JOIN villager_voice vv ON vv.villager_id = v.id \
         WHERE v.id = $1",
    )
    .bind(villager_id)
    .fetch_optional(pool)
    .await
    .db()?
    .ok_or_else(|| DomainError::NotFound(format!("没有这位不完人:{villager_id}")))?;

    let name: String = v.get("name");
    let art_key: Option<String> = v.get("art_key");
    let lack: String = v.get("lack");
    let direction: Option<String> = v.get("direction");
    let opener: Option<String> = v.get("opener");
    let closer: Option<String> = v.get("closer");
    let joiner: Option<String> = v.get("joiner");

    let direction = direction.ok_or_else(|| {
        DomainError::Validation(format!("「缺{lack}」还没定偏向,见 seed/lack_bias.sql"))
    })?;
    // 没模板不兜底 —— 借别人的口气说话等于把他演成别人
    let (Some(opener), Some(closer), Some(joiner)) = (opener, closer, joiner) else {
        return Err(DomainError::Validation(format!(
            "{name}({villager_id})还没有说话模板,不能问签。模板跟他那间房一起做,见 seed/villager_voice.sql"
        )));
    };

    let seed = seed_of(user_id, villager_id, on);

    // ── 偏向层:缺决定方向,seed 在该方向的几种说法里挑一句
    let says = VERDICTS
        .iter()
        .find(|(d, _)| *d == direction)
        .map(|(_, s)| *s)
        .ok_or_else(|| DomainError::Validation(format!("未知偏向 {direction}")))?;
    let verdict = (*pick(says, seed, 1)).to_string();

    // 宜忌取现成的词池(naji 也用它),按 seed 各挑两个,不重复
    let suit = pick_words(pool, "yi", seed, 2).await?;
    let avoid = pick_words(pool, "ji", seed, 1).await?;

    // ── 声音层:同一个结论,不同的人说出来不一样
    let say = format!(
        "{opener}{verdict}{joiner}宜{}，忌{}{closer}",
        suit.join("、"),
        avoid.join("、"),
    );

    let id = new_id("vr");
    // ON CONFLICT:两个请求同时问同一签时,后到的那个读回先到的那条,
    // 而不是撞唯一约束报错。同一天只有一签是设定,并发不该让它变成错误。
    let inserted = sqlx::query(
        "INSERT INTO villager_reading \
           (id, user_id, villager_id, asked_on, art_key, chart_json, lack, verdict, \
            suit_words, avoid_words, say, seed) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) \
         ON CONFLICT (user_id, villager_id, asked_on) DO NOTHING \
         RETURNING id",
    )
    .bind(&id)
    .bind(user_id)
    .bind(villager_id)
    .bind(on)
    .bind(&art_key)
    .bind(chart.unwrap_or(Value::Null))
    .bind(&lack)
    .bind(&verdict)
    .bind(json!(suit))
    .bind(json!(avoid))
    .bind(&say)
    .bind(seed)
    .fetch_optional(pool)
    .await
    .db()?;

    if inserted.is_none() {
        return fetch(pool, user_id, villager_id, on)
            .await?
            .ok_or_else(|| DomainError::Repository("并发写入后读不回那一签".into()));
    }

    Ok(Reading {
        id,
        villager_id: villager_id.to_string(),
        villager_name: name,
        art_key,
        lack,
        verdict,
        suit,
        avoid,
        say,
        seed,
    })
}

async fn fetch(
    pool: &PgPool,
    user_id: &str,
    villager_id: &str,
    on: NaiveDate,
) -> Result<Option<Reading>, DomainError> {
    let row = sqlx::query(
        "SELECT r.id, r.art_key, r.lack, r.verdict, r.suit_words, r.avoid_words, r.say, r.seed, \
                v.name \
         FROM villager_reading r JOIN villager v ON v.id = r.villager_id \
         WHERE r.user_id = $1 AND r.villager_id = $2 AND r.asked_on = $3",
    )
    .bind(user_id)
    .bind(villager_id)
    .bind(on)
    .fetch_optional(pool)
    .await
    .db()?;

    Ok(row.map(|r| Reading {
        id: r.get("id"),
        villager_id: villager_id.to_string(),
        villager_name: r.get("name"),
        art_key: r.get("art_key"),
        lack: r.get("lack"),
        verdict: r.get("verdict"),
        suit: serde_json::from_value(r.get("suit_words")).unwrap_or_default(),
        avoid: serde_json::from_value(r.get("avoid_words")).unwrap_or_default(),
        say: r.get("say"),
        seed: r.get("seed"),
    }))
}

/// 从 `yiji_word` 池里按 seed 取 n 个不重复的词。
async fn pick_words(pool: &PgPool, kind: &str, seed: i64, n: usize) -> Result<Vec<String>, DomainError> {
    // 按 word 排序取回,让池的顺序与库的物理顺序无关 —— 否则同一个 seed
    // 在 VACUUM 之后可能挑出不同的词,那就不叫确定了。
    let words: Vec<String> = sqlx::query_scalar(
        "SELECT word FROM yiji_word WHERE type = $1 AND status = 'published' ORDER BY word",
    )
    .bind(kind)
    .fetch_all(pool)
    .await
    .db()?;
    if words.is_empty() {
        return Err(DomainError::Repository(format!("yiji_word 里没有 {kind} 词")));
    }
    let mut out: Vec<String> = Vec::with_capacity(n);
    let mut salt = 100u64;
    while out.len() < n && out.len() < words.len() {
        let w = pick(&words, seed, salt);
        if !out.contains(w) {
            out.push(w.clone());
        }
        salt += 1;
    }
    Ok(out)
}
