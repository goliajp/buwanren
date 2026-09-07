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

/// 验微信那一侧的签名 —— **回调必须验，不验等于谁都能给我们发「已支付」**。
///
/// 【在这之前一次都没验过】。`verify_webhook` 的注释里写着要做三件事
/// （验头、验签、解密），而代码只做了第三件 —— 也就是说：
/// 任何人只要知道我们的回调地址，就能拿 APIv3 密钥之外的东西
/// ……不，更糟：他连密钥都不用猜，因为**签名根本没人看**，
/// 只要密文解得开就照单收下。而 APIv3 密钥泄露一次，
/// 签名这一层本来是第二道锁。
///
/// 待签串是三行（时间戳、随机串、报文主体），每行一个 `\n` 收尾。
/// 公钥来自微信平台证书 —— 见 [`pubkey_from_cert_pem`]。
pub fn verify_rsa_sha256(public_key_pem: &str, message: &str, signature_b64: &str) -> Result<()> {
    use rsa::pkcs1v15::{Signature, VerifyingKey};
    use rsa::pkcs8::DecodePublicKey;
    use rsa::signature::Verifier;
    use rsa::RsaPublicKey;

    let key = RsaPublicKey::from_public_key_pem(public_key_pem)
        .map_err(|e| WxError::Internal(format!("平台公钥读不出来：{e}")))?;
    let sig_bytes = B64.decode(signature_b64)
        .map_err(|e| WxError::Internal(format!("签名不是合法 base64：{e}")))?;
    let sig = Signature::try_from(sig_bytes.as_slice())
        .map_err(|e| WxError::Internal(format!("签名长度不对：{e}")))?;
    VerifyingKey::<Sha256>::new(key)
        .verify(message.as_bytes(), &sig)
        // 验不过只说验不过。是伪造、是证书轮换、还是我们拼错了待签串，
        // 在密码学上不可区分 —— 猜一个写进日志会把排查引到错的方向。
        .map_err(|_| WxError::Internal(
            "微信那一侧的签名验不过 —— 要么不是微信发的，要么平台证书该换了".into()
        ))
}

/// 微信回调的待签串：三行，最后一行也要换行。
pub fn notify_sign_message(timestamp: &str, nonce: &str, body: &str) -> String {
    format!("{timestamp}\n{nonce}\n{body}\n")
}

/// JSAPI 唤起支付的那五个字段里的 `paySign`。
///
/// 待签串也是自己一套：appId / timeStamp / nonceStr / package，四行。
/// 【这里原先是字面量 `TODO_paySign_beta`】—— 客户端拿它去
/// `wx.requestPayment`，微信当场拒。也就是说：**配上真商户号之后，
/// 这个产品收不到一分钱**，而在这台机器上一切都是绿的，
/// 因为桩替它答了。
pub fn pay_sign_message(appid: &str, timestamp: &str, nonce: &str, package: &str) -> String {
    format!("{appid}\n{timestamp}\n{nonce}\n{package}\n")
}

/// 从微信平台证书（X.509 PEM）里取出 RSA 公钥，导成 PEM。
///
/// 微信下发的是整张证书，而验签只要里面那把公钥。
pub fn pubkey_from_cert_pem(cert_pem: &str) -> Result<String> {
    use rsa::pkcs8::{DecodePublicKey, EncodePublicKey};
    use rsa::RsaPublicKey;
    use x509_cert::der::{DecodePem, Encode};
    use x509_cert::Certificate;

    let cert = Certificate::from_pem(cert_pem.as_bytes())
        .map_err(|e| WxError::Internal(format!("平台证书读不出来：{e}")))?;
    // SPKI 那一段单独 DER 编码出来，就是一份标准公钥 —— `rsa` 直接认
    let der = cert.tbs_certificate.subject_public_key_info.to_der()
        .map_err(|e| WxError::Internal(format!("证书里的公钥编不回 DER：{e}")))?;
    let key = RsaPublicKey::from_public_key_der(&der)
        .map_err(|e| WxError::Internal(format!("证书里那把不是 RSA 公钥：{e}")))?;
    key.to_public_key_pem(rsa::pkcs8::LineEnding::LF)
        .map_err(|e| WxError::Internal(format!("公钥导不成 PEM：{e}")))
        .map(|p| p.to_string())
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


    /// 自签自验 —— 这一对必须对得上，否则回调那一层要么全放行、要么全拒。
    #[test]
    fn 自己签的自己验得过() {
        use rsa::pkcs8::EncodePublicKey;
        let (key, pem) = 测试密钥();
        let pubpem = key.to_public_key().to_public_key_pem(rsa::pkcs8::LineEnding::LF)
            .expect("导公钥").to_string();
        let msg = notify_sign_message("1700000000", "abc", r#"{"id":"x"}"#);
        let sig = sign_rsa_sha256(&pem, &msg).expect("签");
        verify_rsa_sha256(&pubpem, &msg, &sig).expect("该验得过");
        // 改一个字节就该验不过 —— 「验得过」如果对任何输入都成立，那等于没验
        let 改过 = notify_sign_message("1700000001", "abc", r#"{"id":"x"}"#);
        assert!(verify_rsa_sha256(&pubpem, &改过, &sig).is_err(), "换了待签串还验得过");
    }

    /// paySign 的待签串是四行，跟请求签名那五行不是一回事。
    #[test]
    fn paysign_是四行() {
        let m = pay_sign_message("wxappid", "1700000000", "abc", "prepay_id=x");
        assert_eq!(m.lines().count(), 4);
        assert!(m.ends_with('\n'), "最后一行也要换行");
        assert_eq!(m, "wxappid\n1700000000\nabc\nprepay_id=x\n");
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
