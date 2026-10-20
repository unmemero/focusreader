use axum::{
    body::Body,
    http::{Request, StatusCode},
    routing::post,
    Json, Router,
};
use focusreader_backend::{
    create_router,
    db::DbManager,
    models::{
        DrillSession, StartSessionRequest, SubmitIntentRequest, SuggestIntentRequest,
        SuggestIntentResponse, UpdateConfigRequest,
    },
    services::seed::seed_corpus_if_needed,
};
use http_body_util::BodyExt;
use serde_json::json;
use tokio::net::TcpListener;
use tower::ServiceExt;

/// Mock Gemma OpenAI-compatible completions handler
async fn mock_chat_completions(Json(payload): Json<serde_json::Value>) -> impl axum::response::IntoResponse {
    let user_msg = payload["messages"]
        .as_array()
        .and_then(|msgs| msgs.last())
        .and_then(|m| m["content"].as_str())
        .unwrap_or("");

    if user_msg.contains("Target Focus Question:")
        || user_msg.contains("Write ONE guiding question")
    {
        // Return simulated Gemma focus question
        let resp = json!({
            "choices": [{
                "message": {
                    "content": "How does HTTP cache validation maintain state consistency without query latency?"
                }
            }]
        });
        (StatusCode::OK, Json(resp))
    } else {
        // Return simulated structured evaluation
        let raw_eval = json!({
            "clarity_score": 0.85,
            "conciseness_score": 0.90,
            "insight_score": 0.80,
            "constructive_feedback": "Accurately captured the core memory and latency trade-off."
        });
        let resp = json!({
            "choices": [{
                "message": {
                    "content": raw_eval.to_string()
                }
            }]
        });
        (StatusCode::OK, Json(resp))
    }
}

#[tokio::test]
async fn test_gemma_online_mock_evaluation_flow() {
    // 1. Start mock LLM HTTP daemon on ephemeral port
    let mock_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = mock_listener.local_addr().unwrap();
    let mock_app = Router::new().route("/v1/chat/completions", post(mock_chat_completions));

    tokio::spawn(async move {
        axum::serve(mock_listener, mock_app).await.unwrap();
    });

    let mock_base_url = format!("http://{}", mock_addr);

    // 2. Setup FocusReader app
    let db = DbManager::init(":memory:").await.unwrap();
    seed_corpus_if_needed(&db).await.unwrap();
    let app = create_router(db.clone());

    // 3. Configure FocusReader to point to mock Gemma
    let update_cfg = UpdateConfigRequest {
        llm_base_url: Some(mock_base_url),
        llm_model: Some("gemma-2-9b-it".to_string()),
        llm_timeout_seconds: Some(5),
    };
    let cfg_req = Request::builder()
        .uri("/api/config")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&update_cfg).unwrap()))
        .unwrap();
    let cfg_res = app.clone().oneshot(cfg_req).await.unwrap();
    assert_eq!(cfg_res.status(), StatusCode::OK);

    // 4. Test Gemma suggest intent question
    let suggest_req = Request::builder()
        .uri("/api/corpus/seed_cs_rfc9110/suggest-intent")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&SuggestIntentRequest {
                lens: Some("bottleneck_tradeoff".to_string()),
            })
            .unwrap(),
        ))
        .unwrap();
    let suggest_res = app.clone().oneshot(suggest_req).await.unwrap();
    assert_eq!(suggest_res.status(), StatusCode::OK);
    let suggest_body = suggest_res.into_body().collect().await.unwrap().to_bytes();
    let suggestion: SuggestIntentResponse = serde_json::from_slice(&suggest_body).unwrap();
    assert_eq!(suggestion.source, "gemma");
    assert!(suggestion.suggested_question.contains("HTTP cache validation"));

    // 5. Start session and submit intent for Gemma semantic evaluation
    let start_req = Request::builder()
        .uri("/api/sessions/start")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&StartSessionRequest {
                corpus_id: "seed_cs_rfc9110".to_string(),
                drill_type: Some("sequential_pipeline".to_string()),
            })
            .unwrap(),
        ))
        .unwrap();
    let start_res = app.clone().oneshot(start_req).await.unwrap();
    let start_body = start_res.into_body().collect().await.unwrap().to_bytes();
    let session: DrillSession = serde_json::from_slice(&start_body).unwrap();

    let submit_req = Request::builder()
        .uri(format!("/api/sessions/{}/submit-intent", session.id))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&SubmitIntentRequest {
                focus_lens: "bottleneck_tradeoff".to_string(),
                target_question: suggestion.suggested_question,
                user_synthesis: "Caching mitigates latency bottlenecks, requiring freshness invalidation mechanisms.".to_string(),
                response_latency_seconds: Some(14),
            })
            .unwrap(),
        ))
        .unwrap();

    let submit_res = app.oneshot(submit_req).await.unwrap();
    assert_eq!(submit_res.status(), StatusCode::OK);
    let submit_body = submit_res.into_body().collect().await.unwrap().to_bytes();
    let submit_json: serde_json::Value = serde_json::from_slice(&submit_body).unwrap();

    // Verify structured evaluation results
    let eval = &submit_json["evaluation"];
    assert_eq!(eval["evaluation_status"], "completed");
    assert_eq!(eval["clarity_score"], 0.85);
    assert_eq!(eval["conciseness_score"], 0.90);
    assert_eq!(eval["insight_score"], 0.80);
    assert_eq!(eval["composite_score"], 0.85); // 0.4*0.85 + 0.3*0.90 + 0.3*0.80 = 0.34 + 0.27 + 0.24 = 0.85
    assert_eq!(eval["evaluator_model"], "gemma-2-9b-it");
    assert!(eval["constructive_feedback"].as_str().unwrap().contains("Accurately captured"));
}
