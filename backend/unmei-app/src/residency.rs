//! 入住 —— 御守把一位不完人送进你的村子。
//!
//! 「每个不完人把自己的一部分封进一枚御守,散落人间。谁拾到、唤醒它,
//!  谁就是他的村长 —— 他从此住进你的村子。」
//!
//! 两条路进同一张表:
//!   - **买**:御守类 SKU 支付成功 → `OrderPaid` → 履约调 [`move_in_from_line`]
//!   - **扫**:NFC / QR 碰一下 → [`move_in_from_credential`]
//!
//! 载体与身份是分开的(见 `archive/omamori-research/01-architecture.md`):
//! NFC 的 UID、QR 的序列号、将来链上的 token id,都只是指向同一条御守身份的凭证。
//! 换载体 = 换一个 Adapter,这一层一个字都不用动。
//!
//! ## 重复不该变成多一个人
//!
//! 同一枚御守扫十次、同一个 `OrderPaid` 事件重推十次,村里还是多一个人。
//! 靠 `UNIQUE (user_id, villager_id)` + `ON CONFLICT DO NOTHING` 兜住 ——
//! 不是靠调用方记得先查一次。

use sqlx::{PgPool, Postgres, Row, Transaction};
use unmei_domain::DomainError;

use crate::new_id;
use crate::DbResultExt;

/// 入住的结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MoveIn {
    /// 村里多了一位
    MovedIn { residency_id: String, villager_id: String },
    /// 他早就住下了。重复扫、重复推事件都会走到这里 —— 不是错误。
    AlreadyHome { villager_id: String },
}

impl MoveIn {
    pub fn villager_id(&self) -> &str {
        match self {
            MoveIn::MovedIn { villager_id, .. } | MoveIn::AlreadyHome { villager_id } => villager_id,
        }
    }
    pub fn is_new(&self) -> bool {
        matches!(self, MoveIn::MovedIn { .. })
    }
}

/// 扫一枚御守(NFC / QR / …)。
pub async fn move_in_from_credential(
    pool: &PgPool,
    user_id: &str,
    carrier_kind: &str,
    credential: &str,
) -> Result<MoveIn, DomainError> {
    let row = sqlx::query(
        "SELECT o.id AS omamori_id, o.villager_id, c.revoked_at \
         FROM omamori_credential c JOIN omamori o ON o.id = c.omamori_id \
         WHERE c.carrier_kind = $1 AND c.credential = $2",
    )
    .bind(carrier_kind)
    .bind(credential)
    .fetch_optional(pool)
    .await
    .db()?
    .ok_or_else(|| DomainError::NotFound(format!("没有这枚御守:{carrier_kind}/{credential}")))?;

    if row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("revoked_at").is_some() {
        return Err(DomainError::Validation("这枚御守的凭证已作废".into()));
    }

    let omamori_id: String = row.get("omamori_id");
    let villager_id: String = row.get("villager_id");
    let mut tx = pool.begin().await.db()?;
    let out = insert_residency(&mut tx, user_id, &villager_id, Some(&omamori_id), "scan", Some(credential)).await?;
    tx.commit().await.db()?;
    Ok(out)
}

/// 买来的:履约在 `OrderPaid` 之后调这一条。
///
/// 在调用方的事务里跑 —— 入住与「这一行履约完成」必须同批提交,
/// 否则会出现「行标了 done 但人没住进来」这种没人会去查的状态。
pub async fn move_in_from_line(
    tx: &mut Transaction<'_, Postgres>,
    user_id: &str,
    villager_id: &str,
    order_line_id: &str,
) -> Result<MoveIn, DomainError> {
    insert_residency(tx, user_id, villager_id, None, "purchase", Some(order_line_id)).await
}

async fn insert_residency(
    tx: &mut Transaction<'_, Postgres>,
    user_id: &str,
    villager_id: &str,
    omamori_id: Option<&str>,
    source_kind: &str,
    source_ref: Option<&str>,
) -> Result<MoveIn, DomainError> {
    let id = new_id("res");
    // RETURNING 配 DO NOTHING:插进去了才有行回来。
    // 没有它就只能先 SELECT 再 INSERT,而那中间有一道并发的缝。
    let inserted: Option<String> = sqlx::query_scalar(
        "INSERT INTO villager_residency \
           (id, user_id, villager_id, omamori_id, source_kind, source_ref) \
         VALUES ($1,$2,$3,$4,$5,$6) \
         ON CONFLICT (user_id, villager_id) DO NOTHING \
         RETURNING id",
    )
    .bind(&id)
    .bind(user_id)
    .bind(villager_id)
    .bind(omamori_id)
    .bind(source_kind)
    .bind(source_ref)
    .fetch_optional(&mut **tx)
    .await
    .db()?;

    Ok(match inserted {
        Some(rid) => MoveIn::MovedIn { residency_id: rid, villager_id: villager_id.to_string() },
        None => MoveIn::AlreadyHome { villager_id: villager_id.to_string() },
    })
}

/// 这位用户的村子里住着谁。
pub async fn village_of(pool: &PgPool, user_id: &str) -> Result<Vec<String>, DomainError> {
    sqlx::query_scalar(
        "SELECT villager_id FROM villager_residency WHERE user_id = $1 ORDER BY moved_in_at",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .db()
}

/// 他住进来了吗。问签前要问这一句 —— 没请回家的不完人不给你看命。
pub async fn is_home(pool: &PgPool, user_id: &str, villager_id: &str) -> Result<bool, DomainError> {
    let n: Option<String> = sqlx::query_scalar(
        "SELECT id FROM villager_residency WHERE user_id = $1 AND villager_id = $2",
    )
    .bind(user_id)
    .bind(villager_id)
    .fetch_optional(pool)
    .await
    .db()?;
    Ok(n.is_some())
}
