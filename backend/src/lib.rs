pub mod config;
pub mod db;
pub mod models;
pub mod routes;
pub mod services;

use axum::{
    routing::{get, post},
    Router,
};
use db::DbManager;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

pub fn create_router(db: DbManager) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health
        .route("/api/health", get(routes::health::health_check))
        // Config & LLM Connection
        .route("/api/config", get(routes::config::handle_get_config))
        .route("/api/config", post(routes::config::handle_update_config))
        // Corpus & Intent Suggestion
        .route("/api/corpus", get(routes::corpus::list_corpus))
        .route("/api/corpus/random", get(routes::corpus::get_random_passage))
        .route("/api/corpus/suggest-passage", post(routes::corpus::handle_suggest_passage))
        .route("/api/corpus/{id}", get(routes::corpus::get_passage_by_id))
        .route("/api/corpus/ingest", post(routes::corpus::ingest_passage))
        .route("/api/corpus/{id}/suggest-intent", post(routes::corpus::handle_suggest_intent))
        // Sessions & Telemetry
        .route("/api/sessions/start", post(routes::sessions::handle_start_session))
        .route("/api/sessions/{id}", get(routes::sessions::handle_get_session))
        .route("/api/sessions/{id}/drift", post(routes::sessions::handle_record_drift))
        .route("/api/sessions/{id}/finish-reading", post(routes::sessions::handle_finish_reading))
        .route("/api/sessions/{id}/advance", post(routes::sessions::handle_advance_stage))
        .route("/api/sessions/{id}/abort", post(routes::sessions::handle_abort_session))
        // Drill Submissions & Semantic Evaluation
        .route("/api/sessions/{id}/submit-intent", post(routes::sessions::handle_submit_intent))
        .route("/api/sessions/{id}/submit-debrief", post(routes::sessions::handle_submit_debrief))
        // Analytics
        .route("/api/analytics/progress", get(routes::sessions::handle_get_analytics))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(db)
}
