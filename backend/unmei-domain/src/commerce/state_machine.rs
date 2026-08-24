//! 各域 status 转移表 + 校验工具。
//!
//! 所有写操作必须 `assert_can_transition(from, to)?` 通过后才允许;
//! 否则返回 [`crate::DomainError::IllegalStateTransition`]。

use super::enums::*;
use crate::DomainError;

/// 通用转移校验工具。
pub trait StateTransition: Copy + PartialEq + Sized + std::fmt::Display + 'static {
    fn allowed_next(self) -> &'static [Self];
    fn can_transition_to(self, next: Self) -> bool {
        self == next || self.allowed_next().contains(&next)
    }
    fn assert_transition(self, next: Self) -> Result<(), DomainError> {
        if self.can_transition_to(next) {
            Ok(())
        } else {
            Err(DomainError::IllegalStateTransition {
                from: self.to_string(),
                to: next.to_string(),
            })
        }
    }
}

// ═══════════════════════════════ Order ══════════════════════════════
impl StateTransition for OrderStatus {
    fn allowed_next(self) -> &'static [Self] {
        use OrderStatus::*;
        match self {
            Draft         => &[Unpaid, Cancelled],
            Unpaid        => &[Paid, Cancelled],
            Paid          => &[Fulfilling, Done, RefundPartial, Refunded, Disputed],
            Fulfilling    => &[Done, RefundPartial, Refunded, Disputed],
            Done          => &[RefundPartial, Refunded, Disputed],
            Cancelled     => &[],
            RefundPartial => &[Refunded, Disputed],
            Refunded      => &[Disputed],
            Disputed      => &[Paid, Done, RefundPartial, Refunded],
        }
    }
}

// ═══════════════════════════════ Payment ══════════════════════════════
impl StateTransition for PaymentStatus {
    fn allowed_next(self) -> &'static [Self] {
        use PaymentStatus::*;
        match self {
            Pending         => &[Processing, Success, Failed, Expired, Cancelling],
            Processing      => &[Success, Failed, Expired],
            Success         => &[Refunding, Disputed],
            Failed          => &[],
            Expired         => &[],
            // 渠道竞态:取消请求中可能已经被付掉
            Cancelling      => &[Cancelled, Success],
            Cancelled       => &[],
            Refunding       => &[Refunded, RefundedPartial, Failed],
            RefundedPartial => &[Refunding, Refunded],
            Refunded        => &[Disputed],
            Disputed        => &[Success, Refunded, RefundedPartial],
        }
    }
}

// ═══════════════════════════════ Refund ══════════════════════════════
impl StateTransition for RefundStatus {
    fn allowed_next(self) -> &'static [Self] {
        use RefundStatus::*;
        match self {
            Requested  => &[Approved, Cancelled],
            Approved   => &[Processing, Cancelled],
            Processing => &[Success, Failed],
            Success    => &[],
            Failed     => &[Approved], // 重试
            Cancelled  => &[],
        }
    }
}

// ═══════════════════════════════ Shipment ══════════════════════════════
impl StateTransition for ShipmentStatus {
    fn allowed_next(self) -> &'static [Self] {
        use ShipmentStatus::*;
        match self {
            Preparing      => &[PickedUp, Cancelled],
            PickedUp       => &[InTransit, Exception],
            InTransit      => &[OutForDelivery, Exception, Returning, Delivered],
            OutForDelivery => &[Delivered, Exception, Returning],
            Delivered      => &[Returning],
            Exception      => &[InTransit, Returning, Cancelled],
            Returning      => &[Returned, Exception],
            Returned       => &[],
            Cancelled      => &[],
        }
    }
}

// ═══════════════════════════════ Subscription ══════════════════════════════
impl StateTransition for SubscriptionStatus {
    fn allowed_next(self) -> &'static [Self] {
        use SubscriptionStatus::*;
        match self {
            Trialing  => &[Active, Cancelled, Expired],
            Active    => &[PastDue, Cancelled, Paused],
            PastDue   => &[Active, Grace, Cancelled],
            Grace     => &[Active, Expired, Cancelled],
            Paused    => &[Active, Cancelled],
            Cancelled => &[Expired],
            Expired   => &[],
        }
    }
}

// ═══════════════════════════════ Invoice ══════════════════════════════
impl StateTransition for InvoiceStatus {
    fn allowed_next(self) -> &'static [Self] {
        use InvoiceStatus::*;
        match self {
            Open          => &[Paid, Uncollectible, Void],
            Paid          => &[],
            Uncollectible => &[Open, Void],
            Void          => &[],
        }
    }
}

// ═══════════════════════════════ Coupon ══════════════════════════════
impl StateTransition for CouponState {
    fn allowed_next(self) -> &'static [Self] {
        use CouponState::*;
        match self {
            Issued   => &[Locked, Expired, Revoked],
            Locked   => &[Redeemed, Issued, Revoked],
            Redeemed => &[],
            Expired  => &[],
            Revoked  => &[],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn order_normal_flow() {
        assert!(OrderStatus::Unpaid.can_transition_to(OrderStatus::Paid));
        assert!(OrderStatus::Paid.can_transition_to(OrderStatus::Fulfilling));
        assert!(OrderStatus::Fulfilling.can_transition_to(OrderStatus::Done));
        assert!(!OrderStatus::Done.can_transition_to(OrderStatus::Unpaid));
        assert!(!OrderStatus::Cancelled.can_transition_to(OrderStatus::Paid));
    }

    #[test]
    fn payment_refund_flow() {
        assert!(PaymentStatus::Success.can_transition_to(PaymentStatus::Refunding));
        assert!(PaymentStatus::Refunding.can_transition_to(PaymentStatus::Refunded));
        assert!(!PaymentStatus::Refunded.can_transition_to(PaymentStatus::Success));
    }

    #[test]
    fn shipment_happy_path() {
        for (a, b) in [
            (ShipmentStatus::Preparing, ShipmentStatus::PickedUp),
            (ShipmentStatus::PickedUp, ShipmentStatus::InTransit),
            (ShipmentStatus::InTransit, ShipmentStatus::OutForDelivery),
            (ShipmentStatus::OutForDelivery, ShipmentStatus::Delivered),
        ] {
            assert!(a.can_transition_to(b), "{a:?} → {b:?}");
        }
    }

    #[test]
    fn reject_illegal() {
        let r = OrderStatus::Done.assert_transition(OrderStatus::Unpaid);
        assert!(r.is_err());
    }
}
