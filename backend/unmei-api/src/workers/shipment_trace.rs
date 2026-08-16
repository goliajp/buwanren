//! shipment_trace_sweeper · 每 15min(dev:30s)拉物流 trace 推进状态。
//!
//! 流程:
//! 1. 选 status IN (picked_up, in_transit, out_for_delivery, exception) 的 shipment
//!    + tracking_no IS NOT NULL + carrier_code != 'manual'
//! 2. 调 carrier_adapter.query_trace
//! 3. 新事件 insert delta(by raw_event_id 去重)
//! 4. 最新事件 kind → 派生 status,UPDATE shipment

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
        // 去重 by (raw_source='kuaidi100', raw_event_id)
        let already: Option<i32> = sqlx::query_scalar(
            "SELECT 1 FROM shipment_trace_event WHERE raw_source='kuaidi100' AND raw_event_id=$1",
        ).bind(&rid).fetch_optional(&st.db).await?;
        if already.is_some() { continue; }

        sqlx::query(
            r#"INSERT INTO shipment_trace_event(
                 id, shipment_id, event_at, event_kind, location, description,
                 raw_source, raw_event_id, raw_payload_json
               ) VALUES ($1, $2, $3, $4, $5, $6, 'kuaidi100', $7, '{}'::jsonb)"#,
        ).bind(format!("ste-{}", Uuid::new_v4())).bind(sid)
         .bind(e.event_at).bind(&e.kind).bind(&e.location).bind(&e.description)
         .bind(&rid).execute(&st.db).await?;

        if e.event_at > latest_at {
            latest_at = e.event_at;
            latest_kind = Some(e.kind);
        }
    }

    if let Some(k) = latest_kind {
        let new_status = derive_status(&k);
        if new_status == "delivered" {
            // 走 service helper:同事务推 status + 写 ShipmentDelivered outbox
            if let Err(e) = app_shipment::mark_delivered(&st.db, sid).await {
                tracing::warn!("shipment::mark_delivered {sid}: {e}");
            }
        } else {
            sqlx::query(
                r#"UPDATE shipment SET status = $1
                   WHERE id=$2 AND status NOT IN ('delivered','returned','cancelled')"#,
            ).bind(new_status).bind(sid).execute(&st.db).await?;
        }
        tracing::debug!("shipment {sid} → {new_status} (latest event {k})");
    }
    Ok(())
}

fn derive_status(kind: &str) -> &'static str {
    match kind {
        "delivered"        => "delivered",
        "out_for_delivery" => "out_for_delivery",
        "picked_up"        => "picked_up",
        "exception"        => "exception",
        "returned"         => "returned",
        _                  => "in_transit",
    }
}
