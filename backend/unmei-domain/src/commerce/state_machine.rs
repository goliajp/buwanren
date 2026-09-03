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

// ═══════════════════════════════ 会计期间 ══════════════════════════════
/* 【`PeriodState` 定义了三个状态，却一直没有转移表】（2026-09-03）。
   写关账用例时才发现:`open / closing / closed` 在 enums.rs 里躺了很久，
   而没有任何一处判过「从哪能走到哪」——也没有任何一处能把期间关上，
   所以谁都不会撞见这个缺口。

   `closing` 是「正在结账」:分录不再进来，但报表还在算。
   走到 `closed` 之后不许回头 —— 一本能重新打开的账，
   跟没关过是一回事。真要改已关期间的账，走的是下一期的冲销分录。 */
impl StateTransition for PeriodState {
    fn allowed_next(self) -> &'static [Self] {
        use PeriodState::*;
        match self {
            Open    => &[Closing, Closed],
            Closing => &[Closed, Open],   // 结到一半发现有账没落，退回去补
            Closed  => &[],               // 关了就不回头
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 关了的账期不回头() {
        assert!(PeriodState::Open.can_transition_to(PeriodState::Closed));
        assert!(PeriodState::Closing.can_transition_to(PeriodState::Open),
                "结到一半发现有账没落，要能退回去补");
        // 【一本能重新打开的账，跟没关过是一回事】
        assert!(!PeriodState::Closed.can_transition_to(PeriodState::Open));
        assert!(!PeriodState::Closed.can_transition_to(PeriodState::Closing));
    }

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
