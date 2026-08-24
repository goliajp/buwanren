//! unmei-carrier · 物流承运商适配器集合
//!
//! 实现 `unmei_domain::commerce::adapters::CarrierAdapter` trait,
//! 见 `docs/commerce-architecture.md` §3.8 + §4。
//!
//! 当前 P0 实现:
//! - [`manual::ManualAdapter`]:不调用任何外部接口,trace 由运营在 webadmin 手填。
//! - [`kuaidi100::Kuaidi100Adapter`]:聚合国内 200+ 快递,实时查询接口 + webhook。

pub mod manual;
pub mod kuaidi100;
