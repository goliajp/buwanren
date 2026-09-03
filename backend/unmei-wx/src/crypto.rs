//! 微信支付 v3 的两件密码学活儿：请求签名与回调解密。
//!
//! 【为什么单独一个文件】——它们跟 HTTP 无关，也跟微信的业务字段无关：
//! 输入是字节，输出是字节，对错有唯一答案。分出来之后这一段能自己
//! 单测到底（自签自验、自加自解），不需要真凭据、不需要联网、
//! 也不需要真机 —— 而 `pay.rs` 里剩下的部分要的正是那些。
//!
//! 在这之前这两处是 `let signature = "TODO".to_string();` 和
//! 一个直接返回 `Err(Internal("TODO Beta1"))` 的函数。前者更糟：
//! 配了真凭据之后它会把字面量 `TODO` 拼进 Authorization 头发给微信，
//! 而那条路径【看起来是实现过的】。

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::DecodePrivateKey;
use rsa::pkcs1::DecodeRsaPrivateKey;
use rsa::signature::{RandomizedSigner, SignatureEncoding};
use rsa::RsaPrivateKey;
use sha2::Sha256;

use crate::{Result, WxError};

/// 微信支付 v3 的待签串。
///
/// 五行，每行一个 `\n` 收尾 —— **最后一行也要**。少了那个换行，
/// 签出来的东西微信一律拒收，而错误信息只会说「签名错误」。
/// 文档：<https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_0.shtml>
pub fn sign_message(method: &str, url_path: &str, timestamp: i64, nonce: &str, body: &str) -> String {
    format!("{method}\n{url_path}\n{timestamp}\n{nonce}\n{body}\n")
}

/// 用商户私钥对待签串做 SHA256-RSA2048，返回 base64。
///
/// 私钥 PEM 两种头都收：`BEGIN PRIVATE KEY`（PKCS#8）与
/// `BEGIN RSA PRIVATE KEY`（PKCS#1）。微信商户平台下发的是前者，
/// 但用 openssl 转过一手的常常是后者 —— 两种都认，省得上线那天
/// 才发现「私钥读不出来」而不知道是格式问题。
pub fn sign_rsa_sha256(private_key_pem: &str, message: &str) -> Result<String> {
    let key = RsaPrivateKey::from_pkcs8_pem(private_key_pem)
        .or_else(|_| RsaPrivateKey::from_pkcs1_pem(private_key_pem))
        .map_err(|e| WxError::Internal(format!(
            "商户私钥读不出来（PKCS#8 与 PKCS#1 都试过了）：{e}"
        )))?;
    let signing = SigningKey::<Sha256>::new(key);
    let sig = signing.sign_with_rng(&mut rand::thread_rng(), message.as_bytes());
    Ok(B64.encode(sig.to_bytes()))
}

/// 解回调密文 · AEAD_AES_256_GCM。
///
/// key 是商户平台上设的 APIv3 密钥，**32 字节**；nonce 12 字节；
/// `associated_data` 参与认证但不参与加密 —— 传错了解不开，
/// 而解不开就该报错，不能返回一个空对象让上游当成「这次回调没内容」。
pub fn decrypt_aes_256_gcm(
    api_v3_key: &str,
    nonce: &str,
    associated_data: &str,
    ciphertext_b64: &str,
) -> Result<Vec<u8>> {
    use aes_gcm::aead::{Aead, KeyInit, Payload};
    use aes_gcm::{Aes256Gcm, Key, Nonce};

    // 【长度不对就当场说】。32/12 是算法定死的，
    // 交给 crate 去报 `InvalidLength` 的话，日志里只有一句
    // 「invalid length」，没人知道是哪一个短了。
    if api_v3_key.len() != 32 {
        return Err(WxError::Internal(format!(
            "APIv3 密钥要 32 字节，拿到 {} 字节", api_v3_key.len()
        )));
    }
    if nonce.len() != 12 {
        return Err(WxError::Internal(format!(
            "回调 nonce 要 12 字节，拿到 {} 字节", nonce.len()
        )));
    }

    let ct = B64.decode(ciphertext_b64)
        .map_err(|e| WxError::Internal(format!("回调密文不是合法 base64：{e}")))?;

    let key = Key::<Aes256Gcm>::from_slice(api_v3_key.as_bytes());
    let cipher = Aes256Gcm::new(key);
    cipher
        .decrypt(
            Nonce::from_slice(nonce.as_bytes()),
            Payload { msg: &ct, aad: associated_data.as_bytes() },
        )
        // 【解不开只说解不开】。GCM 解不开有两种可能:密钥不对，
        // 或者密文被人动过。这两种在密码学上不可区分 ——
        // 所以不猜是哪一种，也不返回半截明文。
        .map_err(|_| WxError::Internal(
            "回调解不开：APIv3 密钥不对，或者这段密文不是给我们的".into()
        ))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 一对 2048 位测试密钥。生成一次要几百毫秒，所以这一组测试共用。
    fn 测试密钥() -> (RsaPrivateKey, String) {
        use rsa::pkcs8::EncodePrivateKey;
        let key = RsaPrivateKey::new(&mut rand::thread_rng(), 2048).expect("生成密钥");
        let pem = key.to_pkcs8_pem(rsa::pkcs8::LineEnding::LF).expect("导出 PEM").to_string();
        (key, pem)
    }

    #[test]
    fn 待签串最后一行也要换行() {
        // 【少这一个换行，微信一律拒收，而它只回「签名错误」】
        let m = sign_message("POST", "/v3/pay/transactions/jsapi", 1700000000, "abc", "{}");
        assert_eq!(m, "POST\n/v3/pay/transactions/jsapi\n1700000000\nabc\n{}\n");
        assert!(m.ends_with('\n'));
        assert_eq!(m.matches('\n').count(), 5, "五行五个换行");
    }

    #[test]
    fn 签出来的东西用公钥验得过() {
        use rsa::pkcs1v15::VerifyingKey;
        use rsa::signature::Verifier;

        let (key, pem) = 测试密钥();
        let msg = sign_message("POST", "/v3/pay/transactions/jsapi", 1700000000, "n0nce", r#"{"a":1}"#);
        let sig_b64 = sign_rsa_sha256(&pem, &msg).expect("签名");

        let sig_bytes = B64.decode(&sig_b64).expect("签名是 base64");
        let sig = rsa::pkcs1v15::Signature::try_from(sig_bytes.as_slice()).expect("签名长度");
        let vk = VerifyingKey::<Sha256>::new(key.to_public_key());
        vk.verify(msg.as_bytes(), &sig).expect("自己签的自己该验得过");
    }

    #[test]
    fn 改一个字签名就不该过了() {
        use rsa::pkcs1v15::VerifyingKey;
        use rsa::signature::Verifier;

        let (key, pem) = 测试密钥();
        let msg = sign_message("POST", "/v3/pay/transactions/jsapi", 1700000000, "n0nce", r#"{"total":100}"#);
        let sig_b64 = sign_rsa_sha256(&pem, &msg).expect("签名");
        let sig_bytes = B64.decode(&sig_b64).unwrap();
        let sig = rsa::pkcs1v15::Signature::try_from(sig_bytes.as_slice()).unwrap();
        let vk = VerifyingKey::<Sha256>::new(key.to_public_key());

        // 金额改了一位:签名必须失效。这条钉的是「签的是不是这个 body」
        let 改过 = sign_message("POST", "/v3/pay/transactions/jsapi", 1700000000, "n0nce", r#"{"total":900}"#);
        assert!(vk.verify(改过.as_bytes(), &sig).is_err(), "改了金额还验得过就等于没签");
    }

    #[test]
    fn 读不出来的私钥要报错而不是签出个空的() {
        let e = sign_rsa_sha256("这不是 PEM", "whatever").unwrap_err();
        assert!(format!("{e}").contains("私钥读不出来"), "拿到的是 {e}");
    }

    #[test]
    fn 自己加密的自己解得开() {
        use aes_gcm::aead::{Aead, KeyInit, Payload};
        use aes_gcm::{Aes256Gcm, Key, Nonce};

        let k = "0123456789abcdef0123456789abcdef";   // 32 字节
        let n = "0123456789ab";                        // 12 字节
        let aad = "transaction";
        let 明文 = br#"{"trade_state":"SUCCESS","out_trade_no":"pay-1"}"#;

        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(k.as_bytes()));
        let ct = cipher
            .encrypt(Nonce::from_slice(n.as_bytes()), Payload { msg: 明文, aad: aad.as_bytes() })
            .expect("加密");
        let ct_b64 = B64.encode(ct);

        let out = decrypt_aes_256_gcm(k, n, aad, &ct_b64).expect("解密");
        assert_eq!(out, 明文);
    }

    #[test]
    fn 密钥不对解不开而且不给半截明文() {
        use aes_gcm::aead::{Aead, KeyInit, Payload};
        use aes_gcm::{Aes256Gcm, Key, Nonce};

        let k = "0123456789abcdef0123456789abcdef";
        let n = "0123456789ab";
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(k.as_bytes()));
        let ct = B64.encode(cipher
            .encrypt(Nonce::from_slice(n.as_bytes()), Payload { msg: b"secret", aad: b"t" })
            .unwrap());

        let 换个密钥 = "ffffffffffffffffffffffffffffffff";
        let e = decrypt_aes_256_gcm(换个密钥, n, "t", &ct).unwrap_err();
        assert!(format!("{e}").contains("解不开"), "拿到的是 {e}");
    }

    #[test]
    fn 附加数据不对也解不开() {
        use aes_gcm::aead::{Aead, KeyInit, Payload};
        use aes_gcm::{Aes256Gcm, Key, Nonce};

        let k = "0123456789abcdef0123456789abcdef";
        let n = "0123456789ab";
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(k.as_bytes()));
        let ct = B64.encode(cipher
            .encrypt(Nonce::from_slice(n.as_bytes()), Payload { msg: b"x", aad: b"transaction" })
            .unwrap());

        // aad 参与认证不参与加密 —— 传错了必须解不开，
        // 而不是解出明文却认错了这是哪一类回调
        assert!(decrypt_aes_256_gcm(k, n, "refund", &ct).is_err());
    }

    #[test]
    fn 长度不对当场说清是哪一个短了() {
        let e = decrypt_aes_256_gcm("太短", "0123456789ab", "t", "AAAA").unwrap_err();
        assert!(format!("{e}").contains("32 字节"), "拿到的是 {e}");
        let e = decrypt_aes_256_gcm("0123456789abcdef0123456789abcdef", "短", "t", "AAAA").unwrap_err();
        assert!(format!("{e}").contains("12 字节"), "拿到的是 {e}");
    }
}
