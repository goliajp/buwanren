//! Money 类型 + Currency
//!
//! 金额一律最小货币单位 (minor unit) · 分 / cent。
//! 跨语言 / 跨进程时 amount_minor 走 i64,展示时由前端按 currency 的 decimals 折算。
//! **禁止内部用 yuan / dollar** 或 float。

use serde::{Deserialize, Serialize};
use std::fmt;

/// ISO 4217 货币码。表面 3 字母大写,内部 enum 驱动。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Currency {
    Cny,
    Usd,
    Hkd,
    Jpy,
    Eur,
    Gbp,
    Sgd,
    Twd,
}

impl Currency {
    /// 该币种的最小货币单位的 10 进位数。
    /// CNY/USD/EUR/GBP/SGD/HKD = 2 (分)。JPY/TWD = 0 (无最小)。
    /// 【逐个写全，不要 `_ =>`】。通配的后果不是难看，是**错 100 倍**：
    /// 将来加一个零位币种（韩元）或三位币种（科威特第纳尔），
    /// 通配会静默按两位算，而编译器一个字都不会说。
    /// 同文件的 `display()` 本来就是穷举的 —— 加币种时它会编译不过，
    /// 逼人回答「这个币种长什么样」；这里也该逼人回答「它有几位小数」。
    pub fn decimals(&self) -> u8 {
        match self {
            Self::Jpy | Self::Twd => 0,
            Self::Cny | Self::Usd | Self::Hkd | Self::Eur | Self::Gbp | Self::Sgd => 2,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Cny => "CNY",
            Self::Usd => "USD",
            Self::Hkd => "HKD",
            Self::Jpy => "JPY",
            Self::Eur => "EUR",
            Self::Gbp => "GBP",
            Self::Sgd => "SGD",
            Self::Twd => "TWD",
        }
    }

    pub fn from_str_lax(s: &str) -> Option<Self> {
        match s.to_ascii_uppercase().as_str() {
            "CNY" => Some(Self::Cny),
            "USD" => Some(Self::Usd),
            "HKD" => Some(Self::Hkd),
            "JPY" => Some(Self::Jpy),
            "EUR" => Some(Self::Eur),
            "GBP" => Some(Self::Gbp),
            "SGD" => Some(Self::Sgd),
            "TWD" => Some(Self::Twd),
            _ => None,
        }
    }
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl Default for Currency {
    fn default() -> Self { Self::Cny }
}

/// 金额 = 数量(以最小货币单位计) + 币种。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    pub amount_minor: i64,
    pub currency: Currency,
}

impl Money {
    pub const fn new(amount_minor: i64, currency: Currency) -> Self {
        Self { amount_minor, currency }
    }

    pub const fn zero(currency: Currency) -> Self {
        Self { amount_minor: 0, currency }
    }

    pub fn is_zero(&self) -> bool { self.amount_minor == 0 }
    pub fn is_positive(&self) -> bool { self.amount_minor > 0 }

    /// 展示串。CNY 1234 → "¥12.34";JPY 100 → "¥100"。
    pub fn display(&self) -> String {
        let sym = match self.currency {
            Currency::Cny | Currency::Jpy => "¥",
            Currency::Usd => "$",
            Currency::Hkd => "HK$",
            Currency::Eur => "€",
            Currency::Gbp => "£",
            Currency::Sgd => "S$",
            Currency::Twd => "NT$",
        };
        let d = self.currency.decimals();
        if d == 0 {
            format!("{sym}{}", self.amount_minor)
        } else {
            let pow = 10_i64.pow(d as u32);
            let main = self.amount_minor / pow;
            let frac = (self.amount_minor.abs() % pow) as u32;
            format!("{sym}{main}.{:0width$}", frac, width = d as usize)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_cny() {
        assert_eq!(Money::new(12345, Currency::Cny).display(), "¥123.45");
        assert_eq!(Money::new(0, Currency::Cny).display(), "¥0.00");
        assert_eq!(Money::new(199, Currency::Cny).display(), "¥1.99");
    }

    #[test]
    fn display_jpy() {
        assert_eq!(Money::new(1000, Currency::Jpy).display(), "¥1000");
    }

    /// 小数位这张表钉死。它错一位就是钱错 100 倍，
    /// 而在这之前它一条测试都没有（是「领域层哪些 pub fn 没被测过」那一遍量出来的）。
    #[test]
    fn decimals_per_currency() {
        for c in [Currency::Jpy, Currency::Twd] {
            assert_eq!(c.decimals(), 0, "{} 没有最小单位", c.as_str());
        }
        for c in [Currency::Cny, Currency::Usd, Currency::Hkd,
                  Currency::Eur, Currency::Gbp, Currency::Sgd] {
            assert_eq!(c.decimals(), 2, "{} 是两位", c.as_str());
        }
    }

    /// 零位币种上的展示不该冒出小数点 —— 那是 decimals 错了的第一个症状。
    #[test]
    fn display_never_invents_a_decimal_point_on_zero_decimal_currencies() {
        assert_eq!(Money::new(1000, Currency::Twd).display(), "NT$1000");
        assert!(!Money::new(1000, Currency::Jpy).display().contains('.'));
    }

    #[test]
    fn currency_parse() {
        assert_eq!(Currency::from_str_lax("cny"), Some(Currency::Cny));
        assert_eq!(Currency::from_str_lax("USD"), Some(Currency::Usd));
        assert_eq!(Currency::from_str_lax("xxx"), None);
    }
}
