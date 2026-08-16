//! 营销用例。

use sqlx::PgPool;
use unmei_domain::commerce::enums::PromotionStatus;
use unmei_domain::DomainError;

use crate::Actor;

/// 改促销活动状态。合法取值由 [`PromotionStatus`] 判定,
/// 不再在路由里手抄字符串白名单。
pub async fn set_status(
    pool: &PgPool,
    promotion_id: &str,
    status: &str,
    actor: &Actor,
) -> Result<PromotionStatus, DomainError> {
    let status = PromotionStatus::from_str_lax(status)
        .ok_or_else(|| DomainError::Validation(format!("unknown promotion status {status}")))?;

    let affected = sqlx::query(
        "UPDATE promotion SET status=$1, audit_note = audit_note || E'\\n' || $2 WHERE id=$3",
    )
    .bind(status.as_str())
    .bind(format!("{} → {}", actor.label(), status.as_str()))
    .bind(promotion_id)
    .execute(pool)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(DomainError::NotFound(format!("promotion {promotion_id}")));
    }
    Ok(status)
}
