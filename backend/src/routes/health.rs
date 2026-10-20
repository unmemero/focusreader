use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use chrono::Utc;

use crate::{db::DbManager, models::HealthResponse};

pub async fn health_check(State(db): State<DbManager>) -> impl IntoResponse {
    let db_status = match db.connect() {
        Ok(conn) => {
            match conn.query("SELECT 1", ()).await {
                Ok(_) => "connected".to_string(),
                Err(e) => format!("error: {e}"),
            }
        }
        Err(e) => format!("connection_failed: {e}"),
    };

    let response = HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: Utc::now(),
        database: db_status,
    };

    (StatusCode::OK, Json(response))
}
