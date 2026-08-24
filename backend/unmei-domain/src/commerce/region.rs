//! Region · 6 cell 元数据 + ID prefix。
//!
//! 见 `docs/commerce-architecture.md` § 多区域(待补)。
//! 6 个 cell:cn / jp / kr / sea / na / zh_hant
//!
//! 设计:
//! - 每个 Cell 是物理 / 逻辑独立单元(P1 单 PG partitioning,P3 多 PG instance)
//! - ID 一律 `{region}-{kind}-{uuid}` (如 `cn-ord-xxx`),集团报表合并不冲突
//! - 客户端用户主体绑 region(注册时锁死),user_id 也带 region prefix
//! - Admin JWT 含 `region_scope[]`,super = 全开,区域 admin = 单 region
//! - Master Data(SPU / plan / chart / risk template)归 control plane,push 到各 cell
//!
//! ─────────────────────────────────────────────────────────────
//! **现状：这一整个模块零调用方**（2026-08-18 查过）。
//!
//! `unmei-domain` 之外没有一处 `use ... Region`、没有一处调 `.meta()`
//! 或 `Region::from_str` / `new_id`。上面写的设计一条都还没兑现，实测：
//!
//! - `region` 是**客户端登录时自己报的**，后端原样存，不校验 ——
//!   `region=zz` 的用户下单、支付、问签，跟 `cn` 用户表现完全一致
//! - 订单号是 `ord-{uuid}`，**不是**上面写的 `{region}-{kind}-{uuid}`
//! - `region=jp` 的用户照样能用 `wechat_jsapi` 付款，
//!   而 jp 那格的 `payment_channels` 里根本没有它
//! - `tz` 也没人读：「今天」在 `routes/village.rs` 与 `workers/recon.rs`
//!   里都写死 `+8`（那两处各有注释说明代价）
//!
//! 这不是「坏了」—— 今天只有 cn 一格在跑，内容也只有 `zh-CN`。
//! 记在这里是因为**开第二格那天，这些全都要一次性接上**，
//! 而「这套东西已经写好了」很容易被读成「已经在起作用」。
//! 同类的东西这个仓库有一整张表（README「实现完整、零调用方 —— 一份清单」），
//! 这是其中最大的一件。

use serde::{Deserialize, Serialize};
use std::str::FromStr;

/// 6 个区域 cell。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Region {
    /// 中国大陆 · CNY · 微信 / 支付宝 / 银联
    Cn,
    /// 日本 · JPY · LINE Pay / PayPay / Stripe
    Jp,
    /// 韩国 · KRW · Toss / KakaoPay / NaverPay
    Kr,
    /// 东南亚 · 多币(SGD 基准)· GrabPay / Stripe / 本地 · 含 SG/MY/TH/VN/PH/ID
    Sea,
    /// 北美 · USD · Stripe / Apple Pay / Google Pay · 含 US/CA
    Na,
    /// 中文繁体 · TWD/HKD · LINE Pay / 信用卡 / 八達通 · 含 TW/HK/MO 🟡(MO 待确认)
    ZhHant,
    /// 集团视图(只用于 admin JWT scope,不是真实 cell)
    Global,
}

impl Region {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Cn      => "cn",
            Self::Jp      => "jp",
            Self::Kr      => "kr",
            Self::Sea     => "sea",
            Self::Na      => "na",
            Self::ZhHant  => "zh_hant",
            Self::Global  => "global",
        }
    }

    pub fn all_cells() -> &'static [Region] {
        &[Self::Cn, Self::Jp, Self::Kr, Self::Sea, Self::Na, Self::ZhHant]
    }

    /// 该 region 的元数据(currency / locale / tz / 渠道 / 物流)
    pub fn meta(&self) -> RegionMeta {
        match self {
            Self::Cn => RegionMeta {
                code: "cn",
                name: "中国大陆",
                primary_currency: "CNY",
                supported_currencies: &["CNY"],
                primary_locale: "zh-CN",
                supported_locales: &["zh-CN"],
                tz: "Asia/Shanghai",
                payment_channels: &[
                    "wechat_jsapi","wechat_mp","wechat_h5","wechat_native",
                    "alipay_wap","alipay_pc","alipay_mini",
                ],
                carriers: &["sf","jd","zto","yto","yunda","sto","ems"],
                jurisdiction: "CN",
                data_residency_required: true,  // PIPL 个保法
            },
            Self::Jp => RegionMeta {
                code: "jp",
                name: "日本",
                primary_currency: "JPY",
                supported_currencies: &["JPY"],
                primary_locale: "ja-JP",
                supported_locales: &["ja-JP","en-US"],
                tz: "Asia/Tokyo",
                payment_channels: &["stripe_card","line_pay","paypay","iap","gpb"],
                carriers: &["jp_post","yamato","sagawa"],
                jurisdiction: "JP",
                data_residency_required: true,  // APPI
            },
            Self::Kr => RegionMeta {
                code: "kr",
                name: "韩国",
                primary_currency: "KRW",
                supported_currencies: &["KRW"],
                primary_locale: "ko-KR",
                supported_locales: &["ko-KR","en-US"],
                tz: "Asia/Seoul",
                payment_channels: &["toss","kakaopay","naverpay","stripe_card","iap","gpb"],
                carriers: &["cj_logistics","hanjin","lotte"],
                jurisdiction: "KR",
                data_residency_required: true,  // PIPA
            },
            Self::Sea => RegionMeta {
                code: "sea",
                name: "东南亚",
                primary_currency: "SGD",
                supported_currencies: &["SGD","MYR","THB","IDR","VND","PHP"],
                primary_locale: "en-US",
                supported_locales: &["en-US","zh-Hans","th-TH","vi-VN","id-ID","ms-MY"],
                tz: "Asia/Singapore",
                payment_channels: &["stripe_card","grabpay","shopeepay","iap","gpb"],
                carriers: &["dhl","jnt","ninja_van"],
                jurisdiction: "SG-multi",
                data_residency_required: false,  // 多国情况复杂,SG 较宽
            },
            Self::Na => RegionMeta {
                code: "na",
                name: "北美",
                primary_currency: "USD",
                supported_currencies: &["USD","CAD"],
                primary_locale: "en-US",
                supported_locales: &["en-US","en-CA","fr-CA","es-US"],
                tz: "America/New_York",
                payment_channels: &["stripe_card","iap","gpb","paypal"],
                carriers: &["usps","fedex","ups","dhl"],
                jurisdiction: "US-CA",
                data_residency_required: false,
            },
            Self::ZhHant => RegionMeta {
                code: "zh_hant",
                name: "中文繁体",
                primary_currency: "TWD",
                supported_currencies: &["TWD","HKD","MOP"],
                primary_locale: "zh-TW",
                supported_locales: &["zh-TW","zh-HK"],
                tz: "Asia/Taipei",
                payment_channels: &["stripe_card","line_pay","iap","gpb"],
                carriers: &["chunghwa_post","sf"],
                jurisdiction: "TW-HK-MO",
                data_residency_required: false,
            },
            Self::Global => RegionMeta {
                code: "global",
                name: "集团视图",
                primary_currency: "USD",
                supported_currencies: &[],
                primary_locale: "en-US",
                supported_locales: &[],
                tz: "UTC",
                payment_channels: &[],
                carriers: &[],
                jurisdiction: "",
                data_residency_required: false,
            },
        }
    }

    /// 生成带 region prefix 的 id:`{region}-{kind}-{uuid}`
    /// 用法:`region.new_id("ord")` → `"cn-ord-{uuid}"`
    pub fn new_id(&self, kind: &str) -> String {
        format!("{}-{}-{}", self.as_str(), kind, uuid::Uuid::new_v4())
    }

    /// 从已存在的 id 反解 region(若不带 prefix 则返 None)
    pub fn from_id(id: &str) -> Option<Region> {
        let prefix = id.split('-').next()?;
        Region::from_str(prefix).ok()
    }
}

impl FromStr for Region {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, ()> {
        match s {
            "cn"      => Ok(Self::Cn),
            "jp"      => Ok(Self::Jp),
            "kr"      => Ok(Self::Kr),
            "sea"     => Ok(Self::Sea),
            "na"      => Ok(Self::Na),
            "zh_hant" => Ok(Self::ZhHant),
            "global"  => Ok(Self::Global),
            _ => Err(()),
        }
    }
}

impl std::fmt::Display for Region {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl Default for Region {
    fn default() -> Self { Self::Cn }  // dev default;生产由 JWT / Header 显式指定
}

/// Region 静态元数据(只读,代码常量)
#[derive(Debug, Clone, Copy, Serialize)]
pub struct RegionMeta {
    pub code: &'static str,
    pub name: &'static str,
    pub primary_currency: &'static str,
    pub supported_currencies: &'static [&'static str],
    pub primary_locale: &'static str,
    pub supported_locales: &'static [&'static str],
    pub tz: &'static str,
    pub payment_channels: &'static [&'static str],
    pub carriers: &'static [&'static str],
    pub jurisdiction: &'static str,
    pub data_residency_required: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_cells_count_six() {
        assert_eq!(Region::all_cells().len(), 6);
    }

    #[test]
    fn id_prefix_round_trip() {
        let id = Region::Cn.new_id("ord");
        assert!(id.starts_with("cn-ord-"));
        assert_eq!(Region::from_id(&id), Some(Region::Cn));

        let id2 = Region::ZhHant.new_id("pay");
        assert!(id2.starts_with("zh_hant-pay-"));
        assert_eq!(Region::from_id(&id2), Some(Region::ZhHant));
    }

    #[test]
    fn meta_cn() {
        let m = Region::Cn.meta();
        assert_eq!(m.primary_currency, "CNY");
        assert_eq!(m.tz, "Asia/Shanghai");
        assert!(m.data_residency_required);
        assert!(m.payment_channels.contains(&"wechat_jsapi"));
    }

    #[test]
    fn meta_sea_multi_currency() {
        let m = Region::Sea.meta();
        assert_eq!(m.primary_currency, "SGD");
        assert!(m.supported_currencies.len() >= 4);
    }

    #[test]
    fn from_str_global() {
        assert_eq!(Region::from_str("global").unwrap(), Region::Global);
        assert_eq!(Region::from_str("zh_hant").unwrap(), Region::ZhHant);
        assert!(Region::from_str("xx").is_err());
    }
}
