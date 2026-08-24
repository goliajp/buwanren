//! kevy-embedded 那对 API 真的能存能取吗。
//!
//! 为什么要有这一支：`token.rs` 里对缓存只用两个方法 —— `set_with_ttl` 与 `get`。
//! 而它们**只在真去微信取 token 那条路上才被调到**，mock 模式跳过那一步，
//! 于是整个测试套跑完，这对 API 一次都没被走过。
//!
//! 2026-08-23 把 kevy-embedded 从 1.4.20 升到 5.4.1（跨四个大版本）时看清这件事：
//! 编译过、单测全绿、服务起得来 —— 这三样加起来仍然不能说明缓存是好的。
//! 「能编译」跟「用得对」是两回事，尤其是跨大版本升级。

use kevy_embedded::{Config, Store};
use std::time::Duration;

fn store(dir: &str) -> Store {
    let _ = std::fs::remove_dir_all(dir);
    Store::open(Config::default().with_persist(dir)).expect("kevy 起不来")
}

#[test]
fn 存进去取得回来() {
    let s = store("/tmp/kevy-test-roundtrip");
    let key = b"unmei:test:token";
    s.set_with_ttl(key, b"tok-abc", Duration::from_secs(60))
        .expect("写不进去");
    let got = s.get(key).expect("读出错");
    assert_eq!(got.as_deref(), Some(&b"tok-abc"[..]), "存进去的跟取回来的不是同一个");
}

#[test]
fn 没存过的取回来是空() {
    let s = store("/tmp/kevy-test-miss");
    // 缓存未命中必须是 Ok(None)，不能是 Err —— `token.rs` 靠这个分支去取新 token。
    // 要是它变成 Err，那条 `if let Ok(Some(..))` 照样不命中，行为看着一样，
    // 但「没缓存」与「缓存坏了」就再也分不开了。
    let got = s.get(b"unmei:test:never-written").expect("未命中不该是错");
    assert!(got.is_none(), "没存过却取到了东西");
}

#[test]
fn ttl_到点就没了() {
    let s = store("/tmp/kevy-test-ttl");
    let key = b"unmei:test:short";
    s.set_with_ttl(key, b"x", Duration::from_millis(120)).expect("写不进去");
    assert!(s.get(key).expect("读出错").is_some(), "刚写完就没了");
    std::thread::sleep(Duration::from_millis(400));
    assert!(s.get(key).expect("读出错").is_none(), "过了 TTL 还在 —— token 会一直用过期的那个");
}
