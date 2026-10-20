use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use tracing::error;

use crate::{
    db::DbManager,
    models::{CorpusPassage, IngestRequest, IngestResponse, SuggestPassageRequest},
    services::corpus::{ingest_text_with_difficulty, is_valid_domain},
};

#[derive(Debug, Deserialize)]
pub struct CorpusQuery {
    pub domain: Option<String>,
}

/// Helper to convert a database row into a CorpusPassage struct
fn row_to_passage(row: &libsql::Row) -> Result<CorpusPassage, libsql::Error> {
    Ok(CorpusPassage {
        id: row.get(0)?,
        title: row.get(1)?,
        domain: row.get(2)?,
        source_attribution: row.get(3)?,
        passage_text: row.get(4)?,
        word_count: row.get(5)?,
        lexical_density_score: row.get(6)?,
        created_at: row.get(7)?,
    })
}

/// GET /api/corpus - List all passages, optionally filtered by domain
pub async fn list_corpus(
    State(db): State<DbManager>,
    Query(query): Query<CorpusQuery>,
) -> impl IntoResponse {
    let conn = match db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("Database connection error: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database connection error" })),
            );
        }
    };

    let result = if let Some(domain) = query.domain.as_deref() {
        if !is_valid_domain(domain) {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": format!("Invalid domain '{domain}'") })),
            );
        }
        conn.query(
            "SELECT id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at
             FROM reading_corpus WHERE domain = ?1 ORDER BY created_at DESC",
            [domain],
        )
        .await
    } else {
        conn.query(
            "SELECT id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at
             FROM reading_corpus ORDER BY created_at DESC",
            (),
        )
        .await
    };

    let mut rows = match result {
        Ok(r) => r,
        Err(e) => {
            error!("Database query error: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to query corpus" })),
            );
        }
    };

    let mut passages = Vec::new();
    while let Ok(Some(row)) = rows.next().await {
        if let Ok(passage) = row_to_passage(&row) {
            passages.push(passage);
        }
    }

    (StatusCode::OK, Json(serde_json::json!(passages)))
}

/// GET /api/corpus/random - Fetch a random passage, optionally filtered by domain
pub async fn get_random_passage(
    State(db): State<DbManager>,
    Query(query): Query<CorpusQuery>,
) -> impl IntoResponse {
    let conn = match db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("Database connection error: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database connection error" })),
            );
        }
    };

    let result = if let Some(domain) = query.domain.as_deref() {
        if !is_valid_domain(domain) {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": format!("Invalid domain '{domain}'") })),
            );
        }
        conn.query(
            "SELECT id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at
             FROM reading_corpus WHERE domain = ?1 ORDER BY RANDOM() LIMIT 1",
            [domain],
        )
        .await
    } else {
        conn.query(
            "SELECT id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at
             FROM reading_corpus ORDER BY RANDOM() LIMIT 1",
            (),
        )
        .await
    };

    let mut rows = match result {
        Ok(r) => r,
        Err(e) => {
            error!("Database query error: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to query random passage" })),
            );
        }
    };

    match rows.next().await {
        Ok(Some(row)) => match row_to_passage(&row) {
            Ok(passage) => (StatusCode::OK, Json(serde_json::json!(passage))),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to parse passage row: {e}") })),
            ),
        },
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "No passages available in corpus" })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Database error: {e}") })),
        ),
    }
}

/// GET /api/corpus/:id - Fetch a specific passage by ID
pub async fn get_passage_by_id(
    State(db): State<DbManager>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let conn = match db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("Database connection error while fetching passage '{id}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Database connection error: {e}") })),
            );
        }
    };

    let mut rows = match conn
        .query(
            "SELECT id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at
             FROM reading_corpus WHERE id = ?1",
            [id.clone()],
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            error!("Database query error while fetching passage '{id}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Database error: {e}") })),
            );
        }
    };

    match rows.next().await {
        Ok(Some(row)) => match row_to_passage(&row) {
            Ok(passage) => (StatusCode::OK, Json(serde_json::json!(passage))),
            Err(e) => {
                error!("Row parse error for passage '{id}': {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": format!("Row parse error: {e}") })),
                )
            }
        },
        Ok(None) => {
            tracing::warn!("Passage '{id}' not found");
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": format!("Passage '{id}' not found") })),
            )
        }
        Err(e) => {
            error!("Database row read error for passage '{id}': {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Database error: {e}") })),
            )
        }
    }
}

/// POST /api/corpus/ingest - Ingest, validate, chunk, and store custom text
pub async fn ingest_passage(
    State(db): State<DbManager>,
    Json(payload): Json<IngestRequest>,
) -> impl IntoResponse {
    // Security limit: reject payloads exceeding 10MB to prevent memory exhaustion
    if payload.text.len() > 10_000_000 {
        tracing::warn!(
            "Rejected corpus ingest for '{}': payload size {} exceeds 10MB limit",
            payload.title,
            payload.text.len()
        );
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(serde_json::json!({ "error": "Text payload exceeds maximum size limit of 10MB" })),
        );
    }

    match ingest_text_with_difficulty(
        &db,
        &payload.title,
        &payload.domain,
        &payload.source_attribution,
        &payload.text,
        payload.difficulty.as_deref(),
    )
    .await
    {
        Ok(passages) => {
            let count = passages.len();
            tracing::info!(
                "Ingested custom text '{}' (domain='{}') into {} passage(s)",
                payload.title,
                payload.domain,
                count
            );
            (
                StatusCode::CREATED,
                Json(serde_json::json!(IngestResponse {
                    message: format!("Successfully ingested text into {count} passage(s)"),
                    passages_created: count,
                    passages,
                })),
            )
        }
        Err(e) => {
            tracing::warn!(
                "Failed to ingest custom text '{}' (domain='{}'): {e}",
                payload.title,
                payload.domain
            );
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

/// POST /api/corpus/suggest-passage - Non-generative AI curator & deterministic section extractor
pub async fn handle_suggest_passage(
    State(db): State<DbManager>,
    Json(payload): Json<SuggestPassageRequest>,
) -> impl IntoResponse {
    match crate::services::llm::suggest_and_extract_passage(
        &db,
        payload.domain.as_deref(),
        payload.difficulty.as_deref(),
        payload.prompt_parameters.as_deref(),
        &payload.exclude_titles,
    )
    .await
    {
        Ok(suggestion) => (StatusCode::OK, Json(serde_json::json!(suggestion))),
        Err(e) => {
            error!("Failed to suggest and extract passage: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to curate passage: {e}") })),
            )
        }
    }
}

/// POST /api/corpus/{id}/suggest-intent - Suggest a pre-flight focus question
pub async fn handle_suggest_intent(
    State(db): State<DbManager>,
    Path(id): Path<String>,
    Json(payload): Json<crate::models::SuggestIntentRequest>,
) -> impl IntoResponse {
    let conn = match db.connect() {
        Ok(c) => c,
        Err(e) => {
            error!("Database connection error during suggest-intent for '{id}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Database error: {e}") })),
            );
        }
    };

    let mut rows = match conn
        .query(
            "SELECT id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at
             FROM reading_corpus WHERE id = ?1",
            [id.clone()],
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            error!("Database query error during suggest-intent for '{id}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Database error: {e}") })),
            );
        }
    };

    match rows.next().await {
        Ok(Some(row)) => {
            let passage = match row_to_passage(&row) {
                Ok(p) => p,
                Err(e) => {
                    error!("Failed to parse passage '{id}' during suggest-intent: {e}");
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": format!("Parse error: {e}") })),
                    );
                }
            };

            let suggestion = crate::services::llm::suggest_intent_question(
                &db,
                &passage.title,
                &passage.domain,
                &passage.passage_text,
                payload.lens.as_deref(),
            )
            .await;

            (StatusCode::OK, Json(serde_json::json!(suggestion)))
        }
        Ok(None) => {
            tracing::warn!("Cannot suggest intent: passage '{id}' not found");
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": format!("Passage '{id}' not found") })),
            )
        }
        Err(e) => {
            error!("Database error reading passage '{id}' during suggest-intent: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Database error: {e}") })),
            )
        }
    }
}
