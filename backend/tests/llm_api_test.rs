use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use focusreader_backend::{
    create_router,
    db::DbManager,
    models::{
        ConfigResponse, DrillSession, SessionDetailResponse, StartSessionRequest,
        SubmitDebriefRequest, SubmitIntentRequest, SuggestIntentRequest, SuggestIntentResponse,
        UpdateConfigRequest,
    },
    services::seed::seed_corpus_if_needed,
};
use http_body_util::BodyExt;
use tower::ServiceExt;

async fn setup_app() -> (axum::Router, DbManager) {
    let db = DbManager::init(":memory:")
        .await
        .expect("Failed to initialize test DB");
    seed_corpus_if_needed(&db)
        .await
        .expect("Failed to seed initial corpus");
    let app = create_router(db.clone());
    (app, db)
}

#[tokio::test]
async fn test_config_endpoints_and_ssrf_protection() {
    let (app, _) = setup_app().await;

    // 1. GET /api/config
    let get_req = Request::builder()
        .uri("/api/config")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let get_res = app.clone().oneshot(get_req).await.unwrap();
    assert_eq!(get_res.status(), StatusCode::OK);
    let get_body = get_res.into_body().collect().await.unwrap().to_bytes();
    let config: ConfigResponse = serde_json::from_slice(&get_body).unwrap();
    assert!(!config.llm_base_url.is_empty());
    assert!(!config.llm_model.is_empty());

    // 2. POST /api/config with valid parameters
    let update_payload = UpdateConfigRequest {
        llm_base_url: Some("http://127.0.0.1:11434".to_string()),
        llm_model: Some("gemma-2-2b-it".to_string()),
        llm_timeout_seconds: Some(20),
    };

    let post_req = Request::builder()
        .uri("/api/config")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&update_payload).unwrap()))
        .unwrap();

    let post_res = app.clone().oneshot(post_req).await.unwrap();
    assert_eq!(post_res.status(), StatusCode::OK);
    let post_body = post_res.into_body().collect().await.unwrap().to_bytes();
    let updated_config: ConfigResponse = serde_json::from_slice(&post_body).unwrap();
    assert_eq!(updated_config.llm_base_url, "http://127.0.0.1:11434");
    assert_eq!(updated_config.llm_model, "gemma-2-2b-it");
    assert_eq!(updated_config.llm_timeout_seconds, 20);

    // 3. POST /api/config with malicious SSRF URL (must be rejected)
    let bad_ssrf_payload = UpdateConfigRequest {
        llm_base_url: Some("file:///etc/shadow".to_string()),
        llm_model: None,
        llm_timeout_seconds: None,
    };

    let bad_req = Request::builder()
        .uri("/api/config")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&bad_ssrf_payload).unwrap()))
        .unwrap();

    let bad_res = app.oneshot(bad_req).await.unwrap();
    assert_eq!(bad_res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_suggest_intent_offline_heuristic() {
    let (app, _) = setup_app().await;

    let payload = SuggestIntentRequest {
        lens: Some("bottleneck_tradeoff".to_string()),
    };

    let req = Request::builder()
        .uri("/api/corpus/seed_cs_rfc9110/suggest-intent")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let suggestion: SuggestIntentResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(suggestion.lens, "bottleneck_tradeoff");
    assert!(!suggestion.suggested_question.is_empty());
}

#[tokio::test]
async fn test_offline_resilience_submits_preserve_deterministic_state() {
    let (app, _) = setup_app().await;

    // 1. Point LLM config to an unreachable local port to test offline behavior
    let set_unreachable_cfg = UpdateConfigRequest {
        llm_base_url: Some("http://127.0.0.1:54321".to_string()),
        llm_model: Some("gemma-offline-test".to_string()),
        llm_timeout_seconds: Some(1),
    };
    let cfg_req = Request::builder()
        .uri("/api/config")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&set_unreachable_cfg).unwrap()))
        .unwrap();
    let cfg_res = app.clone().oneshot(cfg_req).await.unwrap();
    assert_eq!(cfg_res.status(), StatusCode::OK);

    // 2. Start session
    let start_payload = StartSessionRequest {
        corpus_id: "seed_cs_rfc9110".to_string(),
        drill_type: Some("sequential_pipeline".to_string()),
    };
    let start_req = Request::builder()
        .uri("/api/sessions/start")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&start_payload).unwrap()))
        .unwrap();
    let start_res = app.clone().oneshot(start_req).await.unwrap();
    assert_eq!(start_res.status(), StatusCode::CREATED);
    let start_body = start_res.into_body().collect().await.unwrap().to_bytes();
    let session: DrillSession = serde_json::from_slice(&start_body).unwrap();
    let session_id = session.id;

    // 3. Submit Intent answer while offline
    let intent_payload = SubmitIntentRequest {
        focus_lens: "bottleneck_tradeoff".to_string(),
        target_question: "What is the key trade-off with HTTP caching?".to_string(),
        user_synthesis: "Caching saves bandwidth and reduces latency, but introduces freshness control challenges.".to_string(),
        response_latency_seconds: Some(18),
    };
    let intent_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/submit-intent"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&intent_payload).unwrap()))
        .unwrap();

    let intent_res = app.clone().oneshot(intent_req).await.unwrap();
    assert_eq!(intent_res.status(), StatusCode::OK);
    let intent_body = intent_res.into_body().collect().await.unwrap().to_bytes();
    let intent_json: serde_json::Value = serde_json::from_slice(&intent_body).unwrap();

    // Verify evaluation status is offline_skipped, NOT failed
    assert_eq!(intent_json["evaluation"]["evaluation_status"], "offline_skipped");
    assert!(intent_json["evaluation"]["constructive_feedback"].as_str().unwrap().contains("offline"));
    assert_eq!(intent_json["intent"]["focus_lens"], "bottleneck_tradeoff");

    // 4. Submit 3-Sentence Debrief while offline
    let debrief_payload = SubmitDebriefRequest {
        core_premise: "HTTP coordinates distributed resource requests.".to_string(),
        pivot_or_surprise: "Caching introduces stale response risks requiring revalidation.".to_string(),
        implication: "Method idempotency dictates whether a response can be safely cached.".to_string(),
    };
    let debrief_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/submit-debrief"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&debrief_payload).unwrap()))
        .unwrap();

    let debrief_res = app.clone().oneshot(debrief_req).await.unwrap();
    assert_eq!(debrief_res.status(), StatusCode::OK);
    let debrief_body = debrief_res.into_body().collect().await.unwrap().to_bytes();
    let debrief_json: serde_json::Value = serde_json::from_slice(&debrief_body).unwrap();

    assert_eq!(debrief_json["evaluation"]["evaluation_status"], "offline_skipped");
    assert_eq!(debrief_json["debrief"]["core_premise"], "HTTP coordinates distributed resource requests.");

    // 5. Query session details and assert full preservation
    let details_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}"))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let details_res = app.oneshot(details_req).await.unwrap();
    assert_eq!(details_res.status(), StatusCode::OK);
    let details_body = details_res.into_body().collect().await.unwrap().to_bytes();
    let details: SessionDetailResponse = serde_json::from_slice(&details_body).unwrap();

    assert!(details.intent.is_some());
    assert!(details.debrief.is_some());
    assert_eq!(details.evaluations.len(), 2);
    for ev in details.evaluations {
        assert_eq!(ev.evaluation_status, "offline_skipped");
    }
}
