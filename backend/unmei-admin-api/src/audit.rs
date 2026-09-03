//! 后台写操作留痕。
//!
//! 【`audit_log` 这张表建好了，一条都没写过】——从建库到 2026-09-03，
//! `SELECT COUNT(*) FROM audit_log` 是 0，而整个仓库里没有一处代码写它。
//! seed 里还留着四条示例行，说明当初想清楚了格式（`action` 用「域.动作」、
//! `diff` 存前后），只是没有人接上去。
//!
//! 与此同时，后台上有十八个写操作:批退款、取消订单、关账、结对账、
//! 结风控案子 —— 全是花钱或改账的事。它们各自往业务表的 `audit_note`
//! 文本列里拼一句话，那能回答「这条记录被谁动过」，
//! 回答不了「今天这个人做了什么」，也回答不了「谁批的那笔退款」。
//!
//! 【做成中间件而不是逐处调用】。十八处手抄必然漏一两处，
//! 而漏掉的那处正好是出事时要查的那处 —— 留痕这件事，
//! 覆盖不全等于没有:查不到就只能假设它没发生过。
//! 中间件拿得到方法、路径、状态码，新加的写端点自动进来。

use axum::{
    body::Body,
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use serde_json::json;

use crate::auth::decode_token;
use crate::state::AppState;

/// 从路径推出「域.动作」与操作对象。
///
/// `/admin/commerce/refunds/rfd-123/approve` → `refund.approve` / `refund` / `rfd-123`
///
/// 【路径就是这件事本身】——不额外维护一张「路由 → 动作名」的表:
/// 那张表会跟路由脱节，而脱节的那天没有人会发现（漏记不报错）。
/// 这一段是不是一个 id（相对于「是一个动作名」）。
///
/// 【判据是「它是不是动作名」，不是「它长什么样」】。
/// 试过按形状认（`<前缀>-<uuid>`），而那要求 id 足够长 ——
/// 于是 id 的长度成了这段代码的前提，而那是会变的东西：
/// 短 id（`rfd-123`、`pb-9`）当场认不出来。
///
/// 动作名是**这个后台自己定的一小撮词**，而 id 是别的一切。
/// 加一条新路由时，如果它的动作名不在这张表里，
/// 单元测试 `id的形状认得准` 会当场红 —— 那时把它加进来。
fn 是个id(段: &str) -> bool {
    !动作名(段)
}

/// 后台路径里出现过的动作名。**加路由时要跟着加**。
///
/// 写成一张明表而不是一条正则:正则认的是形状，
/// 而这里要认的是「这个词是不是我们定的动作」——
/// 上一版拿「带不带短横」当形状判据，`mark-exception` 当场被当成了 id。
fn 动作名(段: &str) -> bool {
    const 动作: &[&str] = &[
        "annotate", "cancel", "retry", "approve", "deny", "resolve", "close",
        "state", "listing", "publish", "expire", "ban", "checkin", "batch",
        "mark-failed", "mark-exception", "assign-tracking", "skus", "registrations",
    ];
    动作.contains(&段)
}

fn 认出来(路径: &str) -> Option<(String, Option<String>, Option<String>)> {
    let 段: Vec<&str> = 路径.trim_start_matches('/').split('/').collect();
    // /admin/commerce/<域>/<id>/<动作>  或  /admin/commerce/<域>
    // /admin/<域>/<id>                  （quotes / users / feature_flags 那几支）
    let (域头, 余) = match 段.as_slice() {
        ["admin", "commerce", 余 @ ..] => ("", 余),
        ["admin", 余 @ ..] => ("", 余),
        _ => return None,
    };
    let _ = 域头;
    /* 【最后三段才是「域/对象/动作」】——上一版按【前】三段匹配，
       于是 `/recon/records/:id/resolve` 这种四段路径整个落进 `_ => None`，
       一声不吭地不留痕。审计门禁第一次跑就抓到了它:
       两条记上了、这一条没有。

       所以从后往前认:倒数第三段是域、倒数第二段是对象、最后一段是动作。
       `pricing/expire/:id` 那种「动作在中间」的形状单独认 —— 它是
       `<域>/<动作>/<id>`，倒过来看最后一段是 id 不是动作。 */
    let 域 = |i: usize| 余.get(i).map(|x| x.trim_end_matches('s').to_string());
    let n = 余.len();
    match n {
        // /<域>            —— 建一个
        1 => Some((format!("{}.create", 域(0)?), 域(0), None)),
        // /<域>/<id>       —— 改一个
        2 => Some((format!("{}.update", 域(0)?), 域(0), Some(余[1].to_string()))),
        // 三段以上:最后一段是动作还是 id?
        _ => {
            let 末 = 余[n - 1];
            /* 【要看的是【中间】那一段，不是最后一段】
               （2026-09-04 审计门禁补探针时抓到）。

               三段的两种形状，差别在中间：
                 · `<域>/<id>/<动作>`   —— 中间是 id
                 · `<域>/<动作>/<id>`   —— 中间是动作（`pricing/expire/<id>`）

               上一版拿【最后一段】判，判据是 `末.contains('-')` ——
               而这个后台的动作名是 kebab-case 的:`mark-exception`、
               `assign-tracking` 都带短横，于是它们被当成 id，
               走进第二种形状，把【运单号】写成了动作名。
               库里实测:`shipment.shp-e2-fe1beb42803e` 两条。
               留痕的全部意义是「谁改了什么」，而那两条的「什么」
               是一个每次都不一样的号 —— 按动作查是查不到的，看着却像有记录。

               改看中间那一段之后，两种形状各自成立，
               而且不再依赖「id 有多长」这种会变的事：
               动作名在中间时是一个词，id 在中间时有 `<前缀>-<uuid>` 的形状。 */
            let 中间是id = n == 3 && 是个id(余[1]);
            if n == 3 && !中间是id {
                // `<域>/<动作>/<id>`
                Some((format!("{}.{}", 域(0)?, 余[1]), 域(0), Some(末.to_string())))
            } else {
                // <…>/<域>/<对象>/<动作>
                Some((
                    format!("{}.{}", 域(n - 3)?, 末),
                    域(n - 3),
                    Some(余[n - 2].to_string()),
                ))
            }
        }
    }
}

/// 记一条。
///
/// **只记成功的写操作**。失败的那些没有改变任何东西，
/// 而把它们混进来会让这张表读起来像「有人试过很多次」——
/// 想查失败尝试的是另一件事（那属于访问日志），不该跟「谁改了什么」混在一起。
///
/// 记不下来【不影响业务返回】:审计是旁证，不是主路径。
/// 但它会 error 一行 —— 一张悄悄断掉的审计表比没有审计更糟，
/// 因为查的人会以为「这里什么都没发生」。
pub async fn 留痕(
    State(st): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let 方法 = req.method().clone();
    let 路径 = req.uri().path().to_string();
    let 是写 = matches!(方法.as_str(), "POST" | "PUT" | "PATCH" | "DELETE");

    // 登录那条自己记（它拿得到账号对不对），这里跳过 —— 不然
    // 每次失败登录都会尝试解一个还不存在的 token
    let 跳过 = !是写 || 路径 == "/admin/auth/login";

    let 管理员 = if 跳过 {
        None
    } else {
        req.headers()
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer ")))
            .and_then(|t| decode_token(t, &st.jwt_secret).ok())
            .map(|c| c.sub)
    };
    let 来源 = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());

    /* 【请求体正好就是「改成了什么」】。
       `{"status":"active"}`、`{"action":"known_fee","note":"差的是手续费"}`——
       查审计的人要的正是这个，而不只是「有人动过」。

       读 body 要先把它取出来再重建请求。后台是低频路径，
       这一次缓冲不值得心疼;但还是限个上限 —— 超了只记大小，
       不把一整个大请求塞进审计表（那会让这张表变得没法读）。 */
    const 体上限: usize = 8 * 1024;
    let (parts, body) = req.into_parts();
    let (体, req) = if 跳过 {
        (None, Request::from_parts(parts, body))
    } else {
        match axum::body::to_bytes(body, 体上限).await {
            Ok(b) => {
                let 记 = serde_json::from_slice::<serde_json::Value>(&b).ok();
                (记, Request::from_parts(parts, Body::from(b)))
            }
            // 读不出来（超上限、或者流断了）就不记内容 ——
            // 但请求本身还是要往下走，审计不该拦住业务
            Err(_) => (
                Some(json!({ "note": "请求体太大或读不出来，没记内容" })),
                Request::from_parts(parts, Body::empty()),
            ),
        }
    };

    let resp = next.run(req).await;

    if let (Some(admin_id), true) = (管理员, resp.status().is_success()) {
        if let Some((动作, 类型, 对象)) = 认出来(&路径) {
            let r = sqlx::query(
                "INSERT INTO audit_log(id, admin_id, action, target_type, target_id, diff, ip)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
            )
            .bind(format!("al-{}", uuid::Uuid::new_v4()))
            .bind(&admin_id)
            .bind(&动作)
            .bind(&类型)
            .bind(&对象)
            .bind(json!({
                "method": 方法.as_str(),
                "path": 路径,
                // 「改成了什么」——请求体本身。前值这里拿不到
                // （中间件不知道业务表长什么样），要前后对照的那几处
                // 各自往业务表的 audit_note 里写，两边互补。
                "body": 体,
            }))
            .bind(&来源)
            .execute(&st.db)
            .await;
            if let Err(e) = r {
                // 【断了要出声】。一张悄悄不写的审计表比没有更糟:
                // 查的人会以为这里什么都没发生过。
                tracing::error!(%e, admin_id, 动作, "审计没记下来");
            }
        }
    }
    resp
}

#[cfg(test)]
mod tests {
    use super::{认出来, 是个id, 动作名};

    #[test]
    fn 从路径认出域和动作() {
        assert_eq!(
            认出来("/admin/commerce/refunds/rfd-123/approve"),
            Some(("refund.approve".into(), Some("refund".into()), Some("rfd-123".into())))
        );
        assert_eq!(
            认出来("/admin/commerce/finance/periods/period-2026-09/close"),
            Some(("period.close".into(), Some("period".into()), Some("period-2026-09".into())))
        );
        assert_eq!(
            认出来("/admin/commerce/coupons"),
            Some(("coupon.create".into(), Some("coupon".into()), None))
        );
        assert_eq!(
            认出来("/admin/quotes/q01"),
            Some(("quote.update".into(), Some("quote".into()), Some("q01".into())))
        );
        /* 【四段的那种】——审计门禁第一次跑抓到的正是它:
           `/recon/records/:id/resolve` 上一版整个落进 None，不留痕。 */
        assert_eq!(
            认出来("/admin/commerce/recon/records/rr-abc/resolve"),
            Some(("record.resolve".into(), Some("record".into()), Some("rr-abc".into())))
        );
        assert_eq!(
            认出来("/admin/commerce/risk/cases/rc-1/state"),
            Some(("case.state".into(), Some("case".into()), Some("rc-1".into())))
        );
        // 动作在中间的那种
        assert_eq!(
            认出来("/admin/commerce/pricing/expire/pb-9"),
            Some(("pricing.expire".into(), Some("pricing".into()), Some("pb-9".into())))
        );
    }

    #[test]
    fn 不是后台的路径不认() {
        assert_eq!(认出来("/v1/orders"), None);
        assert_eq!(认出来("/health"), None);
    }

    /// 【动作名带短横，不是 id】（2026-09-04）。
    ///
    /// 上一版判据是 `末.contains('-')`，而这个后台的动作名是 kebab-case 的 ——
    /// 于是 `mark-exception` 被当成 id，把【运单号】写成了动作名。
    /// 库里实测两条 `shipment.shp-e2-fe1beb42803e`：
    /// 按动作查是查不到的，看着却像有记录。
    #[test]
    fn 带短横的动作名不许被当成id() {
        let (动作, 域, 对象) = 认出来("/admin/commerce/shipments/shp-abc123def456/mark-exception").unwrap();
        assert_eq!(动作, "shipment.mark-exception", "动作名被写成了别的东西");
        assert_eq!(域.as_deref(), Some("shipment"));
        assert_eq!(对象.as_deref(), Some("shp-abc123def456"));

        let (动作, _, _) = 认出来("/admin/commerce/shipments/shp-abc123def456/assign-tracking").unwrap();
        assert_eq!(动作, "shipment.assign-tracking");
    }

    /// 反面：动作【真的】在中间那一种（`<域>/<动作>/<id>`）仍要认得出来。
    /// 定价那条就是这个形状:`/pricing/expire/<id>`。
    #[test]
    fn 动作在中间那一种照旧认得出() {
        let (动作, 域, 对象) = 认出来("/admin/commerce/pricing/expire/pb-abc123def456").unwrap();
        assert_eq!(动作, "pricing.expire");
        assert_eq!(域.as_deref(), Some("pricing"));
        assert_eq!(对象.as_deref(), Some("pb-abc123def456"));
    }

    /// 【路径里每一个动作名都要在那张表里】。
    ///
    /// 不在的话，`<域>/<id>/<动作>` 这种路径会被认成
    /// `<域>/<动作>/<id>`，动作名就成了那个 id ——
    /// 库里实测过两条 `shipment.shp-e2-fe1beb42803e`。
    ///
    /// 这条测试直接从【路由表】里把动作名抠出来比，
    /// 所以加一条新路由而忘了加动作名时，它当场红。
    #[test]
    fn 路由表里的动作名一个都不许漏() {
        let 路由 = include_str!("routes/commerce.rs");
        let mut 漏了 = vec![];
        for 行 in 路由.lines() {
            let Some(i) = 行.find(".route(\"") else { continue };
            let 剩 = &行[i + 8..];
            let Some(j) = 剩.find('"') else { continue };
            let 路径 = &剩[..j];
            let 段: Vec<&str> = 路径.trim_start_matches('/').split('/').collect();
            // 只看「最后一段不是 :参数」的那些 —— 那一段就是动作名
            if let Some(末) = 段.last() {
                if !末.starts_with(':') && 段.len() >= 4 && 段[段.len() - 2].starts_with(':')
                    && !动作名(末)
                {
                    漏了.push(format!("{路径} → 「{末}」不在动作名表里"));
                }
            }
        }
        assert!(漏了.is_empty(), "这些动作名会被当成 id：\n  {}", 漏了.join("\n  "));
    }

    #[test]
    fn 动作名一个都不许被当成id() {
        for 动作 in ["mark-exception", "assign-tracking", "mark-failed", "close",
                     "resolve", "retry", "approve", "deny", "listing", "state",
                     "annotate", "cancel", "publish", "checkin", "ban", "batch"] {
            assert!(!是个id(动作), "「{动作}」被当成了 id");
        }
        // 反过来:id 就该是 id
        assert!(是个id("ord-4c739ef9-bef3-4fec-b7b0-1b2bec0ac7ac"));
        assert!(是个id("rfd-123"));
        assert!(是个id("pb-9"));
    }
}
