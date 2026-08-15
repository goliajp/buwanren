//! unmei 商业子系统域模型 · v2.0
//!
//! 见 `docs/commerce-architecture.md`。
//! 本模块定义 9 个业务域的聚合根类型 + 状态枚举 + 状态机 transition tables + 领域事件 + service / adapter trait。
//!
//! 设计约定:
//! - 金额一律 `i64` minor unit + `Currency`(见 [`money`])
//! - 时间一律 [`chrono::DateTime<Utc>`]
//! - 主键一律 [`String`](UUID v4 字符串),便于跨服务复用 / idempotency
//! - 状态字段一律 `TEXT + CHECK`,代码侧用 enum 派生 `sqlx::Type` (rename_all=snake_case)

pub mod money;
pub mod enums;
pub mod product;
pub mod pricing;
pub mod promotion;
pub mod subscription;
pub mod order;
pub mod payment;
pub mod refund;
pub mod shipment;
pub mod settlement;
pub mod risk;
pub mod finance;

pub mod state_machine;
pub mod events;
pub mod services;
pub mod adapters;
pub mod outbox;
pub mod region;
pub mod services_impl;

pub use region::{Region, RegionMeta};

pub use money::*;
pub use enums::*;
pub use product::*;
pub use pricing::*;
pub use promotion::*;
pub use subscription::*;
pub use order::*;
pub use payment::*;
pub use refund::*;
pub use shipment::*;
pub use settlement::*;
pub use risk::*;
pub use finance::*;
pub use events::*;
