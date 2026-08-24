//! 谁在做这件事。
//!
//! 两份旧实现在这里分歧最大:路由把 `actor_kind` 写死成 `'user'`,
//! service 用 `actor.starts_with("admin")` 之类的前缀猜。前者在后台调用时是错的,
//! 后者在 ID 命名规则一变就是错的。两条都不要 —— 调用方本来就知道自己是谁,
//! 让它显式说。

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActorKind {
    /// 终端用户,带 JWT `sub`
    User,
    /// 后台运营,带 admin JWT `sub`
    Admin,
    /// 定时 worker / sweeper
    System,
    /// 渠道回调(微信支付 / 物流),无身份
    Webhook,
}

impl ActorKind {
    /// 落 `order_event.actor_kind` / `refund.actor_kind` 等列的值。
    /// 与 migration 里的 CHECK 约束对齐。
    pub fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Admin => "admin",
            Self::System => "system",
            Self::Webhook => "webhook",
        }
    }
}

impl fmt::Display for ActorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone)]
pub struct Actor {
    pub kind: ActorKind,
    /// user_id / admin_id;system 与 webhook 无 id
    pub id: Option<String>,
}

impl Actor {
    pub fn user(id: impl Into<String>) -> Self {
        Self { kind: ActorKind::User, id: Some(id.into()) }
    }
    pub fn admin(id: impl Into<String>) -> Self {
        Self { kind: ActorKind::Admin, id: Some(id.into()) }
    }
    pub fn system() -> Self {
        Self { kind: ActorKind::System, id: None }
    }
    pub fn webhook() -> Self {
        Self { kind: ActorKind::Webhook, id: None }
    }

    pub fn is_admin(&self) -> bool {
        self.kind == ActorKind::Admin
    }

    /// 写审计串用。system / webhook 无 id 时给个稳定占位,不要写空串。
    pub fn label(&self) -> String {
        match &self.id {
            Some(id) => id.clone(),
            None => self.kind.as_str().to_string(),
        }
    }
}
