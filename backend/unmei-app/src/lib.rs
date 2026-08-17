//! unmei 用例编排层。
//!
//! **这一层存在的理由是「每条业务写操作只有一份实现」**。
//!
//! 在此之前,同一条用例被写了两遍:`unmei-domain/commerce/services_impl/` 里
//! 一份(11 个 `PgXxxService`,2451 LOC,从未被任何 binary 引用过),
//! `unmei-api` / `unmei-admin-api` 的路由 handler 里又一份(直接拼 SQL,真正在跑)。
//! 两份已经漂移 —— 建单一份支持多币种、写 outbox、落 ip/ua,另一份硬编码 CNY、
//! 不写 outbox、ip/ua 写 NULL,却把 `receipt` 存进了 `contact_json`。
//! 谁也说不清哪份是对的。
//!
//! 现在只有这一份。路由只负责 HTTP 解析与鉴权,拿到 [`Actor`] 后调这里。
//!
//! ## 边界
//!
//! - **进得来**:`unmei-domain`(类型 / 状态机 / 领域事件 / port trait)
//! - **出不去**:不认识 axum,不认识 HTTP。错误一律 [`DomainError`],
//!   由调用方在自己的边界翻译成响应
//! - **暂时的例外**:本层直接用 sqlx。P2 会把 SQL 抽到 `unmei-pg`,
//!   本层改为依赖 domain 里的 repository port
//!
//! ## 读与写
//!
//! 只收**写操作与状态迁移**。列表 / 详情这类只读查询留在路由里 ——
//! 它们两边不重叠(客户端按 `user_id` 过滤,后台按筛选条件),不存在双写,
//! 收进来只是搬运。P2 连同 SQL 一起处理。

pub mod actor;
pub mod catalog;
pub mod fulfillment;
pub mod idempotency;
pub mod order;
pub mod outbox;
pub mod outbox_ops;
pub mod payment;
pub mod promotion;
pub mod recon;
pub mod refund;
pub mod risk;
pub mod shipment;
pub mod subscription;

pub use actor::{Actor, ActorKind};

/// 本层统一错误类型。用 domain 的,不自己造。
pub use unmei_domain::DomainError;

/// 生成带前缀的主键。全仓 ID 形如 `ord-<uuid>` / `pay-<uuid>`。
pub(crate) fn new_id(prefix: &str) -> String {
    format!("{prefix}-{}", uuid::Uuid::new_v4())
}

/// sqlx 错误 → [`DomainError::Repository`]。
///
/// domain 不认识 sqlx,所以这层转换必须显式发生在这里。孤儿规则也不允许
/// 在本 crate 里给 `DomainError` 写 `From<sqlx::Error>`(两个类型都是外部的),
/// 所以做成扩展方法:每个落库调用写 `.await.db()?`。
///
/// 啰嗦是故意的 —— 它标出了「这一行会碰数据库」,P2 把 SQL 抽到独立
/// 持久化 crate 时,这些点就是切口。
pub(crate) trait DbResultExt<T> {
    fn db(self) -> Result<T, DomainError>;
}

impl<T> DbResultExt<T> for Result<T, sqlx::Error> {
    fn db(self) -> Result<T, DomainError> {
        self.map_err(|e| DomainError::Repository(e.to_string()))
    }
}
