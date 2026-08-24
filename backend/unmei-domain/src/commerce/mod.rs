//! unmei 商业子系统域模型 · v2.0
//!
//! 见 `docs/commerce-architecture.md`。
//! 本模块定义 9 个业务域的聚合根类型 + 状态枚举 + 状态机 transition tables + 领域事件 + service / adapter trait。
//!
//! 设计约定:
//! - 金额一律 `i64` minor unit + `Currency`(见 [`money`])
//! - 时间一律 [`chrono::DateTime<Utc>`]
//! - 主键一律 [`String`](UUID v4 字符串),便于跨服务复用 / idempotency
//! - 状态字段一律 `TEXT + CHECK`;enum 只提供 `as_str()` / `from_str_lax()`,
//!   映射由持久化层负责 —— domain 不认识数据库

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
pub mod adapters;
pub mod region;

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
