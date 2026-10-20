use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use tracing::{error, info, warn};

use crate::{
    db::DbManager,
    models::{
        AdvanceStageRequest, FinishReadingRequest, RecordDriftRequest, StartSessionRequest,
        SubmitDebriefRequest, SubmitIntentRequest,
    },
    services::session::{
        abort_session, advance_session_stage, finish_reading_phase, get_analytics_progress,
        get_session_details, record_drift_event, save_session_debrief, save_session_intent,
        start_session,
    },
};

/// POST /api/sessions/start - Initialize a new drill session
pub async fn handle_start_session(
    State(db): State<DbManager>,
    Json(payload): Json<StartSessionRequest>,
) -> impl IntoResponse {
    match start_session(&db, &payload.corpus_id, payload.drill_type.as_deref()).await {
        Ok(session) => {
            info!(
                "Started drill session '{}' for corpus '{}' (drill_type='{}', initial_stage='{}')",
                session.id, session.corpus_id, session.drill_type, session.current_stage
            );
            (StatusCode::CREATED, Json(serde_json::json!(session)))
        }
        Err(e) => {
            error!(
                "Failed to start session (corpus_id='{}', drill_type={:?}): {e}",
                payload.corpus_id, payload.drill_type
            );
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// GET /api/sessions/{id} - Get complete session state and drift telemetry
pub async fn handle_get_session(
    State(db): State<DbManager>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match get_session_details(&db, &id).await {
        Ok(details) => (StatusCode::OK, Json(serde_json::json!(details))),
        Err(e) => {
            warn!("Failed to get session details for '{id}': {e}");
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// POST /api/sessions/{id}/drift - Record timestamped drift event
pub async fn handle_record_drift(
    State(db): State<DbManager>,
    Path(id): Path<String>,
    Json(payload): Json<RecordDriftRequest>,
) -> impl IntoResponse {
    match record_drift_event(&db, &id, payload.elapsed_seconds, payload.line_number).await {
        Ok(event) => (StatusCode::CREATED, Json(serde_json::json!(event))),
        Err(e) => {
            warn!(
                "Rejected drift event for session '{id}' (elapsed_seconds={}, line_number={:?}): {e}",
                payload.elapsed_seconds, payload.line_number
            );
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// POST /api/sessions/{id}/finish-reading - Finalize reading duration and calculate WPM
pub async fn handle_finish_reading(
    State(db): State<DbManager>,
    Path(id): Path<String>,
    Json(payload): Json<FinishReadingRequest>,
) -> impl IntoResponse {
    match finish_reading_phase(&db, &id, payload.duration_seconds).await {
        Ok(session) => {
            info!(
                "Finished reading phase for session '{id}': duration={}s, wpm={}, drifts={}",
                session.duration_seconds, session.words_per_minute, session.drift_count
            );
            (StatusCode::OK, Json(serde_json::json!(session)))
        }
        Err(e) => {
            warn!(
                "Failed to finish reading phase for session '{id}' (duration_seconds={}): {e}",
                payload.duration_seconds
            );
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// POST /api/sessions/{id}/advance - Advance stage in the sequential pipeline
pub async fn handle_advance_stage(
    State(db): State<DbManager>,
    Path(id): Path<String>,
    Json(payload): Json<AdvanceStageRequest>,
) -> impl IntoResponse {
    match advance_session_stage(&db, &id, payload.next_stage.as_deref()).await {
        Ok(session) => {
            info!(
                "Advanced session '{id}' to stage '{}' (status='{}')",
                session.current_stage, session.status
            );
            (StatusCode::OK, Json(serde_json::json!(session)))
        }
        Err(e) => {
            warn!(
                "Failed to advance stage for session '{id}' (requested={:?}): {e}",
                payload.next_stage
            );
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// POST /api/sessions/{id}/abort - Abort an active session
pub async fn handle_abort_session(
    State(db): State<DbManager>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match abort_session(&db, &id).await {
        Ok(session) => {
            info!("Aborted session '{id}'");
            (StatusCode::OK, Json(serde_json::json!(session)))
        }
        Err(e) => {
            warn!("Failed to abort session '{id}': {e}");
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// GET /api/analytics/progress - Get time-series progress and telemetry
pub async fn handle_get_analytics(State(db): State<DbManager>) -> impl IntoResponse {
    match get_analytics_progress(&db).await {
        Ok(progress) => (StatusCode::OK, Json(serde_json::json!(progress))),
        Err(e) => {
            error!("Failed to compute analytics progress: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// POST /api/sessions/{id}/submit-intent - Submit pre-flight intent synthesis and trigger evaluation
pub async fn handle_submit_intent(
    State(db): State<DbManager>,
    Path(id): Path<String>,
    Json(payload): Json<SubmitIntentRequest>,
) -> impl IntoResponse {
    let session = match get_session_details(&db, &id).await {
        Ok(s) => s,
        Err(e) => {
            warn!("Cannot submit intent: session '{id}' not found: {e}");
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": format!("Session not found: {e}") })),
            );
        }
    };

    let intent = match save_session_intent(
        &db,
        &id,
        &payload.focus_lens,
        &payload.target_question,
        &payload.user_synthesis,
        payload.response_latency_seconds,
    )
    .await
    {
        Ok(i) => i,
        Err(e) => {
            error!("Failed to save intent for session '{id}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to save intent: {e}") })),
            );
        }
    };

    let evaluation = match crate::services::llm::evaluate_synthesis(
        &db,
        &id,
        "intent_answer",
        &intent.id,
        &session.passage.passage_text,
        &payload.target_question,
        &payload.user_synthesis,
    )
    .await
    {
        Ok(ev) => ev,
        Err(e) => {
            error!("Intent evaluation error for session '{id}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Evaluation failed: {e}") })),
            );
        }
    };

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "intent": intent,
            "evaluation": evaluation
        })),
    )
}

/// POST /api/sessions/{id}/submit-debrief - Submit 3-sentence debrief and trigger evaluation
pub async fn handle_submit_debrief(
    State(db): State<DbManager>,
    Path(id): Path<String>,
    Json(payload): Json<SubmitDebriefRequest>,
) -> impl IntoResponse {
    let session = match get_session_details(&db, &id).await {
        Ok(s) => s,
        Err(e) => {
            warn!("Cannot submit debrief: session '{id}' not found: {e}");
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": format!("Session not found: {e}") })),
            );
        }
    };

    let debrief = match save_session_debrief(
        &db,
        &id,
        &payload.core_premise,
        &payload.pivot_or_surprise,
        &payload.implication,
    )
    .await
    {
        Ok(d) => d,
        Err(e) => {
            error!("Failed to save debrief for session '{id}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to save debrief: {e}") })),
            );
        }
    };

    let combined_synthesis = format!(
        "Core Premise: {}\nPivot/Surprise: {}\nImplication: {}",
        payload.core_premise, payload.pivot_or_surprise, payload.implication
    );

    let evaluation = match crate::services::llm::evaluate_synthesis(
        &db,
        &id,
        "three_sentence",
        &debrief.id,
        &session.passage.passage_text,
        "3-Sentence Synthesis Debrief (Core Premise, Pivot/Nuance, Implication)",
        &combined_synthesis,
    )
    .await
    {
        Ok(ev) => ev,
        Err(e) => {
            error!("Debrief evaluation error for session '{id}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Evaluation failed: {e}") })),
            );
        }
    };

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "debrief": debrief,
            "evaluation": evaluation
        })),
    )
}
