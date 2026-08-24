//! shipment_trace_sweeper · 每 15min(dev:30s)拉物流 trace 推进状态。
//!
//! 流程:
//! 1. 选 status IN (picked_up, in_transit, out_for_delivery, exception) 的 shipment
//!    + tracking_no IS NOT NULL + carrier_code != 'manual'
//! 2. 调 carrier_adapter.query_trace
//! 3. 新事件 insert delta(by raw_event_id 去重)
//! 4. 最新事件 kind → 交给 `shipment::advance_status_now` 推进状态（用例层一份实现）

use chrono::Utc;
use sqlx::Row;
use std::time::Duration;
use unmei_domain::commerce::adapters::TraceEvent;
use unmei_app::shipment as app_shipment;
use uuid::Uuid;

use crate::state::AppState;

const INTERVAL_SECS: u64 = 30; // dev 30s;prod 改 15*60 = 900

pub async fn run(state: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(INTERVAL_SECS));
    tick.tick().await; // skip first immediate
    loop {
        tick.tick().await;
        if let Err(e) = sweep_once(&state).await {
            tracing::warn!("shipment_trace_sweeper failed: {e}");
        }
    }
}

async fn sweep_once(st: &AppState) -> anyhow::Result<()> {
    let rows = sqlx::query(
        r#"SELECT id, carrier_code, tracking_no
           FROM shipment
           WHERE status IN ('picked_up','in_transit','out_for_delivery','exception')
             AND tracking_no IS NOT NULL
             AND carrier_code <> 'manual'
           ORDER BY updated_at ASC
           LIMIT 50"#,
    ).fetch_all(&st.db).await?;
    if rows.is_empty() { return Ok(()); }
    tracing::debug!("shipment_trace_sweeper: scanning {} shipments", rows.len());

    for row in rows {
        let sid: String = row.try_get("id")?;
        let carrier: String = row.try_get("carrier_code")?;
        let no: String = row.try_get("tracking_no")?;

        let provider = if st.carrier_adapters.kuaidi100.supported_carriers().contains(&carrier.as_str()) {
            st.carrier_adapters.kuaidi100.clone()
        } else {
            continue;
        };

        let events = match provider.query_trace(&carrier, &no).await {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("query_trace {sid} {carrier}/{no}: {e}");
                continue;
            }
        };
        if let Err(e) = apply_trace(st, &sid, events).await {
            tracing::warn!("apply_trace {sid}: {e}");
        }
    }
    Ok(())
}

async fn apply_trace(st: &AppState, sid: &str, events: Vec<TraceEvent>) -> anyhow::Result<()> {
    if events.is_empty() { return Ok(()); }
    let mut latest_kind: Option<String> = None;
    let mut latest_at = chrono::DateTime::<Utc>::from_timestamp(0, 0).unwrap();

    for e in events {
        let rid = e.raw_event_id.clone().unwrap_or_else(|| format!("noid-{}", Uuid::new_v4()));
        /* 去重交给 `uq_trace_dedup (raw_source, raw_event_id)` —— 那个唯一索引
           本来就是为这件事建的，回调那条路（`shipment::apply_trace_webhook`）
           也是这么写的。
           这里原本是「先 SELECT 看在不在、再 INSERT」：两步之间有缝，
           两份轮询并行时会双双通过检查、然后撞唯一索引把这一趟打断。
           今天撞不上（单实例，而且 raw_source 与回调那条不同），
           但先查后做这个形状本身没有存在的理由 —— 库能保证的事不该用两步换。 */
        sqlx::query(
            r#"INSERT INTO shipment_trace_event(
                 id, shipment_id, event_at, event_kind, location, description,
                 raw_source, raw_event_id, raw_payload_json
               ) VALUES ($1, $2, $3, $4, $5, $6, 'kuaidi100', $7, '{}'::jsonb)
               ON CONFLICT (raw_source, raw_event_id) WHERE raw_event_id IS NOT NULL
               DO NOTHING"#,
        ).bind(format!("ste-{}", Uuid::new_v4())).bind(sid)
         .bind(e.event_at).bind(&e.kind).bind(&e.location).bind(&e.description)
         .bind(&rid).execute(&st.db).await?;

        if e.event_at > latest_at {
            latest_at = e.event_at;
            latest_kind = Some(e.kind);
        }
    }

    if let Some(k) = latest_kind {
        /* 状态怎么推，用例层说了算 —— 这里以前有自己的一份
           （`derive_status` + 自己的 UPDATE），跟回调那条各写各的，
           而差别全是 bug。现在两条路调同一个函数。 */
        if let Err(e) = app_shipment::advance_status_now(&st.db, sid, &k).await {
            tracing::warn!("shipment::advance_status {sid}: {e}");
        }
        tracing::debug!("shipment {sid} ← 最新事件 {k}");
    }
    Ok(())
}


