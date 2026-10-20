use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use tracing::error;

use crate::{
    db::DbManager,
    models::UpdateConfigRequest,
    services::llm::{get_llm_config, update_llm_config},
};

/// GET /api/config - Retrieve current configuration and LLM connection status
pub async fn handle_get_config(State(db): State<DbManager>) -> impl IntoResponse {
    match get_llm_config(&db).await {
        Ok(config) => (StatusCode::OK, Json(serde_json::json!(config))),
        Err(e) => {
            error!("Failed to retrieve configuration: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// POST /api/config - Update LLM settings and test connection
pub async fn handle_update_config(
    State(db): State<DbManager>,
    Json(payload): Json<UpdateConfigRequest>,
) -> impl IntoResponse {
    match update_llm_config(
        &db,
        payload.llm_base_url.as_deref(),
        payload.llm_model.as_deref(),
        payload.llm_timeout_seconds,
    )
    .await
    {
        Ok(updated) => (StatusCode::OK, Json(serde_json::json!(updated))),
        Err(e) => {
            tracing::warn!(
                "Failed to update LLM configuration (base_url={:?}, model={:?}, timeout={:?}): {e}",
                payload.llm_base_url,
                payload.llm_model,
                payload.llm_timeout_seconds
            );
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}
