use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use focusreader_backend::{
    create_router,
    db::DbManager,
    models::{
        AdvanceStageRequest, AnalyticsProgressResponse, DrillSession, FinishReadingRequest,
        RecordDriftRequest, SessionDetailResponse, StartSessionRequest,
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
async fn test_start_session_validation() {
    let (app, _) = setup_app().await;

    // Invalid corpus ID
    let bad_req_body = StartSessionRequest {
        corpus_id: "nonexistent_corpus_id".to_string(),
        drill_type: Some("sequential_pipeline".to_string()),
    };

    let req = Request::builder()
        .uri("/api/sessions/start")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&bad_req_body).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    // Valid start
    let good_req_body = StartSessionRequest {
        corpus_id: "seed_cs_rfc9110".to_string(),
        drill_type: Some("sequential_pipeline".to_string()),
    };

    let req_good = Request::builder()
        .uri("/api/sessions/start")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&good_req_body).unwrap()))
        .unwrap();

    let res_good = app.oneshot(req_good).await.unwrap();
    assert_eq!(res_good.status(), StatusCode::CREATED);

    let body = res_good.into_body().collect().await.unwrap().to_bytes();
    let session: DrillSession = serde_json::from_slice(&body).unwrap();
    assert_eq!(session.corpus_id, "seed_cs_rfc9110");
    assert_eq!(session.current_stage, "preflight_intent");
    assert_eq!(session.status, "in_progress");
}

#[tokio::test]
async fn test_full_session_lifecycle_and_telemetry() {
    let (app, _) = setup_app().await;

    // 1. Start Session
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

    // 2. Advance to active_reading
    let adv_payload = AdvanceStageRequest {
        next_stage: Some("active_reading".to_string()),
    };
    let adv_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/advance"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&adv_payload).unwrap()))
        .unwrap();

    let adv_res = app.clone().oneshot(adv_req).await.unwrap();
    assert_eq!(adv_res.status(), StatusCode::OK);

    // 3. Record Drift Event 1
    let drift1_payload = RecordDriftRequest {
        elapsed_seconds: 12.5,
        line_number: Some(4),
    };
    let drift1_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/drift"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&drift1_payload).unwrap()))
        .unwrap();

    let drift1_res = app.clone().oneshot(drift1_req).await.unwrap();
    assert_eq!(drift1_res.status(), StatusCode::CREATED);

    // 4. Rate-limit check: Rapid drift within 0.05s must be debounced
    let drift_rapid = RecordDriftRequest {
        elapsed_seconds: 12.52,
        line_number: Some(4),
    };
    let drift_rapid_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/drift"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&drift_rapid).unwrap()))
        .unwrap();

    let drift_rapid_res = app.clone().oneshot(drift_rapid_req).await.unwrap();
    assert_eq!(drift_rapid_res.status(), StatusCode::BAD_REQUEST);

    // 5. Record Drift Event 2 (well after event 1)
    let drift2_payload = RecordDriftRequest {
        elapsed_seconds: 28.0,
        line_number: Some(9),
    };
    let drift2_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/drift"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&drift2_payload).unwrap()))
        .unwrap();

    let drift2_res = app.clone().oneshot(drift2_req).await.unwrap();
    assert_eq!(drift2_res.status(), StatusCode::CREATED);

    // 6. Finish Reading Phase: duration = 50 seconds
    let finish_payload = FinishReadingRequest {
        duration_seconds: 50,
    };
    let finish_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/finish-reading"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&finish_payload).unwrap()))
        .unwrap();

    let finish_res = app.clone().oneshot(finish_req).await.unwrap();
    assert_eq!(finish_res.status(), StatusCode::OK);
    let finish_body = finish_res.into_body().collect().await.unwrap().to_bytes();
    let finished_session: DrillSession = serde_json::from_slice(&finish_body).unwrap();
    assert_eq!(finished_session.duration_seconds, 50);
    assert!(finished_session.words_per_minute > 0.0);
    assert_eq!(finished_session.drift_count, 2);

    // 7. Advance through remaining stages to completed
    // active_reading -> intent_recall
    let to_intent_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/advance"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&AdvanceStageRequest { next_stage: None }).unwrap(),
        ))
        .unwrap();
    let to_intent_res = app.clone().oneshot(to_intent_req).await.unwrap();
    assert_eq!(to_intent_res.status(), StatusCode::OK);

    // intent_recall -> debrief
    let to_debrief_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/advance"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&AdvanceStageRequest { next_stage: None }).unwrap(),
        ))
        .unwrap();
    let to_debrief_res = app.clone().oneshot(to_debrief_req).await.unwrap();
    assert_eq!(to_debrief_res.status(), StatusCode::OK);

    // debrief -> completed
    let to_comp_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}/advance"))
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&AdvanceStageRequest { next_stage: None }).unwrap(),
        ))
        .unwrap();
    let to_comp_res = app.clone().oneshot(to_comp_req).await.unwrap();
    assert_eq!(to_comp_res.status(), StatusCode::OK);
    let comp_body = to_comp_res.into_body().collect().await.unwrap().to_bytes();
    let comp_session: DrillSession = serde_json::from_slice(&comp_body).unwrap();
    assert_eq!(comp_session.current_stage, "completed");
    assert_eq!(comp_session.status, "completed");

    // 8. Fetch session details
    let get_details_req = Request::builder()
        .uri(format!("/api/sessions/{session_id}"))
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let get_details_res = app.clone().oneshot(get_details_req).await.unwrap();
    assert_eq!(get_details_res.status(), StatusCode::OK);
    let details_body = get_details_res
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let details: SessionDetailResponse = serde_json::from_slice(&details_body).unwrap();
    assert_eq!(details.drift_events.len(), 2);
    // MTBD = 50 / 2 = 25.0
    assert_eq!(details.mean_time_between_drifts, 25.0);
    assert_eq!(details.passage.id, "seed_cs_rfc9110");

    // 9. Fetch progress analytics
    let analytics_req = Request::builder()
        .uri("/api/analytics/progress")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    let analytics_res = app.oneshot(analytics_req).await.unwrap();
    assert_eq!(analytics_res.status(), StatusCode::OK);
    let analytics_body = analytics_res
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let analytics: AnalyticsProgressResponse = serde_json::from_slice(&analytics_body).unwrap();
    assert!(analytics.total_sessions >= 1);
    assert_eq!(analytics.completed_sessions, 1);
    assert_eq!(analytics.average_mtbd, 25.0);
    assert!(analytics.average_wpm > 0.0);
}

#[tokio::test]
async fn test_abort_session() {
    let (app, _) = setup_app().await;

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
    let start_body = start_res.into_body().collect().await.unwrap().to_bytes();
    let session: DrillSession = serde_json::from_slice(&start_body).unwrap();

    let abort_req = Request::builder()
        .uri(format!("/api/sessions/{}/abort", session.id))
        .method("POST")
        .body(Body::empty())
        .unwrap();

    let abort_res = app.oneshot(abort_req).await.unwrap();
    assert_eq!(abort_res.status(), StatusCode::OK);
    let abort_body = abort_res.into_body().collect().await.unwrap().to_bytes();
    let aborted_session: DrillSession = serde_json::from_slice(&abort_body).unwrap();
    assert_eq!(aborted_session.status, "aborted");
    assert_eq!(aborted_session.current_stage, "aborted");
}
