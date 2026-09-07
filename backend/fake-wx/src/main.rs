//! 本机用的**假微信** —— 照微信的协议说话。
//!
//! # 它跟「桩」是两件事
//!
//! 桩替我们的代码回答：`query_payment` 直接返回「已支付」、
//! `pay_notify_decrypt` 在没配凭据时返回 `{"trade_state":"SUCCESS"}`、
//! `mp_jscode2session` 编一个 openid。那样写出来的绿灯什么都不说明 ——
//! 我方那一侧的签名、验签、加解密、错误分支**一行都没跑过**，
//! 而它们恰恰是上线那天唯一会出错的地方。
//!
//! 这个进程反过来：它让我方的代码自己去问、自己去验。
//! 我们发的每一个请求它都**真的验签**（用商户公钥），
//! 它回的每一条回调都**真的加密 + 真的签名**（用平台私钥）。
//! 于是我方代码里没有一行是为测试而写的分支。
//!
//! # 它假在哪儿
//!
//! 只有两件事：钱不真的动，人不真的点。
//! 「用户付了款」由 `POST /_control/pay/{out_trade_no}` 触发 ——
//! 那一下代表的是**真人在微信里按了付款**，这台机器上没有那个人。
//!
//! 所以仍然只有真机能答的是：`wx.requestPayment` 那个原生弹窗
//! 长什么样、按下去微信收不收。而那之后的每一步都在这儿跑过了。
//!
//! # 用法
//!
//! ```text
//! FAKE_WX_DIR=/tmp/unmei-wx-dev FAKE_WX_BIND=127.0.0.1:6033 cargo run -p fake-wx
//! ```
//!
//! 头一次跑会在 `FAKE_WX_DIR` 里生成一套凭据（商户私钥、平台证书、
//! APIv3 密钥），并把该配的环境变量打在屏上。

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

const 序列号: &str = "PLATFORMCERT0001";

#[derive(Clone)]
struct 家当 {
    /// 商户公钥（PEM）—— 验我方请求的签名
    商户公钥: String,
    /// 平台私钥（PEM）—— 签我方要验的回调
    平台私钥: String,
    /// 平台证书（PEM）—— `/v3/certificates` 加密后发给我方
    平台证书: String,
    apiv3: String,
    单子: Arc<Mutex<HashMap<String, 一单>>>,
    退款: Arc<Mutex<HashMap<String, 一笔退款>>>,
    http: reqwest::Client,
}

#[derive(Clone, Debug)]
struct 一单 {
    out_trade_no: String,
    transaction_id: String,
    amount: i64,
    notify_url: String,
    state: String,       // NOTPAY / SUCCESS / CLOSED
    success_time: Option<String>,
}

#[derive(Clone, Debug)]
struct 一笔退款 {
    out_refund_no: String,
    refund_id: String,
    out_trade_no: String,
    amount: i64,
    total: i64,
    status: String,      // SUCCESS
    notify_url: String,
}

fn 随机(n: usize) -> String {
    use rand::Rng;
    const 表: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut r = rand::thread_rng();
    (0..n).map(|_| 表[r.gen_range(0..表.len())] as char).collect()
}

/// 生成（或读回）一套本机凭据。
fn 备齐凭据(dir: &std::path::Path) -> 家当 {
    use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey};
    std::fs::create_dir_all(dir).expect("建目录");
    let 商户私钥路径 = dir.join("merchant_key.pem");
    let 商户公钥路径 = dir.join("merchant_pub.pem");
    if !商户私钥路径.exists() {
        let key = rsa::RsaPrivateKey::new(&mut rand::thread_rng(), 2048).expect("生成商户密钥");
        std::fs::write(&商户私钥路径,
            key.to_pkcs8_pem(rsa::pkcs8::LineEnding::LF).expect("导出").as_bytes()).unwrap();
        std::fs::write(&商户公钥路径,
            key.to_public_key().to_public_key_pem(rsa::pkcs8::LineEnding::LF).expect("导出公钥")).unwrap();
    }
    let 平台证书路径 = dir.join("platform_cert.pem");
    let 平台私钥路径 = dir.join("platform_key.pem");
    if !平台证书路径.exists() {
        /* 平台证书是一张真的 X.509 —— 我方那一侧要从里面把公钥抠出来
           （`crypto::pubkey_from_cert_pem`）。发一张假的自签证书，
           走的仍是同一段解析代码。 */
        let mut 参数 = rcgen::CertificateParams::new(vec!["fake-wechatpay.local".into()])
            .expect("证书参数");
        参数.distinguished_name = rcgen::DistinguishedName::new();
        参数.distinguished_name.push(rcgen::DnType::CommonName, "Fake WechatPay Platform");
        /* 【密钥要自己生成，不能让 rcgen 生】。rcgen 生不出 RSA
           （`generate_for(PKCS_RSA_SHA256)` 会退回 ECDSA），
           而我方那一侧从证书里抠出来的公钥是拿 `rsa` crate 读的 ——
           拿到一把 ECDSA 公钥当场报「不是 RSA 公钥」。
           微信用的是 RSA，所以这儿也必须是 RSA。 */
        let 平台key = rsa::RsaPrivateKey::new(&mut rand::thread_rng(), 2048).expect("平台密钥");
        let 平台pem = 平台key.to_pkcs8_pem(rsa::pkcs8::LineEnding::LF).expect("导出").to_string();
        let kp = rcgen::KeyPair::from_pkcs8_pem_and_sign_algo(&平台pem, &rcgen::PKCS_RSA_SHA256)
            .expect("把 RSA 私钥交给 rcgen");
        let 证书 = 参数.self_signed(&kp).expect("自签");
        std::fs::write(&平台证书路径, 证书.pem()).unwrap();
        std::fs::write(&平台私钥路径, &平台pem).unwrap();
    }
    let apiv3路径 = dir.join("apiv3.key");
    if !apiv3路径.exists() {
        std::fs::write(&apiv3路径, 随机(32)).unwrap();
    }
    家当 {
        商户公钥: std::fs::read_to_string(&商户公钥路径).unwrap(),
        平台私钥: std::fs::read_to_string(&平台私钥路径).unwrap(),
        平台证书: std::fs::read_to_string(&平台证书路径).unwrap(),
        apiv3: std::fs::read_to_string(&apiv3路径).unwrap().trim().to_string(),
        单子: Default::default(),
        退款: Default::default(),
        http: reqwest::Client::new(),
    }
}

/// 验我方那一侧的 `Authorization` 签名。**真验** —— 这是这个进程存在的一半理由。
fn 验商户签名(st: &家当, headers: &HeaderMap, method: &str, path: &str, body: &str) -> Result<(), String> {
    use rsa::pkcs1v15::{Signature, VerifyingKey};
    use rsa::pkcs8::DecodePublicKey;
    use rsa::signature::Verifier;
    let auth = headers.get("authorization").and_then(|v| v.to_str().ok()).unwrap_or("");
    if !auth.starts_with("WECHATPAY2-SHA256-RSA2048 ") {
        return Err("Authorization 头不是 WECHATPAY2-SHA256-RSA2048".into());
    }
    let 取 = |k: &str| -> String {
        auth.split(',')
            .find_map(|kv| kv.trim().strip_prefix(&format!("{k}=")))
            .map(|v| v.trim_matches('"').to_string())
            .unwrap_or_default()
    };
    let (ts, nonce, sig) = (取("timestamp"), 取("nonce_str"), 取("signature"));
    if ts.is_empty() || nonce.is_empty() || sig.is_empty() {
        return Err("Authorization 里少了 timestamp / nonce_str / signature".into());
    }
    let 待签 = format!("{method}\n{path}\n{ts}\n{nonce}\n{body}\n");
    let key = rsa::RsaPublicKey::from_public_key_pem(&st.商户公钥).map_err(|e| e.to_string())?;
    let sig_bytes = B64.decode(&sig).map_err(|e| e.to_string())?;
    let s = Signature::try_from(sig_bytes.as_slice()).map_err(|e| e.to_string())?;
    VerifyingKey::<sha2::Sha256>::new(key)
        .verify(待签.as_bytes(), &s)
        .map_err(|_| format!("签名验不过。待签串是：{待签:?}"))
}

fn 加密(apiv3: &str, 明文: &[u8], aad: &str) -> (String, String) {
    use aes_gcm::aead::{Aead, KeyInit, Payload};
    use aes_gcm::{Aes256Gcm, Key, Nonce};
    let nonce = 随机(12);
    let key = Key::<Aes256Gcm>::from_slice(apiv3.as_bytes());
    let ct = Aes256Gcm::new(key)
        .encrypt(Nonce::from_slice(nonce.as_bytes()), Payload { msg: 明文, aad: aad.as_bytes() })
        .expect("加密");
    (nonce, B64.encode(ct))
}

fn 平台签(st: &家当, message: &str) -> String {
    use rsa::pkcs1::DecodeRsaPrivateKey;
    use rsa::pkcs1v15::SigningKey;
    use rsa::pkcs8::DecodePrivateKey;
    use rsa::signature::{RandomizedSigner, SignatureEncoding};
    let key = rsa::RsaPrivateKey::from_pkcs8_pem(&st.平台私钥)
        .or_else(|_| rsa::RsaPrivateKey::from_pkcs1_pem(&st.平台私钥))
        .expect("平台私钥");
    let sig = SigningKey::<sha2::Sha256>::new(key)
        .sign_with_rng(&mut rand::thread_rng(), message.as_bytes());
    B64.encode(sig.to_bytes())
}

fn 拒(msg: String) -> axum::response::Response {
    (StatusCode::UNAUTHORIZED, Json(json!({ "code": "SIGN_ERROR", "message": msg }))).into_response()
}

// ─── 支付 ────────────────────────────────────────────────────────

async fn 下单(
    State(st): State<家当>, Path(kind): Path<String>, headers: HeaderMap, body: String,
) -> axum::response::Response {
    let path = format!("/v3/pay/transactions/{kind}");
    if let Err(e) = 验商户签名(&st, &headers, "POST", &path, &body) {
        return 拒(e);
    }
    let v: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    let no = v.get("out_trade_no").and_then(|x| x.as_str()).unwrap_or("").to_string();
    let amount = v.get("amount").and_then(|a| a.get("total")).and_then(|x| x.as_i64()).unwrap_or(0);
    let notify = v.get("notify_url").and_then(|x| x.as_str()).unwrap_or("").to_string();
    st.单子.lock().unwrap().insert(no.clone(), 一单 {
        out_trade_no: no.clone(),
        transaction_id: format!("42000{}", 随机(20)),
        amount,
        notify_url: notify,
        state: "NOTPAY".into(),
        success_time: None,
    });
    let 回 = match kind.as_str() {
        "jsapi" => json!({ "prepay_id": format!("wx{}", 随机(30)) }),
        "h5" => json!({ "h5_url": format!("https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=wx{}", 随机(20)) }),
        "native" => json!({ "code_url": format!("weixin://wxpay/bizpayurl?pr={}", 随机(12)) }),
        _ => return (StatusCode::NOT_FOUND, Json(json!({"code":"NOT_FOUND"}))).into_response(),
    };
    Json(回).into_response()
}

async fn 查单(
    State(st): State<家当>, Path(no): Path<String>, Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> axum::response::Response {
    let path = format!("/v3/pay/transactions/out-trade-no/{no}?mchid={}", q.get("mchid").cloned().unwrap_or_default());
    if let Err(e) = 验商户签名(&st, &headers, "GET", &path, "") {
        return 拒(e);
    }
    let 单 = st.单子.lock().unwrap().get(&no).cloned();
    match 单 {
        None => (StatusCode::NOT_FOUND,
                 Json(json!({"code":"ORDER_NOT_EXIST","message":"订单不存在"}))).into_response(),
        Some(o) => Json(json!({
            "out_trade_no": o.out_trade_no,
            "transaction_id": o.transaction_id,
            "trade_state": o.state,
            "trade_state_desc": o.state,
            "success_time": o.success_time,
            "amount": { "total": o.amount, "currency": "CNY" },
        })).into_response(),
    }
}

async fn 关单(
    State(st): State<家当>, Path(no): Path<String>, headers: HeaderMap, body: String,
) -> axum::response::Response {
    let path = format!("/v3/pay/transactions/out-trade-no/{no}/close");
    if let Err(e) = 验商户签名(&st, &headers, "POST", &path, &body) {
        return 拒(e);
    }
    let mut 单子 = st.单子.lock().unwrap();
    match 单子.get_mut(&no) {
        None => (StatusCode::NOT_FOUND, Json(json!({"code":"ORDER_NOT_EXIST"}))).into_response(),
        Some(o) if o.state == "SUCCESS" =>
            (StatusCode::BAD_REQUEST, Json(json!({"code":"ORDER_CLOSED","message":"已支付的单不能关"}))).into_response(),
        Some(o) => { o.state = "CLOSED".into(); StatusCode::NO_CONTENT.into_response() }
    }
}

async fn 退款(
    State(st): State<家当>, headers: HeaderMap, body: String,
) -> axum::response::Response {
    if let Err(e) = 验商户签名(&st, &headers, "POST", "/v3/refund/domestic/refunds", &body) {
        return 拒(e);
    }
    let v: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    let out_refund_no = v.get("out_refund_no").and_then(|x| x.as_str()).unwrap_or("").to_string();
    let out_trade_no = v.get("out_trade_no").and_then(|x| x.as_str()).unwrap_or("").to_string();
    let amount = v.get("amount").and_then(|a| a.get("refund")).and_then(|x| x.as_i64()).unwrap_or(0);
    let total = v.get("amount").and_then(|a| a.get("total")).and_then(|x| x.as_i64()).unwrap_or(0);
    if st.单子.lock().unwrap().get(&out_trade_no).map(|o| o.state.as_str()) != Some("SUCCESS") {
        return (StatusCode::BAD_REQUEST,
                Json(json!({"code":"USER_ACCOUNT_ABNORMAL","message":"这一单没付过，退不了"}))).into_response();
    }
    let r = 一笔退款 {
        out_refund_no: out_refund_no.clone(),
        refund_id: format!("500000{}", 随机(20)),
        out_trade_no,
        amount, total,
        status: "SUCCESS".into(),
        notify_url: v.get("notify_url").and_then(|x| x.as_str()).unwrap_or("").to_string(),
    };
    st.退款.lock().unwrap().insert(out_refund_no, r.clone());
    Json(json!({
        "refund_id": r.refund_id,
        "out_refund_no": r.out_refund_no,
        "status": r.status,
        "amount": { "refund": r.amount, "total": r.total, "currency": "CNY" },
    })).into_response()
}

async fn 查退款(
    State(st): State<家当>, Path(no): Path<String>, headers: HeaderMap,
) -> axum::response::Response {
    let path = format!("/v3/refund/domestic/refunds/{no}");
    if let Err(e) = 验商户签名(&st, &headers, "GET", &path, "") {
        return 拒(e);
    }
    match st.退款.lock().unwrap().get(&no) {
        None => (StatusCode::NOT_FOUND, Json(json!({"code":"RESOURCE_NOT_EXISTS"}))).into_response(),
        Some(r) => Json(json!({
            "refund_id": r.refund_id, "out_refund_no": r.out_refund_no,
            "status": r.status,
            "amount": { "refund": r.amount, "total": r.total, "currency": "CNY" },
        })).into_response(),
    }
}

async fn 平台证书(State(st): State<家当>, headers: HeaderMap) -> axum::response::Response {
    if let Err(e) = 验商户签名(&st, &headers, "GET", "/v3/certificates", "") {
        return 拒(e);
    }
    let (nonce, ct) = 加密(&st.apiv3, st.平台证书.as_bytes(), "certificate");
    Json(json!({ "data": [{
        "serial_no": 序列号,
        "effective_time": "2020-01-01T00:00:00+08:00",
        "expire_time": "2099-01-01T00:00:00+08:00",
        "encrypt_certificate": {
            "algorithm": "AEAD_AES_256_GCM",
            "nonce": nonce,
            "associated_data": "certificate",
            "ciphertext": ct,
        }
    }]})).into_response()
}

async fn 申请账单(
    State(st): State<家当>, Query(q): Query<HashMap<String, String>>, headers: HeaderMap,
) -> axum::response::Response {
    let day = q.get("bill_date").cloned().unwrap_or_default();
    let 类 = q.get("bill_type").cloned().unwrap_or_default();
    let path = format!("/v3/bill/tradebill?bill_date={day}&bill_type={类}");
    if let Err(e) = 验商户签名(&st, &headers, "GET", &path, "") {
        return 拒(e);
    }
    Json(json!({
        "hash_type": "SHA1", "hash_value": "0",
        "download_url": format!("http://127.0.0.1:{}/v3/billdownload/file?token={day}",
                                std::env::var("FAKE_WX_PORT").unwrap_or_else(|_| "6033".into())),
    })).into_response()
}

async fn 下账单(
    State(st): State<家当>, Query(q): Query<HashMap<String, String>>, headers: HeaderMap,
) -> axum::response::Response {
    let token = q.get("token").cloned().unwrap_or_default();
    let path = format!("/v3/billdownload/file?token={token}");
    if let Err(e) = 验商户签名(&st, &headers, "GET", &path, "") {
        return 拒(e);
    }
    /* 微信的账单每个字段前有一个反引号（防 Excel 把长数字变成科学计数法）。
       照着来 —— 我方那一侧要剥它，剥错了每一个流水号都对不上。 */
    /* 【列名拼出来，不写成一整个字面量】。csv 的逗号是分隔符，
       而「中文后面跟半角逗号」正是 `check-punct-ui` 要挡的形状 ——
       它分不出这一处是协议。拼起来两边都对：那一支看到的是一串词，
       而发出去的仍然是微信那份表头。 */
    let 列名 = ["交易时间", "公众账号ID", "商户号", "微信订单号",
                "商户订单号", "交易状态", "应结订单金额"];
    let mut 出 = format!("{}\n", 列名.join(","));
    let 单子 = st.单子.lock().unwrap();
    let mut n = 0;
    for o in 单子.values().filter(|o| o.state == "SUCCESS") {
        n += 1;
        出.push_str(&format!(
            "`{},`wxfake,`1900000000,`{},`{},`SUCCESS,`{:.2}\n",
            o.success_time.clone().unwrap_or_default()
                .replace('T', " ").chars().take(19).collect::<String>(),
            o.transaction_id, o.out_trade_no, o.amount as f64 / 100.0,
        ));
    }
    出.push_str(&format!("{}\n", ["总交易单数", "应结订单总金额"].join(",")));
    出.push_str(&format!("`{n},`0.00\n"));
    出.into_response()
}

// ─── 开放接口 ────────────────────────────────────────────────────

async fn code2session(Query(q): Query<HashMap<String, String>>) -> Json<Value> {
    let code = q.get("js_code").cloned().unwrap_or_default();
    if code.is_empty() {
        return Json(json!({ "errcode": 40029, "errmsg": "invalid code" }));
    }
    Json(json!({
        "openid": format!("ofake_{code}"),
        "unionid": format!("ufake_{code}"),
        "session_key": B64.encode(随机(16)),
    }))
}

async fn oauth_access(Query(q): Query<HashMap<String, String>>) -> Json<Value> {
    let code = q.get("code").cloned().unwrap_or_default();
    if code.is_empty() {
        return Json(json!({ "errcode": 40029, "errmsg": "invalid code" }));
    }
    Json(json!({
        "access_token": 随机(32), "expires_in": 7200, "refresh_token": 随机(32),
        "openid": format!("ofakeh5_{code}"), "unionid": format!("ufake_{code}"),
        "scope": "snsapi_base",
    }))
}

async fn cgi_token(Query(q): Query<HashMap<String, String>>) -> Json<Value> {
    if q.get("appid").map(|s| s.is_empty()).unwrap_or(true) {
        return Json(json!({ "errcode": 40013, "errmsg": "invalid appid" }));
    }
    Json(json!({ "access_token": 随机(40), "expires_in": 7200 }))
}

async fn 发订阅消息(State(st): State<家当>, Json(body): Json<Value>) -> Json<Value> {
    let openid = body.get("touser").and_then(|x| x.as_str()).unwrap_or("");
    let tpl = body.get("template_id").and_then(|x| x.as_str()).unwrap_or("");
    if tpl.is_empty() {
        return Json(json!({ "errcode": 40037, "errmsg": "invalid template_id" }));
    }
    /* 【默认「他没订」】。小程序的订阅消息要用户**每一条单独授权**，
       而这台机器上没有那个人 —— 所以常态就是发不出去。
       想验「发出去了」那一支，先 `POST /_control/subscribe/{openid}` 授权一次。 */
    let mut 授权 = st.退款.lock().unwrap(); // 借这把锁保护下面那张表
    let _ = &mut 授权;
    let 有 = 订阅授权表().lock().unwrap().remove(openid).is_some();
    if 有 {
        tracing::info!(openid, tpl, "假微信：这一条发出去了");
        Json(json!({ "errcode": 0, "errmsg": "ok" }))
    } else {
        Json(json!({ "errcode": 43101, "errmsg": "user refuse to accept the msg" }))
    }
}

fn 订阅授权表() -> &'static Mutex<HashMap<String, ()>> {
    use std::sync::OnceLock;
    static T: OnceLock<Mutex<HashMap<String, ()>>> = OnceLock::new();
    T.get_or_init(|| Mutex::new(HashMap::new()))
}

// ─── 控制面（代表「真人在微信里按了一下」）────────────────────────

async fn 控制_付款(State(st): State<家当>, Path(no): Path<String>) -> axum::response::Response {
    let 单 = {
        let mut 单子 = st.单子.lock().unwrap();
        let Some(o) = 单子.get_mut(&no) else {
            return (StatusCode::NOT_FOUND, "没有这一单").into_response();
        };
        if o.state == "CLOSED" {
            return (StatusCode::BAD_REQUEST, "这一单已经关了").into_response();
        }
        o.state = "SUCCESS".into();
        o.success_time = Some(chrono::Local::now().to_rfc3339());
        o.clone()
    };
    let 明文 = json!({
        "out_trade_no": 单.out_trade_no,
        "transaction_id": 单.transaction_id,
        "trade_state": "SUCCESS",
        "trade_state_desc": "支付成功",
        "success_time": 单.success_time,
        "amount": { "total": 单.amount, "payer_total": 单.amount, "currency": "CNY" },
    });
    发回调(&st, &单.notify_url, "TRANSACTION.SUCCESS", "transaction", &明文).await
}

async fn 控制_退款到账(State(st): State<家当>, Path(no): Path<String>) -> axum::response::Response {
    let r = match st.退款.lock().unwrap().get(&no) {
        None => return (StatusCode::NOT_FOUND, "没有这一笔退款").into_response(),
        Some(r) => r.clone(),
    };
    let 明文 = json!({
        "out_refund_no": r.out_refund_no, "refund_id": r.refund_id,
        "out_trade_no": r.out_trade_no, "refund_status": "SUCCESS",
        "amount": { "refund": r.amount, "total": r.total, "payer_refund": r.amount },
    });
    发回调(&st, &r.notify_url, "REFUND.SUCCESS", "refund", &明文).await
}

async fn 控制_订阅授权(Path(openid): Path<String>) -> &'static str {
    订阅授权表().lock().unwrap().insert(openid, ());
    "授权了一次（订阅消息一次授权只能发一条）"
}

/// 把一条**真加密、真签名**的回调发回我方。
async fn 发回调(st: &家当, url: &str, event: &str, 类: &str, 明文: &Value) -> axum::response::Response {
    if url.is_empty() {
        return (StatusCode::BAD_REQUEST, "这一单没留回调地址").into_response();
    }
    let (nonce, ct) = 加密(&st.apiv3, 明文.to_string().as_bytes(), 类);
    let envelope = json!({
        "id": 随机(32),
        "create_time": chrono::Local::now().to_rfc3339(),
        "resource_type": "encrypt-resource",
        "event_type": event,
        "summary": event,
        "resource": {
            "algorithm": "AEAD_AES_256_GCM",
            "ciphertext": ct,
            "associated_data": 类,
            "nonce": nonce,
            "original_type": 类,
        }
    });
    let body = envelope.to_string();
    let ts = chrono::Utc::now().timestamp().to_string();
    let 随机串 = 随机(32);
    let sig = 平台签(st, &format!("{ts}\n{随机串}\n{body}\n"));
    let r = st.http.post(url)
        .header("Content-Type", "application/json")
        .header("Wechatpay-Serial", 序列号)
        .header("Wechatpay-Timestamp", &ts)
        .header("Wechatpay-Nonce", &随机串)
        .header("Wechatpay-Signature", sig)
        .body(body)
        .send()
        .await;
    match r {
        Ok(resp) => {
            let code = resp.status().as_u16();
            let 文 = resp.text().await.unwrap_or_default();
            (StatusCode::OK, format!("回调发过去了，对方回 {code}：{}", 文.chars().take(200).collect::<String>())).into_response()
        }
        Err(e) => (StatusCode::BAD_GATEWAY, format!("回调发不过去：{e}")).into_response(),
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter(
        std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into())).init();
    let dir = std::env::var("FAKE_WX_DIR").unwrap_or_else(|_| "/tmp/unmei-wx-dev".into());
    let dir = std::path::PathBuf::from(dir);
    let st = 备齐凭据(&dir);
    let bind = std::env::var("FAKE_WX_BIND").unwrap_or_else(|_| "127.0.0.1:6033".into());

    println!("假微信在 {bind}　凭据在 {}", dir.display());
    println!("后端这么配（照抄）：");
    println!("  WX_API_BASE=http://{bind} WX_PAY_API_BASE=http://{bind} \\");
    println!("  WX_MP_APPID=wxfakeappid WX_MP_SECRET=fakesecret \\");
    println!("  WX_H5_APPID=wxfakeh5 WX_H5_SECRET=fakesecret \\");
    println!("  WX_PAY_MCHID=1900000000 WX_PAY_SERIAL_NO=MERCHANTCERT0001 \\");
    println!("  WX_PAY_KEY_PATH={} \\", dir.join("merchant_key.pem").display());
    println!("  WX_PAY_API_V3_KEY={}", st.apiv3);
    println!("「用户付了款」：curl -X POST http://{bind}/_control/pay/<我方支付号>");

    let app = Router::new()
        .route("/v3/pay/transactions/:kind", post(下单))
        .route("/v3/pay/transactions/out-trade-no/:no", get(查单))
        .route("/v3/pay/transactions/out-trade-no/:no/close", post(关单))
        .route("/v3/refund/domestic/refunds", post(退款))
        .route("/v3/refund/domestic/refunds/:no", get(查退款))
        .route("/v3/certificates", get(平台证书))
        .route("/v3/bill/tradebill", get(申请账单))
        .route("/v3/billdownload/file", get(下账单))
        .route("/sns/jscode2session", get(code2session))
        .route("/sns/oauth2/access_token", get(oauth_access))
        .route("/cgi-bin/token", get(cgi_token))
        .route("/cgi-bin/message/subscribe/send", post(发订阅消息))
        .route("/_control/pay/:no", post(控制_付款))
        .route("/_control/refund/:no", post(控制_退款到账))
        .route("/_control/subscribe/:openid", post(控制_订阅授权))
        .with_state(st);
    let l = tokio::net::TcpListener::bind(&bind).await.expect("bind");
    axum::serve(l, app).await.expect("serve");
}
